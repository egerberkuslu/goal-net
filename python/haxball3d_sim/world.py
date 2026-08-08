"""Deterministic 2D pitch simulation, ported from packages/core/src/world.js.

This is a transcription, not a reimplementation. Section numbering, ordering
and even the early-outs follow the JS line for line, because the tick order is
load-bearing: timers, acceleration, tackle lunge, impulses, tackle hitbox,
curve, integrate, collide, hold pin, damp, decay, score, match rules. Moving
any of those past another changes the checksum.

State lives in one flat list of ints with exactly the JS layout (loaded from
layout.json, never retyped). A Python list rather than a numpy int32 array on
purpose: every value written here has already been saturated into int32 range
by an fx operation, so the wrapping that ``Int32Array`` does on store never
fires, and a plain list keeps every read a Python int with no risk of a silent
numpy overflow in an intermediate.

Vectorisation
    ``World(vectorised=True)`` runs the five stages whose per-player work is
    independent -- input acceleration, integration, wall clamping, the four
    posts and damping -- as numpy int64 array expressions instead of Python
    loops. Those stages read and write only the acting player's own slots, so
    evaluation order cannot matter, and the array expressions are the same
    integer program (see fx.v_* ). Everything else stays scalar because it is
    genuinely sequential:

      * the impulse stages (touch, kick, charged shot) all write the ONE ball,
        so player i's kick is seen by player i+1's reach test in the same tick
      * player-vs-player and player-vs-ball collisions resolve pairwise in a
        fixed order and each resolution feeds the next
      * the tackle hitbox pushes other players
      * catch, dive and the keeper's release mutate shared header words and
        break out of their loops on the first hit

    test_parity.py runs the full 3000-tick scenario in both modes and compares
    the complete checksum chains, so "does not change results" is proven per
    tick rather than asserted.
"""

from __future__ import annotations

import numpy as np

from . import fx
from .checksum import checksum_ints
from .layout import (
    BALL_BASE,
    BTN_CANCEL,
    BTN_CATCH,
    BTN_CHARGE,
    BTN_CLEAR,
    BTN_DIVE,
    BTN_KICK,
    BTN_MASK,
    BTN_TACKLE,
    BTN_THROW,
    BTN_TOUCH,
    C,
    CONSTANTS_HASH_INT,
    END_FULL_TIME,
    END_GOLDEN_GOAL,
    END_MERCY,
    END_NONE,
    END_SCORE_LIMIT,
    FLAG_DIVE_HELD,
    FLAG_TACKLE_HELD,
    FLAG_TOUCHING,
    HDR_AFTERTOUCH_OWNER,
    HDR_AFTERTOUCH_TICKS,
    HDR_BALL_CURVE,
    HDR_BALL_HOLDER,
    HDR_BALL_HOLD_TICKS,
    HDR_CONST_HASH,
    HDR_DURATION_TICKS,
    HDR_END_REASON,
    HDR_GRIEF_TEAM,
    HDR_GRIEF_TICKS,
    HDR_KICKOFF_TEAM,
    HDR_LAST_GOAL_TEAM,
    HDR_LAST_GOAL_TICK,
    HDR_MAGIC,
    HDR_MATCH_STATE,
    HDR_PITCH,
    HDR_PLAYER_COUNT,
    HDR_RULE_FLAGS,
    HDR_SCORE_0,
    HDR_SCORE_1,
    HDR_SCORE_LIMIT,
    HDR_SETTINGS_HASH,
    HDR_TICK,
    HDR_VERSION,
    MATCH_FINISHED,
    MATCH_GOLDEN_GOAL,
    MATCH_RUNNING,
    MERCY_GOAL_DIFF,
    PITCH_PRESETS,
    P_CHARGE,
    P_CHARGE_PWR,
    P_CHARGE_REL,
    P_CLEAR_CHARGE,
    P_DIVE_ACTIVE,
    P_DIVE_DIR,
    P_DIVE_LOCK,
    P_FLAGS,
    P_KICK_ARM,
    P_KICK_CD,
    P_PREV_BUTTONS,
    P_ROLE,
    P_TACKLE_ACTIVE,
    P_TACKLE_CD,
    P_TACKLE_RECOV,
    P_TEAM,
    P_TOUCH_CD,
    P_VX,
    P_VZ,
    P_X,
    P_Z,
    REACH,
    RULE_GOLDEN_GOAL,
    RULE_MERCY,
    STATE_MAGIC,
    STATE_VERSION,
    player_offset,
    state_length,
)
from .matchrules import (
    SettingsError,
    assert_same_settings,
    duration_ticks,
    end_reason_name,
    leader_of,
    match_phase_name,
    normalise_settings,
    pitch_code_of,
    settings_flags,
    settings_from,
    settings_hash_int,
)

FX_ONE = fx.FX_ONE


class World:
    """A state buffer plus its player count. The JS twin is ``{ buf, playerCount }``."""

    __slots__ = ("buf", "player_count", "vectorised")

    def __init__(self, buf, player_count: int, vectorised: bool = False):
        self.buf = buf
        self.player_count = player_count
        self.vectorised = vectorised

    def copy(self) -> "World":
        return World(list(self.buf), self.player_count, self.vectorised)


# ------------------------------------------------------------------ setup


def pitch_of(world) -> dict:
    """The arena a state was built on, read from the header every time."""
    buf = world.buf if isinstance(world, World) else world
    code = buf[HDR_PITCH]
    preset = PITCH_PRESETS[code] if 0 <= code < len(PITCH_PRESETS) else None
    if preset is None:
        raise SettingsError(
            "bad-pitch",
            f"state carries pitch preset {code}, which is not one of 1..3",
        )
    return preset


def _role_of(spec) -> int:
    if spec == 1 or spec is True:
        return 1
    if spec in ("keeper", "gk", "goalkeeper"):
        return 1
    return 0


def create_world(
    players=None,
    teams=None,
    roles=None,
    player_count=None,
    settings=None,
    strict_settings: bool = False,
    vectorised: bool = False,
) -> World:
    """Mirror of createWorld(config). ``players`` wins, then ``teams``, then count."""
    s = normalise_settings(settings, strict=strict_settings)
    if players is not None:
        team_list = [1 if (p and p.get("team")) else 0 for p in players]
        role_list = [_role_of(p.get("role") if p else None) for p in players]
    elif teams is not None:
        team_list = [1 if t else 0 for t in teams]
        role_list = [
            _role_of(roles[i]) if roles is not None and i < len(roles) else 0
            for i in range(len(team_list))
        ]
    else:
        n = 2 if player_count is None else int(player_count)
        team_list = [i % 2 for i in range(n)]
        role_list = [
            _role_of(roles[i]) if roles is not None and i < len(roles) else 0
            for i in range(n)
        ]

    if len(team_list) < 1 or len(team_list) > C["MAX_PLAYERS"]:
        raise ValueError(f"player count {len(team_list)} outside 1..{C['MAX_PLAYERS']}")
    if not s["keepers"]:
        role_list = [0] * len(role_list)

    buf = [0] * state_length(len(team_list))
    buf[HDR_MAGIC] = STATE_MAGIC
    buf[HDR_VERSION] = STATE_VERSION
    buf[HDR_CONST_HASH] = CONSTANTS_HASH_INT
    buf[HDR_TICK] = 0
    buf[HDR_PLAYER_COUNT] = len(team_list)
    buf[HDR_SCORE_0] = 0
    buf[HDR_SCORE_1] = 0
    buf[HDR_LAST_GOAL_TEAM] = -1
    buf[HDR_LAST_GOAL_TICK] = -1
    buf[HDR_KICKOFF_TEAM] = 0
    buf[HDR_PITCH] = pitch_code_of(s["pitch"])
    buf[HDR_SETTINGS_HASH] = settings_hash_int(s)
    buf[HDR_DURATION_TICKS] = duration_ticks(s)
    buf[HDR_SCORE_LIMIT] = s["scoreLimit"]
    buf[HDR_RULE_FLAGS] = settings_flags(s)
    buf[HDR_MATCH_STATE] = MATCH_RUNNING
    buf[HDR_END_REASON] = END_NONE

    for i, team in enumerate(team_list):
        buf[player_offset(i) + P_TEAM] = team
        buf[player_offset(i) + P_ROLE] = role_list[i]

    world = World(buf, len(team_list), vectorised)
    reset_kickoff(world)
    return world


