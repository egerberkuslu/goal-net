// FIFA goal + ball dimensions and physical constants (SI units)
export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
export const POST_R = 0.06;

export const NET_TOP_DEPTH = 0.85; // how far back the net roof extends
export const NET_BOT_DEPTH = 1.7;  // ground footprint depth behind goal line
export const NET_CELL = 0.14;      // mesh opening size
export const CORD_R = 0.006;

export const BALL_R = 0.11;
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

export const REST_GROUND = 0.62;
export const REST_POST = 0.7;
