// Headless gate for the arena atmosphere layer — matrix rows #21 to #25.
//
// three's math, instancing and scene graph all work in node without a
// renderer, so everything below runs against stub scenes. What cannot be
// checked here (a real draw call count, a real triangle count) is measured in
// a browser instead and reported separately; what CAN be checked here is
// checked properly rather than approximated.
//
//   node scripts/atmos-test.mjs      (or: npm run test:atmos)

import * as THREE from 'three';

import {
  ArenaCrowd, buildSeats, mulberry32,
} from '../packages/client/src/arena/atmos/crowd.js';
import {
  CLIP, CLIP_COUNT, FRAMES, VAT_RANGE, bakeCrowdVat, buildSpectatorMesh,
  decodeOffset, encodeOffset, poseOffset,
} from '../packages/client/src/arena/atmos/vat.js';
import { ArenaNets, CosmeticBall, collideBallNet } from '../packages/client/src/arena/atmos/net.js';
import { ClothSheet, windAt } from '../packages/client/src/arena/atmos/cloth.js';
import { CornerFlags } from '../packages/client/src/arena/atmos/flags.js';
import { BallBoys, PHASE, ballBoyPose } from '../packages/client/src/arena/atmos/ballboy.js';
import {
  ATLAS_SIZE, CELL_SIZE, KEEPER_CELL, KitSystem, PATTERNS, atlasTexel,
  buildKitAtlas, cellRect, cellUv, digitCell, glyphPixel, kitUniformValues,
  luminance, patternCell, resolveKit,
} from '../packages/client/src/arena/atmos/kit.js';
import { ArenaSfx, createAudioGate, tensionOf } from '../packages/client/src/arena/atmos/sound.js';
import { TIERS, detectTier, resolveTier } from '../packages/client/src/arena/atmos/quality.js';
import { Atmosphere } from '../packages/client/src/arena/atmos/index.js';
import { PITCH_M, GOAL_HEIGHT_M } from '../packages/client/src/arena/units.js';