def reset_kickoff(world: World) -> None:
    """Ball to the centre spot, players to their side, every timer to zero."""
    buf = world.buf
    P = pitch_of(buf)
    half_spawn_step = P["spawnXStep"] // 2  # spawnXStep is even on every preset
    if P["spawnXStep"] % 2 != 0:
        raise RuntimeError("layout: spawnXStep is odd; JS divides it by two exactly")
    buf[BALL_BASE] = 0
    buf[BALL_BASE + 1] = 0
    buf[BALL_BASE + 2] = 0
    buf[BALL_BASE + 3] = 0
    buf[HDR_BALL_HOLDER] = -1
    buf[HDR_BALL_HOLD_TICKS] = 0
    buf[HDR_BALL_CURVE] = 0
    buf[HDR_AFTERTOUCH_OWNER] = -1
    buf[HDR_AFTERTOUCH_TICKS] = 0
    buf[HDR_GRIEF_TEAM] = -1
    buf[HDR_GRIEF_TICKS] = 0

    seen = [0, 0]
    total = [0, 0]
    for i in range(world.player_count):
        total[buf[player_offset(i) + P_TEAM]] += 1
    for i in range(world.player_count):
        o = player_offset(i)
        team = buf[o + P_TEAM]
        slot = seen[team]
        seen[team] += 1
        n = total[team]
        buf[o + P_X] = (2 * slot - (n - 1)) * half_spawn_step
        buf[o + P_Z] = -P["spawnZ"] if team == 0 else P["spawnZ"]
        for slot_index in (
            P_VX,
            P_VZ,
            P_KICK_ARM,
            P_KICK_CD,
            P_PREV_BUTTONS,
            P_CHARGE,
            P_CHARGE_REL,
            P_CHARGE_PWR,
            P_TACKLE_ACTIVE,
            P_TACKLE_RECOV,
            P_TACKLE_CD,
            P_DIVE_ACTIVE,
            P_DIVE_LOCK,
            P_DIVE_DIR,
            P_CLEAR_CHARGE,
            P_FLAGS,
            P_TOUCH_CD,
        ):
            buf[o + slot_index] = 0
        # P_TEAM and P_ROLE survive a restart on purpose (ADR-0001).


# ------------------------------------------------------------------ input


def quantise_axis(v) -> int:
    if v is None or not isinstance(v, (int, float)) or isinstance(v, bool):
        return 0
    q = fx.js_round(float(v) * FX_ONE)
    if q > FX_ONE:
        q = FX_ONE
    if q < -FX_ONE:
        q = -FX_ONE
    return q


_BUTTON_KEYS = (
    ("kick", BTN_KICK),
    ("charge", BTN_CHARGE),
    ("chargeCancel", BTN_CANCEL),
    ("tackle", BTN_TACKLE),
    ("catchBall", BTN_CATCH),
    ("throwBall", BTN_THROW),
    ("clearBall", BTN_CLEAR),
    ("dive", BTN_DIVE),
    ("touch", BTN_TOUCH),
)


def quantise_input(inp) -> dict:
    """Normalise one player's input into {mx, mz, kick, buttons}."""
    if not inp:
        return {"mx": 0, "mz": 0, "kick": 0, "buttons": 0}
    if "moveXFx" in inp and inp["moveXFx"] is not None:
        mx = int(inp["moveXFx"])
    else:
        mx = quantise_axis(inp.get("moveX", 0))
    if "moveZFx" in inp and inp["moveZFx"] is not None:
        mz = int(inp["moveZFx"])
    else:
        mz = quantise_axis(inp.get("moveZ", 0))
    length = fx.hypot(mx, mz)
    if length > FX_ONE:
        mx = fx.div(mx, length)
        mz = fx.div(mz, length)
    buttons = int(inp.get("buttons", 0) or 0) & BTN_MASK
    for key, bit in _BUTTON_KEYS:
        if inp.get(key):
            buttons |= bit
    return {
        "mx": mx,
        "mz": mz,
        "kick": 1 if buttons & BTN_KICK else 0,
        "buttons": buttons,
    }


# ------------------------------------------------------------- collisions


def _resolve_discs(buf, ao, bo, ra, rb, ia, ib, bcoef) -> bool:
    """Elastic response between two discs. invMass 0 means immovable."""
    dx = fx.sub(buf[bo + P_X], buf[ao + P_X])
    dz = fx.sub(buf[bo + P_Z], buf[ao + P_Z])
    rsum = ra + rb
    dist = fx.hypot(dx, dz)
    if dist >= rsum:
        return False

    if dist == 0:
        nx = FX_ONE
        nz = 0
    else:
        nx = fx.div(dx, dist)
        nz = fx.div(dz, dist)

    isum = ia + ib
    if isum <= 0:
        return False

    overlap = rsum - dist
    sa = fx.mul(overlap, fx.div(ia, isum))
    sb = fx.mul(overlap, fx.div(ib, isum))
    buf[ao + P_X] = fx.sub(buf[ao + P_X], fx.mul(nx, sa))
    buf[ao + P_Z] = fx.sub(buf[ao + P_Z], fx.mul(nz, sa))
    buf[bo + P_X] = fx.add(buf[bo + P_X], fx.mul(nx, sb))
    buf[bo + P_Z] = fx.add(buf[bo + P_Z], fx.mul(nz, sb))

    rvx = fx.sub(buf[bo + P_VX], buf[ao + P_VX])
    rvz = fx.sub(buf[bo + P_VZ], buf[ao + P_VZ])
    vn = fx.add(fx.mul(rvx, nx), fx.mul(rvz, nz))
    if vn < 0:
        j = fx.div(fx.mul(fx.neg(fx.add(FX_ONE, bcoef)), vn), isum)
        ja = fx.mul(j, ia)
        jb = fx.mul(j, ib)
        buf[ao + P_VX] = fx.sub(buf[ao + P_VX], fx.mul(nx, ja))
        buf[ao + P_VZ] = fx.sub(buf[ao + P_VZ], fx.mul(nz, ja))
        buf[bo + P_VX] = fx.add(buf[bo + P_VX], fx.mul(nx, jb))
        buf[bo + P_VZ] = fx.add(buf[bo + P_VZ], fx.mul(nz, jb))
    return True


def _resolve_post(buf, o, r, inv_mass, bcoef, px, pz, pr) -> bool:
    """Disc against a static post centred at (px, pz)."""
    dx = fx.sub(px, buf[o + P_X])
    dz = fx.sub(pz, buf[o + P_Z])
    rsum = r + pr
    dist = fx.hypot(dx, dz)
    if dist >= rsum:
        return False
    if dist == 0:
        nx = FX_ONE
        nz = 0
    else:
        nx = fx.div(dx, dist)
        nz = fx.div(dz, dist)
    overlap = rsum - dist
    buf[o + P_X] = fx.sub(buf[o + P_X], fx.mul(nx, overlap))
    buf[o + P_Z] = fx.sub(buf[o + P_Z], fx.mul(nz, overlap))
    vn = fx.add(fx.mul(buf[o + P_VX], nx), fx.mul(buf[o + P_VZ], nz))
    if vn > 0:
        k = fx.mul(fx.add(FX_ONE, bcoef), vn)
        buf[o + P_VX] = fx.sub(buf[o + P_VX], fx.mul(nx, k))
        buf[o + P_VZ] = fx.sub(buf[o + P_VZ], fx.mul(nz, k))
    return True


