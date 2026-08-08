"""The action space, mirroring packages/bots/src/action.js.

18 discrete actions = 1 idle + 8 directions + 1 kick-in-place + 8
direction-with-kick, in the attack frame: index 1 is always "toward the
opponent goal", whichever end the agent is playing. ``ego_to_world`` rotates
back into pitch coordinates (a 180 degree yaw for team 1) before the action
reaches the core, so one set of weights serves both halves.

The table itself comes from layout.json, generated from DISCRETE_ACTIONS, so
the indices a checkpoint was trained against cannot drift away from the ones
the browser bot will use. The diagonal component is sqrt(0.5) as a float64;
quantise_axis turns it into 46341 raw, the same integer the JS pipeline
produces, because js_round is the ECMAScript rounding rule and not Python's.

Buttons beyond `kick` (charge, slide, catch, clear) exist on the action object
and in the continuous layout but are not in the discrete table -- action.js
keeps them out so the head size does not quadruple, and a later modifier head
can add them without renumbering these 18.
"""

from __future__ import annotations

import numpy as np

from .layout import ACTION
from .world import quantise_axis

DISCRETE = tuple(dict(a) for a in ACTION["discrete"])
DISCRETE_SIZE = ACTION["discreteSize"]
DIRECTIONS = tuple(dict(d) for d in ACTION["directions"])
BUTTONS = tuple(ACTION["buttons"])
ACTION_VERSION = ACTION["version"]
DEADZONE = ACTION["deadzone"]
LABELS = tuple(a["label"] for a in DISCRETE)


def decode_discrete(index: int) -> dict:
    """Discrete index -> attack-frame action."""
    i = int(index)
    if not 0 <= i < DISCRETE_SIZE:
        raise IndexError(f"decode_discrete: {index} outside 0..{DISCRETE_SIZE - 1}")
    row = DISCRETE[i]
    return {"moveX": row["moveX"], "moveZ": row["moveZ"], "kick": bool(row["kick"])}


def ego_to_world(action: dict, attack_sign: int) -> dict:
    """Attack frame -> pitch frame. Its own inverse."""
    s = -1 if attack_sign < 0 else 1
    out = dict(action)
    out["moveX"] = s * action.get("moveX", 0.0)
    out["moveZ"] = s * action.get("moveZ", 0.0)
    return out


def attack_sign_of(team: int) -> int:
    return 1 if team == 0 else -1


def to_core_input(action: dict) -> dict:
    """Action -> the pre-quantised input dict ``step()`` wants.

    Quantising here rather than inside step() keeps the float boundary in one
    visible place: everything downstream of this call is integers.
    """
    inp = {
        "moveXFx": quantise_axis(action.get("moveX", 0.0)),
        "moveZFx": quantise_axis(action.get("moveZ", 0.0)),
        "buttons": 0,
    }
    if action.get("kick"):
        inp["kick"] = True
    for b in BUTTONS:
        if b != "kick" and action.get(b):
            inp[b] = True
    return inp


def discrete_to_core_input(index: int, team: int) -> dict:
    """The whole pipeline: index -> attack-frame action -> pitch frame -> input."""
    return to_core_input(ego_to_world(decode_discrete(index), attack_sign_of(team)))


# Precomputed table: [team][action index] -> input dict. Small, immutable and
# hot, since it is hit once per agent per decision.
CORE_INPUTS = tuple(
    tuple(discrete_to_core_input(a, team) for a in range(DISCRETE_SIZE))
    for team in (0, 1)
)


def encode_discrete(action: dict) -> int:
    """Attack-frame action -> the discrete index that decodes back to it."""
    x = float(action.get("moveX", 0.0) or 0.0)
    z = float(action.get("moveZ", 0.0) or 0.0)
    kick = bool(action.get("kick"))
    base = 1 + len(DIRECTIONS) if kick else 0
    length = np.sqrt(x * x + z * z)
    if length < DEADZONE:
        return base
    best = 0
    best_dot = -np.inf
    for d, direction in enumerate(DIRECTIONS):
        dot = (x * direction["x"] + z * direction["z"]) / length
        if dot > best_dot:
            best_dot = dot
            best = d
    return base + 1 + best
