import * as THREE from 'three';
import { PLAYER_SPEED } from '../core/constants.js';

const TEAM_COLORS = [0xe23b3b, 0x3b6de2];
const TEAM_DARK = [0x7c1f1f, 0x1f3a7c];
const KEEPER_COLORS = [0xf2b632, 0x38d6c4];

// Minimal procedural character: capsule torso, sphere head, two swinging legs.
// No skeletal animation — lean, walk-cycle and kick swing are all computed.
export class PlayerView {
  constructor(player, scene) {
    this.player = player;
    this.group = new THREE.Group();

    const jerseyColor = player.role === 'keeper'
      ? KEEPER_COLORS[player.team] : TEAM_COLORS[player.team];
    const jersey = new THREE.MeshStandardMaterial({ color: jerseyColor, roughness: 0.7 });
    const shorts = new THREE.MeshStandardMaterial({ color: TEAM_DARK[player.team], roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8b98f, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.45, 6, 14), jersey);
    body.position.y = 0.95;
    body.castShadow = true;
    this.group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), skin);
    head.position.y = 1.52;
    head.castShadow = true;
    this.group.add(head);

    const legGeo = new THREE.CylinderGeometry(0.075, 0.06, 0.55, 10);
    legGeo.translate(0, -0.275, 0); // pivot at the hip
    this.legs = [-1, 1].map((side) => {
      const leg = new THREE.Mesh(legGeo, shorts);
      leg.position.set(side * 0.11, 0.62, 0);
      leg.castShadow = true;
      this.group.add(leg);
      return leg;
    });

    const armGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.48, 10);
    armGeo.translate(0, -0.24, 0); // pivot at the shoulder
    this.arms = [-1, 1].map((side) => {
      const arm = new THREE.Mesh(armGeo, jersey);
      arm.position.set(side * 0.32, 1.28, 0);
      arm.rotation.z = side * 0.16; // resting flare away from the torso
      arm.castShadow = true;
      this.group.add(arm);
      return arm;
    });

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.045, 10, 32),
      new THREE.MeshBasicMaterial({ color: TEAM_COLORS[player.team], transparent: true, opacity: 0.85 }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.ring.visible = false;
    this.group.add(this.ring);

    this.walkPhase = 0;
    scene.add(this.group);
  }

  update(dt) {
    const p = this.player;
    const sp = p.speed();

    if (p.down > 0) {
      // ragdoll: topple onto the back with a tumble, then scramble up
      const t = 1 - p.down / p.downTotal; // 0 -> 1 over the knockdown
      const fall = Math.min(t / 0.2, 1);
      const rise = Math.max(0, (t - 0.72) / 0.28);
      const flat = fall * fall * (1 - rise * rise);
      const pitch = -flat * (Math.PI / 2) * 1.04;
      const hop = Math.sin(Math.min(t / 0.3, 1) * Math.PI) * 0.3 * (1 - t);
      const flail = Math.sin(t * 26) * 0.45 * (1 - t);
      // the group pivots at the feet, so lying flat would sink the torso
      // halfway into the grass — lift by the body radius while horizontal
      this.group.position.set(p.pos.x, hop + flat * 0.3, p.pos.z);
      this.group.rotation.set(pitch, p.facing + p.tumbleSpin * flat, flail * 0.4, 'YXZ');
      this.legs[0].rotation.x = flail + flat * 0.5;
      this.legs[1].rotation.x = -flail + flat * 0.7;
      this.legs[0].rotation.z = flat * 0.35;
      this.legs[1].rotation.z = -flat * 0.35;
      // arms fly up and windmill while going down, settle spread on the grass
      const wind = Math.sin(t * 32 + 1.3) * 0.9 * (1 - t);
      this.arms[0].rotation.x = -2.4 * flat + wind;
      this.arms[1].rotation.x = -2.4 * flat - wind;
      this.arms[0].rotation.z = 0.16 + flat * 1.1 + wind * 0.3;
      this.arms[1].rotation.z = -0.16 - flat * 1.1 + wind * 0.3;
      this.ring.visible = false;
      return;
    }
    this.legs[0].rotation.z = 0;
    this.legs[1].rotation.z = 0;

    this.group.position.set(p.pos.x, 0, p.pos.z);
    const lean = Math.min(sp / PLAYER_SPEED, 1) * 0.16;
    this.group.rotation.set(lean, p.facing, 0, 'YXZ');

    this.walkPhase += dt * (4 + sp * 2.6);
    const stride = Math.min(sp / PLAYER_SPEED, 1) * 0.55;
    const kick = p.kickAnim > 0 ? Math.sin(Math.min(p.kickAnim, 1) * Math.PI) : 0;
    this.legs[0].rotation.x = Math.sin(this.walkPhase) * stride;
    // right leg does the kicking
    this.legs[1].rotation.x = kick > 0 ? -kick * 1.5 : Math.sin(this.walkPhase + Math.PI) * stride;
    // arms swing opposite the legs; the kicking motion throws them out
    this.arms[0].rotation.x = Math.sin(this.walkPhase + Math.PI) * stride * 0.8 + kick * 0.9;
    this.arms[1].rotation.x = Math.sin(this.walkPhase) * stride * 0.8 - kick * 0.5;
    this.arms[0].rotation.z = 0.16 + kick * 0.5;
    this.arms[1].rotation.z = -0.16 - kick * 0.2;

    const c = p.charge;
    this.ring.visible = c > 0.02;
    if (this.ring.visible) {
      const s = 1 + c * 0.5;
      this.ring.scale.set(s, s, 1);
      this.ring.material.opacity = 0.35 + c * 0.6;
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