def _resolve_wall(buf, o, r, ai, limit, bcoef) -> bool:
    """Keep a disc inside +/-limit on one axis. The velocity slot is ai + 2."""
    hi = limit - r
    p = buf[o + ai]
    if p > hi:
        buf[o + ai] = hi
        v = buf[o + ai + 2]
        if v > 0:
            buf[o + ai + 2] = fx.neg(fx.mul(v, bcoef))
        return True
    if p < -hi:
        buf[o + ai] = -hi
        v = buf[o + ai + 2]
        if v < 0:
            buf[o + ai + 2] = fx.neg(fx.mul(v, bcoef))
        return True
    return False


# ------------------------------------------------------------- geometry


def _ball_distance(buf, o) -> int:
    return fx.hypot(
        fx.sub(buf[BALL_BASE], buf[o + P_X]),
        fx.sub(buf[BALL_BASE + 1], buf[o + P_Z]),
    )


def _ball_direction(buf, o) -> tuple[int, int]:
    dx = fx.sub(buf[BALL_BASE], buf[o + P_X])
    dz = fx.sub(buf[BALL_BASE + 1], buf[o + P_Z])
    ux, uz, length = fx.normalize(dx, dz)
    if length == 0:
        return FX_ONE, 0
    return ux, uz


def _aim_direction(mx, mz, team) -> tuple[int, int]:
    """The movement stick if pushed, otherwise straight at the opponents' goal."""
    if mx != 0 or mz != 0:
        ux, uz, length = fx.normalize(mx, mz)
        if length != 0:
            return ux, uz
    return 0, (FX_ONE if team == 0 else -FX_ONE)


def in_penalty_area(x, z, team, pitch=None) -> bool:
    P = pitch if pitch is not None else PITCH_PRESETS[2]
    if fx.fabs(x) > P["penaltyHalfX"]:
        return False
    edge = P["halfZ"] - P["penaltyDepth"]
    return z <= -edge if team == 0 else z >= edge


def keeper_empowered(world: World, i: int, pitch=None) -> bool:
    P = pitch if pitch is not None else pitch_of(world)
    buf = world.buf
    o = player_offset(i)
    if buf[o + P_ROLE] != 1:
        return False
    return in_penalty_area(buf[o + P_X], buf[o + P_Z], buf[o + P_TEAM], P)


# ------------------------------------------------------------ close control


def control_advice(
    world: World, i: int, mx: int = 0, mz: int = 0, horizon: int = 1
) -> dict:
    buf = world.buf
    o = player_offset(i)
    gap = _ball_distance(buf, o)
    px = buf[o + P_X]
    pz = buf[o + P_Z]
    pvx = buf[o + P_VX]
    pvz = buf[o + P_VZ]
    bx = buf[BALL_BASE]
    bz = buf[BALL_BASE + 1]
    bvx = buf[BALL_BASE + 2]
    bvz = buf[BALL_BASE + 3]
    h = 1 if horizon < 1 else int(horizon)
    for _ in range(h):
        pvx = fx.add(pvx, fx.mul(mx, C["PLAYER_ACCEL"]))
        pvz = fx.add(pvz, fx.mul(mz, C["PLAYER_ACCEL"]))
        px = fx.add(px, pvx)
        pz = fx.add(pz, pvz)
        bx = fx.add(bx, bvx)
        bz = fx.add(bz, bvz)
        pvx = fx.mul(pvx, C["PLAYER_DAMPING"])
        pvz = fx.mul(pvz, C["PLAYER_DAMPING"])
        bvx = fx.mul(bvx, C["BALL_DAMPING"])
        bvz = fx.mul(bvz, C["BALL_DAMPING"])
    gap_next = fx.hypot(fx.sub(bx, px), fx.sub(bz, pz))
    return {"gap": gap, "gapNext": gap_next, "keep": gap_next <= C["CONTROL_RADIUS"]}


# ------------------------------------------------------------ shot charge


def charge_power(ticks: int) -> int:
    """power = 0.3 + 0.7 * t**1.5, as a Q16.16 multiplier on KICK_IMPULSE."""
    span = C["CHARGE_MAX_TICKS"] - C["CHARGE_MIN_TICKS"]
    held = int(ticks) - C["CHARGE_MIN_TICKS"]
    if held <= 0:
        return C["CHARGE_BASE"]
    if held > span:
        held = span
    t = fx.div(fx.from_int(held), fx.from_int(span))
    t15 = fx.mul(t, fx.sqrt(t))
    return fx.add(C["CHARGE_BASE"], fx.mul(C["CHARGE_SPAN"], t15))


def _clear_impulse(ticks: int) -> int:
    span = C["CLEAR_MAX_TICKS"]
    held = int(ticks)
    if held < 0:
        held = 0
    if held > span:
        held = span
    t = fx.div(fx.from_int(held), fx.from_int(span))
    t15 = fx.mul(t, fx.sqrt(t))
    return fx.add(
        C["CLEAR_MIN_IMPULSE"],
        fx.mul(C["CLEAR_MAX_IMPULSE"] - C["CLEAR_MIN_IMPULSE"], t15),
    )


# ------------------------------------------------- vectorised tick stages
#
# Each of these reproduces the scalar loop above it in world.js with numpy
# int64 array expressions. They touch only the acting player's own slots, so
# the loop order the JS uses is not observable and removing it is safe.


def _v_neg(a: np.ndarray) -> np.ndarray:
    return np.where(a == fx.FX_MIN, fx.FX_MAX, -a)


def _gather(buf, n, slot) -> np.ndarray:
    return np.fromiter(
        (buf[player_offset(i) + slot] for i in range(n)), dtype=np.int64, count=n
    )


def _scatter(buf, n, slot, values) -> None:
    for i in range(n):
        buf[player_offset(i) + slot] = int(values[i])


def _v_accelerate(buf, n, inp) -> None:
    """Section 2, vectorised."""
    ta = _gather(buf, n, P_TACKLE_ACTIVE)
    tr = _gather(buf, n, P_TACKLE_RECOV)
    dl = _gather(buf, n, P_DIVE_LOCK)
    live = (ta <= 0) & (tr <= 0) & (dl <= 0)
    mx = np.fromiter((p["mx"] for p in inp), dtype=np.int64, count=n)
    mz = np.fromiter((p["mz"] for p in inp), dtype=np.int64, count=n)
    kick = np.fromiter((p["kick"] for p in inp), dtype=np.int64, count=n)
    accel = np.where(kick != 0, C["PLAYER_KICKING_ACCEL"], C["PLAYER_ACCEL"])
    vx = _gather(buf, n, P_VX)
    vz = _gather(buf, n, P_VZ)
    vx = np.where(live & (mx != 0), fx.v_add(vx, fx.v_mul(mx, accel)), vx)
    vz = np.where(live & (mz != 0), fx.v_add(vz, fx.v_mul(mz, accel)), vz)
    _scatter(buf, n, P_VX, vx)
    _scatter(buf, n, P_VZ, vz)


def _v_integrate(buf, n) -> None:
    """Section 8, player half, vectorised."""
    _scatter(buf, n, P_X, fx.v_add(_gather(buf, n, P_X), _gather(buf, n, P_VX)))
    _scatter(buf, n, P_Z, fx.v_add(_gather(buf, n, P_Z), _gather(buf, n, P_VZ)))


def _v_damp(buf, n) -> None:
    """Section 12, player half, vectorised."""
    _scatter(buf, n, P_VX, fx.v_mul(_gather(buf, n, P_VX), C["PLAYER_DAMPING"]))
    _scatter(buf, n, P_VZ, fx.v_mul(_gather(buf, n, P_VZ), C["PLAYER_DAMPING"]))


