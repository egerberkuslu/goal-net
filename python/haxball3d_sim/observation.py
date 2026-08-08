"""observe(world, player_index) -> float32[100], mirroring bots/src/observation.js.

The spec table is not retyped here: it is read from layout.json, which was
generated from OBSERVATION_SPEC itself, so the 100 names, their order and their
declared ranges are the JS ones by construction. What this module ports is the
arithmetic that fills them.

Bit-identical, and cheaply so. observation.js restricts itself to +, -, *, /
and Math.sqrt, all of which IEEE-754 defines exactly, and Python floats are the
same float64. The only two places a difference could creep in are the final
narrowing to Float32 (numpy's float32 cast and JS's Float32Array store both
round-to-nearest-even, so they agree) and the sort order of the mate/opponent
lists (JS Array.prototype.sort has been stable since ES2019 and the comparator
falls back to the player index, so a (d2, index) key reproduces it exactly).
The fixture test compares raw float32 bit patterns, not decimals.

Frames. Team 0 attacks +z and sees the pitch as it is; team 1 sees it rotated
180 degrees about the vertical axis, (x, z) -> (-x, -z). A rotation, not a
mirror: mirroring only z would flip handedness and a policy that learned to cut
inside would come out cutting outside.
"""

from __future__ import annotations

import math

import numpy as np

from .layout import (
    BALL_BASE,
    C,
    HDR_SCORE_0,
    HDR_SCORE_1,
    OBSERVATION,
    P_KICK_ARM,
    P_KICK_CD,
    P_ROLE,
    P_TEAM,
    P_VX,
    P_VZ,
    P_X,
    P_Z,
    player_offset,
)
from .world import pitch_of

FX_ONE = 65536.0

SPEC = tuple((f["index"], f["name"], f["lo"], f["hi"]) for f in OBSERVATION["spec"])
OBS_NAMES = tuple(f["name"] for f in OBSERVATION["spec"])
OBS = {name: i for i, name in enumerate(OBS_NAMES)}
OBS_SIZE = OBSERVATION["size"]
OBSERVATION_VERSION = OBSERVATION["version"]
MATE_SLOTS = OBSERVATION["mateSlots"]
OPP_SLOTS = OBSERVATION["oppSlots"]

# layout.js derives these from the locked constant table with float arithmetic;
# the values in layout.json are the JS doubles, so no rederivation is needed and
# no rounding can differ. They are recomputed below only to assert agreement.
SPEED_PLAYER = OBSERVATION["speedPlayer"]
SPEED_BALL = OBSERVATION["speedBall"]
KICK_COOLDOWN_TICKS = OBSERVATION["pitch"]["KICK_COOLDOWN_TICKS"]
KICK_LATCH_TICKS = OBSERVATION["pitch"]["KICK_LATCH_TICKS"]


def _check_speed_derivation() -> None:
    """layout.js: PLAYER = a*d/(1-d), BALL = KICK_IMPULSE + PLAYER."""
    accel = C["PLAYER_ACCEL"] / FX_ONE
    damping = C["PLAYER_DAMPING"] / FX_ONE
    player = (accel * damping) / (1 - damping)
    ball = C["KICK_IMPULSE"] / FX_ONE + player
    if player != SPEED_PLAYER or ball != SPEED_BALL:
        raise RuntimeError(
            "observation: the reference speeds in layout.json do not match the "
            "formula in bots/src/layout.js; regenerate layout.json"
        )


_check_speed_derivation()


def _clamp(v: float, lo: float, hi: float) -> float:
    if v != v:  # NaN guard; a bot never gets to see NaN
        return 0.0
    if v < lo:
        return lo
    if v > hi:
        return hi
    return v


def _c1(v: float) -> float:
    return _clamp(v, -1.0, 1.0)


def _c01(v: float) -> float:
    return _clamp(v, 0.0, 1.0)


def _len2(x: float, z: float) -> float:
    return math.sqrt(x * x + z * z)


def attack_sign_of(team: int) -> int:
    return 1 if team == 0 else -1


def pitch_floats(world) -> dict:
    """Pitch geometry for the world being observed, in world units (floats)."""
    p = pitch_of(world)
    return {
        "HALF_X": p["halfX"] / FX_ONE,
        "HALF_Z": p["halfZ"] / FX_ONE,
        "GOAL_HALF_X": p["goalHalfX"] / FX_ONE,
    }