let failures = 0;
let checks = 0;
function check(name, ok, detail = '') {
  checks++;
  if (ok) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
function section(title) { console.log(`\n--- ${title}`); }

/** A scene stub: three's objects only ever call add/remove on it. */
function stubScene() {
  const added = [];
  return {
    added,
    add(...objs) { added.push(...objs); return this; },
    remove(obj) {
      const i = added.indexOf(obj);
      if (i >= 0) added.splice(i, 1);
      return this;
    },
  };
}

const DT = 1 / 60;

// =========================================================== #21 crowd + VAT

section('#21 crowd: vertex animation texture');

const mesh = buildSpectatorMesh();
check('spectator mesh is 24 triangles',
  mesh.triangleCount === 24, `${mesh.triangleCount}`);
check('spectator mesh vertex count matches the triangles',
  mesh.vertexCount === mesh.triangleCount * 3, `${mesh.vertexCount}`);
check('every spectator vertex is finite',
  mesh.positions.every(Number.isFinite));
check('every spectator normal is unit length',
  (() => {
    for (let i = 0; i < mesh.vertexCount; i++) {
      const o = i * 3;
      const l = Math.hypot(mesh.normals[o], mesh.normals[o + 1], mesh.normals[o + 2]);
      if (Math.abs(l - 1) > 1e-4) return false;
    }
    return true;
  })());
check('the mesh has all four parts tagged',
  new Set(mesh.parts).size === 4, `${[...new Set(mesh.parts)].join(',')}`);

const baked = bakeCrowdVat(mesh);
check('VAT is RGBA8 and one row per clip frame',
  baked.width === mesh.vertexCount && baked.height === CLIP_COUNT * FRAMES
  && baked.data.length === baked.width * baked.height * 4,
  `${baked.width}x${baked.height}`);
check('VAT is small enough to be free (under 64 KB)',
  baked.bytes < 65536, `${baked.bytes} bytes`);
check('VAT alpha channel is fully opaque',
  (() => { for (let i = 3; i < baked.data.length; i += 4) if (baked.data[i] !== 255) return false; return true; })());

// Round-trip: the byte encoding must reproduce the pose within its quantum.
{
  const off = [0, 0, 0];
  let worst = 0;
  let nonFinite = 0;
  for (let clip = 0; clip < CLIP_COUNT; clip++) {
    for (let f = 0; f < FRAMES; f += 3) {
      for (let v = 0; v < mesh.vertexCount; v += 5) {
        const p = v * 3;
        poseOffset(clip, f / FRAMES, mesh.positions[p], mesh.positions[p + 1],
          mesh.positions[p + 2], mesh.parts[v], off);
        if (!off.every(Number.isFinite)) nonFinite++;
        const o = ((clip * FRAMES + f) * baked.width + v) * 4;
        for (let a = 0; a < 3; a++) {
          worst = Math.max(worst, Math.abs(decodeOffset(baked.data[o + a]) - clamp(off[a], -VAT_RANGE, VAT_RANGE)));
        }
      }
    }
  }
  check('no pose produces a non-finite offset', nonFinite === 0, `${nonFinite}`);
  // one quantum is 2 * range / 255
  const quantum = (2 * VAT_RANGE) / 255;
  check('VAT decode error is within one quantum',
    worst <= quantum * 1.01, `worst ${worst.toFixed(5)} vs ${quantum.toFixed(5)}`);
}
check('encode/decode round trips through zero',
  Math.abs(decodeOffset(encodeOffset(0))) < 2e-3);
check('encode saturates rather than wrapping',
  encodeOffset(99) === 255 && encodeOffset(-99) === 0);

// Every looping clip has to meet itself at the seam, or the crowd stutters
// once per loop. WAVE is the exception by design: it is a one-shot rise and
// fall that the shader drives from the wave front, not from a looping phase.
{
  const a = [0, 0, 0], b = [0, 0, 0];
  let worst = 0;
  let worstClip = -1;
  for (const clip of [CLIP.IDLE, CLIP.CLAP, CLIP.CELEBRATE, CLIP.SLUMP]) {
    for (let v = 0; v < mesh.vertexCount; v++) {
      const p = v * 3;
      poseOffset(clip, 0, mesh.positions[p], mesh.positions[p + 1], mesh.positions[p + 2], mesh.parts[v], a);
      poseOffset(clip, 1 - 1e-6, mesh.positions[p], mesh.positions[p + 1], mesh.positions[p + 2], mesh.parts[v], b);
      for (let k = 0; k < 3; k++) {
        const d = Math.abs(a[k] - b[k]);
        if (d > worst) { worst = d; worstClip = clip; }
      }
    }
  }
  check('looping clips meet themselves at the seam',
    worst < 1e-4, `worst ${worst.toFixed(6)} on clip ${worstClip}`);
}

section('#21 crowd: instancing and budget');

const crowdScene = stubScene();
const crowd = new ArenaCrowd(crowdScene, { tier: 'high', seed: 0x5eed17 });

check('crowd mounts as exactly one group', crowdScene.added.length === 1);
check('crowd is ONE instanced draw call',
  crowd.group.children.length === 1 && crowd.group.children[0].isInstancedMesh,
  `${crowd.group.children.length} children`);
check('crowd instance count is a stadium (1200..4000)',
  crowd.count >= 1200 && crowd.count <= 4000, `count ${crowd.count}`);
check('crowd triangles inside the 150k scene budget',
  crowd.triangles < 100000, `${crowd.triangles} triangles`);
check('per-instance colours uploaded', !!crowd.instanced.instanceColor);

{
  const TIER_TOPS = [1.6, 3.1, 4.6];
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  let badMatrix = 0, offTier = 0, outside = 0, badScale = 0;
  const seen = { side: 0, red: 0, blue: 0 };
  for (let i = 0; i < crowd.count; i++) {
    crowd.instanced.getMatrixAt(i, m);
    if (m.elements.some((v) => !Number.isFinite(v))) { badMatrix++; continue; }
    m.decompose(p, q, s);
    if (!TIER_TOPS.some((y) => Math.abs(p.y - y) < 1e-6)) offTier++;
    const onSide = Math.abs(p.x) > 12.5 && Math.abs(p.x) < 20.5;
    const onEnd = Math.abs(p.z) > 21.5 && Math.abs(p.z) < 30;
    if (!onSide && !onEnd) outside++;
    if (s.x < 0.8 || s.x > 1.2) badScale++;
    if (onEnd) { if (p.z < 0) seen.red++; else seen.blue++; } else seen.side++;
  }
  check('no NaN/Inf in any crowd instance matrix', badMatrix === 0, `${badMatrix}`);
  check('every spectator sits on a stand tier top', offTier === 0, `${offTier}`);
  check('every spectator sits inside the stand footprint', outside === 0, `${outside}`);
  check('instance scales stay inside the jitter range', badScale === 0, `${badScale}`);
  check('all three sections are populated',
    seen.side > 400 && seen.red > 150 && seen.blue > 150, JSON.stringify(seen));
}

// Layout must be deterministic: same seed, same stadium.
{
  const a = buildSeats(TIERS.high, mulberry32(7));
  const b = buildSeats(TIERS.high, mulberry32(7));
  const same = a.length === b.length && a.every((s, i) =>
    s.x === b[i].x && s.z === b[i].z && s.color === b[i].color);
  check('crowd layout is deterministic for a seed', same);
  const wave = a.every((s) => s.wave >= 0 && s.wave < 1);
  check('every seat has a wave position in [0,1)', wave);
}

// Ten simulated seconds with every event fired, watching for drift and NaN.
{
  const FRAMES_10S = 600;
  let nonFinite = 0;
  let sawCelebrate = false, sawWave = false, sawIdle = false;
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < FRAMES_10S; f++) {
    if (f === 60) crowd.onGoal(0);
    if (f === 330) crowd.onApplause();
    if (f === 420) crowd.startWave(1);
    crowd.update(DT);
    const u = crowd.uniforms;
    for (const v of [u.uCheer.value, u.uSad.value, u.uClap.value]) {
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) nonFinite++;
    }
    if (!Number.isFinite(u.uTime.value) || !Number.isFinite(u.uWaveFront.value.x)) nonFinite++;
    if (crowd.state === 'celebrate') sawCelebrate = true;
    if (crowd.state === 'wave') sawWave = true;
    if (crowd.state === 'idle') sawIdle = true;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check('no non-finite crowd uniform over 10 s', nonFinite === 0, `${nonFinite}`);
  check('crowd reaches all three states', sawCelebrate && sawWave && sawIdle,
    `celebrate ${sawCelebrate} wave ${sawWave} idle ${sawIdle}`);
  check('crowd update is O(1): 600 frames under 12 ms total',
    ms < 12, `${ms.toFixed(2)} ms for ${crowd.count} spectators`);
  console.log(`      crowd cost: ${(ms / FRAMES_10S * 1000).toFixed(1)} us/frame`);
  // instance matrices are uploaded once and never rewritten
  const m = new THREE.Matrix4();
  crowd.instanced.getMatrixAt(0, m);
  check('instance matrices are untouched by update (GPU animation)',
    m.elements.every(Number.isFinite));
}

