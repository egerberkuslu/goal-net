// The substitutes, sitting on the bench.
//
// They used to be a downloaded static figure stood beside the dugout, and the
// broadcast camera showed what that was really worth: six men lying flat on the
// grass. The model is rigged, its control bones sit seven metres from its body,
// and the measured stand-up in vendorModel.js — which gets the keeper upright
// to the centimetre — has nothing sane to measure on it.
//
// So the substitutes are the SAME clean character the players wear, posed once
// into a sit and left there. That is cheaper than it sounds: they never update,
// so this costs one pose evaluation each at load and nothing per frame, and it
// means a bench player and a pitch player are visibly the same footballer in
// the same kit, which is the point of having a bench at all.
//
// The seat height is not hard-coded. The pose is applied first, the hip bone's
// world height is read back, and the figure is dropped by exactly that much —
// the same measure-then-place rule the rest of the vendor pipeline follows, so
// a different bench model needs no new number here.

import * as THREE from 'three';
import { VENDOR, vendorScene } from './vendorModel.js';
import { bindRiggedPose } from './riggedPose.js';
import { recolorKit } from './kitRecolor.js';
import { CH_RX, CH_RZ, ch, createPose } from '../arena/anim/index.js';

/**
 * A man sitting on a bench, written into a pose buffer.
 *
 * Signs follow arena/anim's own convention, read off the kick in
 * locomotion.js: negative RX on a thigh swings the leg forward, positive RX on
 * a knee bends it. So a sit is thighs forward to roughly horizontal, knees
 * folded back under the seat, and a small forward slump through the spine —
 * nobody waiting to come on sits to attention.
 *
 * `lean` varies the slump per substitute so a row of them is a row of people
 * rather than a row of one person.
 */
function writeSit(out, lean) {
  out[ch('thighL', CH_RX)] = -1.42;
  out[ch('thighR', CH_RX)] = -1.42;
  out[ch('kneeL', CH_RX)] = 1.48;
  out[ch('kneeR', CH_RX)] = 1.48;
  out[ch('footL', CH_RX)] = -0.12;
  out[ch('footR', CH_RX)] = -0.12;
  // knees apart, the way anyone sits on a low bench
  out[ch('thighL', CH_RZ)] = 0.12;
  out[ch('thighR', CH_RZ)] = -0.12;
  // forearms resting on the thighs
  out[ch('shoulderL', CH_RX)] = -0.55;
  out[ch('shoulderR', CH_RX)] = -0.55;
  out[ch('elbowL', CH_RX)] = 0.95;
  out[ch('elbowR', CH_RX)] = 0.95;
  out[ch('shoulderL', CH_RZ)] = 0.16;
  out[ch('shoulderR', CH_RZ)] = -0.16;
  // the slump, spread over the back so no single joint kinks
  out[ch('hips', CH_RX)] = lean * 0.5;
  out[ch('spine', CH_RX)] = lean * 0.6;
  out[ch('chest', CH_RX)] = lean * 0.4;
  out[ch('head', CH_RX)] = -lean * 0.9;   // still watching the match
  return out;
}

/**
 * Seat substitutes on a bench.
 *
 * Resolves to however many actually took a seat, so a checkout with no vendor
 * models gets an empty bench rather than an exception — the same "optional,
 * never required" contract the rest of vendorModel.js keeps.
 *
 * @param {object} scene
 * @param {Array<{x:number, y:number, z:number, yaw:number, color:number,
 *                lean?:number}>} seats where to sit, and in whose colours
 * @returns {Promise<object[]>} the seated figures
 */
export async function seatSubstitutes(scene, seats) {
  const seated = [];
  for (const seat of seats) {
    // Sequential rather than parallel on purpose: vendorScene caches the parsed
    // glTF after the first call, so this is one network fetch and N clones
    // either way, and awaiting in turn keeps the load off one frame.
    const mesh = await vendorScene(VENDOR.keeperRig);   // the one rig that measures clean
    if (!mesh || !scene) continue;
    const binding = bindRiggedPose(mesh);
    if (!binding) continue;

    const pose = createPose();
    binding.apply(writeSit(pose, seat.lean ?? 0.18));

    if (seat.color != null) {
      const target = new THREE.Color(seat.color);
      const seen = new Set();
      mesh.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m || seen.has(m) || !m.map) continue;
          seen.add(m);
          const repainted = recolorKit(m.map, target);
          if (repainted) { m.map = repainted; m.needsUpdate = true; }
        }
      });
    }

    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(seat.x, 0, seat.z);
    group.rotation.y = seat.yaw || 0;
    group.name = 'bench:sub';
    scene.add(group);

    // Now that he is posed, find his hips and move him until they land on the
    // seat — in all three axes, not just height. Reading it back beats
    // predicting it: where the hips end up depends on the sit angles above and
    // on whatever the model's own origin happens to be (this rig's is between
    // its feet, a metre in front of where it sits), and anyone changing the
    // pose should not also have to work out a new offset by hand. The first
    // version corrected height alone and sat three men on the grass beside
    // their bench.
    group.updateMatrixWorld(true);
    let hip = null;
    mesh.traverse((o) => {
      if (o.isBone && /hip|pelvis/i.test(o.name) && hip === null) {
        hip = o.getWorldPosition(new THREE.Vector3());
      }
    });
    if (hip) {
      // The offset is measured in world space but applied to a child of a
      // rotated group, so it has to come back through that rotation first.
      const fix = new THREE.Vector3(seat.x - hip.x, seat.y - hip.y, seat.z - hip.z);
      fix.applyAxisAngle(new THREE.Vector3(0, 1, 0), -(seat.yaw || 0));
      mesh.position.add(fix);
    }
    seated.push(group);
  }
  return seated;
}
