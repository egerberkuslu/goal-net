// FIFA goal + ball dimensions and physical constants (SI units)
export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
export const POST_R = 0.06;

export const NET_TOP_DEPTH = 0.85; // how far back the net roof extends
export const NET_BOT_DEPTH = 1.7;  // ground footprint depth behind goal line
export const NET_CELL = 0.14;      // mesh opening size
export const CORD_R = 0.006;

export const BALL_R = 0.15; // slightly bigger than regulation for readability
export const BALL_M = 0.43;
export const BALL_A = Math.PI * BALL_R * BALL_R;

export const GRAV = 9.81;
export const RHO_AIR = 1.2;
export const CD_BALL = 0.25;

export const DT = 1 / 60;
export const SUBSTEPS = 12;
export const ITERS = 3;
export const CONTACT_CORD_R = 0.02; // inflated cord radius for ball contact
export const STRAIN_LIMIT = 1.06;   // hard cap on cord stretch

// XPBD compliances (m/N)
export const COMPLIANCE_STRUCT = 2e-6;
export const COMPLIANCE_SHEAR = 6e-4;
export const COMPLIANCE_STITCH = 2e-6;

export const NODE_MASS = 0.004; // ~4 g of cord per knot

// restitutions
export const REST_GROUND = 0.62;
export const REST_POST = 0.7;
export const REST_WALL = 0.72;
export const REST_PLAYER = 0.65;

// arena (Haxball-style bounded pitch, goals on the z axis)
export const PITCH_HALF_L = 18;  // goal lines at z = ±18
export const PITCH_HALF_W = 11;  // touchlines at x = ±11
export const WALL_X = 11.5;      // side wall at the ad boards
export const WALL_Z_BACK = 20.6; // safety wall behind the nets
export const BOARD_TOP = 0.76;   // boards only block the ball below this height

// players
export const PLAYER_R = 0.35;
export const PLAYER_H = 1.7;
export const PLAYER_SPEED = 6.5;
export const PLAYER_ACCEL_RATE = 9; // 1/s velocity approach rate

// kicking
export const KICK_RANGE = 1.05;  // centre distance within which a kick connects
export const KICK_MIN = 11;
export const KICK_MAX = 24;
export const LOFT_MIN = 0.06;
export const LOFT_MAX = 0.42;
export const KICK_CHARGE_TIME = 0.6; // seconds to full charge

// ragdoll knockdowns
export const RAGDOLL_SPEED = 11; // relative ball speed that floors a player
export const RAGDOLL_TIME = 1.5;

// match
export const MATCH_TIME = 180;
export const MATCH_GOALS = 5;
