// Matrix #21 — the arena crowd: one InstancedMesh, animated from a VAT.
//
// What this shares with the shipping view/crowdView.js, and what it does not.
//
// SHARED   the stand geometry. crowdView.js already exports STAND_INFO (the
//          tier tops, depths and footprints mirrored from scene.js
//          addStadium()), and this module imports it rather than restating the
//          numbers, so both crowds sit on the same benches. The seat palette
//          idea, the deterministic mulberry32 layout and the per-instance
//          phase offset are the same design, kept because they work.
//
// DIFFERENT the animation. crowdView.js injects an analytic wobble (two sines
//          plus a jump envelope) into the vertex shader. That is already free
//          on the CPU, so this is NOT a CPU win — and the report says so. What
//          the VAT buys is expressiveness at a FIXED shader cost: idle, clap,
//          celebrate, Mexican wave and slump are five authored poses with real
//          arm articulation, and the shader samples exactly two of them per
//          vertex whatever the pose is. Expressing five clips analytically
//          would mean five more sine chains in the vertex shader for every
//          spectator; here the extra clips cost texture rows, not ALU.
//          Bodies, head and arms are also merged into ONE geometry, so this is
//          one draw call where crowdView.js needs two.
//
// The crowd reads nothing but the numbers it is handed. It has no reference to
// a world, a session or a state buffer.

import * as THREE from 'three';
import { STAND_INFO } from '../../view/crowdView.js';
import {
  CLIP, CLIP_RATE, FRAMES, VAT_RANGE, bakeCrowdVat, buildSpectatorMesh,
} from './vat.js';
import { resolveTier } from './quality.js';

export const SEC = Object.freeze({ NEUTRAL: 0, RED: 1, BLUE: 2 });

const NEUTRAL_COLORS = [
  0x4a5a7a, 0x6b5a4a, 0x3f6b5a, 0x7a5a6b, 0x8a7a4a,
  0x5a5a5a, 0x6b4a4a, 0x4a6b7a, 0x7a6a52, 0x55607a,
];
const RED_COLORS = [0xc23a3a, 0xa82f2f, 0xd4534a, 0x8e2626, 0xb84040];
const BLUE_COLORS = [0x3560c8, 0x2b4ea8, 0x4a76d8, 0x24407f, 0x3f6bbf];
const RED_SCARVES = [0xe0d6bd, 0xdca63c];
const BLUE_SCARVES = [0xcdd8ea, 0x2fbfb0];
const SCARF_CHANCE = 0.16;

const CHEER_TIME = 2.6;
const MOURN_TIME = 4.0;
const CLAP_TIME = 2.2;
const WAVE_SPEED = 0.36;   // laps per second the wave front travels
const WAVE_WIDTH = 0.11;   // fraction of the ring that is standing at once

/** Rows across each tier's depth; a tier populates the first `crowdRows`. */
const ROW_OFFSETS = [0, -0.62, 0.62];

/** Deterministic PRNG, so the same seed always seats the same crowd. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seat every spectator. Pure: no three.js, no scene, so a test can assert the
 * footprint and the section split without a renderer.
 *
 * @param {object} tier a record from quality.js
 * @param {() => number} rnd
 * @returns {Array<{x:number,y:number,z:number,sec:number,color:number,
 *   rot:number,scale:number,phase:number,rate:number,wave:number}>}
 */
