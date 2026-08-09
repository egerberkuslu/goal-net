// Headless checks for the atmosphere layer: goal confetti, rain and the
// camera impact shake. three's math, instancing and scene graph all work in
// node without a renderer, so everything runs against stub objects.
//
//   node scripts/fx-test.mjs      (or: npm run test:fx)

import * as THREE from 'three';
import { Fx } from '../packages/client/src/view/fx.js';
import { CameraRig } from '../packages/client/src/view/cameraRig.js';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const DT = 1 / 60;

// ---------------------------------------------------------------- confetti

const added = [];
const removed = [];
const scene = { add(o) { added.push(o); }, remove(o) { removed.push(o); } };

const fx = new Fx(scene);

check('construction adds exactly the confetti pool', added.length === 1, `added ${added.length}`);
check('confetti is a single InstancedMesh', !!fx.confetti?.isInstancedMesh);
check('confetti pool is a few hundred quads',
  fx.confetti.count >= 200 && fx.confetti.count <= 600, `count ${fx.confetti.count}`);
check('confetti idle before any goal', fx.confettiActive === 0);

const m = new THREE.Matrix4();
const p = new THREE.Vector3();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();

function hiddenCount() {
  let hidden = 0;
  for (let i = 0; i < fx.confetti.count; i++) {
    fx.confetti.getMatrixAt(i, m);
    if (m.elements.every((v) => v === 0)) hidden++;
  }
  return hidden;
}
check('every instance hidden at rest', hiddenCount() === fx.confetti.count);

// Red scores into the +z goal.
fx.onGoal(0, 1);
check('goal spawns a burst', fx.confettiActive >= 200, `active ${fx.confettiActive}`);
check('burst allocates nothing new',
  added.length === 1 && fx.allocations.confetti === 1,
  `added ${added.length} alloc ${fx.allocations.confetti}`);

fx.update(DT);
let originOk = 0, originBad = 0;
for (let i = 0; i < fx.confetti.count; i++) {
  fx.confetti.getMatrixAt(i, m);
  if (m.elements.every((v) => v === 0)) continue;
  m.decompose(p, q, s);
  // stands behind the +z goal: z past the goal line, inside the end block
  if (p.z > 18 && p.z < 32 && Math.abs(p.x) < 14 && p.y > 1.5 && p.y < 9) originOk++;
  else originBad++;
}
check('burst starts in the stands behind the scoring end', originBad === 0,
  `${originBad} stray of ${originOk + originBad}`);

// Colors must be the scoring team's: red burst is red-dominant.
const cAttr = fx.confetti.instanceColor;
check('per-instance colors uploaded', !!cAttr);
let redDominant = 0, sampled = 0;
for (let i = 0; i < 40; i++) {
  const r = cAttr.getX(i), b = cAttr.getZ(i);
  sampled++;
  if (r >= b) redDominant++;
}
check('confetti wears the scoring team colors', redDominant === sampled,
  `${redDominant}/${sampled}`);

// Drive 5 s. Matrices must stay finite the whole way and the burst must fall.
let nonFinite = 0;
let peakActive = 0;
let firstY = null, midY = null;
for (let f = 0; f < 300; f++) {
  fx.update(DT);
  peakActive = Math.max(peakActive, fx.confettiActive);
  for (let i = 0; i < fx.confetti.count; i += 29) {
    fx.confetti.getMatrixAt(i, m);
    if (m.elements.some((v) => !Number.isFinite(v))) nonFinite++;
  }
  if (f === 5 || f === 150) {
    let sum = 0, n = 0;
    for (let i = 0; i < fx.confetti.count; i++) {
      fx.confetti.getMatrixAt(i, m);
      if (m.elements.every((v) => v === 0)) continue;
      m.decompose(p, q, s);
      sum += p.y; n++;
    }
    if (f === 5) firstY = sum / n; else midY = sum / n;
  }
}
check('no NaN/Inf in sampled confetti matrices over 5 s', nonFinite === 0, `${nonFinite} bad`);
check('confetti flutters downward', midY < firstY, `${firstY?.toFixed(2)} -> ${midY?.toFixed(2)}`);
check('confetti fully recycled after its lifetime', fx.confettiActive === 0,
  `still ${fx.confettiActive} alive`);
check('every instance hidden again after the burst', hiddenCount() === fx.confetti.count);
check('burst never allocated a second mesh', added.length === 1 && removed.length === 0);

