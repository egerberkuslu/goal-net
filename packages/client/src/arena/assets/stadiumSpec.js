// #18 — the stadium and decor set, authored procedurally.
//
// Pure: no three.js, no DOM, no randomness that is not seeded. Returns typed
// arrays and instance tables. assets/stadium.js turns them into a scene;
// tools/build-assets.mjs turns the identical output into a GLB and pushes it
// through Draco and KTX2. Neither consumer is allowed to add geometry of its
// own, which is the only way the triangle count in the test means anything.
//
// WHAT IS MERGED AND WHAT IS INSTANCED, AND WHY
//
//   shell      every static block of the bowl — terraces, roof, dugouts,
//              tunnel, corner posts, scoreboard — merged into ONE mesh with
//              vertex colours. One draw call for the entire stadium structure.
//   lines      the pitch markings, struck from the CORE's rectangle rather than
//              the pitch texture's, merged. One draw call.
//   goals      both goal frames, merged. One draw call.
//   boards     the advertising hoardings, textured from one atlas. One call.
//   seats      an InstancedMesh: one small block, thousands of instances, one
//              draw call, per-instance colour for the block patterns.
//   lamps      the floodlight heads, instanced, unlit material.
//
// Six draw calls for a stadium. The budget is 50 on mobile and the players cost
// four, which leaves room the crowd system (#21) is going to need.

import {
  box, createMeshBuilder, cylinder, groundArc, groundLine, rgb, terrace, tube,
} from './geometry.js';

/** Palette. Deliberately few colours: a low-poly set reads better flat. */
export const PALETTE = Object.freeze({
  concrete: 0x2a3350,
  concreteDark: 0x1e2540,
  steel: 0x8b94a8,
  roof: 0x161d33,
  seatA: 0x2e3a5c,
  seatB: 0x3a4870,
  seatAccent: 0xc8442e,
  white: 0xf2f4f8,
  turf: 0x2f8f45,
  lamp: 0xfff6d8,
  dugout: 0x141a2c,
  flag: 0xe6b422,
});

/**
 * Every dimension of the bowl, in metres. Defaults match the footprint the
 * shipping renderer already draws so the two views are the same stadium.
 */
export const DEFAULT_LAYOUT = Object.freeze({
  pitchHalfX: 8.571,     // the CORE's rectangle, from arena/units.js
  pitchHalfZ: 18.0,
  goalHalfX: 2.357,
  goalHeight: 2.44,
  penaltyHalfX: 5.0,
  penaltyDepth: 4.5,
  apronHalfX: 15.0,      // grass beyond the touchline
  apronHalfZ: 24.0,
  standNearX: 14.5,      // the far touchline stand starts here
  standNearZ: 23.5,
  tierDepth: 2.3,
  tierRise: 1.1,
  tierFront: 1.6,
  tiers: 3,
  standLengthZ: 52,
  standLengthX: 34,
  pylonX: 13.5,
  pylonZ: 22.5,
  pylonHeight: 14,
});

/**
 * Quality knobs. Everything that scales with the device tier is a number here,
 * so assets/quality.js can pick a row and nothing else has to know.
 */
export const DEFAULT_DETAIL = Object.freeze({
  seatRows: 6,
  seatColumns: 46,
  seatSides: 3,        // far touchline + both ends; the near side stays open
  tubeSegments: 8,
  cylinderSegments: 10,
  arcSegments: 48,
  roof: true,
  decor: true,
});

/**
 * Build the whole set.
 * @param {object} [opts] { layout, detail }
 * @returns {{meshes:object, instances:object, stats:object}}
 */
export function buildStadiumSpec(opts = {}) {
  const L = { ...DEFAULT_LAYOUT, ...(opts.layout || {}) };
  const D = { ...DEFAULT_DETAIL, ...(opts.detail || {}) };

  const shell = createMeshBuilder('shell');
  const lines = createMeshBuilder('lines');
  const goals = createMeshBuilder('goals');
  const boards = createMeshBuilder('boards');

  buildTerraces(shell, L, D);
  if (D.roof) buildRoof(shell, L, D);
  buildPylons(shell, L, D);
  if (D.decor) buildDecor(shell, L, D);
  buildLines(lines, L, D);
  buildGoals(goals, L, D);
  buildBoards(boards, L);

  const seats = buildSeatInstances(L, D);
  const lamps = buildLampInstances(L);

  const meshes = {
    shell: shell.build(),
    lines: lines.build(),
    goals: goals.build(),
    boards: boards.build(),
    seat: seatUnit(),
    lamp: lampUnit(),
  };

  const stats = {
    triangles: {
      shell: meshes.shell.triangleCount,
      lines: meshes.lines.triangleCount,
      goals: meshes.goals.triangleCount,
      boards: meshes.boards.triangleCount,
      seats: meshes.seat.triangleCount * seats.count,
      lamps: meshes.lamp.triangleCount * lamps.count,
    },
    drawCalls: 6,
    seatCount: seats.count,
    lampCount: lamps.count,
  };
  stats.triangles.total = Object.values(stats.triangles).reduce((a, b) => a + b, 0);

  return { meshes, instances: { seats, lamps }, stats, layout: L, detail: D };
}