def _v_wall_axis(buf, n, r, pos_slot, vel_slot, limit, bcoef) -> None:
    hi = limit - r
    p = _gather(buf, n, pos_slot)
    v = _gather(buf, n, vel_slot)
    over = p > hi
    under = p < -hi
    bounced = _v_neg(fx.v_mul(v, bcoef))
    new_p = np.where(over, hi, np.where(under, -hi, p))
    new_v = np.where(over & (v > 0), bounced, np.where(under & (v < 0), bounced, v))
    _scatter(buf, n, pos_slot, new_p)
    _scatter(buf, n, vel_slot, new_v)


def _v_walls(buf, n, P) -> None:
    """Section 9a, vectorised."""
    coef = fx.mul(C["PLAYER_BCOEF"], C["WALL_BCOEF"])
    _v_wall_axis(buf, n, C["PLAYER_RADIUS"], P_X, P_VX, P["halfX"], coef)
    _v_wall_axis(buf, n, C["PLAYER_RADIUS"], P_Z, P_VZ, P["halfZ"], coef)


def _v_posts(buf, n, px, pz, bcoef) -> None:
    """Section 9c, the player half of one post, vectorised."""
    r = C["PLAYER_RADIUS"]
    pr = C["POST_RADIUS"]
    x = _gather(buf, n, P_X)
    z = _gather(buf, n, P_Z)
    vx = _gather(buf, n, P_VX)
    vz = _gather(buf, n, P_VZ)
    dx = fx.v_sub(np.full(n, px, dtype=np.int64), x)
    dz = fx.v_sub(np.full(n, pz, dtype=np.int64), z)
    rsum = r + pr
    dist = fx.v_hypot(dx, dz)
    hit = dist < rsum
    if not hit.any():
        return
    zero = dist == 0
    nx = np.where(zero, FX_ONE, fx.v_div(dx, np.where(zero, 1, dist)))
    nz = np.where(zero, 0, fx.v_div(dz, np.where(zero, 1, dist)))
    overlap = rsum - dist
    new_x = fx.v_sub(x, fx.v_mul(nx, overlap))
    new_z = fx.v_sub(z, fx.v_mul(nz, overlap))
    vn = fx.v_add(fx.v_mul(vx, nx), fx.v_mul(vz, nz))
    k = fx.v_mul(np.full(n, fx.add(FX_ONE, bcoef), dtype=np.int64), vn)
    push = vn > 0
    new_vx = np.where(push, fx.v_sub(vx, fx.v_mul(nx, k)), vx)
    new_vz = np.where(push, fx.v_sub(vz, fx.v_mul(nz, k)), vz)
    _scatter(buf, n, P_X, np.where(hit, new_x, x))
    _scatter(buf, n, P_Z, np.where(hit, new_z, z))
    _scatter(buf, n, P_VX, np.where(hit, new_vx, vx))
    _scatter(buf, n, P_VZ, np.where(hit, new_vz, vz))


# ------------------------------------------------------------------- step


