// Q16.16 signed fixed-point arithmetic on Int32.
//
// Why: plain JS doubles are IEEE-754 and therefore reproducible for +, -, *, /
// and sqrt, but the transcendental library functions (Math.sin, Math.cos,
// Math.pow, Math.exp...) are explicitly "implementation-approximated" in the
// ECMAScript spec and DO differ between v8, SpiderMonkey and JavaScriptCore.
// A simulation that touches any of them stops being bit-identical across
// devices. Fixed-point removes the question entirely: every value in the world
// state is an Int32, every operation is integer add/shift/compare, and the only
// doubles that appear are exact integers below 2^53 used as a 64-bit scratch
// register. Two engines cannot disagree about those.
//
// Representation
//   value = raw / 2^16, raw stored as a signed 32-bit integer
//   range  [-32768, 32767.99998], resolution 1/65536 ≈ 1.5259e-5
//
// Rules of the house
//   * every operator saturates instead of wrapping; a runaway value pins at
//     FX_MAX/FX_MIN and stays comparable rather than flipping sign
//   * multiplication and division truncate toward zero, so decaying values
//     reach exactly 0 instead of oscillating in the last bit
//   * fxFromNumber / fxToNumber are the ONLY float boundary; they belong in
//     authoring code (constant tables), input quantisation and rendering
//     read-out, never inside a tick

export const FX_SHIFT = 16;
export const FX_SCALE = 65536; // 2^16
export const FX_ONE = 65536;
export const FX_HALF = 32768;
export const FX_MAX = 2147483647; // 32767.99998
export const FX_MIN = -2147483648; // -32768
export const FX_EPS = 1; // smallest positive step, 1/65536

// Largest magnitude whose square still lands inside the exact-integer range of
// a double (2^26 squared is 2^52; two of them sum to 2^53).
const HYPOT_SAFE = 67108864; // 2^26 raw = 1024.0

// ---------------------------------------------------------------- boundary

/** Float -> fixed. Authoring / input boundary only. */
export function fxFromNumber(n) {
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n * FX_SCALE);
  if (r > FX_MAX) return FX_MAX;
  if (r < FX_MIN) return FX_MIN;
  return r | 0;
}

/** Fixed -> float. Rendering / reporting boundary only. */
export function fxToNumber(a) {
  return (a | 0) / FX_SCALE;
}

/** Integer -> fixed, saturating. */
export function fxFromInt(n) {
  const r = (n | 0) * FX_SCALE;
  if (r > FX_MAX) return FX_MAX;
  if (r < FX_MIN) return FX_MIN;
  return r | 0;
}

/** Fixed -> integer, truncating toward zero. */
export function fxToInt(a) {
  a |= 0;
  return a < 0 ? -Math.floor(-a / FX_SCALE) | 0 : Math.floor(a / FX_SCALE) | 0;
}

// ---------------------------------------------------------------- core ops

export function fxAdd(a, b) {
  // |a|,|b| < 2^31 so the sum is an exact double before we clamp it.
  const s = (a | 0) + (b | 0);
  if (s > FX_MAX) return FX_MAX;
  if (s < FX_MIN) return FX_MIN;
  return s | 0;
}

export function fxSub(a, b) {
  const s = (a | 0) - (b | 0);
  if (s > FX_MAX) return FX_MAX;
  if (s < FX_MIN) return FX_MIN;
  return s | 0;
}

export function fxNeg(a) {
  a |= 0;
  return a === FX_MIN ? FX_MAX : -a | 0;
}

export function fxAbs(a) {
  a |= 0;
  return a < 0 ? (a === FX_MIN ? FX_MAX : -a | 0) : a;
}

export function fxSign(a) {
  a |= 0;
  return a > 0 ? 1 : a < 0 ? -1 : 0;
}

/**
 * (a * b) >> 16 with an exact 64-bit intermediate.
 *
 * The product is split into 16-bit limbs so every partial term stays an exact
 * integer double (the largest is ah*bh*2^16 <= 2^46). No engine has any
 * freedom here: integer arithmetic below 2^53 is exact in IEEE-754.
 */
export function fxMul(a, b) {
  a |= 0;
  b |= 0;
  const neg = a < 0 !== b < 0;
  const ua = a < 0 ? -a : a; // 2^31 when a === FX_MIN; still exact as a double
  const ub = b < 0 ? -b : b;
  const ah = (ua / FX_SCALE) | 0;
  const al = ua - ah * FX_SCALE;
  const bh = (ub / FX_SCALE) | 0;
  const bl = ub - bh * FX_SCALE;
  // |mag| < 2^47, exact
  const mag = ah * bh * FX_SCALE + ah * bl + al * bh + ((al * bl) >>> FX_SHIFT);
  if (neg) return mag >= 2147483648 ? FX_MIN : -mag | 0;
  return mag > FX_MAX ? FX_MAX : mag | 0;
}

/**
 * (a << 16) / b, truncated toward zero, saturating.
 *
 * Math.floor on a double quotient can land one off when the true quotient sits
 * a hair under an integer, so the remainder is recomputed exactly and the
 * estimate corrected. Both q*ub and the numerator stay below 2^48.
 * Division by zero saturates with the sign of the numerator.
 */
export function fxDiv(a, b) {
  a |= 0;
  b |= 0;
  if (b === 0) return a > 0 ? FX_MAX : a < 0 ? FX_MIN : 0;
  if (a === 0) return 0;
  const neg = a < 0 !== b < 0;
  const ua = a < 0 ? -a : a;
  const ub = b < 0 ? -b : b;
  const num = ua * FX_SCALE; // <= 2^47, exact
  let q = Math.floor(num / ub);
  const r = num - q * ub; // exact: q*ub is within one ub of num
  if (r < 0) q -= 1;
  else if (r >= ub) q += 1;
  if (neg) return q >= 2147483648 ? FX_MIN : -q | 0;
  return q > FX_MAX ? FX_MAX : q | 0;
}

