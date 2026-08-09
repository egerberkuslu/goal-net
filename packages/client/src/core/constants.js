// FIFA goal + ball dimensions and physical constants (SI units)
export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
export const POST_R = 0.06;

export const NET_TOP_DEPTH = 1.1;  // how far back the net roof extends
export const NET_BOT_DEPTH = 2.4;  // ground footprint depth behind goal line
export const NET_CELL = 0.14;      // mesh opening size
export const CORD_R = 0.006;

export const BALL_R = 0.15; // slightly bigger than regulation for readability
export const BALL_M = 0.43;
export const BALL_A = Math.PI * BALL_R * BALL_R;

export const GRAV = 9.81;
export const RHO_AIR = 1.2;
// calibrated so the oversized display ball flies like a regulation ball
// (drag area scales with r^2, so Cd is scaled down to match A/m of the real thing)
export const CD_BALL = 0.14;

export const DT = 1 / 60;
export const SUBSTEPS = 12;
export const ITERS = 3;
export const CONTACT_CORD_R = 0.02; // inflated cord radius for ball contact
export const STRAIN_LIMIT = 1.06;   // hard cap on cord stretch
// how hard the knotted mesh drains a ball it is touching (1/s); a real net
// swallows a shot instead of trampolining it back out
export const NET_GRIP = 14;

// XPBD compliances (m/N)
export const COMPLIANCE_STRUCT = 2e-6;
export const COMPLIANCE_SHEAR = 6e-4;
export const COMPLIANCE_STITCH = 2e-6;

export const NODE_MASS = 0.004; // ~4 g of cord per knot

// restitutions
export const REST_GROUND = 0.62;
export const REST_POST = 0.7;
export const REST_WALL = 0.72;
export const REST_PLAYER = 0.25; // soft touch so dribbling sticks to the feet

// arena (Haxball-style bounded pitch, goals on the z axis)
export const PITCH_HALF_L = 18;  // goal lines at z = ±18
export const PITCH_HALF_W = 11;  // touchlines at x = ±11
export const WALL_X = 11.5;      // side wall at the ad boards
export const WALL_Z_BACK = 21.4; // safety wall behind the (deeper) nets
export const BOARD_TOP = 0.76;   // boards only block the ball below this height

// players
export const PLAYER_R = 0.35;
export const PLAYER_H = 1.7;
export const PLAYER_SPEED = 6.5;
export const PLAYER_ACCEL_RATE = 9; // 1/s velocity approach rate

// kicking
export const KICK_RANGE = 1.5;   // centre distance within which a kick connects
export const KICK_ASSIST = 0.55; // pull toward the goal frame when facing it
export const KICK_MIN = 11;
export const KICK_MAX = 24;
export const LOFT_MIN = 0.06;
export const LOFT_MAX = 0.42;
export const KICK_CHARGE_TIME = 0.6; // seconds to full charge

// ragdoll knockdowns
export const RAGDOLL_SPEED = 11; // relative ball speed that floors a player
export const RAGDOLL_TIME = 1.5;

// jumping — a straight-up leap so a player can rise to head a ball that is
// over a standing player's reach. Take-off speed was already live (keepers
// leaping for a cross); formalised here as a named, documented constant.
// height = vy^2 / (2*GRAV) = 4.4^2 / 19.62 ~= 0.99 m
// hang time = 2*vy / GRAV = 2*4.4 / 9.81 ~= 0.90 s
// That reach matters: PLAYER_H (1.7) alone already covers a header at the
// ball-height header threshold (1.15), so the leap exists for balls ABOVE
// standing reach — crosses and long balls in the 1.7-3.1 m band (see the
// "top" reach formula in world.js#collideBallPlayers).
export const JUMP_TAKEOFF_VY = 4.4;
// no double-jump: a short dead time on the ground after landing before the
// next take-off is armed, on top of the "can't jump while airborne" guard.
export const JUMP_COOLDOWN = 0.35;

// fouls and set pieces
// a slide that floors an opponent while the ball is farther away than this is
// a foul, not a tackle: the tackler took the man, not the ball
export const FOUL_BALL_DIST = 1.2;
export const BOX_HALF_W = 7;        // penalty area half-width
export const BOX_DEPTH = 4.5;       // penalty area depth from the goal line
export const PENALTY_SPOT_INSET = 6; // spot sits this far in front of the line
export const SETPIECE_FREEZE = 1.2;  // ceremony seconds before the kick is live
export const SETPIECE_TIMEOUT = 8;   // hard release so play can never stall

// slide tackle: the risk/reward window. A slide that reaches an opponent
// EARLY (within this many seconds of leaving the feet) is judged the normal
// way — clean if it also reached the ball (FOUL_BALL_DIST), a foul if it
// only reached the man. A slide that connects LATE — after the window has
// passed, still sliding but past the committed lunge — is a mistimed,
// trailing-leg challenge and is always a foul, however close the ball is:
// the risk grows the longer the tackler is already committed to the ground.
export const SLIDE_WINDOW = 0.35; // of the 0.6 s total slide (see player.js)

// shoulder-to-shoulder: two opposing players pressed together while running
// can lean and shove. Builds on the existing player-player depenetration in
// world.js#collidePlayers rather than a separate system.
export const SHOULDER_MIN_SPEED = 1.5;   // below this closing speed: incidental contact, no shove
export const SHOULDER_MAX_SPEED = 7.0;   // closing speed at which the shove impulse saturates
// beyond this closing speed it reads as a reckless charge, not a shove — a
// foul instead of a push (a two-sprinter head-on collision is ~13 m/s)
export const SHOULDER_FOUL_SPEED = 10.5;
export const SHOULDER_PUSH = 3.2;        // m/s of lateral shove landed on the victim at full saturation
// fraction of the pusher's own speed spent on a full-saturation shove — the
// "leaning in" costs him pace, same trade real shoulder charges make
export const SHOULDER_DRAG = 0.28;
// per-pair dead time after a shove so continuous contact (running side by
// side) reads as a cadence of jostles, not 12 shoves crammed into one frame
export const SHOULDER_COOLDOWN = 0.4;

// keeper hands: catch, hold, hand throw, foot (goal-kick style) clearance.
// Extends the existing keeper logic in ai.js/game.js rather than replacing
// its instant-clearance path — a catch simply pins the ball first.
export const KEEPER_CATCH_REACH = 0.55;  // extra grab reach beyond PLAYER_R + BALL_R
export const KEEPER_CATCH_MAX_Y = 2.0;   // above this height it is a punch/header situation, not a catch
export const KEEPER_HOLD_TIME = 3.5;     // forced release once this clock runs out (design doc: 3-4 s)
export const KEEPER_THROW_SPEED = 13;    // hand throw: flat, medium, uncharged (design doc: "straight, medium")
export const KEEPER_CLEAR_MIN = 15;      // foot clearance floor (a stubbed tap)
export const KEEPER_CLEAR_MAX = 27;      // foot clearance ceiling at full charge — beats KICK_MAX (24)
// a ball released from a hold cannot be scored as an own goal against the
// releasing keeper for this long unless another player touches it first —
// guards the physics quirk of a release curling straight back into the net
export const GRIEF_LOCK_TIME = 3.0;

// match
export const MATCH_TIME = 180;
export const MATCH_GOALS = 5;
export const HALF_BREAK = 2.5;   // seconds of the half-time freeze
export const GOLDEN_MAX = 90;    // sudden death runs at most this long