def observe(
    world, player_index: int, out: np.ndarray | None = None, role: str | None = None
):
    """Fill and return a float32 observation for `player_index`."""
    size = OBS_SIZE
    if out is None or len(out) != size:
        out = np.zeros(size, dtype=np.float32)
    else:
        out.fill(0)

    buf = world.buf
    n = world.player_count
    if not 0 <= player_index < n:
        raise IndexError(f"observe: playerIndex {player_index} outside 0..{n - 1}")

    P = pitch_floats(world)
    rel_x = 2 * P["HALF_X"]
    rel_z = 2 * P["HALF_Z"]
    diag = math.sqrt(rel_x * rel_x + rel_z * rel_z)

    so = player_offset(player_index)
    self_team = buf[so + P_TEAM]
    sign = attack_sign_of(self_team)

    sx = sign * (buf[so + P_X] / FX_ONE)
    sz = sign * (buf[so + P_Z] / FX_ONE)
    svx = sign * (buf[so + P_VX] / FX_ONE)
    svz = sign * (buf[so + P_VZ] / FX_ONE)
    bx = sign * (buf[BALL_BASE] / FX_ONE)
    bz = sign * (buf[BALL_BASE + 1] / FX_ONE)
    bvx = sign * (buf[BALL_BASE + 2] / FX_ONE)
    bvz = sign * (buf[BALL_BASE + 3] / FX_ONE)

    opp_goal_x = 0.0
    opp_goal_z = P["HALF_Z"]
    own_goal_x = 0.0
    own_goal_z = -P["HALF_Z"]

    kick_cd = buf[so + P_KICK_CD]
    kick_arm = buf[so + P_KICK_ARM]

    # --- self ---------------------------------------------------------------
    out[OBS["self_x"]] = _c1(sx / P["HALF_X"])
    out[OBS["self_z"]] = _c1(sz / P["HALF_Z"])
    out[OBS["self_vx"]] = _c1(svx / SPEED_PLAYER)
    out[OBS["self_vz"]] = _c1(svz / SPEED_PLAYER)
    out[OBS["self_speed"]] = _c01(_len2(svx, svz) / SPEED_PLAYER)
    out[OBS["self_kick_ready"]] = 0.0 if kick_cd > 0 else 1.0
    out[OBS["self_kick_cd"]] = _c01(kick_cd / KICK_COOLDOWN_TICKS)
    out[OBS["self_kick_armed"]] = _c01(kick_arm / KICK_LATCH_TICKS)

    d_own_x = own_goal_x - sx
    d_own_z = own_goal_z - sz
    d_opp_x = opp_goal_x - sx
    d_opp_z = opp_goal_z - sz
    dist_own = _len2(d_own_x, d_own_z)
    dist_opp = _len2(d_opp_x, d_opp_z)
    out[OBS["self_dist_own_goal"]] = _c01(dist_own / diag)
    out[OBS["self_dist_opp_goal"]] = _c01(dist_opp / diag)

    # --- ball ---------------------------------------------------------------
    bdx = bx - sx
    bdz = bz - sz
    bdist = _len2(bdx, bdz)
    bux = bdx / bdist if bdist > 0 else 0.0
    buz = bdz / bdist if bdist > 0 else 0.0

    out[OBS["ball_x"]] = _c1(bx / P["HALF_X"])
    out[OBS["ball_z"]] = _c1(bz / P["HALF_Z"])
    out[OBS["ball_vx"]] = _c1(bvx / SPEED_BALL)
    out[OBS["ball_vz"]] = _c1(bvz / SPEED_BALL)
    out[OBS["ball_dx"]] = _c1(bdx / rel_x)
    out[OBS["ball_dz"]] = _c1(bdz / rel_z)
    out[OBS["ball_dist"]] = _c01(bdist / diag)
    out[OBS["ball_dir_x"]] = _c1(bux)
    out[OBS["ball_dir_z"]] = _c1(buz)
    out[OBS["ball_closing"]] = _c1(((svx - bvx) * bux + (svz - bvz) * buz) / SPEED_BALL)

    # --- goal geometry ------------------------------------------------------
    out[OBS["opp_goal_dx"]] = _c1(d_opp_x / rel_x)
    out[OBS["opp_goal_dz"]] = _c1(d_opp_z / rel_z)
    out[OBS["opp_goal_dist"]] = _c01(dist_opp / diag)
    out[OBS["own_goal_dx"]] = _c1(d_own_x / rel_x)
    out[OBS["own_goal_dz"]] = _c1(d_own_z / rel_z)
    out[OBS["own_goal_dist"]] = _c01(dist_own / diag)

    bgx = opp_goal_x - bx
    bgz = opp_goal_z - bz
    bgd = _len2(bgx, bgz)
    out[OBS["ball_opp_goal_dist"]] = _c01(bgd / diag)
    out[OBS["shot_alignment"]] = (
        _c1(bux * (bgx / bgd) + buz * (bgz / bgd)) if bdist > 0 and bgd > 0 else 0.0
    )

    # --- role and context ---------------------------------------------------
    is_keeper = role == "keeper" or (role is None and buf[so + P_ROLE] == 1)
    out[OBS["role_field"]] = 0.0 if is_keeper else 1.0
    out[OBS["role_keeper"]] = 1.0 if is_keeper else 0.0

    # --- team-mates and opponents, nearest first ----------------------------
    mates = []
    opps = []
    nearest_index = player_index
    nearest_d2 = math.inf
    for i in range(n):
        o = player_offset(i)
        px = sign * (buf[o + P_X] / FX_ONE)
        pz = sign * (buf[o + P_Z] / FX_ONE)
        pdx = px - bx
        pdz = pz - bz
        pd2 = pdx * pdx + pdz * pdz
        if pd2 < nearest_d2 or (pd2 == nearest_d2 and i < nearest_index):
            nearest_d2 = pd2
            nearest_index = i
        if i == player_index:
            continue
        ex = px - sx
        ez = pz - sz
        entry = (
            ex * ex + ez * ez,
            i,
            ex,
            ez,
            sign * (buf[o + P_VX] / FX_ONE),
            sign * (buf[o + P_VZ] / FX_ONE),
        )
        if buf[o + P_TEAM] == self_team:
            mates.append(entry)
        else:
            opps.append(entry)
    mates.sort(key=lambda e: (e[0], e[1]))
    opps.sort(key=lambda e: (e[0], e[1]))

    nearest_team = buf[player_offset(nearest_index) + P_TEAM]
    out[OBS["possession"]] = 1.0 if nearest_team == self_team else -1.0
    out[OBS["self_nearest"]] = 1.0 if nearest_index == player_index else 0.0
    out[OBS["mate_count"]] = _c01(len(mates) / MATE_SLOTS)
    ours = buf[HDR_SCORE_0 if self_team == 0 else HDR_SCORE_1]
    theirs = buf[HDR_SCORE_1 if self_team == 0 else HDR_SCORE_0]
    out[OBS["score_diff"]] = _c1((ours - theirs) / 5)

    _write_entities(out, "mate", mates, MATE_SLOTS, rel_x, rel_z, diag)
    _write_entities(out, "opp", opps, OPP_SLOTS, rel_x, rel_z, diag)
    return out