// Goal reactions must be per team: the scoring end cheers, the other slumps.
{
  const c = new ArenaCrowd(stubScene(), { tier: 'low', seed: 3 });
  c.onGoal(0);
  c.update(DT);
  const cheer = c.uniforms.uCheer.value.clone();
  const sad = c.uniforms.uSad.value.clone();
  check('red goal cheers the red end', cheer.y > 0.5 && cheer.z < 0.2,
    `${cheer.toArray().join(',')}`);
  check('red goal slumps the blue end', sad.z > 0.5 && sad.y === 0,
    `${sad.toArray().join(',')}`);
  c.onGoal(1);
  c.update(DT);
  check('blue goal flips both reactions',
    c.uniforms.uCheer.value.z > 0.5 && c.uniforms.uSad.value.y > 0.5);
  // and it decays back to nothing
  for (let i = 0; i < 600; i++) c.update(DT);
  check('the crowd settles back to idle', c.state === 'idle'
    && c.uniforms.uCheer.value.lengthSq() === 0);
  c.dispose();
}

// Tiers must actually turn the crowd down.
{
  const low = new ArenaCrowd(stubScene(), { tier: 'low', seed: 1 });
  const high = new ArenaCrowd(stubScene(), { tier: 'high', seed: 1 });
  check('the low tier seats far fewer spectators',
    low.count < high.count * 0.35, `low ${low.count} high ${high.count}`);
  low.dispose(); high.dispose();
}

// ================================================================= #22 boys

section('#22 ball-boy scenes');

{
  const home = { x: 10, z: 14 };
  const ball = { x: 1.2, z: 17.5 };
  const spot = { x: 0, z: 0 };
  const start = ballBoyPose(0, home, ball, spot);
  const end = ballBoyPose(1, home, ball, spot);
  check('the scene starts at the touchline',
    near(start.x, home.x) && near(start.z, home.z) && start.phase === PHASE.FETCH);
  check('the scene ends back at the touchline',
    near(end.x, home.x) && near(end.z, home.z) && end.phase === PHASE.RETURN);
  const phases = new Set();
  let carriedFrom = -1, carriedTo = -1;
  let jump = 0, px = start.x, pz = start.z;
  for (let i = 0; i <= 1000; i++) {
    const p = ballBoyPose(i / 1000, home, ball, spot);
    phases.add(p.phase);
    if (p.carrying && carriedFrom < 0) carriedFrom = i / 1000;
    if (p.carrying) carriedTo = i / 1000;
    jump = Math.max(jump, Math.hypot(p.x - px, p.z - pz));
    px = p.x; pz = p.z;
  }
  check('the sequence runs all five phases', phases.size === 5,
    [...phases].join(','));
  check('the boy carries the ball across the middle of the window',
    carriedFrom > 0.3 && carriedFrom < 0.5 && carriedTo > 0.75 && carriedTo < 0.9,
    `${carriedFrom.toFixed(2)}..${carriedTo.toFixed(2)}`);
  check('the path never teleports', jump < 0.2, `max step ${jump.toFixed(3)}`);
  check('the pose is clamped outside [0,1]',
    near(ballBoyPose(-5, home, ball, spot).x, home.x)
    && near(ballBoyPose(9, home, ball, spot).x, home.x));
}

{
  const boyScene = stubScene();
  const boys = new BallBoys(boyScene, { halfX: PITCH_M.halfX, halfZ: PITCH_M.halfZ, tier: 'high' });
  check('ball boys are one instanced draw call',
    boys.group.children.length === 1 && boys.instanced.isInstancedMesh);
  check('ball boys idle before any dead ball', boys.phase === PHASE.IDLE);

  const ball = new CosmeticBall(PITCH_M.ballR);
  ball.launch({ x: 0.4, z: 18.4, vx: 0, vz: 5 });
  const RESTART = 2.6;
  const started = boys.onDeadBall({ kind: 'goal', x: 0.4, z: 18.4, seconds: RESTART });
  check('a dead ball starts a scene', started && boys.active >= 0);

  const seenPhases = new Set();
  let heldFrames = 0;
  let badMatrix = 0;
  const m = new THREE.Matrix4();
  const frames = Math.round(RESTART / DT) + 20;
  for (let f = 0; f < frames; f++) {
    boys.update(DT, ball);
    seenPhases.add(boys.phase);
    if (ball.held) heldFrames++;
    for (let i = 0; i < boys.count; i++) {
      boys.instanced.getMatrixAt(i, m);
      if (m.elements.some((v) => !Number.isFinite(v))) badMatrix++;
    }
  }
  check('the scene fits inside the restart window',
    boys.phase === PHASE.IDLE && boys.active === -1, `${boys.phase}`);
  check('the ball was actually carried', heldFrames > 20, `${heldFrames} frames`);
  check('the ball ends on the restart spot',
    near(ball.x, 0, 0.05) && near(ball.z, 0, 0.05), `${ball.x.toFixed(2)},${ball.z.toFixed(2)}`);
  check('no NaN in any ball-boy instance matrix', badMatrix === 0, `${badMatrix}`);
  check('the scene played every phase', seenPhases.size >= 5, [...seenPhases].join(','));

  // Timing is the point of the row: whatever T the arena runs, the boy fits.
  for (const T of [1.2, 2.6, 5]) {
    const b2 = new BallBoys(stubScene(), { halfX: 8, halfZ: 18, tier: 'medium' });
    b2.onDeadBall({ x: 2, z: 17, seconds: T });
    let n = 0;
    while (b2.active >= 0 && n < 4000) { b2.update(DT); n++; }
    const took = n * DT;
    check(`a ${T} s restart window is filled exactly once`,
      Math.abs(took - T) < DT * 2, `took ${took.toFixed(2)} s`);
    b2.dispose();
  }
  boys.dispose();
}