// A second goal must reuse the same pool, from the other end and in blue.
fx.onGoal(1, -1);
fx.update(DT);
let otherEnd = 0, blueDominant = 0;
for (let i = 0; i < 40; i++) {
  fx.confetti.getMatrixAt(i, m);
  if (m.elements.every((v) => v === 0)) continue;
  m.decompose(p, q, s);
  if (p.z < -18) otherEnd++;
  if (cAttr.getZ(i) >= cAttr.getX(i)) blueDominant++;
}
check('second burst reuses the pool', added.length === 1 && fx.allocations.confetti === 1);
check('second burst erupts behind the other goal', otherEnd >= 35, `${otherEnd}/40`);
check('second burst wears blue', blueDominant >= 35, `${blueDominant}/40`);
for (let f = 0; f < 320; f++) fx.update(DT);
check('second burst also cleans up', fx.confettiActive === 0);

// -------------------------------------------------------------------- rain

check('no rain allocated while clear', fx.rain === null && fx.allocations.rain === 0);

fx.setWeather('yagmur');
const rainMesh = fx.rain;
const rainBuf = fx.r.y;
check('rain builds one InstancedMesh', !!rainMesh?.isInstancedMesh);
check('rain is a dense streak field',
  rainMesh.count >= 600 && rainMesh.count <= 4000, `count ${rainMesh.count}`);
check('rain + sheen added once each',
  fx.allocations.rain === 1 && fx.allocations.sheen === 1 && added.length === 3,
  `added ${added.length}`);
check('rain visible while it rains', rainMesh.visible && fx.sheen.visible);

// One second of rain: drops fall and recycle instead of running off to -inf.
let rainNonFinite = 0, below = 0;
const y0 = fx.r.y[0];
for (let f = 0; f < 60; f++) {
  fx.update(DT);
  for (let i = 0; i < rainMesh.count; i += 97) {
    rainMesh.getMatrixAt(i, m);
    if (m.elements.some((v) => !Number.isFinite(v))) rainNonFinite++;
  }
}
for (let i = 0; i < rainMesh.count; i++) if (fx.r.y[i] < 0) below++;
check('no NaN/Inf in sampled rain matrices', rainNonFinite === 0, `${rainNonFinite} bad`);
check('rain recycles above the ground', below === 0, `${below} below y=0`);
check('rain actually moves', fx.r.y[0] !== y0);

fx.setWeather('acik');
check('clear weather hides rain without freeing it',
  fx.rain === rainMesh && !rainMesh.visible && !fx.sheen.visible && removed.length === 0);
fx.setWeather('yagmur');
fx.setWeather('acik');
fx.setWeather('yagmur');
check('toggling allocates once and reuses the buffers',
  fx.allocations.rain === 1 && fx.allocations.sheen === 1
  && fx.rain === rainMesh && fx.r.y === rainBuf && added.length === 3,
  `alloc ${fx.allocations.rain}/${fx.allocations.sheen} added ${added.length}`);
check('unknown weather falls back to clear', fx.setWeather('sis') === 'acik');

// snow: its own pool, its own pass, and it must not disturb the rain's
{
  const before = fx.allocations.rain;
  check('snow is a real mode', fx.setWeather('kar') === 'kar');
  check('snow allocates once', fx.allocations.snow === 1 && fx.snow !== null,
    `alloc ${fx.allocations.snow}`);
  check('snow does not rebuild the rain', fx.allocations.rain === before);
  check('only snow draws while it snows',
    fx.snow.visible === true && (!fx.rain || fx.rain.visible === false));

  // A flake must wander around its drift, not walk away from it: the sway is a
  // displacement from a base position rather than something integrated.
  const i = 7;
  fx.setWeather('kar');
  const startBase = fx.s.baseX[i];
  let maxOffset = 0;
  for (let f = 0; f < 120; f++) {
    fx.update(1 / 60);
    maxOffset = Math.max(maxOffset, Math.abs(fx.s.x[i] - fx.s.baseX[i]));
  }
  check('a flake sways around its path without drifting off it',
    maxOffset > 0.05 && maxOffset <= 0.56,
    `max offset ${maxOffset.toFixed(3)} m`);
  check('calm air leaves the column where it was',
    Math.abs(fx.s.baseX[i] - startBase) < 1e-6,
    `${(fx.s.baseX[i] - startBase).toFixed(6)} m`);

  // and it falls
  const y0 = fx.s.y[i];
  fx.update(0.05);
  check('snow falls', fx.s.y[i] < y0, `${y0.toFixed(2)} -> ${fx.s.y[i].toFixed(2)}`);
  fx.setWeather('acik');
  check('clear stops drawing the snow', fx.snow.visible === false);
}

// ------------------------------------------------------- weather scene hook

