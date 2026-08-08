"""Match settings, mirroring packages/core/src/matchRules.js.

Only the parts a simulation needs are ported: normalisation, the canonical
serialisation, the two hashes and the pitch preset lookup. The wire codec
(encodeSettings / decodeSettings) belongs to the net layer and has no Python
consumer, so it is deliberately absent rather than ported and left untested.

The hash is the load-bearing piece. ``settingsHashInt`` lands in the state
header, the header is hashed into the per-tick checksum, and a settings hash
that is one bit off would make every chain in a non-default room diverge at
tick 0 -- which is exactly how the fixture test would catch it.

Key order for the hash is the JS ``SETTING_KEYS``, already sorted. JS's default
``Array.prototype.sort`` orders by UTF-16 code unit and Python's ``sorted``
orders by code point; for these ASCII identifiers the two agree, and the order
is hardcoded here anyway so the question never arises.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType

from .checksum import fnv1a_string, to_hex32
from .layout import (
    DEFAULT_SETTINGS,
    MATCH_FINISHED,
    MATCH_RUNNING,
    MAX_DURATION_SECONDS,
    MAX_SCORE_LIMIT,
    MIN_DURATION_SECONDS,
    MIN_SCORE_LIMIT,
    PITCH_BY_ID,
    PITCH_PRESETS,
    RULE_GOLDEN_GOAL,
    RULE_KEEPERS,
    RULE_MASK,
    RULE_MERCY,
    TICK_RATE,
    END_NAMES,
    PHASE_NAMES,
)

SETTING_KEYS = (
    "durationSeconds",
    "goldenGoal",
    "keepers",
    "mercyRule",
    "pitch",
    "scoreLimit",
)

PITCH_ALIASES = {
    "kucuk": 1,
    "small": 1,
    "s": 1,
    "orta": 2,
    "medium": 2,
    "m": 2,
    "buyuk": 3,
    "large": 3,
    "big": 3,
    "l": 3,
}


class SettingsError(Exception):
    """Mirrors matchRules.js's SettingsError, including the stable ``code``."""

    def __init__(self, code: str, message: str, issues=()):
        super().__init__(message)
        self.code = code
        self.issues = list(issues)


def pitch_code_of(value) -> int:
    """Preset code for an id, alias or code. 0 when the value is not a preset."""
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value if 1 <= value <= 3 else 0
    if not isinstance(value, str):
        return 0
    return PITCH_ALIASES.get(value.lower(), 0)


def pitch_preset(value):
    code = pitch_code_of(value)
    if code == 0:
        raise SettingsError("bad-pitch", f"unknown pitch preset {value!r}")
    return PITCH_PRESETS[code]


def _coerce_int(v, lo, hi):
    if isinstance(v, bool):
        return None  # True is not "1 second"
    if not isinstance(v, int):
        return None
    if v < lo or v > hi:
        return None
    return v


def _coerce_bool(v):
    if v is True or v is False:
        return v
    if v == 1 and isinstance(v, int):
        return True
    if v == 0 and isinstance(v, int):
        return False
    return None


def normalise_settings(raw=None, strict: bool = False):
    """Anything -> a canonical, frozen settings mapping. Lenient by default."""
    out = dict(DEFAULT_SETTINGS)
    issues = []
    if raw is None:
        if strict:
            raise SettingsError(
                "not-an-object", "settings missing", ["settings: missing"]
            )
        return MappingProxyType(out)
    # A Mapping, not a dict: normalise_settings is routinely handed the frozen
    # MappingProxyType it returned earlier (create_world does exactly that), and
    # an isinstance(raw, dict) test would silently reject it and fall all the
    # way back to DEFAULT_SETTINGS. JS has no such trap -- typeof frozenObject
    # is still 'object' -- so this is a port hazard, not a JS behaviour.
    if not isinstance(raw, Mapping):
        if strict:
            raise SettingsError(
                "not-an-object",
                "settings is not an object",
                [f"settings: {type(raw).__name__}"],
            )
        return MappingProxyType(out)

    for key in raw:
        if key not in SETTING_KEYS:
            issues.append(f"{key}: unknown setting")

    if "durationSeconds" in raw:
        v = _coerce_int(
            raw["durationSeconds"], MIN_DURATION_SECONDS, MAX_DURATION_SECONDS
        )
        if v is None:
            issues.append(f"durationSeconds: {raw['durationSeconds']!r}")
        else:
            out["durationSeconds"] = v

    if "scoreLimit" in raw:
        v = _coerce_int(raw["scoreLimit"], MIN_SCORE_LIMIT, MAX_SCORE_LIMIT)
        if v is None:
            issues.append(f"scoreLimit: {raw['scoreLimit']!r}")
        else:
            out["scoreLimit"] = v

    if "pitch" in raw:
        code = pitch_code_of(raw["pitch"])
        if code == 0:
            issues.append(f"pitch: {raw['pitch']!r}")
        else:
            out["pitch"] = PITCH_PRESETS[code]["id"]

    for key in ("goldenGoal", "mercyRule", "keepers"):
        if key not in raw:
            continue
        b = _coerce_bool(raw[key])
        if b is None:
            issues.append(f"{key}: {raw[key]!r}")
        else:
            out[key] = b

    if strict and issues:
        raise SettingsError("invalid", f"rejected {len(issues)} setting(s)", issues)
    return MappingProxyType(out)


