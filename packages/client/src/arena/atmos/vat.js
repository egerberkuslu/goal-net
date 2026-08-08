// Vertex Animation Texture for the crowd (matrix #21).
//
// rendering-optimization.md is explicit about the approach: "InstancedMesh +
// Vertex Animation Texture (VAT): animation baked into a texture, read in the
// vertex shader; NO CPU skinning" and "RGBA(32bit) texture preferred (half
// float reads are slow and some devices cannot sample float textures ->
// encode)". Both are honoured here: the bake writes unsigned bytes, and the
// decode is a single multiply-add in the shader.
//
// Everything in this module is pure arithmetic on typed arrays. There is no
// three.js, no DOM and no canvas in it, which is what lets scripts/atmos-test
// assert the encoding, the loop continuity and the decode error headlessly.
//
// Layout
//   texture width  = vertex count of one spectator
//   texture height = CLIPS * FRAMES
//   texel(x, y)    = the position OFFSET of vertex x on frame (y % FRAMES) of
//                    clip floor(y / FRAMES), encoded as (v / range) * 0.5 + 0.5
//
// The offset is stored rather than the absolute position because offsets are
// small and symmetric, so eight bits per axis buy far more precision than they
// would on a world position.

/** Animation clips, in the order they are baked into the texture rows. */
export const CLIP = Object.freeze({
  IDLE: 0,
  CLAP: 1,
  CELEBRATE: 2,
  WAVE: 3,
  SLUMP: 4,
});
export const CLIP_COUNT = 5;

/** Frames per clip. A power of two keeps the frame index arithmetic exact. */
export const FRAMES = 32;

/** Loop speed of each clip in Hz, used by the shader to advance its own phase. */
export const CLIP_RATE = Object.freeze([0.42, 2.4, 2.1, 0.9, 0.22]);

/** Half-range of the encoded offsets, in metres. */
export const VAT_RANGE = 0.5;

/** Vertex part tags, so a pose function can move arms without moving the head. */
export const PART = Object.freeze({ TORSO: 0, HEAD: 1, ARM_L: 2, ARM_R: 3 });

// Body proportions, in metres. Matched to the seated spectators the shipping
// crowd already draws so the two read as the same stadium.
const BODY_W = 0.34, BODY_H = 0.62, BODY_D = 0.28;
const HEAD_R = 0.15, HEAD_Y = BODY_H + HEAD_R + 0.02;
const ARM_LEN = 0.42, ARM_W = 0.1;
const SHOULDER_Y = BODY_H - 0.06;
const SHOULDER_X = BODY_W / 2 + ARM_W * 0.35;

function pushTri(out, ax, ay, az, bx, by, bz, cx, cy, cz, part) {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]]) {
    out.pos.push(x, y, z);
    out.nrm.push(nx, ny, nz);
    out.part.push(part);
  }
}

function pushQuad(out, p0, p1, p2, p3, part) {
  pushTri(out, ...p0, ...p1, ...p2, part);
  pushTri(out, ...p0, ...p2, ...p3, part);
}

function pushBox(out, cx, cy, cz, w, h, d, part) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const v = (x, y, z) => [x, y, z];
  pushQuad(out, v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), part); // +z
  pushQuad(out, v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), part); // -z
  pushQuad(out, v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), part); // +x
  pushQuad(out, v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), part); // -x
  pushQuad(out, v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0), part); // +y
  pushQuad(out, v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), part); // -y
}

/**
 * One spectator, flat shaded, 24 triangles: box torso, octahedron head and a
 * flat quad per arm. Low enough that a full stand of them stays inside the
 * triangle budget in a single instanced draw call.
 *
 * @returns {{positions:Float32Array, normals:Float32Array, parts:Uint8Array,
 *            vertexCount:number, triangleCount:number}}
 */