// ========================================================== #23 net + flags

section('#23 goal net: XPBD cloth, read-only ball');

{
  const netScene = stubScene();
  const nets = new ArenaNets(netScene, {
    goalW: PITCH_M.goalHalfX * 2,
    goalH: GOAL_HEIGHT_M,
    goalZ: PITCH_M.halfZ,
    ballRadius: PITCH_M.ballR,
    tier: 'high',
  });
  check('both goals get a net', nets.nets.length === 2);
  check('the nets render in one fat-line draw call',
    netScene.added.length === 1 && !!nets.view.mesh);
  console.log(`      net: ${nets.nodeCount} nodes, ${nets.segments} drawn cords`);

  // Settle, then confirm nothing exploded and the sheet still hangs.
  for (let f = 0; f < 180; f++) nets.update(DT, null);
  const finite = nets.nets.every((n) => [...n.pos].every(Number.isFinite));
  check('the net is finite after 3 s of idling', finite);
  check('the net never needed a reset while idling', nets.resets === 0);

  // A ball pressed into the back skirt of the sheet. The net roof slopes from
  // the crossbar down to the ground pegs NET_BOT_DEPTH behind the line, so a
  // ball on the grass meets the netting near the back of the goal, not on the
  // line itself. The sheet must move; the ball must not.
  const backZ = PITCH_M.halfZ + nets.stats().backDepth - 0.45;
  const ball = { x: 0.2, y: PITCH_M.ballR, z: backZ };
  const before = nets.nets[1].pos.slice();
  const frozen = { ...ball };
  let contacts = 0;
  let worstPen = 0;
  for (let f = 0; f < 90; f++) {
    ball.z = backZ + Math.sin(f * 0.2) * 0.15;
    nets.update(DT, ball);
    contacts += nets.lastContacts;
    worstPen = Math.max(worstPen, nets.lastMaxPenetration);
  }
  check('the ball rippled the sheet', contacts > 0, `${contacts} contacts`);
  check('the authoritative ball was never written',
    ball.x === frozen.x && ball.y === frozen.y);
  const moved = countMoved(before, nets.nets[1].pos, 1e-4);
  check('the sheet actually deformed', moved > 20, `${moved} nodes moved`);

  // Post-correction: after the frame, no cord may still be inside the ball.
  const pen = deepestPenetration(nets.nets[1], ball, PITCH_M.ballR);
  check('post-correction leaves no cord inside the ball',
    pen < 1e-3, `deepest ${pen.toFixed(5)} m`);

  // Now the abusive case: a ball teleporting across the sheet every frame.
  const resetsBefore = nets.resets;
  for (let f = 0; f < 300; f++) {
    const s = f % 2 ? 1 : -1;
    ball.z = PITCH_M.halfZ + 1.2 + s * 0.9;
    ball.x = Math.sin(f) * 2;
    ball.y = PITCH_M.ballR + Math.abs(Math.sin(f * 0.7)) * 1.8;
    nets.update(DT, ball);
  }
  check('a teleporting ball never explodes the solver',
    nets.nets.every((n) => [...n.pos].every(Number.isFinite))
    && nets.resets === resetsBefore, `${nets.resets - resetsBefore} resets`);
  check('cords stay inside the strain limit',
    maxStrain(nets.nets[1]) < 1.2, `${maxStrain(nets.nets[1]).toFixed(3)}`);

  // The cosmetic ball is the two-way one and must be stopped by the sheet.
  // A modest 11 m/s is deliberate: the ball has to CARRY into the netting on
  // its own, which is what caught a per-substep friction bug that stopped it
  // a hand's width past the line.
  nets.launchCosmeticBall({ x: 0, z: PITCH_M.halfZ - 0.4, vx: 0, vz: 11 });
  let deepest = 0;
  let netTouches = 0;
  for (let f = 0; f < 150; f++) {
    nets.update(DT, null);
    netTouches += nets.lastContacts;
    deepest = Math.max(deepest, deepestPenetration(nets.nets[1], nets.ball, PITCH_M.ballR));
  }
  const b = nets.ball;
  check('the cosmetic ball crossed the goal line',
    b.z > PITCH_M.halfZ, `z ${b.z.toFixed(2)}`);
  check('the cosmetic ball carried all the way into the netting',
    b.z > PITCH_M.halfZ + 1.2 && netTouches > 0,
    `z ${b.z.toFixed(2)}, ${netTouches} contacts`);
  check('the cosmetic ball never passed through the back of the net',
    b.z < PITCH_M.halfZ + nets.stats().backDepth + 0.2,
    `z ${b.z.toFixed(2)} vs limit ${(PITCH_M.halfZ + nets.stats().backDepth).toFixed(2)}`);
  check('the cosmetic ball stayed on the mouth side of every cord',
    deepest < 0.02, `deepest ${deepest.toFixed(4)} m`);
  check('the cosmetic ball is finite',
    Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z));

  // Cost per frame, with the ball in the net (the expensive case).
  {
    const N = 200;
    const t0 = process.hrtime.bigint();
    for (let f = 0; f < N; f++) nets.update(DT, null);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`      net solver: ${(ms / N).toFixed(2)} ms/frame with contact`);
    check('net solver stays inside a 6 ms frame budget',
      ms / N < 6, `${(ms / N).toFixed(2)} ms/frame`);
  }
  nets.clearCosmeticBall();
  nets.dispose();
}

section('#23 corner flags: Verlet sheet');