// ------------------------------------------------------------------ pieces --

function buildTerraces(b, L, D) {
  const c = rgb(PALETTE.concrete);
  const cd = rgb(PALETTE.concreteDark);
  for (let t = 0; t < L.tiers; t++) {
    const front = L.tierFront + t * 0.4;
    const back = front + L.tierRise;
    const colour = t % 2 ? cd : c;
    // far touchline only: the near (+x) side is left open, broadcast style, so
    // the camera can always see the bottom of the pitch
    terrace(b, {
      axis: 'x', away: -1,
      near: -(L.standNearX + t * L.tierDepth),
      depth: L.tierDepth, length: L.standLengthZ, centre: 0,
      front: front + t * L.tierRise, back: back + t * L.tierRise, color: colour,
    });
    for (const side of [-1, 1]) {
      terrace(b, {
        axis: 'z', away: side,
        near: side * (L.standNearZ + t * L.tierDepth),
        depth: L.tierDepth, length: L.standLengthX, centre: 0,
        front: front + t * L.tierRise, back: back + t * L.tierRise, color: colour,
      });
    }
  }
}

function buildRoof(b, L, D) {
  const r = rgb(PALETTE.roof);
  const s = rgb(PALETTE.steel);
  const top = L.tierFront + L.tiers * L.tierRise + 3.2;
  const depth = L.tierDepth * L.tiers + 1.6;
  // far touchline canopy
  box(b, -(L.standNearX + depth / 2 - 0.6), top, 0, depth, 0.22, L.standLengthZ, r);
  for (const side of [-1, 1]) {
    box(b, 0, top, side * (L.standNearZ + depth / 2 - 0.6), L.standLengthX, 0.22, depth, r);
  }
  // the columns holding it up
  for (let i = -2; i <= 2; i++) {
    cylinder(b, -(L.standNearX + depth - 1.0), top / 2, i * (L.standLengthZ / 5),
      0.12, 0.14, top, D.cylinderSegments, s);
  }
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      cylinder(b, i * (L.standLengthX / 3), top / 2, side * (L.standNearZ + depth - 1.0),
        0.12, 0.14, top, D.cylinderSegments, s);
    }
  }
}

function buildPylons(b, L, D) {
  const s = rgb(PALETTE.steel);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      cylinder(b, sx * L.pylonX, L.pylonHeight / 2, sz * L.pylonZ,
        0.12, 0.18, L.pylonHeight, D.cylinderSegments, s);
      // the gantry the lamps bolt to
      box(b, sx * L.pylonX, L.pylonHeight + 0.35, sz * L.pylonZ, 2.0, 0.14, 0.5, s);
    }
  }
}

function buildDecor(b, L, D) {
  const d = rgb(PALETTE.dugout);
  const w = rgb(PALETTE.white);
  const s = rgb(PALETTE.steel);
  const f = rgb(PALETTE.flag);
  // two dugouts on the open side, set back behind the hoardings
  for (const sz of [-1, 1]) {
    box(b, L.apronHalfX - 2.4, 0.95, sz * 5.2, 1.5, 1.9, 5.0, d);
    box(b, L.apronHalfX - 3.2, 1.55, sz * 5.2, 0.2, 0.7, 5.0, s);
  }
  // the players' tunnel, on the far side
  box(b, -(L.standNearX - 0.4), 1.5, 0, 1.2, 3.0, 3.4, d);
  box(b, -(L.standNearX - 0.4), 3.1, 0, 1.4, 0.25, 3.8, s);
  // a scoreboard behind one end
  box(b, 0, 7.0, -(L.standNearZ + 3.6), 9.0, 3.2, 0.4, d);
  box(b, 0, 7.0, -(L.standNearZ + 3.4), 8.4, 2.6, 0.1, w);
  for (const sx of [-1, 1]) {
    cylinder(b, sx * 3.6, 2.7, -(L.standNearZ + 3.8), 0.14, 0.18, 5.4, D.cylinderSegments, s);
  }
  // corner flags
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * L.pitchHalfX;
      const z = sz * L.pitchHalfZ;
      cylinder(b, x, 0.6, z, 0.03, 0.03, 1.2, 5, w);
      box(b, x + sx * 0.18, 1.05, z, 0.34, 0.22, 0.02, f);
    }
  }
}