export function fxMin(a, b) {
  a |= 0;
  b |= 0;
  return a < b ? a : b;
}

export function fxMax(a, b) {
  a |= 0;
  b |= 0;
  return a > b ? a : b;
}

export function fxClamp(a, lo, hi) {
  a |= 0;
  if (a < lo) return lo | 0;
  if (a > hi) return hi | 0;
  return a;
}

// ------------------------------------------------------------------ roots

/**
 * Exact floor(sqrt(v)) for a non-negative integer v <= 2^53.
 *
 * Digit-by-digit (restoring) square root: no Math.sqrt seed, so the result
 * cannot inherit anyone's rounding. Every intermediate is an exact integer.
 */
export function isqrtInt(v) {
  if (!(v > 0)) return 0;
  let bit = 1;
  while (bit * 4 <= v) bit *= 4;
  let res = 0;
  let num = v;
  // `bit >= 1` rather than `bit > 0`: bit walks powers of four exactly, and
  // stopping at 1 keeps the halving of `res` on integers.
  while (bit >= 1) {
    const t = res + bit;
    if (num >= t) {
      num -= t;
      res = Math.floor(res / 2) + bit;
    } else {
      res = Math.floor(res / 2);
    }
    bit = bit / 4;
  }
  return res;
}

/** sqrt of a fixed-point value; negatives clamp to 0. Error < 1 LSB. */
export function fxSqrt(a) {
  a |= 0;
  if (a <= 0) return 0;
  // sqrt(a/2^16) * 2^16 === sqrt(a * 2^16); a*2^16 <= 2^47, exact.
  return isqrtInt(a * FX_SCALE) | 0;
}

/**
 * sqrt(x^2 + y^2) in raw units, i.e. the length of a fixed-point vector.
 *
 * Exact for |x|,|y| <= 1024.0 (the whole pitch and then some). Beyond that the
 * inputs are halved until the squares fit under 2^53 and the answer is scaled
 * back, which costs low bits but never overflows.
 */
export function fxHypot(x, y) {
  let ax = x < 0 ? -x : x;
  let ay = y < 0 ? -y : y;
  if (ax === 0) return ay > FX_MAX ? FX_MAX : ay | 0;
  if (ay === 0) return ax > FX_MAX ? FX_MAX : ax | 0;
  let shift = 0;
  while (ax > HYPOT_SAFE || ay > HYPOT_SAFE) {
    ax = Math.floor(ax / 2);
    ay = Math.floor(ay / 2);
    shift++;
  }
  let r = isqrtInt(ax * ax + ay * ay);
  for (let i = 0; i < shift; i++) r *= 2; // integer doubling, no Math.pow
  return r > FX_MAX ? FX_MAX : r | 0;
}

/**
 * Unit vector of (x, y) written into out[0], out[1]. Zero-length stays zero.
 * Returns the original length in raw units.
 */
export function fxNormalize(x, y, out) {
  const len = fxHypot(x, y);
  if (len === 0) {
    out[0] = 0;
    out[1] = 0;
    return 0;
  }
  out[0] = fxDiv(x, len);
  out[1] = fxDiv(y, len);
  return len;
}

// --------------------------------------------------------------- angles

export const FX_PI = 205887; // 3.14159...
export const FX_TWO_PI = 411775;
export const FX_HALF_PI = 102944;

// atan(2^-i) in Q16.16, hardcoded so the table never depends on Math.atan.
const CORDIC_ATAN = [
  51472, 30386, 16055, 8150, 4091, 2047, 1024, 512, 256, 128, 64, 32, 16, 8, 4,
  2,
];
// Product of 1/sqrt(1+4^-i) over the 16 iterations, in Q16.16.
const CORDIC_K = 39797;

/** Wrap a Q16.16 radian angle into [-pi, pi). */
export function fxWrapAngle(a) {
  a |= 0;
  if (a >= -FX_PI && a < FX_PI) return a;
  // exact integer scratch: |a| < 2^31, FX_TWO_PI ~ 2^18.7
  const k = Math.floor((a + FX_PI) / FX_TWO_PI);
  const w = a - k * FX_TWO_PI;
  return w | 0;
}

/**
 * sin and cos of a Q16.16 radian angle, written into out[0] (cos), out[1] (sin).
 * 16-iteration CORDIC in rotation mode: shifts, adds and a hardcoded arctan
 * table only. Absolute error stays under ~5e-4.
 */
export function fxSinCos(angle, out) {
  let z = fxWrapAngle(angle);
  let flip = 1;
  // CORDIC only converges on [-pi/2, pi/2]; reflect the outer quadrants.
  if (z > FX_HALF_PI) {
    z = z - FX_PI;
    flip = -1;
  } else if (z < -FX_HALF_PI) {
    z = z + FX_PI;
    flip = -1;
  }
  let x = CORDIC_K;
  let y = 0;
  for (let i = 0; i < 16; i++) {
    const dx = x >> i;
    const dy = y >> i;
    if (z >= 0) {
      const nx = x - dy;
      y = y + dx;
      x = nx;
      z -= CORDIC_ATAN[i];
    } else {
      const nx = x + dy;
      y = y - dx;
      x = nx;
      z += CORDIC_ATAN[i];
    }
  }
  out[0] = (flip * x) | 0;
  out[1] = (flip * y) | 0;
  return out;
}

export function fxCos(angle) {
  const o = [0, 0];
  fxSinCos(angle, o);
  return o[0];
}

export function fxSin(angle) {
  const o = [0, 0];
  fxSinCos(angle, o);
  return o[1];
}
