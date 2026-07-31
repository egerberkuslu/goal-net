import * as THREE from 'three';

// Stadium crowd: ~2.3k spectators seated on the stand tiers built by
// scene.js addStadium(). Two InstancedMesh draw calls total (bodies + heads).
//
// Animation approach: a vertex-shader wobble injected with onBeforeCompile,
// driven by per-instance attributes (phase, section, rate) and three uniforms.
// Chosen over CPU matrix rewrites because it is genuinely zero per-instance
// work: update() touches a handful of floats regardless of crowd size, the
// instance matrices are uploaded once at construction and never re-read, and
// every spectator animates every frame instead of a rotating 1/6 subset
// (which visibly strobes at this instance count). The cost is that the wobble
// is invisible to raycasting and shadows, neither of which the crowd needs.

// Stand geometry mirrored from scene.js addStadium(). Side tiers are boxes of
// 2.2 x H x 52 at x = +/-(14.5 + t*2.3); end tiers are 34 x H x 2.2 at
// z = +/-(23.5 + t*2.3). With H = 1.6 + 0.4t and centre y = H/2 + 1.1t, the
// walkable top of tier t sits at y = 1.6 + 1.5t.
const TIERS = 3;
const TIER_DEPTH = 2.2;
const SIDE_X = (t) => 14.5 + t * 2.3;
const END_Z = (t) => 23.5 + t * 2.3;
const TIER_TOP = (t) => 1.6 + 1.5 * t;
const SIDE_LEN = 52; // side stands run this far along z
// End rows stop at the inner face of the innermost side tier, otherwise the
// corner seats end up buried inside the side stand boxes.
const END_HALF_X = SIDE_X(0) - TIER_DEPTH / 2 - 0.2;

// Stand geometry shared with the effects layer so confetti erupts out of the
// same seats the crowd sits in instead of duplicating the numbers.
export const STAND_INFO = {
  tiers: TIERS,
  tierDepth: TIER_DEPTH,
  sideLen: SIDE_LEN,
  sideX: SIDE_X,
  endZ: END_Z,
  tierTop: TIER_TOP,
  endHalfX: END_HALF_X,
};

const SEAT_PITCH = 0.6; // spacing along a row
const ROW_OFFSETS = [-0.62, 0, 0.62]; // three rows across each 2.2-deep tier
const EMPTY_SEAT_CHANCE = 0.08;

const BODY_W = 0.34, BODY_H = 0.62, BODY_D = 0.28;
const HEAD_R = 0.14, HEAD_Y = BODY_H + HEAD_R + 0.015;

const SEC_NEUTRAL = 0, SEC_RED = 1, SEC_BLUE = 2;

// Muted jackets in the neutral side stands, team tones behind the goals.
// Nothing is pure white: the night lighting blows those highlights out.
const NEUTRAL_COLORS = [
  0x4a5a7a, 0x6b5a4a, 0x3f6b5a, 0x7a5a6b, 0x8a7a4a,
  0x5a5a5a, 0x6b4a4a, 0x4a6b7a, 0x7a6a52, 0x55607a,
];
const RED_COLORS = [0xc23a3a, 0xa82f2f, 0xd4534a, 0x8e2626, 0xb84040];
const BLUE_COLORS = [0x3560c8, 0x2b4ea8, 0x4a76d8, 0x24407f, 0x3f6bbf];
const RED_SCARVES = [0xe0d6bd, 0xdca63c];
const BLUE_SCARVES = [0xcdd8ea, 0x2fbfb0];
const SCARF_CHANCE = 0.16;
const SKIN_COLORS = [0xe8b98f, 0xc98f66, 0x9a6a45, 0xf0cba6, 0x7a5238];

const GOAL_CHEER_TIME = 2.5;
const OOH_TIME = 0.55;