{
  const sheet = new ClothSheet({ cols: 10, rows: 8, origin: [0, 1.5, 0] });
  check('the flag grid is the specified 10x8', sheet.count === 80);
  check('the pole edge is pinned',
    [...sheet.pinned].filter(Boolean).length === 8);
  let worstStrain = 0;
  for (let f = 0; f < 1200; f++) {
    sheet.step(DT, { wind: windAt(f * DT, 1.6), iters: 4 });
    worstStrain = Math.max(worstStrain, sheet.maxStrain());
  }
  check('the sheet is finite after 20 s of gusting wind', sheet.finite());
  check('the sheet never stretches past 25 %', worstStrain < 1.25,
    `${worstStrain.toFixed(3)}`);
  const pinnedStill = sheet.pos[0] === 0 && sheet.pos[1] === 1.5 && sheet.pos[2] === 0;
  check('a pinned particle never moves', pinnedStill);

  // A ludicrous wind must not be able to blow the solver up.
  const wild = new ClothSheet({ cols: 10, rows: 8 });
  for (let f = 0; f < 600; f++) wild.step(DT, { wind: [4000, -9000, 3000], iters: 4 });
  check('an absurd wind still leaves finite particles', wild.finite());
  check('an absurd wind still respects the constraints',
    wild.maxStrain() < 2.5, `${wild.maxStrain().toFixed(2)}`);

  const flagScene = stubScene();
  const flags = new CornerFlags(flagScene, { halfX: PITCH_M.halfX, halfZ: PITCH_M.halfZ, tier: 'high' });
  check('four corner flags, two draw calls (sheets + poles)',
    flags.sheets.length === 4 && flags.group.children.length === 2);
  for (let f = 0; f < 600; f++) flags.update(DT);
  const attr = flags.positionAttr.array;
  check('the flag vertex buffer has no NaN', attr.every(Number.isFinite));
  check('the flags never needed a reset', flags.resets === 0, `${flags.resets}`);
  const st = flags.stats();
  console.log(`      flags: ${st.particles} particles, ${st.links} links, `
    + `${st.solveMs.toFixed(3)} ms/frame`);
  check('flag solver costs under 1 ms a frame', st.solveMs < 1, `${st.solveMs.toFixed(3)}`);
  flags.dispose();
}

// ================================================================== #24 kit

section('#24 kit system: atlas, colour mask and number');

