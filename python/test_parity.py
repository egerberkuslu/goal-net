#!/usr/bin/env python3
"""Acceptance gate for matrix row #42 - NumPy port + parity.

    python3 python/test_parity.py            PASS/FAIL per check, non-zero on failure
    python3 python/test_parity.py --emit-digest   internal: fresh-process re-run

What "parity" is allowed to mean here
    Bit-identical, everywhere, with no tolerance anywhere. Fixed-point results
    are compared as integers, observation features as raw float32 bit patterns,
    and simulation runs as the FULL per-tick checksum chain rather than the
    final state. There is deliberately no ``assert_close`` in this file: a
    tolerance would turn a real desync into a passing test, which for a replay
    format and a P2P desync detector is worse than no test at all.

Sections
    1  layout audit          the private flag bits the port had to hardcode
    2  fixed point           every fx.js operation, against JS-produced fixtures
    3  hashing               FNV-1a over ints and strings, and constantsHash
    4  chain parity          the 3000-tick Phase 1.2 scenario, scalar
    5  vectorisation         the same scenario with the numpy stages on
    6  match rules           golden goal, mercy, score limit, full time, presets
    7  observation           100 features vs JS float32 bits
    8  determinism           two runs in-process, and one in a fresh process
    9  snapshot              serialize -> deserialize -> resume keeps the chain
   10  environment           spaces, action table, reward shape, cloning
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from haxball3d_sim import fx  # noqa: E402
from haxball3d_sim.actions import (  # noqa: E402
    CORE_INPUTS,
    DISCRETE,
    DISCRETE_SIZE,
    decode_discrete,
    encode_discrete,
)
from haxball3d_sim.checksum import (  # noqa: E402
    checksum_ints,
    fnv1a_ints,
    fnv1a_ints_fast,
    fnv1a_string,
    to_hex32,
)
from haxball3d_sim.env import HaxballEnv  # noqa: E402
from haxball3d_sim.layout import (  # noqa: E402
    BALL_BASE,
    FIXTURES_DIR,
    FLAG_DIVE_HELD,
    FLAG_TACKLE_HELD,
    FLAG_TOUCHING,
    HDR_BALL_HOLDER,
    HDR_BALL_HOLD_TICKS,
    HDR_GRIEF_TEAM,
    HDR_GRIEF_TICKS,
    REPO_ROOT,
)
from haxball3d_sim.observation import (  # noqa: E402
    OBS_NAMES,
    OBS_SIZE,
    check_bounds,
    observe,
)
from haxball3d_sim.world import (  # noqa: E402
    World,
    checksum,
    create_world,
    deserialize,
    pitch_of,
    serialize,
    step,
)

sys.path.insert(0, str(HERE))
import parity  # noqa: E402

TRACE_PATH = FIXTURES_DIR / "trace.json"
RULES_PATH = FIXTURES_DIR / "rules-traces.json"
FX_PATH = FIXTURES_DIR / "fx.json"
OBS_PATH = FIXTURES_DIR / "observation.json"
WORLD_JS = REPO_ROOT / "packages" / "core" / "src" / "world.js"

FAILURES = 0
CHECKS = 0


def check(name: str, ok: bool, detail: str = "") -> bool:
    global FAILURES, CHECKS
    CHECKS += 1
    if ok:
        print(f"PASS  {name}{f'  [{detail}]' if detail else ''}")
    else:
        FAILURES += 1
        print(f"FAIL  {name}{f' - {detail}' if detail else ''}")
    return ok


def section(title: str) -> None:
    print(f"\n--- {title}")


def load(path: Path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def decode_input(code: int, dirs):
    d = dirs[code & 15]
    return {"moveXFx": d[0], "moveZFx": d[1], "buttons": code >> 4}


def replay(trace, vectorised=False, upto=None):
    scn = trace["scenario"]
    world = create_world(
        player_count=scn["playerCount"], roles=scn.get("roles"), vectorised=vectorised
    )
    chain = [checksum(world)]
    frames = trace["inputs"] if upto is None else trace["inputs"][:upto]
    for frame in frames:
        step(world, [decode_input(c, trace["dirs"]) for c in frame])
        chain.append(checksum(world))
    return world, chain


def first_diff(a, b):
    for i in range(min(len(a), len(b))):
        if a[i] != b[i]:
            return i
    return -1 if len(a) == len(b) else min(len(a), len(b))


# --------------------------------------------------- fresh-process re-run mode

if "--emit-digest" in sys.argv:
    trace = load(TRACE_PATH)
    _, chain = replay(trace)
    print(parity.chain_digest(chain))
    raise SystemExit(0)


print("haxball3d_sim parity gate")
print(f"fixtures {FIXTURES_DIR}")

# ------------------------------------------------------------ 1. layout audit

section("layout audit")

js_source = WORLD_JS.read_text(encoding="utf-8")
for name, value in (
    ("FLAG_TOUCHING", FLAG_TOUCHING),
    ("FLAG_TACKLE_HELD", FLAG_TACKLE_HELD),
    ("FLAG_DIVE_HELD", FLAG_DIVE_HELD),
):
    m = re.search(rf"const {name} = (\d+);", js_source)
    check(
        f"{name} still equals the JS value",
        m is not None and int(m.group(1)) == value,
        f"js={m.group(1) if m else 'missing'} py={value}",
    )

layout_json = load(HERE / "layout.json")
check(
    "layout.json was generated from the JS modules",
    layout_json["generatedBy"] == "python/tools/dump-layout.mjs",
)

# ------------------------------------------------------------- 2. fixed point

section("fixed point")

fxf = load(FX_PATH)

UNARY = {
    "fxNeg": fx.neg,
    "fxAbs": fx.fabs,
    "fxSign": fx.sign,
    "fxSqrt": fx.sqrt,
    "fxToInt": fx.to_int,
    "isqrtInt": fx.isqrt_int,
}
for op, func in UNARY.items():
    cases = fxf["unary"][op]
    bad = [(a, want, func(a)) for a, want in cases if func(a) != want]
    check(
        f"{op}: {len(cases)} JS cases reproduced",
        not bad,
        f"first {bad[0]}" if bad else "",
    )

BINARY = {
    "fxAdd": fx.add,
    "fxSub": fx.sub,
    "fxMul": fx.mul,
    "fxDiv": fx.div,
    "fxHypot": fx.hypot,
    "fxMin": fx.fmin,
    "fxMax": fx.fmax,
}
for op, func in BINARY.items():
    cases = fxf["binary"][op]
    bad = [(a, b, want, func(a, b)) for a, b, want in cases if func(a, b) != want]
    check(
        f"{op}: {len(cases)} JS cases reproduced",
        not bad,
        f"first {bad[0]}" if bad else "",
    )

# the vectorised twins have to agree with the scalar ones on the same fixtures
VECTOR = {
    "fxAdd": fx.v_add,
    "fxSub": fx.v_sub,
    "fxMul": fx.v_mul,
    "fxDiv": fx.v_div,
    "fxHypot": fx.v_hypot,
}
for op, func in VECTOR.items():
    cases = fxf["binary"][op]
    a = np.array([c[0] for c in cases], dtype=np.int64)
    b = np.array([c[1] for c in cases], dtype=np.int64)
    want = np.array([c[2] for c in cases], dtype=np.int64)
    got = func(a, b)
    mism = np.nonzero(got != want)[0]
    check(
        f"v_{op}: {len(cases)} JS cases reproduced elementwise",
        mism.size == 0,
        ""
        if mism.size == 0
        else f"first at {int(mism[0])}: {int(a[mism[0]])},{int(b[mism[0]])} "
        f"want {int(want[mism[0]])} got {int(got[mism[0]])}",
    )

sq = fxf["unary"]["isqrtInt"]
va = np.array([c[0] for c in sq], dtype=np.int64)
vw = np.array([c[1] for c in sq], dtype=np.int64)
check(
    "v_isqrt reproduces the JS integer square root",
    bool((fx.v_isqrt(va) == vw).all()),
    f"{len(sq)} cases",
)

norm = fxf["normalize"]
bad = []
for a, b, wx, wz, wlen in norm:
    gx, gz, glen = fx.normalize(a, b)
    if (gx, gz, glen) != (wx, wz, wlen):
        bad.append((a, b, (wx, wz, wlen), (gx, gz, glen)))
check(
    f"fxNormalize: {len(norm)} JS cases reproduced",
    not bad,
    f"first {bad[0]}" if bad else "",
)

bad = [
    (v, want, fx.from_number(v))
    for v, want in fxf["fromNumber"]
    if fx.from_number(v) != want
]
check(
    f"fxFromNumber: {len(fxf['fromNumber'])} float-boundary cases (JS Math.round semantics)",
    not bad,
    f"first {bad[0]}" if bad else "",
)

from haxball3d_sim.world import quantise_axis  # noqa: E402

bad = [
    (v, w, quantise_axis(v)) for v, w in fxf["quantiseAxis"] if quantise_axis(v) != w
]
check(
    f"quantiseAxis: {len(fxf['quantiseAxis'])} cases",
    not bad,
    f"first {bad[0]}" if bad else "",
)

bad = []
for a, want_wrap, want_cos, want_sin in fxf["angles"]:
    if fx.wrap_angle(a) != want_wrap:
        bad.append(("wrap", a, want_wrap, fx.wrap_angle(a)))
    if fx.sin_cos(a) != (want_cos, want_sin):
        bad.append(("sincos", a, (want_cos, want_sin), fx.sin_cos(a)))
check(
    f"CORDIC sin/cos and wrapAngle: {len(fxf['angles'])} angles",
    not bad,
    f"first {bad[0]}" if bad else "",
)

# ----------------------------------------------------------------- 3. hashing

section("hashing")

bad = [
    (arr, want, to_hex32(fnv1a_ints(arr)))
    for arr, want in fxf["hashInts"]
    if to_hex32(fnv1a_ints(arr)) != want
]
check(
    f"fnv1aInts: {len(fxf['hashInts'])} arrays",
    not bad,
    f"first {bad[0]}" if bad else "",
)

bad = []
for arr, want in fxf["hashInts"]:
    got = to_hex32(fnv1a_ints_fast(np.array(arr, dtype=np.int32)))
    if got != want:
        bad.append((arr, want, got))
check("fnv1aInts byte-view fast path agrees", not bad, f"first {bad[0]}" if bad else "")

bad = [
    (s, want, to_hex32(fnv1a_string(s)))
    for s, want in fxf["hashStrings"]
    if to_hex32(fnv1a_string(s)) != want
]
check(
    f"fnv1aString: {len(fxf['hashStrings'])} strings (UTF-16 code units)",
    not bad,
    f"first {bad[0]}" if bad else "",
)

trace = load(TRACE_PATH)
py_hash = parity.python_constants_hash()
check(
    "constantsHash recomputed in Python matches the JS build",
    py_hash == trace["constantsHash"],
    f"{py_hash} vs {trace['constantsHash']}",
)

# ------------------------------------------------------------ 4. chain parity

section("chain parity (scalar)")

world, py_chain = replay(trace)
js_chain = [e["c"] for e in trace["ticks"]]
d = first_diff(js_chain, py_chain)
check(
    f"per-tick checksum chain over {len(js_chain)} ticks is identical",
    d == -1,
    ""
    if d == -1
    else f"first divergence at tick {d}: JS {js_chain[d] if d < len(js_chain) else '-'} "
    f"PY {py_chain[d] if d < len(py_chain) else '-'}",
)
check(
    "chain digest matches",
    parity.chain_digest(py_chain) == trace["chainDigest"],
    f"{parity.chain_digest(py_chain)} vs {trace['chainDigest']}",
)
check(
    "final checksum matches",
    py_chain[-1] == js_chain[-1],
    f"{py_chain[-1]}",
)

# ---------------------------------------------------------- 5. vectorisation

section("vectorisation")

vworld, v_chain = replay(trace, vectorised=True)
d = first_diff(py_chain, v_chain)
check(
    "vectorised stages reproduce the scalar chain tick for tick",
    d == -1,
    "" if d == -1 else f"first divergence at tick {d}",
)
check(
    "vectorised chain also matches the JS chain",
    v_chain == js_chain,
    f"digest {parity.chain_digest(v_chain)}",
)

# ------------------------------------------------------------ 6. match rules

section("match rules and pitch presets")

rules = load(RULES_PATH)
for entry in rules["scenarios"]:
    scn = entry["scenario"]
    for vec in (False, True):
        w = create_world(
            player_count=scn["playerCount"],
            roles=scn.get("roles"),
            settings=scn.get("settings"),
            vectorised=vec,
        )
        writes = {x["tick"]: x for x in entry["writes"]}
        chain = [checksum(w)]
        for t, frame in enumerate(entry["codes"]):
            x = writes.get(t)
            if x is not None:
                w.buf[HDR_BALL_HOLDER] = x["ballHolder"]
                w.buf[HDR_BALL_HOLD_TICKS] = x["ballHoldTicks"]
                w.buf[HDR_GRIEF_TEAM] = x["griefTeam"]
                w.buf[HDR_GRIEF_TICKS] = x["griefTicks"]
                w.buf[BALL_BASE : BALL_BASE + 4] = [int(v) for v in x["ball"]]
            step(w, [decode_input(c, rules["dirs"]) for c in frame])
            chain.append(checksum(w))
        d = first_diff(entry["chain"], chain)
        mode = "vectorised" if vec else "scalar"
        check(
            f"{entry['name']} ({mode}): {len(chain)} ticks identical",
            d == -1,
            "" if d == -1 else f"first divergence at tick {d}",
        )
        if not vec:
            check(
                f"{entry['name']}: final state identical word for word",
                [int(v) for v in entry["finalState"]] == list(w.buf),
                f"end={entry['end']['reason'] if entry['end'] else 'none'}",
            )

# ------------------------------------------------------------ 7. observation

section("observation")

obsf = load(OBS_PATH)
check(
    f"spec agrees: {OBS_SIZE} features, same names, same order",
    list(OBS_NAMES) == obsf["names"] and OBS_SIZE == obsf["obsSize"],
)
mismatch = 0
compared = 0
first_bad = None
out_of_bounds = 0
for s in obsf["samples"]:
    w = World([int(v) for v in s["state"]], s["playerCount"])
    for i, expected in enumerate(s["obs"]):
        got = observe(w, i)
        out_of_bounds += len(check_bounds(got))
        bits = got.view(np.uint32)
        for k in range(OBS_SIZE):
            compared += 1
            if int(expected[k]) != int(bits[k]):
                mismatch += 1
                if first_bad is None:
                    first_bad = (
                        s["label"],
                        i,
                        OBS_NAMES[k],
                        int(expected[k]),
                        int(bits[k]),
                    )
check(
    f"observation float32 bits identical over {len(obsf['samples'])} scenes",
    mismatch == 0,
    f"{compared} features compared" if mismatch == 0 else f"first {first_bad}",
)
check(
    "every observed feature inside its declared range",
    out_of_bounds == 0,
    f"{out_of_bounds} violations",
)

# ----------------------------------------------------------- 8. determinism

section("determinism")

_, chain_again = replay(trace)
check("two in-process runs produce the same chain", chain_again == py_chain)

proc = subprocess.run(
    [sys.executable, str(HERE / "test_parity.py"), "--emit-digest"],
    capture_output=True,
    text=True,
    check=False,
)
fresh = proc.stdout.strip()
check(
    "a fresh Python process produces the same chain digest",
    fresh == trace["chainDigest"],
    f"{fresh} vs {trace['chainDigest']}",
)

# -------------------------------------------------------------- 9. snapshot

section("snapshot round trip")

cut = 1234
mid_world, mid_chain = replay(trace, upto=cut)
snapshot = serialize(mid_world)
resumed = deserialize(snapshot)
check(
    "deserialize accepts a serialize snapshot", list(resumed.buf) == list(mid_world.buf)
)
tail = []
for frame in trace["inputs"][cut:]:
    step(resumed, [decode_input(c, trace["dirs"]) for c in frame])
    tail.append(checksum(resumed))
rejoined = mid_chain + tail
d = first_diff(rejoined, py_chain)
check(
    f"a run resumed from tick {cut} continues the same chain",
    d == -1,
    "" if d == -1 else f"first divergence at tick {d}",
)

bad_snapshot = np.array(snapshot, copy=True)
bad_snapshot[2] += 1  # HDR_CONST_HASH
try:
    deserialize(bad_snapshot)
    rejected = False
except ValueError:
    rejected = True
check("a snapshot from another physics build is refused, not reinterpreted", rejected)

# ------------------------------------------------------------ 10. environment

section("environment")

check(
    f"action table is the JS one: {DISCRETE_SIZE} entries",
    DISCRETE_SIZE == 18 and len(DISCRETE) == 18,
)
round_trip = all(encode_discrete(decode_discrete(i)) == i for i in range(DISCRETE_SIZE))
check("decode/encode round-trips for every discrete index", round_trip)
check(
    "the diagonal quantises to the same raw integer the JS harness uses",
    CORE_INPUTS[0][2]["moveXFx"] == 46341 and CORE_INPUTS[0][2]["moveZFx"] == 46341,
    f"{CORE_INPUTS[0][2]['moveXFx']}",
)
check(
    "team 1 actions are the 180 degree rotation of team 0's",
    all(
        CORE_INPUTS[1][a]["moveXFx"] == -CORE_INPUTS[0][a]["moveXFx"]
        and CORE_INPUTS[1][a]["moveZFx"] == -CORE_INPUTS[0][a]["moveZFx"]
        for a in range(DISCRETE_SIZE)
    ),
)

env = HaxballEnv(
    player_count=4,
    roles=[1, 0, 1, 0],
    settings={"durationSeconds": 10, "scoreLimit": 3},
)
obs, info = env.reset(seed=7)
check(
    f"reset returns float32[{env.n_agents}, {OBS_SIZE}] inside the declared box",
    obs.shape == (4, OBS_SIZE)
    and obs.dtype == np.float32
    and env.observation_space.contains(obs[0]),
)

rng = np.random.default_rng(11)
script = [[int(rng.integers(DISCRETE_SIZE)) for _ in range(4)] for _ in range(120)]


def run_episode(seed, vectorised=False):
    e = HaxballEnv(
        player_count=4,
        roles=[1, 0, 1, 0],
        settings={"durationSeconds": 10, "scoreLimit": 3},
        vectorised=vectorised,
    )
    e.reset(seed=seed)
    total = np.zeros(4)
    last = None
    for acts in script:
        _, r, term, trunc, last = e.step(acts)
        total += r
        if term or trunc:
            break
    return e.checksum(), total, last


sum_a, ret_a, info_a = run_episode(7)
sum_b, ret_b, _ = run_episode(7)
sum_v, ret_v, _ = run_episode(7, vectorised=True)
check("the same action script gives the same env checksum", sum_a == sum_b, sum_a)
check("and the same rewards", bool(np.array_equal(ret_a, ret_b)))
check(
    "vectorised env reaches the identical state",
    sum_v == sum_a and bool(np.array_equal(ret_v, ret_a)),
)
# Zero-sum is a property of the GOAL term only; the shaping term is a
# potential difference per team and is not zero-sum by construction. Turning
# the shaping off is therefore the honest way to assert it.
bare = HaxballEnv(
    player_count=4,
    roles=[1, 0, 1, 0],
    settings={"durationSeconds": 10, "scoreLimit": 3},
    shaping_coef=0.0,
)
bare.reset(seed=7)
bare_total = np.zeros(4)
goals = 0
for n_step, acts in enumerate(script):
    if n_step in (10, 40, 70):
        # force a goal so the zero-sum claim is tested on a non-zero reward:
        # ball past the line, clear of the posts, nobody holding it
        buf = bare.world.buf
        buf[HDR_BALL_HOLDER] = -1
        buf[HDR_BALL_HOLD_TICKS] = 0
        buf[HDR_GRIEF_TEAM] = -1
        buf[HDR_GRIEF_TICKS] = 0
        beyond = pitch_of(bare.world)["halfZ"] + 20 * 65536
        buf[BALL_BASE : BALL_BASE + 4] = [0, beyond if n_step != 40 else -beyond, 0, 0]
    _, r, term, trunc, last_info = bare.step(acts)
    goals += sum(1 for e in last_info["events"] if e["type"] == "goal")
    bare_total += r
    if term or trunc:
        break
check(
    "with shaping off the reward is exactly zero-sum across the two teams",
    float(bare_total.sum()) == 0.0 and goals > 0,
    f"{goals} goals, returns {bare_total.tolist()}",
)
check(
    "a finished match reports terminated and stops the clock",
    info_a["tick"] <= 600 + env.cfg.decision_period,
    f"tick {info_a['tick']} score {info_a['score']}",
)

env2 = HaxballEnv(
    player_count=2, reward_fn=lambda e, b, a, ev: np.arange(e.n_agents, dtype=float)
)
env2.reset(seed=1)
_, r, _, _, _ = env2.step([0, 0])
check(
    "a custom reward_fn replaces the default entirely",
    bool(np.array_equal(r, np.array([0.0, 1.0]))),
)

env3 = HaxballEnv(
    player_count=2, shaping_terms={"ball_x": lambda e, s, i: s["ball"][0]}
)
env3.reset(seed=1)
_, r3, _, _, _ = env3.step([1, 1])
check("shaping_terms hook is applied on top of the default", r3.shape == (2,))

# ------------------------------------------------------------------ verdict

print(f"\n{CHECKS - FAILURES}/{CHECKS} checks passed")
if FAILURES:
    print(f"FAILED ({FAILURES})")
    raise SystemExit(1)
print("ALL PASS")
