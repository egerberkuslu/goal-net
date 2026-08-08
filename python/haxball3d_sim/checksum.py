"""FNV-1a 32-bit, mirroring packages/core/src/checksum.js.

The JS hash walks an Int32 array and feeds each value as four explicit
little-endian bytes; it never views the underlying ArrayBuffer, so the digest
is host-endianness independent and this port only has to reproduce the byte
order, not the memory layout.

``Math.imul(h, PRIME) >>> 0`` is a 32-bit multiply that keeps the low 32 bits,
so the Python form is ``(h * PRIME) & 0xFFFFFFFF``. The XOR in JS runs through
ToInt32 first, but XOR and multiplication agree modulo 2**32 whichever sign
convention is used, so the unsigned form here is exact.
"""

from __future__ import annotations

import numpy as np

FNV_OFFSET = 0x811C9DC5
FNV_PRIME = 0x01000193
_MASK = 0xFFFFFFFF


def fnv1a_ints(ints, seed: int = FNV_OFFSET) -> int:
    """FNV-1a over a sequence of Int32 values. Returns an unsigned 32-bit int."""
    h = seed & _MASK
    for value in ints:
        v = int(value) & _MASK
        h = ((h ^ (v & 0xFF)) * FNV_PRIME) & _MASK
        h = ((h ^ ((v >> 8) & 0xFF)) * FNV_PRIME) & _MASK
        h = ((h ^ ((v >> 16) & 0xFF)) * FNV_PRIME) & _MASK
        h = ((h ^ ((v >> 24) & 0xFF)) * FNV_PRIME) & _MASK
    return h


def fnv1a_bytes(data: bytes, seed: int = FNV_OFFSET) -> int:
    h = seed & _MASK
    for byte in data:
        h = ((h ^ byte) * FNV_PRIME) & _MASK
    return h


def fnv1a_ints_fast(arr: np.ndarray, seed: int = FNV_OFFSET) -> int:
    """Same digest, one pass over the little-endian byte view.

    Identical by construction: ``int32.tobytes()`` on a little-endian build is
    the same byte sequence the JS loop emits by hand. Only used where speed
    matters; the checksum chain test runs both and compares.
    """
    return fnv1a_bytes(np.ascontiguousarray(arr, dtype="<i4").tobytes(), seed)


def fnv1a_string(text: str, seed: int = FNV_OFFSET) -> int:
    """FNV-1a over the UTF-16 code units of a string, byte-wise little-endian.

    JS iterates ``charCodeAt``, i.e. UTF-16 code units, so an astral character
    contributes two surrogates. Encoding to UTF-16-LE reproduces that exactly,
    where iterating Python code points would not.
    """
    h = seed & _MASK
    data = text.encode("utf-16-le")
    for i in range(0, len(data), 2):
        h = ((h ^ data[i]) * FNV_PRIME) & _MASK
        h = ((h ^ data[i + 1]) * FNV_PRIME) & _MASK
    return h


def to_hex32(h: int) -> str:
    """Unsigned 32-bit int -> lowercase 8-digit hex."""
    return f"{h & _MASK:08x}"


def checksum_ints(ints) -> str:
    return to_hex32(fnv1a_ints(ints))
