// xG-lite (feature matrix #41) — the chance a shot becomes a goal, in [0,1].
//
// Pure, deterministic, cosmetic. It is a display number and a term in the MVP
// score; nothing in packages/core ever sees it.
//
// ==========================================================================
// THE MODEL
// ==========================================================================
//
// A logistic regression on five features, which is the shape every published
// xG model has. It is "lite" because the coefficients are hand-set to this
// arena rather than fitted to shot data we do not have — so they are stated
// here in full and can be re-tuned in one place.
//
//   xG = 1 / (1 + e^(-z))
//
//   z = b0
//     + bDist   * d           distance to the centre of the goal mouth, metres
//     + bAngle  * theta       the angle the goal mouth subtends, radians
//     + bPress  * press       nearest-opponent pressure, [0,1]
//     + bCover  * cover       keeper coverage of the shot line, [0,1]
//     + bPower  * power       shot charge, [0,1]
//
// Coefficients (COEFF below):
//   b0     = -3.20   intercept: a featureless shot is a bad shot
//   bDist  = -0.055  per metre. Small, because theta already carries most of
//                    the distance information (it shrinks as you back away);
//                    this term is what separates two shots at the same angle.
//   bAngle = +5.00   per radian. The dominant term, as in every real xG model:
//                    what a striker is buying with position is goal width.
//   bPress = -1.20   a defender right on top of you roughly quarters the odds.
//   bCover = -2.60   a keeper square on the line is the single biggest
//                    negative; larger in magnitude than pressure because the
//                    keeper is the only body that must be beaten.
//   bPower = +0.60   a fully charged strike is worth about 1.8x the odds of a
//                    tap at the same position; deliberately modest, since in
//                    this core power buys pace and not placement.
//
// FEATURES, exactly as computed:
//
//   d      = |shot - goalCentre| in metres, goalCentre = (0, sign * halfZ).
//
//   theta  = the angle between the vectors from the shot point to the two
//            posts, i.e. the visible width of the goal:
//
//              a = nearPost - shot,  b = farPost - shot
//              theta = acos( (a . b) / (|a| |b|) )
//
//            Posts sit at (+/- goalHalfX, sign * halfZ). Behind the goal line
//            theta is forced to 0: you cannot score from there.
//
//   press  = clamp01(1 - dNearestOpponent / PRESSURE_RADIUS), PRESSURE_RADIUS
//            = 4 m. Keepers are excluded — they are the `cover` term.
//
//   cover  = how well the defending keeper occupies the shot line. Let L be the
//            segment from the shot point to the goal centre, `perp` the
//            keeper's perpendicular distance to L, and `along` his projection
//            onto it as a fraction of |L|:
//
//              cover = clamp01(1 - perp / COVER_HALF_WIDTH) * clamp01(along)
//
//            COVER_HALF_WIDTH = goalHalfX + playerR: a keeper further off the
//            line than half a goal plus his own body is not covering it. The
//            `along` factor drops the term to 0 for a keeper who is behind the
//            shooter (along < 0), and rewards one who has come out (along near
//            1 is on his line; the product is unchanged, which is the honest
//            "lite" simplification — narrowing the angle by coming out is
//            already priced into theta from the shooter's position).
//            No keeper on the pitch => cover = 0.
//
//   power  = charge ticks / CHARGE_MAX_TICKS, clamped, or 1 for an uncharged
//            instant kick at full impulse.
//
// WORKED EXAMPLES (also frozen in scripts/present-test.mjs)
//
//   goalHalfX = 2.357 m, halfZ = 18 m (the medium preset in metres).
//
//   A. Tap-in.       shot at (0, 16), no keeper, no pressure, power 0.5
//      d = 2.0000, theta = 1.7344
//      z = -3.20 - 0.055*2 + 5*1.7344 + 0.6*0.5 = 5.6620  ->  xG = 0.9965
//
//   B. Edge of the box, clear.  shot at (0, 12), no keeper, power 0.8
//      d = 6.0000, theta = 0.7487
//      z = -3.20 - 0.330 + 3.7435 + 0.480 = 0.6935        ->  xG = 0.6667
//
//   C. Same shot, keeper square on the goal line (cover 1.0)
//      z = 0.6935 - 2.60 = -1.9065                        ->  xG = 0.1294
//
//   D. Long ball from the halfway line. shot at (0, 0), power 1.0, keeper one
//      metre off his line at (0, 17) -> cover 0.9444
//      d = 18.0000, theta = 0.2604
//      z = -3.20 - 0.990 + 1.3020 + 0.600 - 2.4556 = -4.7436 -> xG = 0.0086
//
//   E. Acute angle, one metre out. shot at (8, 17), power 0.5, no keeper
//      d = 8.0623, theta = 0.0791
//      z = -3.20 - 0.4434 + 0.3955 + 0.300 = -2.9479      ->  xG = 0.0498
//
// Determinism: doubles, then quantised to 1e-4. Distance/angle come from
// readState() positions converted through arena/units.js, so the same recorded
// match yields the same xG on every machine.