// Deterministic PRNG so the crowd layout is stable across reloads and tests.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WOBBLE_DECL = /* glsl */`
attribute float aPhase;
attribute float aSec;
attribute float aRate;
uniform float uTime;
uniform vec3 uAmp;   // celebration amplitude per section: neutral, red, blue
uniform float uOoh;  // synchronized near-miss bounce envelope
`;

// Injected after <begin_vertex>. Object space has y = 0 at the seat and the
// instance matrices only rotate about Y, so a y offset stays vertical and a
// y-scaled x offset reads as an upper-body lean once instanced.
const WOBBLE_BODY = /* glsl */`
float amp = aSec < 0.5 ? uAmp.x : (aSec < 1.5 ? uAmp.y : uAmp.z);
float idleBob = sin(uTime * 1.7 + aPhase) * 0.014;
float idleSway = sin(uTime * 0.9 + aPhase * 1.3) * 0.055;
float jump = abs(sin(uTime * (7.0 + aRate * 3.5) + aPhase * 2.0)) * 0.34 * amp;
float ooh = uOoh * 0.10 * (0.85 + 0.3 * sin(aPhase));
transformed.y += idleBob + jump + ooh;
transformed.x += idleSway * (1.0 + amp * 2.2) * transformed.y;
`;

export class CrowdView {
  constructor(scene) {
    const rnd = mulberry32(0x5eed17);
    const seats = buildSeats(rnd);
    this.count = seats.length;

    this.uniforms = {
      uTime: { value: 0 },
      uAmp: { value: new THREE.Vector3(0, 0, 0) },
      uOoh: { value: 0 },
    };
    this._clock = 0;
    this._cheer = 0;      // seconds left on the goal celebration
    this._cheerTeam = 0;
    this._ooh = 0;        // seconds left on the near-miss bounce

    const phase = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    const sec = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    const rate = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);

    // Box body plus icosahedron head is 32 triangles per spectator, so the
    // whole crowd stays under 80k triangles across two draw calls.
    const bodyGeo = new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D);
    bodyGeo.translate(0, BODY_H / 2, 0);
    const headGeo = new THREE.IcosahedronGeometry(HEAD_R, 0);
    headGeo.translate(0, HEAD_Y, 0);
    for (const g of [bodyGeo, headGeo]) {
      g.setAttribute('aPhase', phase);
      g.setAttribute('aSec', sec);
      g.setAttribute('aRate', rate);
    }

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (const m of [bodyMat, headMat]) {
      m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.uniforms);
        shader.vertexShader = WOBBLE_DECL + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n${WOBBLE_BODY}`,
        );
      };
      // Both materials compile the same wobble, so sharing one program is
      // correct and keeps the shader cache to a single entry.
      m.customProgramCacheKey = () => 'crowdWobble';
    }

    this.bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, this.count);
    this.heads = new THREE.InstancedMesh(headGeo, headMat, this.count);

    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const scl = new THREE.Vector3();
    const col = new THREE.Color();

    for (let i = 0; i < this.count; i++) {
      const s = seats[i];
      pos.set(s.x, s.y, s.z);
      quat.setFromAxisAngle(axis, s.rot);
      scl.setScalar(s.scale);
      mat4.compose(pos, quat, scl);
      this.bodies.setMatrixAt(i, mat4);
      this.heads.setMatrixAt(i, mat4);
      this.bodies.setColorAt(i, col.setHex(s.color));
      this.heads.setColorAt(i, col.setHex(s.skin));
      phase.setX(i, s.phase);
      sec.setX(i, s.sec);
      rate.setX(i, s.rate);
    }

    for (const m of [this.bodies, this.heads]) {
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor.needsUpdate = true;
      m.castShadow = false;
      m.receiveShadow = false;
      m.computeBoundingSphere();
      // The shader wobble lifts vertices the bounding sphere cannot see, so
      // pad it rather than disabling frustum culling entirely.
      m.boundingSphere.radius += 0.5;
    }

    this.group = new THREE.Group();
    this.group.add(this.bodies, this.heads);
    scene.add(this.group);
  }

  update(dt, time) {
    this._clock += dt;
    this.uniforms.uTime.value = Number.isFinite(time) ? time : this._clock;

    const amp = this.uniforms.uAmp.value;
    if (this._cheer > 0) {
      this._cheer = Math.max(0, this._cheer - dt);
      // ease out so the block deflates instead of cutting off
      const e = (this._cheer / GOAL_CHEER_TIME) ** 1.4;
      amp.set(e * 0.35, 0, 0);
      if (this._cheerTeam === 0) { amp.y = e; amp.z = e * 0.06; }
      else { amp.z = e; amp.y = e * 0.06; }
    } else if (amp.lengthSq() > 0) {
      amp.set(0, 0, 0);
    }

    if (this._ooh > 0) {
      this._ooh = Math.max(0, this._ooh - dt);
      // one synchronized bounce: rise and fall across the whole envelope
      this.uniforms.uOoh.value = Math.sin((1 - this._ooh / OOH_TIME) * Math.PI);
    } else if (this.uniforms.uOoh.value !== 0) {
      this.uniforms.uOoh.value = 0;
    }
  }

  onGoal(scorerTeam) {
    this._cheerTeam = scorerTeam === 1 ? 1 : 0;
    this._cheer = GOAL_CHEER_TIME;
    this._ooh = 0;
  }

  onNearMiss() {
    if (this._cheer > 0) return; // a celebration already owns the crowd
    this._ooh = OOH_TIME;
  }
}