def step(world: World, inputs=None) -> list:
    """Advance one 60 Hz tick and return the events it produced."""
    buf = world.buf
    n = world.player_count
    events: list = []
    tick = buf[HDR_TICK]
    P = pitch_of(buf)
    vec = world.vectorised

    if buf[HDR_MATCH_STATE] == MATCH_FINISHED:
        buf[HDR_TICK] = tick + 1
        return events

    touched = [0] * n
    inp = [
        quantise_input(inputs[i] if inputs and i < len(inputs) else None)
        for i in range(n)
    ]

    holder = buf[HDR_BALL_HOLDER]
    held = holder >= 0

    # 1) timers, button edges and the charge accumulators ---------------------
    for i in range(n):
        o = player_offset(i)
        b = inp[i]["buttons"]
        prev = buf[o + P_PREV_BUTTONS]
        pressed = b & ~prev
        released = prev & ~b

        if buf[o + P_TACKLE_CD] > 0:
            buf[o + P_TACKLE_CD] -= 1
        if buf[o + P_TOUCH_CD] > 0:
            buf[o + P_TOUCH_CD] -= 1
        if buf[o + P_DIVE_LOCK] > 0:
            buf[o + P_DIVE_LOCK] -= 1
        if buf[o + P_TACKLE_RECOV] > 0:
            buf[o + P_TACKLE_RECOV] -= 1

        if b & BTN_CANCEL:
            if buf[o + P_CHARGE] > 0 or buf[o + P_CHARGE_REL] > 0:
                events.append({"type": "charge-cancel", "player": i, "tick": tick})
            buf[o + P_CHARGE] = 0
            buf[o + P_CHARGE_REL] = 0
            buf[o + P_CHARGE_PWR] = 0
            buf[o + P_CLEAR_CHARGE] = 0
        else:
            if b & BTN_CHARGE:
                if buf[o + P_CHARGE] < C["CHARGE_MAX_TICKS"]:
                    buf[o + P_CHARGE] += 1
            elif (released & BTN_CHARGE) and buf[o + P_CHARGE] > 0:
                buf[o + P_CHARGE_PWR] = charge_power(buf[o + P_CHARGE])
                buf[o + P_CHARGE_REL] = C["CHARGE_BUFFER_TICKS"]
                buf[o + P_CHARGE] = 0
            if b & BTN_CLEAR:
                if buf[o + P_CLEAR_CHARGE] < C["CLEAR_MAX_TICKS"]:
                    buf[o + P_CLEAR_CHARGE] += 1
            elif holder != i:
                buf[o + P_CLEAR_CHARGE] = 0

        if (pressed & BTN_KICK) and buf[o + P_KICK_CD] == 0:
            buf[o + P_KICK_ARM] = C["KICK_LATCH_TICKS"]
        buf[o + P_PREV_BUTTONS] = b

    # 2) acceleration from input, unless committed or grounded ----------------
    if vec:
        _v_accelerate(buf, n, inp)
    else:
        for i in range(n):
            o = player_offset(i)
            if buf[o + P_TACKLE_ACTIVE] > 0:
                continue
            if buf[o + P_TACKLE_RECOV] > 0:
                continue
            if buf[o + P_DIVE_LOCK] > 0:
                continue
            mx = inp[i]["mx"]
            mz = inp[i]["mz"]
            accel = C["PLAYER_KICKING_ACCEL"] if inp[i]["kick"] else C["PLAYER_ACCEL"]
            if mx != 0:
                buf[o + P_VX] = fx.add(buf[o + P_VX], fx.mul(mx, accel))
            if mz != 0:
                buf[o + P_VZ] = fx.add(buf[o + P_VZ], fx.mul(mz, accel))

    # 3) slide tackle: start the lunge ---------------------------------------
    for i in range(n):
        o = player_offset(i)
        b = inp[i]["buttons"]
        startable = (
            buf[o + P_TACKLE_ACTIVE] == 0
            and buf[o + P_TACKLE_RECOV] == 0
            and buf[o + P_TACKLE_CD] == 0
            and buf[o + P_DIVE_LOCK] == 0
            and holder != i
        )
        if (b & BTN_TACKLE) == 0:
            buf[o + P_FLAGS] &= ~FLAG_TACKLE_HELD
            continue
        fresh = (buf[o + P_FLAGS] & FLAG_TACKLE_HELD) == 0
        buf[o + P_FLAGS] |= FLAG_TACKLE_HELD
        if fresh and startable:
            buf[o + P_TACKLE_ACTIVE] = C["TACKLE_ACTIVE_TICKS"]
            ax, az = _aim_direction(inp[i]["mx"], inp[i]["mz"], buf[o + P_TEAM])
            buf[o + P_VX] = fx.add(buf[o + P_VX], fx.mul(ax, C["TACKLE_IMPULSE"]))
            buf[o + P_VZ] = fx.add(buf[o + P_VZ], fx.mul(az, C["TACKLE_IMPULSE"]))
            events.append({"type": "tackle-start", "player": i, "tick": tick})

    # 4) keeper: dive start ---------------------------------------------------
    for i in range(n):
        o = player_offset(i)
        b = inp[i]["buttons"]
        if (b & BTN_DIVE) == 0:
            buf[o + P_FLAGS] &= ~FLAG_DIVE_HELD
            continue
        if buf[o + P_FLAGS] & FLAG_DIVE_HELD:
            continue
        buf[o + P_FLAGS] |= FLAG_DIVE_HELD
        if not keeper_empowered(world, i, P):
            continue
        if buf[o + P_DIVE_ACTIVE] > 0 or buf[o + P_DIVE_LOCK] > 0:
            continue
        if holder == i:
            continue
        mx = inp[i]["mx"]
        mz = inp[i]["mz"]
        if fx.fabs(mx) >= fx.fabs(mz):
            d = 0 if mx < 0 else 1
        else:
            d = 2 if mz < 0 else 3
        dvx = -FX_ONE if d == 0 else (FX_ONE if d == 1 else 0)
        dvz = -FX_ONE if d == 2 else (FX_ONE if d == 3 else 0)
        buf[o + P_DIVE_DIR] = d
        buf[o + P_DIVE_ACTIVE] = C["DIVE_ACTIVE_TICKS"]
        buf[o + P_VX] = fx.add(buf[o + P_VX], fx.mul(dvx, C["DIVE_IMPULSE"]))
        buf[o + P_VZ] = fx.add(buf[o + P_VZ], fx.mul(dvz, C["DIVE_IMPULSE"]))
        events.append({"type": "dive-start", "player": i, "dir": d, "tick": tick})

    # 5a) the keeper holding the ball decides how it leaves his hands ---------
    if held:
        o = player_offset(holder)
        b = inp[holder]["buttons"]
        released_clear = (b & BTN_CLEAR) == 0 and buf[o + P_CLEAR_CHARGE] > 0
        kind = None
        impulse = 0
        if b & BTN_THROW:
            kind = "throw"
            impulse = C["THROW_IMPULSE"]
        elif released_clear:
            kind = "clear"
            impulse = _clear_impulse(buf[o + P_CLEAR_CHARGE])
        elif buf[HDR_BALL_HOLD_TICKS] <= 1:
            kind = "forced"
            impulse = C["THROW_IMPULSE"]
        if kind:
            ax, az = _aim_direction(
                inp[holder]["mx"], inp[holder]["mz"], buf[o + P_TEAM]
            )
            buf[BALL_BASE] = fx.add(buf[o + P_X], fx.mul(ax, C["HOLD_OFFSET"]))
            buf[BALL_BASE + 1] = fx.add(buf[o + P_Z], fx.mul(az, C["HOLD_OFFSET"]))
            buf[BALL_BASE + 2] = fx.add(buf[o + P_VX], fx.mul(ax, impulse))
            buf[BALL_BASE + 3] = fx.add(buf[o + P_VZ], fx.mul(az, impulse))
            buf[HDR_BALL_HOLDER] = -1
            buf[HDR_BALL_HOLD_TICKS] = 0
            buf[o + P_CLEAR_CHARGE] = 0
            buf[HDR_BALL_CURVE] = 0
            if kind == "clear":
                buf[HDR_AFTERTOUCH_OWNER] = holder
                buf[HDR_AFTERTOUCH_TICKS] = C["AFTERTOUCH_TICKS"]
            else:
                buf[HDR_AFTERTOUCH_OWNER] = -1
                buf[HDR_AFTERTOUCH_TICKS] = 0
            buf[HDR_GRIEF_TEAM] = buf[o + P_TEAM]
            buf[HDR_GRIEF_TICKS] = C["GRIEF_LOCK_TICKS"]
            touched[holder] = 1
            events.append(
                {"type": "keeper-release", "player": holder, "kind": kind, "tick": tick}
            )
            events.append(
                {"type": "touch", "player": holder, "kind": kind, "tick": tick}
            )
        else:
            buf[HDR_BALL_HOLD_TICKS] -= 1

    still_held = buf[HDR_BALL_HOLDER] >= 0

    # 5b) close-control touch -------------------------------------------------
    for i in range(n):
        o = player_offset(i)
        if (inp[i]["buttons"] & BTN_TOUCH) == 0:
            continue
        if still_held or buf[o + P_TOUCH_CD] > 0:
            continue
        dist = _ball_distance(buf, o)
        if fx.sub(dist, REACH) >= C["KICK_RANGE"]:
            continue
        dx, dz = _ball_direction(buf, o)
        buf[BALL_BASE + 2] = fx.add(buf[BALL_BASE + 2], fx.mul(dx, C["TOUCH_IMPULSE"]))
        buf[BALL_BASE + 3] = fx.add(buf[BALL_BASE + 3], fx.mul(dz, C["TOUCH_IMPULSE"]))
        buf[o + P_TOUCH_CD] = C["TOUCH_COOLDOWN_TICKS"]
        buf[HDR_BALL_CURVE] = 0
        touched[i] = 1
        events.append({"type": "touch", "player": i, "kind": "control", "tick": tick})

    # 5c) plain kick ----------------------------------------------------------
    for i in range(n):
        o = player_offset(i)
        if buf[o + P_KICK_CD] > 0:
            buf[o + P_KICK_CD] -= 1
        if buf[o + P_KICK_ARM] <= 0:
            continue
        if still_held or buf[o + P_KICK_CD] > 0:
            buf[o + P_KICK_ARM] -= 1
            continue
        dist = _ball_distance(buf, o)
        if fx.sub(dist, REACH) < C["KICK_RANGE"]:
            dx, dz = _ball_direction(buf, o)
            buf[BALL_BASE + 2] = fx.add(
                buf[BALL_BASE + 2], fx.mul(dx, C["KICK_IMPULSE"])
            )
            buf[BALL_BASE + 3] = fx.add(
                buf[BALL_BASE + 3], fx.mul(dz, C["KICK_IMPULSE"])
            )
            buf[o + P_KICK_ARM] = 0
            buf[o + P_KICK_CD] = C["KICK_COOLDOWN_TICKS"]
            buf[HDR_BALL_CURVE] = 0
            buf[HDR_AFTERTOUCH_OWNER] = -1
            buf[HDR_AFTERTOUCH_TICKS] = 0
            touched[i] = 1
            events.append({"type": "kick", "player": i, "tick": tick})
            events.append({"type": "touch", "player": i, "kind": "kick", "tick": tick})
        else:
            buf[o + P_KICK_ARM] -= 1

    # 5d) charged shot --------------------------------------------------------
    for i in range(n):
        o = player_offset(i)
        if buf[o + P_CHARGE_REL] <= 0:
            continue
        if still_held or buf[o + P_KICK_CD] > 0:
            buf[o + P_CHARGE_REL] -= 1
            continue
        dist = _ball_distance(buf, o)
        if fx.sub(dist, REACH) < C["KICK_RANGE"]:
            power = buf[o + P_CHARGE_PWR]
            impulse = fx.mul(power, C["KICK_IMPULSE"])
            dx, dz = _ball_direction(buf, o)
            buf[BALL_BASE + 2] = fx.add(buf[BALL_BASE + 2], fx.mul(dx, impulse))
            buf[BALL_BASE + 3] = fx.add(buf[BALL_BASE + 3], fx.mul(dz, impulse))
            buf[o + P_CHARGE_REL] = 0
            buf[o + P_CHARGE_PWR] = 0
            buf[o + P_KICK_CD] = C["KICK_COOLDOWN_TICKS"]
            buf[HDR_BALL_CURVE] = 0
            buf[HDR_AFTERTOUCH_OWNER] = i
            buf[HDR_AFTERTOUCH_TICKS] = C["AFTERTOUCH_TICKS"]
            touched[i] = 1
            events.append(
                {
                    "type": "shot",
                    "player": i,
                    "power": power,
                    "impulse": impulse,
                    "tick": tick,
                }
            )
            events.append({"type": "touch", "player": i, "kind": "shot", "tick": tick})
        else:
            buf[o + P_CHARGE_REL] -= 1

    # 6) slide tackle: the widened hitbox ------------------------------------
    for i in range(n):
        o = player_offset(i)
        if buf[o + P_TACKLE_ACTIVE] <= 0:
            continue
        buf[o + P_TACKLE_ACTIVE] -= 1
        done = False

        if not still_held:
            dist = _ball_distance(buf, o)
            if dist <= REACH + C["TACKLE_REACH"]:
                dx, dz = _ball_direction(buf, o)
                buf[BALL_BASE + 2] = fx.add(
                    fx.mul(buf[BALL_BASE + 2], C["TACKLE_BALL_DAMP"]),
                    fx.mul(dx, C["TACKLE_POKE"]),
                )
                buf[BALL_BASE + 3] = fx.add(
                    fx.mul(buf[BALL_BASE + 3], C["TACKLE_BALL_DAMP"]),
                    fx.mul(dz, C["TACKLE_POKE"]),
                )
                buf[HDR_BALL_CURVE] = 0
                buf[HDR_AFTERTOUCH_OWNER] = -1
                buf[HDR_AFTERTOUCH_TICKS] = 0
                touched[i] = 1
                events.append(
                    {"type": "tackle", "player": i, "won": True, "tick": tick}
                )
                events.append(
                    {"type": "touch", "player": i, "kind": "tackle", "tick": tick}
                )
                done = True

        if not done:
            for j in range(n):
                if done:
                    break
                if j == i:
                    continue
                oj = player_offset(j)
                if buf[oj + P_TEAM] == buf[o + P_TEAM]:
                    continue
                d = fx.hypot(
                    fx.sub(buf[oj + P_X], buf[o + P_X]),
                    fx.sub(buf[oj + P_Z], buf[o + P_Z]),
                )
                if d > C["PLAYER_RADIUS"] + C["TACKLE_REACH"] + C["PLAYER_RADIUS"]:
                    continue
                kx = fx.sub(buf[oj + P_X], buf[o + P_X])
                kz = fx.sub(buf[oj + P_Z], buf[o + P_Z])
                ux, uz, length = fx.normalize(kx, kz)
                if length == 0:
                    ux, uz = FX_ONE, 0
                buf[oj + P_VX] = fx.add(buf[oj + P_VX], fx.mul(ux, C["TACKLE_KNOCK"]))
                buf[oj + P_VZ] = fx.add(buf[oj + P_VZ], fx.mul(uz, C["TACKLE_KNOCK"]))
                events.append(
                    {
                        "type": "tackle",
                        "player": i,
                        "victim": j,
                        "won": False,
                        "tick": tick,
                    }
                )
                done = True

        if done:
            buf[o + P_TACKLE_ACTIVE] = 0
        if buf[o + P_TACKLE_ACTIVE] == 0:
            buf[o + P_TACKLE_RECOV] = C["TACKLE_RECOVERY_TICKS"]
            buf[o + P_TACKLE_CD] = C["TACKLE_COOLDOWN_TICKS"]

    # 7) curve ----------------------------------------------------------------
    if not still_held:
        at = buf[HDR_AFTERTOUCH_OWNER]
        if 0 <= at < n and buf[HDR_AFTERTOUCH_TICKS] > 0:
            vx = buf[BALL_BASE + 2]
            vz = buf[BALL_BASE + 3]
            ux, uz, length = fx.normalize(vx, vz)
            if length != 0:
                mx = inp[at]["mx"]
                mz = inp[at]["mz"]
                lateral = fx.sub(fx.mul(ux, mz), fx.mul(uz, mx))
                curve = fx.add(
                    buf[HDR_BALL_CURVE], fx.mul(lateral, C["AFTERTOUCH_GAIN"])
                )
                if curve > C["CURVE_MAX"]:
                    curve = C["CURVE_MAX"]
                if curve < -C["CURVE_MAX"]:
                    curve = -C["CURVE_MAX"]
                buf[HDR_BALL_CURVE] = curve
            buf[HDR_AFTERTOUCH_TICKS] -= 1
            if buf[HDR_AFTERTOUCH_TICKS] == 0:
                buf[HDR_AFTERTOUCH_OWNER] = -1
        curve = buf[HDR_BALL_CURVE]
        if curve != 0:
            vx = buf[BALL_BASE + 2]
            vz = buf[BALL_BASE + 3]
            k = fx.mul(C["CURVE_ACCEL"], curve)
            buf[BALL_BASE + 2] = fx.add(vx, fx.mul(fx.neg(vz), k))
            buf[BALL_BASE + 3] = fx.add(vz, fx.mul(vx, k))

    # 8) integrate ------------------------------------------------------------
    if vec:
        _v_integrate(buf, n)
    else:
        for i in range(n):
            o = player_offset(i)
            buf[o + P_X] = fx.add(buf[o + P_X], buf[o + P_VX])
            buf[o + P_Z] = fx.add(buf[o + P_Z], buf[o + P_VZ])
    if not still_held:
        buf[BALL_BASE] = fx.add(buf[BALL_BASE], buf[BALL_BASE + 2])
        buf[BALL_BASE + 1] = fx.add(buf[BALL_BASE + 1], buf[BALL_BASE + 3])

    # 9) collisions, in a fixed order -----------------------------------------
    player_wall_coef = fx.mul(C["PLAYER_BCOEF"], C["WALL_BCOEF"])
    ball_wall_coef = fx.mul(C["BALL_BCOEF"], C["WALL_BCOEF"])
    player_post_coef = fx.mul(C["PLAYER_BCOEF"], C["POST_BCOEF"])
    ball_post_coef = fx.mul(C["BALL_BCOEF"], C["POST_BCOEF"])
    player_player_coef = fx.mul(C["PLAYER_BCOEF"], C["PLAYER_BCOEF"])
    player_ball_coef = fx.mul(C["PLAYER_BCOEF"], C["BALL_BCOEF"])

    # 9a) players stay inside the rectangle
    if vec:
        _v_walls(buf, n, P)
    else:
        for i in range(n):
            o = player_offset(i)
            _resolve_wall(buf, o, C["PLAYER_RADIUS"], P_X, P["halfX"], player_wall_coef)
            _resolve_wall(buf, o, C["PLAYER_RADIUS"], P_Z, P["halfZ"], player_wall_coef)

    if not still_held:
        # 9b) ball: side walls always, goal lines only outside the mouth
        _resolve_wall(buf, BALL_BASE, C["BALL_RADIUS"], P_X, P["halfX"], ball_wall_coef)
        if fx.fabs(buf[BALL_BASE]) >= P["goalHalfX"]:
            _resolve_wall(
                buf, BALL_BASE, C["BALL_RADIUS"], P_Z, P["halfZ"], ball_wall_coef
            )

    # 9c) the four posts
    for s in range(4):
        px = P["goalHalfX"] if s & 1 else -P["goalHalfX"]
        pz = P["halfZ"] if s & 2 else -P["halfZ"]
        if vec:
            _v_posts(buf, n, px, pz, player_post_coef)
        else:
            for i in range(n):
                _resolve_post(
                    buf,
                    player_offset(i),
                    C["PLAYER_RADIUS"],
                    C["PLAYER_INV_MASS"],
                    player_post_coef,
                    px,
                    pz,
                    C["POST_RADIUS"],
                )
        if not still_held:
            _resolve_post(
                buf,
                BALL_BASE,
                C["BALL_RADIUS"],
                C["BALL_INV_MASS"],
                ball_post_coef,
                px,
                pz,
                C["POST_RADIUS"],
            )

    # 9d) player vs player
    for i in range(n):
        for j in range(i + 1, n):
            _resolve_discs(
                buf,
                player_offset(i),
                player_offset(j),
                C["PLAYER_RADIUS"],
                C["PLAYER_RADIUS"],
                C["PLAYER_INV_MASS"],
                C["PLAYER_INV_MASS"],
                player_player_coef,
            )

    # 9e) player vs ball
    for i in range(n):
        o = player_offset(i)
        contact = False
        if not still_held:
            contact = _resolve_discs(
                buf,
                o,
                BALL_BASE,
                C["PLAYER_RADIUS"],
                C["BALL_RADIUS"],
                C["PLAYER_INV_MASS"],
                C["BALL_INV_MASS"],
                player_ball_coef,
            )
        was = (buf[o + P_FLAGS] & FLAG_TOUCHING) != 0
        if contact:
            buf[o + P_FLAGS] |= FLAG_TOUCHING
            if not was and not touched[i]:
                touched[i] = 1
                events.append(
                    {"type": "touch", "player": i, "kind": "contact", "tick": tick}
                )
            buf[HDR_BALL_CURVE] = 0
            if buf[HDR_AFTERTOUCH_OWNER] != i:
                buf[HDR_AFTERTOUCH_OWNER] = -1
                buf[HDR_AFTERTOUCH_TICKS] = 0
            if buf[HDR_GRIEF_TEAM] >= 0 and buf[o + P_TEAM] != buf[HDR_GRIEF_TEAM]:
                buf[HDR_GRIEF_TEAM] = -1
                buf[HDR_GRIEF_TICKS] = 0
        else:
            buf[o + P_FLAGS] &= ~FLAG_TOUCHING

    # 10) keeper: dive resolution, then catch --------------------------------
    for i in range(n):
        o = player_offset(i)
        if buf[o + P_DIVE_ACTIVE] <= 0:
            continue
        buf[o + P_DIVE_ACTIVE] -= 1
        if buf[HDR_BALL_HOLDER] >= 0:
            continue
        dist = _ball_distance(buf, o)
        if dist <= REACH + C["DIVE_REACH"]:
            buf[BALL_BASE + 2] = fx.mul(buf[BALL_BASE + 2], C["DIVE_SAVE_DAMP"])
            buf[BALL_BASE + 3] = fx.mul(buf[BALL_BASE + 3], C["DIVE_SAVE_DAMP"])
            buf[HDR_BALL_CURVE] = 0
            buf[o + P_DIVE_ACTIVE] = 0
            if not touched[i]:
                touched[i] = 1
                events.append(
                    {"type": "touch", "player": i, "kind": "save", "tick": tick}
                )
            events.append({"type": "keeper-save", "player": i, "tick": tick})
        elif buf[o + P_DIVE_ACTIVE] == 0:
            buf[o + P_DIVE_LOCK] = C["DIVE_WHIFF_LOCK_TICKS"]
            events.append({"type": "keeper-whiff", "player": i, "tick": tick})

    if buf[HDR_BALL_HOLDER] < 0:
        for i in range(n):
            o = player_offset(i)
            if (inp[i]["buttons"] & BTN_CATCH) == 0:
                continue
            if not keeper_empowered(world, i, P):
                continue
            if _ball_distance(buf, o) > REACH + C["CATCH_REACH"]:
                continue
            buf[HDR_BALL_HOLDER] = i
            buf[HDR_BALL_HOLD_TICKS] = C["CATCH_HOLD_TICKS"]
            buf[HDR_BALL_CURVE] = 0
            buf[HDR_AFTERTOUCH_OWNER] = -1
            buf[HDR_AFTERTOUCH_TICKS] = 0
            buf[o + P_DIVE_ACTIVE] = 0
            if not touched[i]:
                touched[i] = 1
                events.append(
                    {"type": "touch", "player": i, "kind": "catch", "tick": tick}
                )
            events.append({"type": "keeper-catch", "player": i, "tick": tick})
            break  # lowest index wins a simultaneous grab, deterministically

    # 11) a held ball rides with its keeper -----------------------------------
    now_holder = buf[HDR_BALL_HOLDER]
    if now_holder >= 0:
        o = player_offset(now_holder)
        ax, az = _aim_direction(0, 0, buf[o + P_TEAM])
        buf[BALL_BASE] = fx.add(buf[o + P_X], fx.mul(ax, C["HOLD_OFFSET"]))
        buf[BALL_BASE + 1] = fx.add(buf[o + P_Z], fx.mul(az, C["HOLD_OFFSET"]))
        buf[BALL_BASE + 2] = buf[o + P_VX]
        buf[BALL_BASE + 3] = buf[o + P_VZ]

    # 12) damping -------------------------------------------------------------
    if vec:
        _v_damp(buf, n)
    else:
        for i in range(n):
            o = player_offset(i)
            buf[o + P_VX] = fx.mul(buf[o + P_VX], C["PLAYER_DAMPING"])
            buf[o + P_VZ] = fx.mul(buf[o + P_VZ], C["PLAYER_DAMPING"])
    if now_holder < 0:
        buf[BALL_BASE + 2] = fx.mul(buf[BALL_BASE + 2], C["BALL_DAMPING"])
        buf[BALL_BASE + 3] = fx.mul(buf[BALL_BASE + 3], C["BALL_DAMPING"])
        if buf[HDR_BALL_CURVE] != 0:
            buf[HDR_BALL_CURVE] = fx.mul(buf[HDR_BALL_CURVE], C["CURVE_DAMPING"])
    if buf[HDR_GRIEF_TICKS] > 0:
        buf[HDR_GRIEF_TICKS] -= 1
        if buf[HDR_GRIEF_TICKS] == 0:
            buf[HDR_GRIEF_TEAM] = -1

    # 13) goals ---------------------------------------------------------------
    scored = False
    bz = buf[BALL_BASE + 1]
    line = P["halfZ"] + C["BALL_RADIUS"]
    if fx.fabs(buf[BALL_BASE]) < P["goalHalfX"] and (bz > line or bz < -line):
        scorer = 0 if bz > 0 else 1
        conceding = 1 if scorer == 0 else 0
        if buf[HDR_GRIEF_TEAM] == conceding and buf[HDR_GRIEF_TICKS] > 0:
            gk = _find_keeper(world, conceding)
            o = player_offset(gk if gk >= 0 else 0)
            buf[HDR_BALL_HOLDER] = gk if gk >= 0 else -1
            buf[HDR_BALL_HOLD_TICKS] = C["CATCH_HOLD_TICKS"] if gk >= 0 else 0
            ax, az = _aim_direction(0, 0, buf[o + P_TEAM])
            buf[BALL_BASE] = fx.add(buf[o + P_X], fx.mul(ax, C["HOLD_OFFSET"]))
            buf[BALL_BASE + 1] = fx.add(buf[o + P_Z], fx.mul(az, C["HOLD_OFFSET"]))
            buf[BALL_BASE + 2] = 0
            buf[BALL_BASE + 3] = 0
            buf[HDR_BALL_CURVE] = 0
            buf[HDR_GRIEF_TEAM] = -1
            buf[HDR_GRIEF_TICKS] = 0
            events.append({"type": "grief-void", "team": conceding, "tick": tick})
        else:
            if scorer == 0:
                buf[HDR_SCORE_0] += 1
            else:
                buf[HDR_SCORE_1] += 1
            buf[HDR_LAST_GOAL_TEAM] = scorer
            buf[HDR_LAST_GOAL_TICK] = tick
            buf[HDR_KICKOFF_TEAM] = conceding
            events.append({"type": "goal", "team": scorer, "tick": tick})
            scored = True
            reset_kickoff(world)

    # 13b) match rules --------------------------------------------------------
    s0 = buf[HDR_SCORE_0]
    s1 = buf[HDR_SCORE_1]
    diff = s0 - s1
    gap = -diff if diff < 0 else diff
    flags = buf[HDR_RULE_FLAGS]
    limit = buf[HDR_SCORE_LIMIT]
    reason = END_NONE

    if scored:
        if (flags & RULE_MERCY) and gap >= MERCY_GOAL_DIFF:
            reason = END_MERCY
        elif buf[HDR_MATCH_STATE] == MATCH_GOLDEN_GOAL:
            reason = END_GOLDEN_GOAL
        elif limit > 0 and (s0 >= limit or s1 >= limit):
            reason = END_SCORE_LIMIT

    dur = buf[HDR_DURATION_TICKS]
    if (
        reason == END_NONE
        and dur > 0
        and tick + 1 >= dur
        and buf[HDR_MATCH_STATE] == MATCH_RUNNING
    ):
        if diff != 0 or (flags & RULE_GOLDEN_GOAL) == 0:
            reason = END_FULL_TIME
        else:
            buf[HDR_MATCH_STATE] = MATCH_GOLDEN_GOAL
            events.append({"type": "golden-goal", "score": [s0, s1], "tick": tick})

    if reason != END_NONE:
        buf[HDR_MATCH_STATE] = MATCH_FINISHED
        buf[HDR_END_REASON] = reason
        events.append(
            {
                "type": "match-end",
                "reason": end_reason_name(reason),
                "winner": leader_of(s0, s1),
                "score": [s0, s1],
                "tick": tick,
            }
        )

    # 14) advance the clock ---------------------------------------------------
    buf[HDR_TICK] = tick + 1
    return events