def _write_entities(out, prefix, entries, slots, rel_x, rel_z, diag) -> None:
    for k in range(slots):
        base = OBS.get(f"{prefix}{k}_present")
        if base is None:
            break
        if k >= len(entries):
            continue  # already zeroed, present stays 0
        d2, _index, ex, ez, evx, evz = entries[k]
        d = math.sqrt(d2)
        out[base] = 1.0
        out[base + 1] = _c1(ex / rel_x)
        out[base + 2] = _c1(ez / rel_z)
        out[base + 3] = _c01(d / diag)
        out[base + 4] = _c1(evx / SPEED_PLAYER)
        out[base + 5] = _c1(evz / SPEED_PLAYER)


def check_bounds(obs) -> list:
    """Every value inside its declared range? Returns the list of violations."""
    bad = []
    for index, name, lo, hi in SPEC:
        v = float(obs[index])
        if not math.isfinite(v) or v < lo or v > hi:
            bad.append({"index": index, "name": name, "value": v, "lo": lo, "hi": hi})
    return bad


def spec_table() -> str:
    lines = [f"# observation v{OBSERVATION_VERSION}, {OBS_SIZE} features"]
    for f in OBSERVATION["spec"]:
        lines.append(
            f"{f['index']:3d}  {f['name']:<22} [{f['lo']:>2}, {f['hi']}]  {f['desc']}"
        )
    return "\n".join(lines)