export function buildSeats(tier, rnd) {
  const { tiers, sideLen, sideX, endZ, tierTop, endHalfX } = STAND_INFO;
  const pitch = tier.crowdSeatPitch;
  const rowOffsets = ROW_OFFSETS.slice(0, tier.crowdRows);
  const seats = [];

  const place = (x, y, z, sec) => {
    if (rnd() < tier.crowdEmptyChance) return;
    let palette, scarves;
    if (sec === SEC.RED) { palette = RED_COLORS; scarves = RED_SCARVES; }
    else if (sec === SEC.BLUE) { palette = BLUE_COLORS; scarves = BLUE_SCARVES; }
    else { palette = NEUTRAL_COLORS; scarves = null; }
    const color = scarves && rnd() < SCARF_CHANCE
      ? scarves[(rnd() * scarves.length) | 0]
      : palette[(rnd() * palette.length) | 0];
    seats.push({
      x, y, z, sec, color,
      rot: Math.atan2(-x, -z) + (rnd() - 0.5) * 0.4,
      scale: 0.88 + rnd() * 0.24,
      phase: rnd() * Math.PI * 2,
      rate: rnd(),
      // Position around the bowl in [0,1). The Mexican wave front walks this
      // number, so it has to be continuous all the way round the stands.
      wave: (Math.atan2(z, x) / (Math.PI * 2) + 1) % 1,
    });
  };

  for (const side of [-1, 1]) {
    for (let t = 0; t < tiers; t++) {
      const y = tierTop(t);
      // Only the far touchline is seated: the near stand would sit between the
      // broadcast camera and the pitch. Same call scene.js makes.
      if (side < 0) {
        const cx = side * sideX(t);
        const n = Math.floor(sideLen / pitch);
        for (const row of rowOffsets) {
          for (let i = 0; i < n; i++) {
            const z = -sideLen / 2 + (i + 0.5) * pitch + (rnd() - 0.5) * 0.12;
            place(cx + row + (rnd() - 0.5) * 0.1, y, z, SEC.NEUTRAL);
          }
        }
      }
      const cz = side * endZ(t);
      const sec = side < 0 ? SEC.RED : SEC.BLUE;
      const n = Math.floor((endHalfX * 2) / pitch);
      for (const row of rowOffsets) {
        for (let i = 0; i < n; i++) {
          const x = -endHalfX + (i + 0.5) * pitch + (rnd() - 0.5) * 0.12;
          place(x, y, cz + row + (rnd() - 0.5) * 0.1, sec);
        }
      }
    }
  }
  return seats;
}

// --------------------------------------------------------------- the shader

const VAT_DECL = /* glsl */`
attribute float aVid;
attribute float aPhase;
attribute float aSec;
attribute float aRate;
attribute float aWave;
uniform sampler2D uVat;
uniform vec2 uVatSize;
uniform float uFrames;
uniform float uRange;
uniform float uTime;
uniform vec4 uRate;     // idle, clap, celebrate, slump loop rates in Hz
uniform vec3 uCheer;    // celebration weight per section
uniform vec3 uSad;      // slump weight per section
uniform vec3 uClap;     // applause weight per section
uniform vec2 uWaveFront; // x = front position in [0,1) or -1 for off, y = width

vec3 atmosVatSample(float clip, float phase) {
  float f = fract(phase) * uFrames;
  float f0 = floor(f);
  float fr = f - f0;
  float base = clip * uFrames;
  float u = (aVid + 0.5) / uVatSize.x;
  float v0 = (base + mod(f0, uFrames) + 0.5) / uVatSize.y;
  float v1 = (base + mod(f0 + 1.0, uFrames) + 0.5) / uVatSize.y;
  vec3 a = texture2D(uVat, vec2(u, v0)).rgb;
  vec3 b = texture2D(uVat, vec2(u, v1)).rgb;
  return (mix(a, b, fr) * 2.0 - 1.0) * uRange;
}

float atmosPickSec(vec3 v) {
  return aSec < 0.5 ? v.x : (aSec < 1.5 ? v.y : v.z);
}
`;

// Injected after <begin_vertex>: `transformed` is the object-space position and
// the instance matrix that follows only rotates about Y and scales uniformly,
// so a baked offset stays a baked offset once instanced.
const VAT_BODY = /* glsl */`
float aRateJit = 0.85 + aRate * 0.3;
float wCheer = atmosPickSec(uCheer);
float wSad = atmosPickSec(uSad);
float wClap = atmosPickSec(uClap);

float wWave = 0.0;
float waveT = 0.0;
if (uWaveFront.x >= 0.0) {
  float d = aWave - uWaveFront.x;
  d = d - floor(d + 0.5);
  float k = abs(d) / max(uWaveFront.y, 1e-4);
  wWave = 1.0 - smoothstep(0.0, 1.0, k);
  waveT = clamp(0.5 - d / (2.0 * max(uWaveFront.y, 1e-4)), 0.0, 1.0);
}

float best = wCheer;
float clip = ${CLIP.CELEBRATE}.0;
float ph = uTime * uRate.z * aRateJit + aPhase * 0.35;
if (wSad > best) { best = wSad; clip = ${CLIP.SLUMP}.0; ph = uTime * uRate.w + aPhase * 0.2; }
if (wClap > best) { best = wClap; clip = ${CLIP.CLAP}.0; ph = uTime * uRate.y * aRateJit + aPhase * 0.3; }
if (wWave > best) { best = wWave; clip = ${CLIP.WAVE}.0; ph = waveT; }

vec3 idlePose = atmosVatSample(${CLIP.IDLE}.0, uTime * uRate.x * aRateJit + aPhase);
vec3 evtPose = atmosVatSample(clip, ph);
transformed += mix(idlePose, evtPose, clamp(best, 0.0, 1.0));
`;