/**
 * The spots — centre and penalty — are drawn as thin annuli rather than as
 * discs on purpose. A ring helper with an inner radius of zero collapses one
 * triangle of every quad onto the centre point, which is a degenerate triangle:
 * zero area, no normal, invisible, and still submitted to the GPU. Two dozen of
 * them were hiding in the markings mesh. An inner radius of 2 cm leaves a spot
 * that still reads as solid at any camera distance the arena uses.
 */
const SPOT_R = 0.16;
const SPOT_W = 0.28;

function buildLines(b, L, D) {
  const w = rgb(PALETTE.white);
  const W = 0.12;
  const Y = 0.021;
  const { pitchHalfX: hx, pitchHalfZ: hz, goalHalfX: gx, penaltyHalfX: px, penaltyDepth: pd } = L;
  groundLine(b, -hx, -hz, -hx, hz, W, Y, w);
  groundLine(b, hx, -hz, hx, hz, W, Y, w);
  for (const s of [-1, 1]) {
    groundLine(b, -hx, s * hz, -gx, s * hz, W, Y, w);
    groundLine(b, gx, s * hz, hx, s * hz, W, Y, w);
    groundLine(b, -px, s * hz, -px, s * (hz - pd), W, Y, w);
    groundLine(b, px, s * hz, px, s * (hz - pd), W, Y, w);
    groundLine(b, -px, s * (hz - pd), px, s * (hz - pd), W, Y, w);
    // the six-yard box and the penalty spot, for the look of the thing
    groundLine(b, -gx - 0.9, s * hz, -gx - 0.9, s * (hz - 1.8), W, Y, w);
    groundLine(b, gx + 0.9, s * hz, gx + 0.9, s * (hz - 1.8), W, Y, w);
    groundLine(b, -gx - 0.9, s * (hz - 1.8), gx + 0.9, s * (hz - 1.8), W, Y, w);
    groundArc(b, 0, s * (hz - pd * 1.35), SPOT_R, SPOT_W, Y, 8, w);
  }
  groundLine(b, -hx, 0, hx, 0, W, Y, w);
  groundArc(b, 0, 0, hx * 0.28, W, Y, D.arcSegments, w);
  groundArc(b, 0, 0, SPOT_R, SPOT_W, Y, 8, w);
  return b;
}

function buildGoals(b, L, D) {
  const w = rgb(PALETTE.white);
  const seg = D.tubeSegments;
  const r = 0.06;
  const { goalHalfX: hw, goalHeight: h, pitchHalfZ: hz } = L;
  for (const end of [-1, 1]) {
    const gz = end * hz;
    const backBottom = end * (hz + 1.5);
    const backTop = end * (hz + 0.55);
    for (const s of [-1, 1]) {
      tube(b, [s * hw, 0, gz], [s * hw, h + r, gz], r, seg, w);
      tube(b, [s * hw, h + r, gz], [s * hw, h - 0.1, backTop], r * 0.5, seg, w);
      tube(b, [s * hw, h - 0.1, backTop], [s * hw, 0, backBottom], r * 0.5, seg, w);
    }
    tube(b, [-hw - r, h, gz], [hw + r, h, gz], r, seg, w);
    tube(b, [-hw, h - 0.1, backTop], [hw, h - 0.1, backTop], r * 0.5, seg, w);
  }
  return b;
}

/**
 * The hoardings: one strip per run, UV'd across a four-panel atlas.
 *
 * Every board must face the CENTRE of the pitch, and getting that backwards is
 * not a lighting bug — the material is double-sided, so a reversed board still
 * draws, but you are looking at the back of the artwork and every wordmark on
 * it is mirrored. The winding below is chosen so the face normal points inward
 * on all four runs, and scripts/anim-test.mjs checks it by taking the dot
 * product of each triangle's normal with the vector back to the origin.
 */
