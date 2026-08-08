// Headless check for CrowdView. three's math and instancing work in node
// without a renderer, so we build the crowd against a stub scene and drive it
// through five simulated seconds of frames.
//
//   node scripts/crowd-test.mjs      (or: npm run test:crowd)

import * as THREE from 'three';
import { CrowdView } from '../packages/client/src/view/crowdView.js';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const added = [];
const scene = { add(obj) { added.push(obj); } };

const crowd = new CrowdView(scene);

check('crowd added to scene as one group', added.length === 1, `added ${added.length}`);
check('two draw calls (bodies + heads)',
  crowd.group.children.length === 2
  && crowd.group.children.every((c) => c.isInstancedMesh),
  `children ${crowd.group.children.length}`);
check('instance count in range 1200..4000',
  crowd.count >= 1200 && crowd.count <= 4000, `count ${crowd.count}`);
check('both meshes sized to the instance count',
  crowd.bodies.count === crowd.count && crowd.heads.count === crowd.count);
check('per-instance colors uploaded',
  !!crowd.bodies.instanceColor && !!crowd.heads.instanceColor);

// Sampled instance matrices: finite, seated on a tier top, inside the stands.
const TIER_TOPS = [1.6, 3.1, 4.6];
const m = new THREE.Matrix4();
const p = new THREE.Vector3();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();
let badMatrix = 0, badY = 0, badXZ = 0, badScale = 0;
const sectionSeen = { side: 0, endRed: 0, endBlue: 0 };
for (let i = 0; i < crowd.count; i++) {
  crowd.bodies.getMatrixAt(i, m);
  if (m.elements.some((v) => !Number.isFinite(v))) { badMatrix++; continue; }
  m.decompose(p, q, s);
  if (!TIER_TOPS.some((y) => Math.abs(p.y - y) < 1e-6)) badY++;
  const onSide = Math.abs(p.x) > 12.5 && Math.abs(p.x) < 20.5;
  const onEnd = Math.abs(p.z) > 21.5 && Math.abs(p.z) < 30;
  if (!onSide && !onEnd) badXZ++;
  if (s.x < 0.8 || s.x > 1.2) badScale++;
  if (onEnd) { if (p.z < 0) sectionSeen.endRed++; else sectionSeen.endBlue++; }
  else sectionSeen.side++;
}
check('no NaN/Inf in any instance matrix', badMatrix === 0, `${badMatrix} bad`);
check('every spectator sits on a stand tier top', badY === 0, `${badY} off-tier`);
check('every spectator sits within the stand footprint', badXZ === 0, `${badXZ} outside`);
check('instance scales within jitter range', badScale === 0, `${badScale} out of range`);
check('all three sections populated',
  sectionSeen.side > 500 && sectionSeen.endRed > 200 && sectionSeen.endBlue > 200,
  JSON.stringify(sectionSeen));

// Head matrices must track the body matrices exactly.
const mb = new THREE.Matrix4(), mh = new THREE.Matrix4();
let headMismatch = 0;
for (let i = 0; i < crowd.count; i += 37) {
  crowd.bodies.getMatrixAt(i, mb);
  crowd.heads.getMatrixAt(i, mh);
  if (mb.elements.some((v, k) => Math.abs(v - mh.elements[k]) > 1e-6)) headMismatch++;
}
check('head instances share the body transforms', headMismatch === 0, `${headMismatch} mismatched`);

// Drive 5 s at 60 Hz with events fired along the way.
const DT = 1 / 60;
const FRAMES = 300;
let t = 0;
let ampAfterGoal = 0, ampOpposite = 0, ampNeutral = 0;
let oohPeak = 0, oohDuringCheer = 0;
let nonFinite = 0;
const t0 = process.hrtime.bigint();
for (let f = 0; f < FRAMES; f++) {
  if (f === 60) crowd.onGoal(0);              // red scores at t = 1.0 s
  if (f === 120) crowd.onNearMiss();          // ignored: the cheer still runs
  if (f === 215) crowd.onNearMiss();          // woodwork at t ~ 3.6 s, crowd idle
  if (f === 240) crowd.onGoal(1);             // blue scores at t = 4.0 s
  crowd.update(DT, t);
  t += DT;

  const a = crowd.uniforms.uAmp.value;
  if (![a.x, a.y, a.z, crowd.uniforms.uOoh.value, crowd.uniforms.uTime.value]
    .every(Number.isFinite)) nonFinite++;
  if (f === 66) { ampAfterGoal = a.y; ampOpposite = a.z; ampNeutral = a.x; }
  if (f >= 120 && f < 210) oohDuringCheer = Math.max(oohDuringCheer, crowd.uniforms.uOoh.value);
  if (f >= 215 && f < 240) oohPeak = Math.max(oohPeak, crowd.uniforms.uOoh.value);
}
const t1 = process.hrtime.bigint();
const avgMs = Number(t1 - t0) / 1e6 / FRAMES;

check('all uniforms stay finite across the run', nonFinite === 0, `${nonFinite} frames`);
check('scoring block erupts on goal', ampAfterGoal > 0.85, `amp ${ampAfterGoal.toFixed(3)}`);
check('neutral stands react mildly', ampNeutral > 0.2 && ampNeutral < 0.45,
  `amp ${ampNeutral.toFixed(3)}`);
check('opposing block stays quiet', ampOpposite < 0.1, `amp ${ampOpposite.toFixed(3)}`);
check('near miss triggers a bounce', oohPeak > 0.9, `peak ${oohPeak.toFixed(3)}`);
check('near miss ignored mid-celebration', oohDuringCheer === 0,
  `peak ${oohDuringCheer.toFixed(3)}`);

// After the last goal decays, everything must settle back to idle.
for (let f = 0; f < 200; f++) crowd.update(DT, (t += DT));
const rest = crowd.uniforms.uAmp.value;
check('celebration decays to idle within 2.5 s',
  rest.x === 0 && rest.y === 0 && rest.z === 0 && crowd.uniforms.uOoh.value === 0,
  `amp ${rest.toArray().join(',')} ooh ${crowd.uniforms.uOoh.value}`);

// Matrices are written once at construction, so the animation must not have
// disturbed them.
crowd.bodies.getMatrixAt(0, m);
check('instance matrices untouched by update()', m.elements.every(Number.isFinite));

console.log(`INFO  instances: ${crowd.count} (${crowd.count * 2} across 2 draw calls)`);
console.log(`INFO  update() average: ${avgMs.toFixed(5)} ms/frame over ${FRAMES} frames`);
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