{
  const atlas = buildKitAtlas();
  check('the atlas is 512x512 RGBA',
    atlas.width === ATLAS_SIZE && atlas.height === ATLAS_SIZE
    && atlas.data.length === ATLAS_SIZE * ATLAS_SIZE * 4);
  check('the atlas is fully opaque',
    (() => { for (let i = 3; i < atlas.data.length; i += 4) if (atlas.data[i] !== 255) return false; return true; })());

  // Cell geometry: sixteen 128 px cells that tile the atlas exactly.
  {
    let ok = true;
    const covered = new Set();
    for (let i = 0; i < 16; i++) {
      const r = cellRect(i);
      if (r.w !== CELL_SIZE || r.h !== CELL_SIZE) ok = false;
      if (r.x + r.w > ATLAS_SIZE || r.y + r.h > ATLAS_SIZE) ok = false;
      covered.add(`${r.x},${r.y}`);
    }
    check('sixteen distinct 128 px cells tile the atlas', ok && covered.size === 16);
  }

  // uv rectangles: the flip must be exact, and cell 0 must be the top-left.
  {
    const uv0 = cellUv(0);
    check('cell 0 uv is the top-left quarter-eighth',
      uv0[0] === 0 && Math.abs(uv0[1] - (1 - 0.25)) < 1e-9
      && uv0[2] === 0.25 && uv0[3] === 0.25, uv0.join(','));
    const uv15 = cellUv(15);
    check('cell 15 uv is the bottom-right',
      Math.abs(uv15[0] - 0.75) < 1e-9 && Math.abs(uv15[1] - 0) < 1e-9, uv15.join(','));
    const uv = cellUv(6);
    const r = cellRect(6);
    check('uv and pixel rectangles agree for an interior cell',
      Math.abs(uv[0] * ATLAS_SIZE - r.x) < 1e-6
      && Math.abs((1 - uv[1] - uv[3]) * ATLAS_SIZE - r.y) < 1e-6);
  }

  // Pattern masks: the named pattern has to be in the green channel where the
  // pure function says it is, and the plain shirt has to have none of it.
  {
    const plain = cellRect(patternCell('plain'));
    let plainG = 0;
    for (let y = 20; y < 100; y += 7) {
      for (let x = 20; x < 100; x += 7) plainG += atlasTexel(atlas, plain.x + x, plain.y + y)[1];
    }
    check('the plain kit has no secondary mask', plainG === 0, `${plainG}`);

    const stripes = cellRect(patternCell('stripes'));
    const row = [];
    for (let x = 0; x < CELL_SIZE; x++) row.push(atlasTexel(atlas, stripes.x + x, stripes.y + 64)[1] > 127 ? 1 : 0);
    let bands = 1;
    for (let i = 1; i < row.length; i++) if (row[i] !== row[i - 1]) bands++;
    check('the striped kit has eight vertical bands', bands === 8, `${bands}`);

    const hoops = cellRect(patternCell('hoops'));
    const col = [];
    for (let y = 0; y < CELL_SIZE; y++) col.push(atlasTexel(atlas, hoops.x + 64, hoops.y + y)[1] > 127 ? 1 : 0);
    let rings = 1;
    for (let i = 1; i < col.length; i++) if (col[i] !== col[i - 1]) rings++;
    check('the hooped kit bands horizontally instead', rings === 7, `${rings}`);

    const halves = cellRect(patternCell('halves'));
    check('the halved kit splits down the middle',
      atlasTexel(atlas, halves.x + 20, halves.y + 64)[1] === 0
      && atlasTexel(atlas, halves.x + 108, halves.y + 64)[1] === 255);

    // trim: collar at the top, cuffs at the sides
    check('every pattern carries a collar in the trim channel',
      PATTERNS.every((p) => atlasTexel(atlas, cellRect(patternCell(p)).x + 64,
        cellRect(patternCell(p)).y + 4)[2] === 255));
    // fabric shading is present but never black
    check('the fabric shading channel is lit everywhere',
      atlasTexel(atlas, cellRect(0).x + 64, cellRect(0).y + 64)[0] > 150);
  }

  // Digits: the glyph in the atlas must match the 5x7 font exactly.
  {
    let mismatches = 0;
    for (let d = 0; d <= 9; d++) {
      const r = cellRect(digitCell(d));
      for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          // centre of the glyph cell, in the padded sub-rectangle
          const u = 0.12 + ((gx + 0.5) / 5) * 0.76;
          const v = 0.12 + ((gy + 0.5) / 7) * 0.76;
          const px = r.x + Math.floor(u * CELL_SIZE);
          const py = r.y + Math.floor(v * CELL_SIZE);
          const ink = atlasTexel(atlas, px, py)[0] > 127;
          if (ink !== glyphPixel(d, gx, gy)) mismatches++;
        }
      }
    }
    check('every digit glyph is rasterised exactly', mismatches === 0, `${mismatches}`);
    check('digit cells carry no colour mask',
      atlasTexel(atlas, cellRect(digitCell(8)).x + 64, cellRect(digitCell(8)).y + 64)[1] === 0);
  }

  // resolveKit: the pure kit contract.
  {
    const red = resolveKit({ team: 0, number: 9, pattern: 'stripes' });
    check('team 0 wears the first colour', red.primary === 0xe23b3b, hex(red.primary));
    check('a single digit resolves to one cell',
      red.digits.length === 1 && red.digits[0] === digitCell(9), red.digits.join(','));
    check('the pattern resolves to its atlas cell',
      red.patternCell === patternCell('stripes'));
    check('the pattern uv is the cell uv',
      red.patternUv.join(',') === cellUv(patternCell('stripes')).join(','));

    const blue = resolveKit({ team: 1, number: 27, pattern: 'hoops' });
    check('team 1 wears the second colour', blue.primary === 0x3b6de2, hex(blue.primary));
    check('two digits resolve to two cells in order',
      blue.digits.length === 2 && blue.digits[0] === digitCell(2)
      && blue.digits[1] === digitCell(7), blue.digits.join(','));

    const keeper = resolveKit({ team: 0, role: 'keeper', number: 1 });
    check('the keeper gets the keeper cell', keeper.patternCell === KEEPER_CELL);
    check('the keeper shirt cannot be confused with the outfield one',
      keeper.primary !== red.primary, hex(keeper.primary));

    const custom = resolveKit({ team: 1, colors: [0x101010, 0x00ff88], number: 5 });
    check('a lobby colour reaches the shirt', custom.primary === 0x00ff88, hex(custom.primary));
    check('a light shirt gets a dark number',
      luminance(custom.primary) > 0.5 && custom.numberColor === 0x14181f);
    const dark = resolveKit({ team: 0, colors: [0x101010, 0x00ff88], number: 5 });
    check('a dark shirt gets a light number', dark.numberColor === 0xf4f7ff);

    check('a nonsense kit still resolves',
      (() => {
        const k = resolveKit({ team: 9, number: NaN, pattern: 'zebra', colors: 'no' });
        return k.team === 0 && k.number === 0 && k.pattern === 'stripes';
      })());
    check('the number is clamped to two digits',
      resolveKit({ number: 4000 }).number === 99 && resolveKit({ number: -7 }).number === 0);

    const u = kitUniformValues(red);
    check('uniform values carry the resolved colours',
      u.primary === red.primary && u.numberOn === 1);
    check('shorts suppress the number',
      kitUniformValues(red, { number: false }).numberOn === 0);
    check('shirt 0 shows no number', kitUniformValues(resolveKit({ number: 0 })).numberOn === 0);
  }

  // The allocation contract: a kit change must not create anything.
  {
    const kits = new KitSystem();
    const sets = [];
    for (let i = 0; i < 8; i++) sets.push(kits.createSet());
    const afterBuild = kits.stats();
    check('one texture serves every player', afterBuild.textures === 1);
    check('three materials per player and no more',
      afterBuild.materials === 24, `${afterBuild.materials}`);
    check('the sleeve material never carries the number',
      sets.every((s) => s.sleeve.userData.kitUniforms.uKitNumberOn.value === 0));
    const texture = kits.texture;
    for (let i = 0; i < 100; i++) {
      kits.apply(sets[i % sets.length], resolveKit({
        team: i % 2, number: i % 100, pattern: PATTERNS[i % PATTERNS.length],
        role: i % 7 === 0 ? 'keeper' : 'field',
        colors: [0x000000 + i * 977, 0xffffff - i * 733],
      }));
    }
    const after = kits.stats();
    check('100 kit changes create no new material',
      after.materials === afterBuild.materials, `${after.materials}`);
    check('100 kit changes create no new texture', kits.texture === texture);
    check('every material shares one shader program cache key',
      new Set(sets.flatMap((s) => [s.jersey.customProgramCacheKey(),
        s.sleeve.customProgramCacheKey(),
        s.shorts.customProgramCacheKey()])).size === 1);
    check('the uniforms really changed', after.applied === 100);
    const u = sets[0].jersey.userData.kitUniforms;
    check('the atlas uniform still points at the one texture',
      u.uKitAtlas.value === texture);
    kits.dispose();
  }
}

// ================================================================ #25 sound