const clamp01 = (v) => (v > 1 ? 1 : v < 0 ? 0 : v);

export const COEFF = Object.freeze({
  intercept: -3.2,
  dist: -0.055,
  angle: 5.0,
  press: -1.2,
  cover: -2.6,
  power: 0.6,
});

/** Metres at which an opponent stops applying any pressure at all. */
export const PRESSURE_RADIUS = 4;

/** Output quantum, same idea as tension.js. */
export const XG_QUANTUM = 1e-4;

export const round4 = (v) => Math.round(v / XG_QUANTUM) * XG_QUANTUM;

/**
 * The angle the goal mouth subtends from a point, in radians. 0 behind the
 * goal line or on it.
 *
 * @param {number} x shot x, metres
 * @param {number} z shot z, metres
 * @param {number} sign +1 for the goal at +halfZ, -1 for the one at -halfZ
 * @param {{goalHalfX:number, halfZ:number}} geo
 */
export function goalAngle(x, z, sign, geo) {
  const gz = sign * geo.halfZ;
  const depth = (gz - z) * sign; // metres still to travel toward that goal
  if (!(depth > 1e-6)) return 0;
  const ax = geo.goalHalfX - x;
  const bx = -geo.goalHalfX - x;
  const az = gz - z;
  const la = Math.hypot(ax, az);
  const lb = Math.hypot(bx, az);
  if (la < 1e-9 || lb < 1e-9) return Math.PI;
  const cos = (ax * bx + az * az) / (la * lb);
  return Math.acos(cos > 1 ? 1 : cos < -1 ? -1 : cos);
}

/**
 * Keeper coverage of the shot line, [0,1]. See the header for the geometry.
 *
 * @param {{x:number,z:number}} shot
 * @param {{x:number,z:number}|null} keeper
 * @param {number} sign attacking direction
 * @param {{goalHalfX:number, halfZ:number, playerR:number}} geo
 */
export function keeperCover(shot, keeper, sign, geo) {
  if (!keeper) return 0;
  const gx = 0;
  const gz = sign * geo.halfZ;
  const lx = gx - shot.x;
  const lz = gz - shot.z;
  const len2 = lx * lx + lz * lz;
  if (len2 < 1e-9) return 1;
  const kx = keeper.x - shot.x;
  const kz = keeper.z - shot.z;
  const along = (kx * lx + kz * lz) / len2;
  if (along <= 0) return 0; // behind the shooter: not in the way of anything
  const len = Math.sqrt(len2);
  const perp = Math.abs(kx * lz - kz * lx) / len;
  const halfWidth = geo.goalHalfX + (geo.playerR || 0);
  return clamp01(1 - perp / halfWidth) * clamp01(along);
}

/** Nearest-opponent pressure, [0,1]. Keepers excluded (they are `cover`). */
export function pressureOf(shot, opponents) {
  let best = Infinity;
  for (const o of opponents || []) {
    if (!o || o.keeper) continue;
    const d = Math.hypot(o.x - shot.x, o.z - shot.z);
    if (d < best) best = d;
  }
  if (!Number.isFinite(best)) return 0;
  return clamp01(1 - best / PRESSURE_RADIUS);
}

/**
 * The model itself, on already-extracted features. Split out so the test can
 * hit the arithmetic without building a pitch.
 *
 * @param {{d:number, theta:number, press:number, cover:number, power:number}} f
 */
export function xgFromFeatures(f) {
  const z =
    COEFF.intercept +
    COEFF.dist * Math.max(0, f.d || 0) +
    COEFF.angle * Math.max(0, f.theta || 0) +
    COEFF.press * clamp01(f.press || 0) +
    COEFF.cover * clamp01(f.cover || 0) +
    COEFF.power * clamp01(f.power == null ? 1 : f.power);
  return round4(1 / (1 + Math.exp(-z)));
}

/**
 * Full evaluation from a shot description in metres.
 *
 * @param {{x:number, z:number, sign:number, power?:number,
 *          keeper?:{x:number,z:number}|null, opponents?:object[]}} shot
 * @param {{goalHalfX:number, halfZ:number, playerR:number}} geo
 * @returns {{xg:number, d:number, theta:number, press:number, cover:number,
 *            power:number}}
 */
export function xgOf(shot, geo) {
  const sign = shot.sign >= 0 ? 1 : -1;
  const gz = sign * geo.halfZ;
  const d = Math.hypot(shot.x - 0, shot.z - gz);
  const theta = goalAngle(shot.x, shot.z, sign, geo);
  const press = pressureOf(shot, shot.opponents);
  const cover = keeperCover(shot, shot.keeper || null, sign, geo);
  const power = clamp01(shot.power == null ? 1 : shot.power);
  const xg = theta <= 0 ? 0 : xgFromFeatures({ d, theta, press, cover, power });
  return { xg, d: round4(d), theta: round4(theta), press: round4(press), cover: round4(cover), power };
}
