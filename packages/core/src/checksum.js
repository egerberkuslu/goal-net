// FNV-1a 32-bit over raw Int32 state.
//
// The hash walks the state buffer in index order and feeds each Int32 as four
// explicit little-endian bytes. It never views the underlying ArrayBuffer as
// bytes, so a big-endian host produces the same digest as a little-endian one,
// and the digest is stable as long as the field layout is stable.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a over an array-like of Int32 values. Returns an unsigned 32-bit int. */
export function fnv1aInts(ints, seed = FNV_OFFSET) {
  let h = seed >>> 0;
  for (let i = 0; i < ints.length; i++) {
    const v = ints[i] | 0;
    h = (Math.imul(h ^ (v & 0xff), FNV_PRIME) >>> 0);
    h = (Math.imul(h ^ ((v >>> 8) & 0xff), FNV_PRIME) >>> 0);
    h = (Math.imul(h ^ ((v >>> 16) & 0xff), FNV_PRIME) >>> 0);
    h = (Math.imul(h ^ ((v >>> 24) & 0xff), FNV_PRIME) >>> 0);
  }
  return h >>> 0;
}

/** FNV-1a over the UTF-16 code units of a string, byte-wise little-endian. */
export function fnv1aString(str, seed = FNV_OFFSET) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (Math.imul(h ^ (c & 0xff), FNV_PRIME) >>> 0);
    h = (Math.imul(h ^ ((c >>> 8) & 0xff), FNV_PRIME) >>> 0);
  }
  return h >>> 0;
}

/** Unsigned 32-bit int -> lowercase 8-digit hex. */
export function toHex32(h) {
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Convenience: hex digest of an Int32 array-like. */
export function checksumInts(ints) {
  return toHex32(fnv1aInts(ints));
}