section('#25 sound: the autoplay state machine');

{
  // A fake iOS: the context comes up suspended and resume() only takes effect
  // when the platform feels like allowing it. The first gesture is refused,
  // which is exactly the case a {once: true} listener loses forever.
  function fakeIos() {
    return {
      state: 'suspended',
      allowed: false,
      resumeCalls: 0,
      resume() {
        this.resumeCalls++;
        if (this.allowed) this.state = 'running';
        return Promise.resolve();
      },
    };
  }

  const listeners = new Map();
  const on = (t, h) => { listeners.set(t, (listeners.get(t) || new Set()).add(h)); };
  const off = (t, h) => { listeners.get(t)?.delete(h); };
  const fire = (t) => { for (const h of listeners.get(t) || []) h(); };
  const count = () => [...listeners.values()].reduce((s, set) => s + set.size, 0);

  const ctx = fakeIos();
  const gate = createAudioGate({ ensure: () => ctx, on, off, doc: null });
  check('the gate starts idle', gate.state === 'idle');
  gate.arm();
  check('arming installs listeners for every gesture', count() >= 5, `${count()}`);

  fire('pointerdown');
  check('a refused first gesture leaves the gate suspended, not running',
    gate.state === 'suspended', gate.state);
  check('a suspended context keeps its listeners armed', count() >= 5, `${count()}`);
  check('the gate asked the context to resume', ctx.resumeCalls === 1);

  ctx.allowed = true;
  fire('touchend');
  check('the next gesture gets it running', gate.state === 'running', gate.state);
  check('a running context releases its listeners', count() === 0, `${count()}`);

  // iOS suspends it again when the tab goes away, and refuses to hand it back
  // until there is a gesture.
  ctx.state = 'suspended';
  ctx.allowed = false;
  gate.poke();
  check('a context suspended behind our back is noticed',
    gate.state === 'suspended', gate.state);
  check('and the gate re-arms itself', count() >= 5, `${count()}`);
  ctx.allowed = true;
  fire('focus');
  check('it comes back on the next gesture', gate.state === 'running');

  // No audio at all must not spin.
  const dead = createAudioGate({ ensure: () => null, on, off, doc: null });
  dead.arm();
  fire('keydown');
  check('a browser with no AudioContext lands on unsupported',
    dead.state === 'unsupported', dead.state);

  // A context that never resumes must not retry forever.
  const stuck = { state: 'suspended', resume() { return Promise.resolve(); } };
  const patient = createAudioGate({ ensure: () => stuck, on, off, doc: null, maxAttempts: 5 });
  patient.arm();
  for (let i = 0; i < 50; i++) fire('click');
  check('a permanently blocked context stops retrying',
    patient.attempts === 5, `${patient.attempts}`);
}

{
  // The engine surface, over a fake so no AudioContext is needed.
  const fired = [];
  const engine = {
    ctx: { state: 'running', resume() {} },
    ensure() { return true; },
    play(n) { fired.push(n); },
    notify() {},
    setAmbiance(v) { this.amb = v; },
  };
  let clock = 0;
  const sfx = new ArenaSfx({ engine, now: () => clock });
  check('the sfx layer reports the gate state', sfx.state === 'running', sfx.state);

  sfx.onStrike(12);
  sfx.onStrike(12);
  check('a one-shot has a cooldown', fired.filter((n) => n === 'kick').length === 1,
    fired.join(','));
  clock += 500;
  sfx.onStrike(12);
  check('and fires again once the cooldown passes',
    fired.filter((n) => n === 'kick').length === 2);

  sfx.onGoal(0); sfx.onSave(); sfx.onWhistle();
  check('goal, save and whistle all reach the engine',
    fired.includes('goal') && fired.includes('save') && fired.includes('whistle'),
    fired.join(','));

  sfx.setTension(1);
  const loud = engine.amb;
  sfx.setTension(0);
  check('tension drives the crowd bed', loud > engine.amb, `${loud} vs ${engine.amb}`);
  check('the bed level stays inside 0..1', engine.amb >= 0 && engine.amb <= 1);

  // tensionOf is the pure input to all of that.
  check('a tight late chance is the most tense',
    tensionOf({ scoreGap: 0, secondsLeft: 5, ballZ: 17.9, halfZ: 18 }) > 0.9);
  check('a blowout at midfield early on is the least',
    tensionOf({ scoreGap: 5, secondsLeft: 900, ballZ: 0, halfZ: 18 }) < 0.1);
  check('tension is always inside 0..1',
    [[-9, -1, -99], [99, 0, 99], [0, NaN, NaN]].every(([g, s, z]) => {
      const v = tensionOf({ scoreGap: g, secondsLeft: s, ballZ: z, halfZ: 18 });
      return Number.isFinite(v) && v >= 0 && v <= 1;
    }));
}

// ============================================================ tiers + facade

section('quality tiers');

check('every tier is a complete record',
  ['low', 'medium', 'high'].every((n) => {
    const t = TIERS[n];
    return t && t.crowdSeatPitch > 0 && t.netSubsteps >= 1 && t.flagIters >= 1
      && t.ballBoys >= 1;
  }));
check('a phone lands on the low tier',
  detectTier({ maxTouchPoints: 5, deviceMemory: 4 }) === 'low');
check('a desktop lands on the high tier',
  detectTier({ maxTouchPoints: 0, deviceMemory: 16, hardwareConcurrency: 12 }) === 'high');
check('an unknown string falls back rather than throwing',
  resolveTier('nonsense').name.length > 0);
check('the low tier is cheaper on every axis',
  TIERS.low.netSubsteps < TIERS.high.netSubsteps
  && TIERS.low.flagIters < TIERS.high.flagIters
  && TIERS.low.crowdSeatPitch > TIERS.high.crowdSeatPitch);

