#!/usr/bin/env python3
"""Replay a JS trace through the Python core and diff the whole checksum chain.

    python3 python/parity.py                       # the Phase 1.2 3000-tick trace
    python3 python/parity.py --vectorised          # same, numpy stages on
    python3 python/parity.py --rules               # the match-rule traces too
    python3 python/parity.py --trace path/to.json

The bar is the FULL per-tick chain, not the final state. A port that ends up in
the same place after 3000 ticks having taken a different route through tick 812
is not a port, it is a coincidence: the checkpoint pool, the replay format and
the P2P desync detector all compare intermediate states, so intermediate states
are what get compared here.

On a mismatch the run stops at the FIRST differing tick and prints:
  * the tick, and both checksums
  * every state word that differs, named (header word / ball slot / player i
    slot), with the JS value and the Python value

The JS values for that report come from python/tools/dump-state-at.mjs, which
replays the same recorded inputs in node. Nothing is inferred and nothing is
tolerated: the exit status is non-zero the moment one integer differs.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from haxball3d_sim import fx  # noqa: E402
from haxball3d_sim.checksum import fnv1a_string, to_hex32  # noqa: E402
from haxball3d_sim.layout import (  # noqa: E402
    BALL_BASE,
    C,
    CONSTANTS_HASH,
    FIELD,
    FIXTURES_DIR,
    HDR,
    HDR_BALL_HOLDER,
    HDR_BALL_HOLD_TICKS,
    HDR_GRIEF_TEAM,
    HDR_GRIEF_TICKS,
    PLAYER_BASE,
    PLAYER_STRIDE,
    PYTHON_DIR,
)
from haxball3d_sim.world import (  # noqa: E402
    World,
    checksum,
    create_world,
    step,
)

DEFAULT_TRACE = FIXTURES_DIR / "trace.json"
DEFAULT_RULES = FIXTURES_DIR / "rules-traces.json"
STATE_DUMPER = PYTHON_DIR / "tools" / "dump-state-at.mjs"


# ------------------------------------------------------------- constants hash


def python_constants_hash() -> str:
    """Recompute constantsHash from the constant table, the way constants.js does.

    Keys sorted, ``name=value;`` joined, FNV-1a over the UTF-16 code units. This
    is not a re-read of the JS answer: it is the same recipe applied to the same
    table on the Python side, so agreeing with the trace proves the table AND
    the string hash both survived the port.
    """
    return to_hex32(fnv1a_string("".join(f"{k}={int(C[k])};" for k in sorted(C))))


# ------------------------------------------------------------------ helpers


def field_name(index: int, player_count: int) -> str:
    """Name a state word: header, ball slot or player slot."""
    for name, offset in HDR.items():
        if offset == index and name != "HDR_LEN":
            return name
    if BALL_BASE <= index < PLAYER_BASE:
        return ("BALL_X", "BALL_Z", "BALL_VX", "BALL_VZ")[index - BALL_BASE]
    if index >= PLAYER_BASE:
        i = (index - PLAYER_BASE) // PLAYER_STRIDE
        slot = (index - PLAYER_BASE) % PLAYER_STRIDE
        if i < player_count:
            for name, offset in FIELD.items():
                if offset == slot and name != "P_PREV_KICK":
                    return f"player[{i}].{name}"
            return f"player[{i}].slot{slot}"
    return f"word{index}"


def decode_input(code: int, dirs) -> dict:
    d = dirs[code & 15]
    return {"moveXFx": d[0], "moveZFx": d[1], "buttons": code >> 4}


def js_state_at(trace_path: Path, tick: int):
    """Ask node for the JS state buffer at `tick`. None when node is unavailable."""
    try:
        out = subprocess.run(
            ["node", str(STATE_DUMPER), str(trace_path), str(tick)],
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"  (could not obtain the JS state for tick {tick}: {exc})")
        return None
    return json.loads(out.stdout)["state"]


def report_divergence(
    trace_path: Path, trace: dict, tick: int, js_sum: str, py_sum: str, vectorised: bool
) -> None:
    print(f"\nFIRST DIVERGENCE at tick {tick}")
    print(f"  JS checksum     {js_sum}")
    print(f"  Python checksum {py_sum}")
    js_state = js_state_at(trace_path, tick)
    if js_state is None:
        return
    # Re-replay Python up to the divergent tick: the world left over from the
    # full run is 3000 ticks past the interesting moment and comparing against
    # it would name every field on the pitch.
    world, _ = replay_trace(trace, vectorised, upto=tick)
    diffs = 0
    for index, (a, b) in enumerate(zip(js_state, world.buf)):
        if int(a) != int(b):
            diffs += 1
            name = field_name(index, world.player_count)
            print(
                f"  [{index:4d}] {name:28s} JS {int(a):>12d}   PY {int(b):>12d}   d={int(b) - int(a)}"
            )
            if diffs >= 40:
                print("  ... (truncated at 40 differing words)")
                break
    if diffs == 0:
        print(
            "  states are identical but the checksums are not: the hash itself diverged"
        )


# -------------------------------------------------------------- main compare


def replay_trace(trace: dict, vectorised: bool, upto: int | None = None):
    """Replay the recorded input codes and return (world, python chain)."""
    scn = trace["scenario"]
    dirs = trace["dirs"]
    world = create_world(
        player_count=scn["playerCount"], roles=scn.get("roles"), vectorised=vectorised
    )
    chain = [checksum(world)]
    frames = trace["inputs"] if upto is None else trace["inputs"][:upto]
    for frame in frames:
        step(world, [decode_input(code, dirs) for code in frame])
        chain.append(checksum(world))
    return world, chain


def compare_chain(js_chain, py_chain):
    """(ok, first differing index). Length mismatch counts as a difference."""
    n = min(len(js_chain), len(py_chain))
    for i in range(n):
        if js_chain[i] != py_chain[i]:
            return False, i
    if len(js_chain) != len(py_chain):
        return False, n
    return True, -1


def chain_digest(chain) -> str:
    return to_hex32(fnv1a_string("".join(chain)))


def run_main_trace(trace_path: Path, vectorised: bool) -> bool:
    with open(trace_path, "r", encoding="utf-8") as fh:
        trace = json.load(fh)

    print(f"trace           {trace_path}")
    print(
        f"scenario        {trace['scenario']['name']}  "
        f"{trace['scenario']['ticks']} ticks, {trace['scenario']['playerCount']} players"
    )
    print(
        f"mode            {'vectorised (numpy stages on)' if vectorised else 'scalar'}"
    )

    ok = True
    py_hash = python_constants_hash()
    js_hash = trace["constantsHash"]
    same_hash = py_hash == js_hash == CONSTANTS_HASH
    print(
        f"constantsHash   JS {js_hash}   Python {py_hash}   {'OK' if same_hash else 'MISMATCH'}"
    )
    if not same_hash:
        print(
            "  the physics tables differ; every chain below is meaningless until this is fixed"
        )
        ok = False

    world, py_chain = replay_trace(trace, vectorised)
    js_chain = [entry["c"] for entry in trace["ticks"]]
    good, first = compare_chain(js_chain, py_chain)
    print(f"chain length    JS {len(js_chain)}   Python {len(py_chain)}")
    print(
        f"chain digest    JS {trace['chainDigest']}   Python {chain_digest(py_chain)}"
    )
    if good:
        print(f"chain compare   OK, {len(js_chain)} per-tick checksums identical")
    else:
        ok = False
        js_sum = js_chain[first] if first < len(js_chain) else "(missing)"
        py_sum = py_chain[first] if first < len(py_chain) else "(missing)"
        report_divergence(trace_path, trace, first, js_sum, py_sum, vectorised)

    if trace["chainDigest"] != chain_digest(py_chain):
        ok = False
        print("chain digest    MISMATCH")
    return ok


def run_rules_traces(path: Path, vectorised: bool) -> bool:
    with open(path, "r", encoding="utf-8") as fh:
        bundle = json.load(fh)
    dirs = bundle["dirs"]
    ok = True
    for entry in bundle["scenarios"]:
        scn = entry["scenario"]
        world = create_world(
            player_count=scn["playerCount"],
            roles=scn.get("roles"),
            settings=scn.get("settings"),
            vectorised=vectorised,
        )
        writes = {w["tick"]: w for w in entry["writes"]}
        chain = [checksum(world)]
        for t, frame in enumerate(entry["codes"]):
            w = writes.get(t)
            if w is not None:
                buf = world.buf
                buf[HDR_BALL_HOLDER] = w["ballHolder"]
                buf[HDR_BALL_HOLD_TICKS] = w["ballHoldTicks"]
                buf[HDR_GRIEF_TEAM] = w["griefTeam"]
                buf[HDR_GRIEF_TICKS] = w["griefTicks"]
                buf[BALL_BASE : BALL_BASE + 4] = [int(v) for v in w["ball"]]
            step(world, [decode_input(code, dirs) for code in frame])
            chain.append(checksum(world))
        good, first = compare_chain(entry["chain"], chain)
        status = "OK" if good else f"DIVERGED at tick {first}"
        print(
            f"rules trace     {entry['name']:26s} {len(chain):5d} ticks  "
            f"digest {chain_digest(chain)}  {status}"
        )
        if not good:
            ok = False
            js_state = entry["finalState"] if first == len(entry["chain"]) - 1 else None
            print(f"  JS {entry['chain'][first]}  PY {chain[first]}")
            if js_state is not None:
                for index, (a, b) in enumerate(zip(js_state, world.buf)):
                    if int(a) != int(b):
                        print(
                            f"  [{index:4d}] {field_name(index, world.player_count):28s} "
                            f"JS {int(a):>12d}   PY {int(b):>12d}"
                        )
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--trace", type=Path, default=DEFAULT_TRACE)
    ap.add_argument(
        "--rules", action="store_true", help="also replay the match-rule traces"
    )
    ap.add_argument("--rules-file", type=Path, default=DEFAULT_RULES)
    ap.add_argument(
        "--vectorised", action="store_true", help="run the numpy tick stages"
    )
    args = ap.parse_args()

    ok = run_main_trace(args.trace, args.vectorised)
    if args.rules:
        ok = run_rules_traces(args.rules_file, args.vectorised) and ok
    print("\nPARITY OK" if ok else "\nPARITY FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