def _find_keeper(world: World, team: int) -> int:
    """Lowest-index keeper on a team, or -1. Deterministic tie-break (ADR-0001)."""
    buf = world.buf
    for i in range(world.player_count):
        o = player_offset(i)
        if buf[o + P_ROLE] == 1 and buf[o + P_TEAM] == team:
            return i
    return -1


# ------------------------------------------------------------- inspection


def checksum(world: World) -> str:
    """Per-tick 32-bit hex digest of the whole state buffer."""
    return checksum_ints(world.buf)


def serialize(world: World) -> np.ndarray:
    return np.array(world.buf, dtype=np.int32)


def world_settings(world):
    buf = world.buf if isinstance(world, World) else world
    return settings_from(
        buf[HDR_DURATION_TICKS],
        buf[HDR_SCORE_LIMIT],
        buf[HDR_PITCH],
        buf[HDR_RULE_FLAGS],
    )


def deserialize(snapshot, expect_settings=None, vectorised: bool = False) -> World:
    """Rebuild a world from a snapshot, rejecting anything that will not match."""
    buf = [int(v) for v in snapshot]
    if buf[HDR_MAGIC] != STATE_MAGIC:
        raise ValueError("core: bad state magic")
    if buf[HDR_VERSION] != STATE_VERSION:
        raise ValueError(f"core: state version {buf[HDR_VERSION]} != {STATE_VERSION}")
    if buf[HDR_CONST_HASH] != CONSTANTS_HASH_INT:
        raise ValueError(
            "core: constantsHash mismatch - this snapshot belongs to a different physics build"
        )
    player_count = buf[HDR_PLAYER_COUNT]
    if len(buf) != state_length(player_count):
        raise ValueError("core: snapshot length does not match player count")
    settings = world_settings(buf)
    if buf[HDR_SETTINGS_HASH] != settings_hash_int(settings):
        raise SettingsError(
            "settings-hash",
            "core: settings hash in the state header does not match the settings words",
        )
    if buf[HDR_MATCH_STATE] < MATCH_RUNNING or buf[HDR_MATCH_STATE] > MATCH_FINISHED:
        raise SettingsError(
            "bad-match-state",
            f"core: match state {buf[HDR_MATCH_STATE]} is not one of 0..2",
        )
    if expect_settings is not None:
        assert_same_settings(expect_settings, settings)
    return World(buf, player_count, vectorised)