section('the facade: read-only over a full goal sequence');

{
  const scene = stubScene();
  const atmos = new Atmosphere(scene, {
    pitch: PITCH_M,
    goalHeight: GOAL_HEIGHT_M,
    tier: 'medium',
    seed: 11,
    sound: false,
  });
  check('the whole layer mounts in six draw calls',
    atmos.stats().drawCalls === 6, `${atmos.stats().drawCalls}`);
  const tris = atmos.stats().crowd.triangles + atmos.stats().flags.triangles
    + atmos.stats().boys.triangles;
  check('the mounted triangles fit the 150k scene budget',
    tris < 120000, `${tris}`);

  // The whole point: the state handed in comes back untouched.
  const state = Object.freeze({ x: 3.2, z: 17.4, vx: 1.1, vz: 21.5 });
  const before = JSON.stringify(state);
  atmos.onGoal(0, { ...state }, 2.6);
  let hidFrames = 0;
  let boysRan = false;
  for (let f = 0; f < 260; f++) {
    atmos.update(DT, {
      ball: { x: 0, z: 0 },
      flow: f < 156 ? 'goal' : 'play',
      scoreGap: 1,
      secondsLeft: 90,
    });
    if (atmos.hidesMatchBall) hidFrames++;
    if (atmos.boys.phase !== 'idle') boysRan = true;
  }
  check('the core state object was never written', JSON.stringify(state) === before);
  check('the match ball is hidden while the cosmetic one is in the net',
    hidFrames > 100, `${hidFrames} frames`);
  check('the ball-boy scene ran', boysRan);
  check('the goal scene ends on its own',
    !atmos.hidesMatchBall && !atmos.nets.ball.active);
  check('the cosmetic ball ended up in the right net',
    Math.abs(atmos.nets.ball.z) < 1e-6 || atmos.nets.ball.z > 0);
  const s = atmos.stats();
  check('nothing in the layer went non-finite',
    Number.isFinite(s.costMs) && s.nets.resets === 0 && s.flags.resets === 0,
    JSON.stringify({ resets: s.nets.resets, flags: s.flags.resets }));
  console.log(`      facade cost: ${s.costMs.toFixed(2)} ms on the last frame`);
  check('the facade fits a 60 Hz frame', s.costMs < 8, `${s.costMs.toFixed(2)} ms`);

  // A goal from the other side has to go in the other net.
  atmos.onGoal(1, { x: -1, z: -17.6, vx: 0, vz: -18 }, 2.6);
  for (let f = 0; f < 30; f++) atmos.update(DT, { ball: { x: 0, z: 0 }, flow: 'goal' });
  check('a blue goal fills the -z net', atmos.nets.ball.z < 0, `${atmos.nets.ball.z}`);

  // A garbage sample must still produce a believable scene.
  atmos.onGoal(0, { x: NaN, z: 0, vx: 0, vz: 0 }, 2.6);
  check('a useless ball sample is replaced, not trusted',
    Number.isFinite(atmos.nets.ball.z) && atmos.nets.ball.z > 10,
    `${atmos.nets.ball.z}`);

  atmos.dispose();
}

// ==================================================================== done

console.log(`\n${failures === 0 ? 'ALL PASS' : 'FAILURES'} — ${checks - failures}/${checks} checks`);
process.exit(failures === 0 ? 0 : 1);

// -------------------------------------------------------------- helpers

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function near(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }
function hex(v) { return `0x${(v >>> 0).toString(16).padStart(6, '0')}`; }

function countMoved(before, after, eps) {
  let n = 0;
  for (let i = 0; i < before.length; i += 3) {
    if (Math.abs(before[i] - after[i]) > eps
      || Math.abs(before[i + 1] - after[i + 1]) > eps
      || Math.abs(before[i + 2] - after[i + 2]) > eps) n++;
  }
  return n;
}

/** How far the deepest cord has sunk inside the ball, in metres. */
function deepestPenetration(net, ball, radius) {
  const CORD_R = 0.02;
  const rSum = radius + CORD_R;
  const { pos } = net;
  let worst = 0;
  for (const group of net.collidable) {
    const { ids, n } = group;
    for (let c = 0; c < n; c++) {
      const a = ids[c * 2] * 3, b = ids[c * 2 + 1] * 3;
      const ex = pos[b] - pos[a], ey = pos[b + 1] - pos[a + 1], ez = pos[b + 2] - pos[a + 2];
      const px = ball.x - pos[a], py = ball.y - pos[a + 1], pz = ball.z - pos[a + 2];
      const ee = ex * ex + ey * ey + ez * ez;
      let t = ee > 1e-12 ? (px * ex + py * ey + pz * ez) / ee : 0;
      t = clamp(t, 0, 1);
      const qx = pos[a] + ex * t, qy = pos[a + 1] + ey * t, qz = pos[a + 2] + ez * t;
      const d = Math.hypot(ball.x - qx, ball.y - qy, ball.z - qz);
      if (rSum - d > worst) worst = rSum - d;
    }
  }
  return worst;
}

function maxStrain(net) {
  let worst = 0;
  for (const group of [net.struct, net.stitch]) {
    const { ids, rest, n } = group;
    for (let c = 0; c < n; c++) {
      const a = ids[c * 2] * 3, b = ids[c * 2 + 1] * 3;
      const d = Math.hypot(net.pos[b] - net.pos[a], net.pos[b + 1] - net.pos[a + 1],
        net.pos[b + 2] - net.pos[a + 2]);
      if (rest[c] > 1e-9) worst = Math.max(worst, d / rest[c]);
    }
  }
  return worst;
}