export function buildSpectatorMesh() {
  const out = { pos: [], nrm: [], part: [] };
  pushBox(out, 0, BODY_H / 2, 0, BODY_W, BODY_H, BODY_D, PART.TORSO);

  // head: an octahedron is eight triangles and reads as a head at stand range
  const r = HEAD_R, y = HEAD_Y;
  const top = [0, y + r, 0], bot = [0, y - r, 0];
  const ring = [[r, y, 0], [0, y, r], [-r, y, 0], [0, y, -r]];
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4];
    pushTri(out, ...top, ...a, ...b, PART.HEAD);
    pushTri(out, ...bot, ...b, ...a, PART.HEAD);
  }

  // arms: one quad each, hanging from the shoulder, in the x/y plane
  for (const [side, part] of [[-1, PART.ARM_L], [1, PART.ARM_R]]) {
    const x0 = side * SHOULDER_X - ARM_W / 2;
    const x1 = side * SHOULDER_X + ARM_W / 2;
    const yTop = SHOULDER_Y, yBot = SHOULDER_Y - ARM_LEN;
    pushQuad(out,
      [x0, yBot, 0.02], [x1, yBot, 0.02], [x1, yTop, 0.02], [x0, yTop, 0.02], part);
  }

  return {
    positions: new Float32Array(out.pos),
    normals: new Float32Array(out.nrm),
    parts: new Uint8Array(out.part),
    vertexCount: out.part.length,
    triangleCount: out.part.length / 3,
  };
}

// --------------------------------------------------------------- pose clips

const TAU = Math.PI * 2;

/** Rotate a point about the shoulder pivot in the y/z plane, then in x/y. */
function armSwing(x, y, z, side, lift, spread, out) {
  const px = side * SHOULDER_X, py = SHOULDER_Y;
  let dx = x - px, dy = y - py, dz = z;
  // lift: rotate about x (forward/up), spread: rotate about z (out to the side)
  const cl = Math.cos(lift), sl = Math.sin(lift);
  let ny = dy * cl - dz * sl;
  let nz = dy * sl + dz * cl;
  dy = ny; dz = nz;
  const cs = Math.cos(spread * side), ss = Math.sin(spread * side);
  const nx = dx * cs - dy * ss;
  ny = dx * ss + dy * cs;
  out[0] = px + nx - x;
  out[1] = py + ny - y;
  out[2] = nz - z;
}

const _arm = [0, 0, 0];

/**
 * The offset of one vertex on one clip at phase t in [0,1). Pure, and shared
 * by the bake and by the test that checks the clips loop seamlessly.
 *
 * @param {number} clip one of CLIP.*
 * @param {number} t phase in [0,1)
 * @param {number} x @param {number} y @param {number} z base position
 * @param {number} part one of PART.*
 * @param {Float32Array|number[]} out length-3 destination
 */