def serialize_settings(raw) -> str:
    """``name=value;`` in sorted key order, booleans as 0/1, pitch as its id."""
    s = normalise_settings(raw)
    parts = []
    for k in SETTING_KEYS:
        v = s[k]
        if v is True:
            v = 1
        elif v is False:
            v = 0
        parts.append(f"{k}={v};")
    return "".join(parts)


def settings_hash(raw) -> str:
    return to_hex32(fnv1a_string(serialize_settings(raw)))


def settings_hash_int(raw) -> int:
    """Low 32 bits as a SIGNED int, the form the state header stores."""
    h = int(settings_hash(raw), 16)
    return h - 0x100000000 if h >= 0x80000000 else h


def same_settings(a, b) -> bool:
    return settings_hash(a) == settings_hash(b)


def assert_same_settings(expected, actual) -> bool:
    e = settings_hash(expected)
    a = settings_hash(actual)
    if e != a:
        raise SettingsError(
            "settings-mismatch",
            f"settings {a} does not match the host's {e}",
            [serialize_settings(actual), serialize_settings(expected)],
        )
    return True


def settings_flags(raw) -> int:
    s = normalise_settings(raw)
    return (
        (RULE_GOLDEN_GOAL if s["goldenGoal"] else 0)
        | (RULE_MERCY if s["mercyRule"] else 0)
        | (RULE_KEEPERS if s["keepers"] else 0)
    )


def duration_ticks(raw) -> int:
    return normalise_settings(raw)["durationSeconds"] * TICK_RATE


def settings_from(
    duration_ticks_value: int, score_limit: int, pitch_code: int, flags: int
):
    """Rebuild a settings mapping from already-unpacked header words."""
    if duration_ticks_value % TICK_RATE != 0:
        raise SettingsError(
            "bad-duration",
            f"duration {duration_ticks_value} ticks is not a whole number of seconds",
        )
    if pitch_code < 1 or pitch_code > 3:
        raise SettingsError("bad-pitch", f"pitch code {pitch_code} out of range")
    if flags & ~RULE_MASK:
        raise SettingsError("bad-flags", f"rule flags {flags} carry unknown bits")
    return normalise_settings(
        {
            "durationSeconds": duration_ticks_value // TICK_RATE,
            "scoreLimit": score_limit,
            "pitch": PITCH_PRESETS[pitch_code]["id"],
            "goldenGoal": bool(flags & RULE_GOLDEN_GOAL),
            "mercyRule": bool(flags & RULE_MERCY),
            "keepers": bool(flags & RULE_KEEPERS),
        },
        strict=True,
    )


def end_reason_name(code: int) -> str:
    return END_NAMES[code] if 0 <= code < len(END_NAMES) else "none"


def match_phase_name(code: int) -> str:
    return PHASE_NAMES[code] if 0 <= code < len(PHASE_NAMES) else "running"


def leader_of(score0: int, score1: int) -> int:
    if score0 > score1:
        return 0
    if score1 > score0:
        return 1
    return -1


__all__ = [
    "SettingsError",
    "SETTING_KEYS",
    "PITCH_BY_ID",
    "MATCH_RUNNING",
    "MATCH_FINISHED",
    "assert_same_settings",
    "duration_ticks",
    "end_reason_name",
    "leader_of",
    "match_phase_name",
    "normalise_settings",
    "pitch_code_of",
    "pitch_preset",
    "same_settings",
    "serialize_settings",
    "settings_flags",
    "settings_from",
    "settings_hash",
    "settings_hash_int",
]