def read_state(world: World) -> dict:
    """Plain-number view for reporting and tests. Never feed it back in."""
    buf = world.buf
    players = []
    for i in range(world.player_count):
        o = player_offset(i)
        players.append(
            {
                "index": i,
                "team": buf[o + P_TEAM],
                "role": buf[o + P_ROLE],
                "x": buf[o + P_X] / FX_ONE,
                "z": buf[o + P_Z] / FX_ONE,
                "vx": buf[o + P_VX] / FX_ONE,
                "vz": buf[o + P_VZ] / FX_ONE,
                "kickArm": buf[o + P_KICK_ARM],
                "kickCooldown": buf[o + P_KICK_CD],
                "charge": buf[o + P_CHARGE],
                "chargeRelease": buf[o + P_CHARGE_REL],
                "clearCharge": buf[o + P_CLEAR_CHARGE],
                "tackleActive": buf[o + P_TACKLE_ACTIVE],
                "tackleRecovery": buf[o + P_TACKLE_RECOV],
                "tackleCooldown": buf[o + P_TACKLE_CD],
                "diveActive": buf[o + P_DIVE_ACTIVE],
                "diveLock": buf[o + P_DIVE_LOCK],
                "diveDir": buf[o + P_DIVE_DIR],
                "touchCooldown": buf[o + P_TOUCH_CD],
            }
        )
    dur = buf[HDR_DURATION_TICKS]
    return {
        "tick": buf[HDR_TICK],
        "score": [buf[HDR_SCORE_0], buf[HDR_SCORE_1]],
        "kickoffTeam": buf[HDR_KICKOFF_TEAM],
        "settings": dict(world_settings(buf)),
        "pitch": pitch_of(buf)["id"],
        "match": {
            "phase": match_phase_name(buf[HDR_MATCH_STATE]),
            "reason": end_reason_name(buf[HDR_END_REASON]),
            "over": buf[HDR_MATCH_STATE] == MATCH_FINISHED,
            "winner": (
                leader_of(buf[HDR_SCORE_0], buf[HDR_SCORE_1])
                if buf[HDR_MATCH_STATE] == MATCH_FINISHED
                else -1
            ),
            "elapsedTicks": buf[HDR_TICK],
            "remainingTicks": max(0, dur - buf[HDR_TICK]) if dur > 0 else -1,
        },
        "ball": {
            "x": buf[BALL_BASE] / FX_ONE,
            "z": buf[BALL_BASE + 1] / FX_ONE,
            "vx": buf[BALL_BASE + 2] / FX_ONE,
            "vz": buf[BALL_BASE + 3] / FX_ONE,
            "curve": buf[HDR_BALL_CURVE] / FX_ONE,
            "holder": buf[HDR_BALL_HOLDER],
            "holdTicks": buf[HDR_BALL_HOLD_TICKS],
        },
        "aftertouch": {
            "owner": buf[HDR_AFTERTOUCH_OWNER],
            "ticks": buf[HDR_AFTERTOUCH_TICKS],
        },
        "griefLock": {"team": buf[HDR_GRIEF_TEAM], "ticks": buf[HDR_GRIEF_TICKS]},
        "players": players,
    }


def place(world: World, target, x, z, vx=0.0, vz=0.0) -> None:
    """Authoring helper for tests and scenario setup; floats stop here."""
    o = BALL_BASE if target == "ball" else player_offset(target)
    world.buf[o + P_X] = fx.from_number(x)
    world.buf[o + P_Z] = fx.from_number(z)
    world.buf[o + P_VX] = fx.from_number(vx)
    world.buf[o + P_VZ] = fx.from_number(vz)


def set_curve(world: World, curve) -> None:
    world.buf[HDR_BALL_CURVE] = fx.from_number(curve)