function buildBoards(b, L) {
  const H = 0.75;
  const white = [1, 1, 1];
  const panel = (i) => {
    const u0 = (i % 4) / 4;
    const u1 = u0 + 1 / 4;
    return [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
  };
  let i = 0;
  // touchlines, running along z at the apron edge, facing -sx (inward)
  for (const sx of [-1, 1]) {
    const x = sx * (L.apronHalfX - 0.4);
    for (let z = -L.apronHalfZ + 2; z < L.apronHalfZ - 2; z += 6) {
      const z1 = Math.min(z + 6, L.apronHalfZ - 2);
      const uv = panel(i++);
      const [a, c] = sx > 0 ? [z, z1] : [z1, z];
      b.quad([x, 0, a], [x, 0, c], [x, H, c], [x, H, a], white, uv);
    }
  }
  // goal-line hoardings, running along x behind each goal, facing -sz (inward)
  for (const sz of [-1, 1]) {
    const z = sz * (L.pitchHalfZ + 2.2);
    for (let x = -L.apronHalfX + 2; x < L.apronHalfX - 2; x += 5) {
      const x1 = Math.min(x + 5, L.apronHalfX - 2);
      const uv = panel(i++);
      const [a, c] = sz > 0 ? [x1, x] : [x, x1];
      b.quad([a, 0, z], [c, 0, z], [c, H, z], [a, H, z], white, uv);
    }
  }
  return b;
}

// --------------------------------------------------------------- instances --

/** One seat: a block with a back. 12 triangles, and there are thousands. */
function seatUnit() {
  const b = createMeshBuilder('seat');
  box(b, 0, 0, 0, 0.40, 0.10, 0.36, [1, 1, 1]);
  box(b, 0, 0.16, -0.16, 0.40, 0.32, 0.06, [1, 1, 1]);
  return b.build();
}

function lampUnit() {
  const b = createMeshBuilder('lamp');
  box(b, 0, 0, 0, 0.46, 0.34, 0.16, [1, 1, 1]);
  return b.build();
}

/**
 * Seat instances: position, Y rotation and colour, as flat arrays ready for an
 * InstancedMesh (and for EXT_mesh_gpu_instancing, if the GLB ever wants them).
 *
 * The colour pattern is a deterministic block chequer with a stripe of the
 * accent colour a third of the way up, which is what real stands look like and
 * costs one modulo per seat.
 */
function buildSeatInstances(L, D) {
  const pos = [];
  const rotY = [];
  const col = [];
  const a = rgb(PALETTE.seatA);
  const c = rgb(PALETTE.seatB);
  const accent = rgb(PALETTE.seatAccent);
  const rows = D.seatRows;
  const cols = D.seatColumns;

  const emit = (x, y, z, yaw, colour) => {
    pos.push(x, y, z);
    rotY.push(yaw);
    col.push(colour[0], colour[1], colour[2]);
  };
  const colourOf = (row, colIdx) => {
    if (row === Math.floor(rows / 3)) return accent;
    return ((row + Math.floor(colIdx / 4)) % 2) ? c : a;
  };

  for (let row = 0; row < rows; row++) {
    const t = row / Math.max(1, rows - 1);
    const depth = t * (L.tierDepth * L.tiers - 0.8);
    const rise = L.tierFront + t * (L.tiers * L.tierRise) + 0.18;
    // far touchline
    for (let i = 0; i < cols; i++) {
      const z = (i / (cols - 1) - 0.5) * (L.standLengthZ - 4);
      emit(-(L.standNearX + depth + 0.5), rise, z, Math.PI / 2, colourOf(row, i));
    }
    // both ends, at a lower column count since they are shorter
    if (D.seatSides >= 2) {
      const endCols = Math.max(4, Math.round(cols * (L.standLengthX / L.standLengthZ)));
      for (const side of [-1, 1]) {
        for (let i = 0; i < endCols; i++) {
          const x = (i / (endCols - 1) - 0.5) * (L.standLengthX - 4);
          emit(x, rise, side * (L.standNearZ + depth + 0.5), side > 0 ? Math.PI : 0, colourOf(row, i));
        }
      }
    }
  }
  return {
    count: rotY.length,
    position: new Float32Array(pos),
    rotationY: new Float32Array(rotY),
    color: new Float32Array(col),
  };
}

function buildLampInstances(L) {
  const pos = [];
  const rotY = [];
  const col = [];
  const lamp = rgb(PALETTE.lamp);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        pos.push(sx * L.pylonX + i * 0.62, L.pylonHeight + 0.35, sz * L.pylonZ);
        rotY.push(Math.atan2(-sx * L.pylonX, -sz * L.pylonZ));
        col.push(lamp[0], lamp[1], lamp[2]);
      }
    }
  }
  return {
    count: rotY.length,
    position: new Float32Array(pos),
    rotationY: new Float32Array(rotY),
    color: new Float32Array(col),
  };
}
