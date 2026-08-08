"""haxball3d_sim - NumPy port of @goalnet/core, bit-identical to the JS engine.

The JS core (packages/core) is the specification; this package is the port that
Phase 2's MARL training runs against. "Port" here means bit-identical, not
approximately equal: the same inputs produce the same Q16.16 integers and the
same per-tick FNV-1a checksum chain, which is what lets a policy trained in
Python be trusted in the browser and lets a replay recorded in one be verified
in the other.

    from haxball3d_sim import create_world, step, checksum
    world = create_world(player_count=2)
    step(world, [{"moveX": 1, "moveZ": 0, "kick": False}, None])
    checksum(world)

Parity is proven, not assumed: ``python3 python/test_parity.py``.
"""

from . import fx
from .checksum import checksum_ints, fnv1a_ints, fnv1a_string, to_hex32
from .layout import (
    ACTION,
    BTN,
    C,
    CONSTANTS_HASH,
    CORE_VERSION,
    OBSERVATION,
    PITCH_PRESETS,
    STATE_VERSION,
    TICK_RATE,
    player_offset,
    state_length,
)
from .matchrules import (
    SettingsError,
    normalise_settings,
    pitch_preset,
    settings_flags,
    settings_hash,
)
from .world import (
    World,
    charge_power,
    checksum,
    control_advice,
    create_world,
    deserialize,
    in_penalty_area,
    keeper_empowered,
    pitch_of,
    place,
    quantise_axis,
    quantise_input,
    read_state,
    reset_kickoff,
    serialize,
    set_curve,
    step,
    world_settings,
)

__all__ = [
    "ACTION",
    "BTN",
    "C",
    "CONSTANTS_HASH",
    "CORE_VERSION",
    "OBSERVATION",
    "PITCH_PRESETS",
    "STATE_VERSION",
    "SettingsError",
    "TICK_RATE",
    "World",
    "charge_power",
    "checksum",
    "checksum_ints",
    "control_advice",
    "create_world",
    "deserialize",
    "fnv1a_ints",
    "fnv1a_string",
    "fx",
    "in_penalty_area",
    "keeper_empowered",
    "normalise_settings",
    "pitch_of",
    "pitch_preset",
    "place",
    "player_offset",
    "quantise_axis",
    "quantise_input",
    "read_state",
    "reset_kickoff",
    "serialize",
    "set_curve",
    "settings_flags",
    "settings_hash",
    "state_length",
    "step",
    "to_hex32",
    "world_settings",
]