export function poseOffset(clip, t, x, y, z, part, out) {
  out[0] = 0; out[1] = 0; out[2] = 0;
  const a = t * TAU;
  switch (clip) {
    case CLIP.IDLE: {
      // A seated body breathes and rocks; the offset scales with height so the
      // seat itself never leaves the bench. Every frequency is a whole number
      // of cycles per loop, or the clip would jump at the seam every time it
      // wrapped — which at this instance count reads as the whole stand
      // twitching in unison.
      out[1] = Math.sin(a) * 0.016;
      out[0] = Math.sin(a + 1.9) * 0.035 * Math.max(0, y);
      if (part === PART.ARM_L || part === PART.ARM_R) {
        const side = part === PART.ARM_L ? -1 : 1;
        armSwing(x, y, z, side, Math.sin(a + 0.7) * 0.12, 0.05, _arm);
        out[0] += _arm[0]; out[1] += _arm[1]; out[2] += _arm[2];
      }
      break;
    }
    case CLIP.CLAP: {
      // hands meet in front of the chest twice per loop
      const beat = Math.abs(Math.sin(a));
      out[1] = beat * 0.02;
      if (part === PART.ARM_L || part === PART.ARM_R) {
        const side = part === PART.ARM_L ? -1 : 1;
        armSwing(x, y, z, side, -1.15 - beat * 0.2, 0.55 - beat * 0.5, _arm);
        out[0] += _arm[0]; out[1] += _arm[1]; out[2] += _arm[2];
      }
      break;
    }
    case CLIP.CELEBRATE: {
      // out of the seat: a full jump with both arms thrown overhead
      const jump = Math.abs(Math.sin(a)) ** 0.7;
      out[1] = jump * 0.36;
      out[0] = Math.sin(a * 2) * 0.05 * Math.max(0, y);
      if (part === PART.ARM_L || part === PART.ARM_R) {
        const side = part === PART.ARM_L ? -1 : 1;
        armSwing(x, y, z, side, -2.7 - jump * 0.25, -0.35, _arm);
        out[0] += _arm[0]; out[1] += _arm[1]; out[2] += _arm[2];
      }
      break;
    }
    case CLIP.WAVE: {
      // the Mexican wave pose: stand up, both arms straight up, sit back down.
      // The travel across the stand is the shader's job; this is one seat's
      // half of it, so the clip rises and falls exactly once per loop.
      const rise = Math.sin(Math.min(1, t) * Math.PI);
      out[1] = rise * 0.3;
      if (part === PART.ARM_L || part === PART.ARM_R) {
        const side = part === PART.ARM_L ? -1 : 1;
        armSwing(x, y, z, side, -Math.PI * rise, -0.2 * rise, _arm);
        out[0] += _arm[0]; out[1] += _arm[1]; out[2] += _arm[2];
      }
      break;
    }
    case CLIP.SLUMP: {
      // conceding fans: sink, hunch forward, arms dead at the side
      const breathe = 0.9 + 0.1 * Math.sin(a);
      out[1] = -0.11 * breathe;
      out[2] = 0.15 * Math.max(0, y) * breathe;
      if (part === PART.HEAD) out[1] -= 0.05;
      if (part === PART.ARM_L || part === PART.ARM_R) {
        const side = part === PART.ARM_L ? -1 : 1;
        armSwing(x, y, z, side, 0.25, -0.12, _arm);
        out[0] += _arm[0]; out[1] += _arm[1]; out[2] += _arm[2];
      }
      break;
    }
    default:
      break;
  }
}

/** Encode a metre offset into a byte. Inverse of the shader's decode. */
export function encodeOffset(v, range = VAT_RANGE) {
  const n = Math.max(-1, Math.min(1, v / range)) * 0.5 + 0.5;
  return Math.max(0, Math.min(255, Math.round(n * 255)));
}

/** Decode a byte back to metres. Used by the tests, not by the renderer. */
export function decodeOffset(b, range = VAT_RANGE) {
  return ((b / 255) * 2 - 1) * range;
}

/**
 * Bake every clip of every vertex into one RGBA8 buffer.
 *
 * @param {ReturnType<typeof buildSpectatorMesh>} mesh
 * @param {{frames?:number, range?:number}} [opts]
 * @returns {{data:Uint8Array, width:number, height:number, frames:number,
 *            clips:number, range:number, bytes:number}}
 */
export function bakeCrowdVat(mesh, opts = {}) {
  const frames = opts.frames || FRAMES;
  const range = opts.range || VAT_RANGE;
  const width = mesh.vertexCount;
  const height = CLIP_COUNT * frames;
  const data = new Uint8Array(width * height * 4);
  const off = [0, 0, 0];

  for (let clip = 0; clip < CLIP_COUNT; clip++) {
    for (let f = 0; f < frames; f++) {
      const t = f / frames;
      const row = clip * frames + f;
      for (let v = 0; v < width; v++) {
        const p = v * 3;
        poseOffset(clip, t, mesh.positions[p], mesh.positions[p + 1],
          mesh.positions[p + 2], mesh.parts[v], off);
        const o = (row * width + v) * 4;
        data[o] = encodeOffset(off[0], range);
        data[o + 1] = encodeOffset(off[1], range);
        data[o + 2] = encodeOffset(off[2], range);
        data[o + 3] = 255;
      }
    }
  }

  return { data, width, height, frames, clips: CLIP_COUNT, range, bytes: data.length };
}