function buildSeats(rnd) {
  const seats = [];

  const place = (x, y, z, sec) => {
    if (rnd() < EMPTY_SEAT_CHANCE) return;
    let palette, scarves;
    if (sec === SEC_RED) { palette = RED_COLORS; scarves = RED_SCARVES; }
    else if (sec === SEC_BLUE) { palette = BLUE_COLORS; scarves = BLUE_SCARVES; }
    else { palette = NEUTRAL_COLORS; scarves = null; }
    const color = scarves && rnd() < SCARF_CHANCE
      ? scarves[(rnd() * scarves.length) | 0]
      : palette[(rnd() * palette.length) | 0];
    seats.push({
      x, y, z, sec, color,
      skin: SKIN_COLORS[(rnd() * SKIN_COLORS.length) | 0],
      // face the pitch centre, with a bit of slouch either way
      rot: Math.atan2(-x, -z) + (rnd() - 0.5) * 0.44,
      scale: 0.88 + rnd() * 0.24,
      phase: rnd() * Math.PI * 2,
      rate: rnd(),
    });
  };

  for (const side of [-1, 1]) {
    for (let t = 0; t < TIERS; t++) {
      const y = TIER_TOP(t);

      // side stands: rows run along z, seats step across the tier depth in x.
      // Only the far side (-x) is populated — the near (+x) stand would sit
      // between the broadcast camera and the pitch and block the view.
      if (side < 0) {
        const cx = side * SIDE_X(t);
        const nSide = Math.floor(SIDE_LEN / SEAT_PITCH);
        for (const row of ROW_OFFSETS) {
          for (let i = 0; i < nSide; i++) {
            const z = -SIDE_LEN / 2 + (i + 0.5) * SEAT_PITCH + (rnd() - 0.5) * 0.12;
            const x = cx + row + (rnd() - 0.5) * 0.1;
            place(x, y, z, SEC_NEUTRAL);
          }
        }
      }

      // end stands: rows run along x. Red defends z = -18, so the red block
      // sits behind that goal and the blue block behind z = +18.
      const cz = side * END_Z(t);
      const sec = side < 0 ? SEC_RED : SEC_BLUE;
      const nEnd = Math.floor((END_HALF_X * 2) / SEAT_PITCH);
      for (const row of ROW_OFFSETS) {
        for (let i = 0; i < nEnd; i++) {
          const x = -END_HALF_X + (i + 0.5) * SEAT_PITCH + (rnd() - 0.5) * 0.12;
          const z = cz + row + (rnd() - 0.5) * 0.1;
          place(x, y, z, sec);
        }
      }
    }
  }

  return seats;
}