/**
 * The crowd. One instanced draw call, five baked clips, no per-frame CPU work
 * beyond a handful of envelope floats.
 */
export class ArenaCrowd {
  /**
   * @param {THREE.Scene|{add:Function, remove?:Function}} scene
   * @param {{tier?:string|object, seed?:number}} [opts]
   */
  constructor(scene, opts = {}) {
    const tier = resolveTier(opts.tier);
    this.tier = tier;
    const rnd = mulberry32(opts.seed ?? 0x5eed17);
    const seats = buildSeats(tier, rnd);
    this.count = seats.length;
    this.scene = scene;

    const mesh = buildSpectatorMesh();
    this.mesh = mesh;
    const baked = bakeCrowdVat(mesh);
    this.vat = baked;
    this.triangles = mesh.triangleCount * this.count;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals.slice(), 3));
    const vid = new Float32Array(mesh.vertexCount);
    for (let i = 0; i < mesh.vertexCount; i++) vid[i] = i;
    geo.setAttribute('aVid', new THREE.BufferAttribute(vid, 1));

    const phase = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    const sec = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    const rate = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    const wave = new THREE.InstancedBufferAttribute(new Float32Array(this.count), 1);
    geo.setAttribute('aPhase', phase);
    geo.setAttribute('aSec', sec);
    geo.setAttribute('aRate', rate);
    geo.setAttribute('aWave', wave);
    this.geometry = geo;

    // RGBA8, nearest, no mipmaps, no colour-space conversion: this texture is
    // data, and any filtering or sRGB decode on it would corrupt the offsets.
    this.texture = new THREE.DataTexture(
      baked.data, baked.width, baked.height, THREE.RGBAFormat, THREE.UnsignedByteType,
    );
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;

    this.uniforms = {
      uVat: { value: this.texture },
      uVatSize: { value: new THREE.Vector2(baked.width, baked.height) },
      uFrames: { value: FRAMES },
      uRange: { value: VAT_RANGE },
      uTime: { value: 0 },
      uRate: {
        value: new THREE.Vector4(
          CLIP_RATE[CLIP.IDLE], CLIP_RATE[CLIP.CLAP],
          CLIP_RATE[CLIP.CELEBRATE], CLIP_RATE[CLIP.SLUMP],
        ),
      },
      uCheer: { value: new THREE.Vector3(0, 0, 0) },
      uSad: { value: new THREE.Vector3(0, 0, 0) },
      uClap: { value: new THREE.Vector3(0, 0, 0) },
      uWaveFront: { value: new THREE.Vector2(-1, WAVE_WIDTH) },
    };

    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = VAT_DECL + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${VAT_BODY}`,
      );
    };
    material.customProgramCacheKey = () => 'arenaCrowdVat';
    this.material = material;

    this.instanced = new THREE.InstancedMesh(geo, material, this.count);
    this.instanced.castShadow = false;
    this.instanced.receiveShadow = false;

    const m4 = new THREE.Matrix4();
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
      m4.compose(pos, quat, scl);
      this.instanced.setMatrixAt(i, m4);
      this.instanced.setColorAt(i, col.setHex(s.color));
      phase.setX(i, s.phase);
      sec.setX(i, s.sec);
      rate.setX(i, s.rate);
      wave.setX(i, s.wave);
    }
    this.instanced.instanceMatrix.needsUpdate = true;
    if (this.instanced.instanceColor) this.instanced.instanceColor.needsUpdate = true;
    this.instanced.computeBoundingSphere();
    // the baked poses lift vertices the bounding sphere cannot see
    if (this.instanced.boundingSphere) this.instanced.boundingSphere.radius += 0.8;

    this.group = new THREE.Group();
    this.group.name = 'atmos.crowd';
    this.group.add(this.instanced);
    scene.add(this.group);

    this._clock = 0;
    this._cheer = 0;
    this._cheerTeam = 0;
    this._mourn = 0;
    this._clapLeft = 0;
    this._waveFront = -1;
    this._waveLoops = 0;
    this._lull = 0;
    this.autoWave = opts.autoWave !== false;
  }

  /** 'celebrate' while a goal is being celebrated, 'wave' during a Mexican wave. */
  get state() {
    if (this._cheer > 0) return 'celebrate';
    if (this._waveFront >= 0) return 'wave';
    return 'idle';
  }

  /**
   * @param {number} dt seconds
   * @param {number} [time] absolute seconds; defaults to the internal clock
   */
  update(dt, time) {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.25, dt)) : 0;
    this._clock += step;
    this.uniforms.uTime.value = Number.isFinite(time) ? time : this._clock;

    const cheer = this.uniforms.uCheer.value;
    if (this._cheer > 0) {
      this._cheer = Math.max(0, this._cheer - step);
      const e = (this._cheer / CHEER_TIME) ** 1.35;
      cheer.set(e * 0.4, 0, 0);
      if (this._cheerTeam === 0) { cheer.y = e; cheer.z = 0; } else { cheer.z = e; cheer.y = 0; }
    } else if (cheer.lengthSq() > 0) {
      cheer.set(0, 0, 0);
    }

    const sad = this.uniforms.uSad.value;
    if (this._mourn > 0) {
      this._mourn = Math.max(0, this._mourn - step);
      const lvl = Math.min(1, this._mourn / (MOURN_TIME * 0.6));
      sad.set(0, 0, 0);
      if (this._cheerTeam === 0) sad.z = lvl; else sad.y = lvl;
    } else if (sad.lengthSq() > 0) {
      sad.set(0, 0, 0);
    }

    const clap = this.uniforms.uClap.value;
    if (this._clapLeft > 0) {
      this._clapLeft = Math.max(0, this._clapLeft - step);
      const lvl = Math.min(1, this._clapLeft / (CLAP_TIME * 0.5)) * 0.85;
      clap.set(lvl, lvl, lvl);
    } else if (clap.lengthSq() > 0) {
      clap.set(0, 0, 0);
    }

    // The wave is the crowd's own idea: it starts itself after a long enough
    // stretch with nothing else to react to, which is exactly when a real
    // stand starts one.
    if (this._waveFront >= 0) {
      this._waveFront += WAVE_SPEED * step;
      if (this._waveFront >= 1) {
        this._waveFront -= 1;
        this._waveLoops--;
        if (this._waveLoops <= 0) this._waveFront = -1;
      }
      this._lull = 0;
    } else if (this._cheer <= 0 && this._mourn <= 0 && this._clapLeft <= 0) {
      this._lull += step;
      if (this.autoWave && this._lull > 26) this.startWave(2);
    } else {
      this._lull = 0;
    }
    this.uniforms.uWaveFront.value.x = this._waveFront;
  }

  /** @param {number} scorerTeam 0 red, 1 blue */
  onGoal(scorerTeam) {
    this._cheerTeam = scorerTeam === 1 ? 1 : 0;
    this._cheer = CHEER_TIME;
    this._mourn = MOURN_TIME;
    this._clapLeft = 0;
    this._waveFront = -1;
    this._lull = 0;
  }

  /** Applause: a save, a near miss, the end of a half. */
  onApplause(seconds = CLAP_TIME) {
    if (this._cheer > 0) return;
    this._clapLeft = Math.max(this._clapLeft, seconds);
    this._lull = 0;
  }

  /** @param {number} laps how many times the wave goes round */
  startWave(laps = 1) {
    if (this._cheer > 0) return;
    this._waveFront = 0;
    this._waveLoops = Math.max(1, laps | 0);
  }

  stopWave() {
    this._waveFront = -1;
    this._waveLoops = 0;
  }

  stats() {
    return {
      instances: this.count,
      drawCalls: 1,
      triangles: this.triangles,
      vatBytes: this.vat.bytes,
      vatSize: [this.vat.width, this.vat.height],
      state: this.state,
    };
  }

  dispose() {
    this.scene.remove?.(this.group);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.instanced.dispose?.();
  }
}