const real = new THREE.Scene();
real.background = new THREE.Color(0x0b1226);
real.fog = new THREE.Fog(0x0b1226, 60, 160);
const hemi = new THREE.HemisphereLight(0xc4d6ff, 0x1c3a24, 0.8);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
real.add(hemi, sun);

fx.setWeather('yagmur');
check('scene hook reports it ran', fx.applyWeatherToScene(real) === true);
check('rain dims the lights', hemi.intensity < 0.8 && sun.intensity < 1.5,
  `hemi ${hemi.intensity} sun ${sun.intensity}`);
check('rain tightens and darkens the fog',
  real.fog.far < 160 && real.fog.color.getHex() !== 0x0b1226,
  `far ${real.fog.far} color ${real.fog.color.getHexString()}`);
fx.setWeather('acik');
fx.applyWeatherToScene(real);
check('clear weather restores the scene exactly',
  hemi.intensity === 0.8 && sun.intensity === 1.5
  && real.fog.near === 60 && real.fog.far === 160
  && real.fog.color.getHex() === 0x0b1226 && real.background.getHex() === 0x0b1226,
  `hemi ${hemi.intensity} sun ${sun.intensity} fog ${real.fog.near}/${real.fog.far}`);
check('stub scenes are tolerated', fx.applyWeatherToScene(scene) === false);

// -------------------------------------------------------------- camera shake

const basisSeen = [];
const fakeCamera = {
  position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
  lookAt(x, y, z) { basisSeen.push([x, y, z]); },
};
const rig = new CameraRig(fakeCamera);
const ctx = { ball: { x: 0, y: 0.11, z: 0 }, state: 'play', me: null };

// settle the rig so the shake is the only thing still moving
for (let f = 0; f < 240; f++) rig.update(DT, ctx);
const rest = { x: fakeCamera.position.x, y: fakeCamera.position.y, z: fakeCamera.position.z };
check('rig settles before the shake', rig.shakeAmp === 0);

rig.shake(0.5);
check('shake stores the strength', Math.abs(rig.shakeAmp - 0.5) < 1e-9, `amp ${rig.shakeAmp}`);
rig.shake(0.15); // weaker hits never cut a bigger shake short
check('weaker shakes do not override', Math.abs(rig.shakeAmp - 0.5) < 1e-9, `amp ${rig.shakeAmp}`);

let maxOffset = 0, ampAt05 = null, ampAt15 = null, shakeNonFinite = 0;
let basisDrift = 0;
const baseLook = basisSeen[basisSeen.length - 1];
for (let f = 0; f < 120; f++) { // 2 s
  rig.update(DT, ctx);
  const o = rig.shakeOffset;
  if (![o.x, o.y, o.z, rig.shakeAmp].every(Number.isFinite)) shakeNonFinite++;
  maxOffset = Math.max(maxOffset, Math.hypot(o.x, o.y, o.z));
  const look = basisSeen[basisSeen.length - 1];
  basisDrift = Math.max(basisDrift, Math.max(
    Math.abs(look[0] - baseLook[0]), Math.abs(look[1] - baseLook[1]),
    Math.abs(look[2] - baseLook[2]),
  ));
  if (f === 30) ampAt05 = rig.shakeAmp;   // t = 0.5 s
  if (f === 89) ampAt15 = rig.shakeAmp;   // t = 1.5 s
}
check('shake values stay finite', shakeNonFinite === 0, `${shakeNonFinite} frames`);
check('shake actually displaces the camera', maxOffset > 0.05, `max ${maxOffset.toFixed(3)}`);
check('shake is still alive at 0.5 s', ampAt05 > 0.01, `amp ${ampAt05.toFixed(4)}`);
check('shake decays below 0.01 within 1.5 s', ampAt15 < 0.01, `amp ${ampAt15.toFixed(5)}`);
check('shake settles back to exactly zero', rig.shakeAmp === 0
  && rig.shakeOffset.x === 0 && rig.shakeOffset.y === 0 && rig.shakeOffset.z === 0);
check('look-at target never twitches with the shake', basisDrift < 1e-6,
  `drift ${basisDrift}`);
check('camera returns to its unshaken position',
  Math.abs(fakeCamera.position.x - rest.x) < 1e-6
  && Math.abs(fakeCamera.position.y - rest.y) < 1e-6
  && Math.abs(fakeCamera.position.z - rest.z) < 1e-6);
rig.shake(NaN);
check('bad shake strengths are ignored', rig.shakeAmp === 0);

console.log(`INFO  confetti pool: ${fx.confetti.count} quads in 1 draw call`);
console.log(`INFO  rain: ${rainMesh.count} streaks in 1 draw call`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
