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
    this.group.position.set(p.pos.x, 0, p.pos.z);
    const sp = p.speed();
    const lean = Math.min(sp / PLAYER_SPEED, 1) * 0.16;
    this.group.rotation.set(lean, p.facing, 0, 'YXZ');

    this.walkPhase += dt * (4 + sp * 2.6);
    const stride = Math.min(sp / PLAYER_SPEED, 1) * 0.55;
    const kick = p.kickAnim > 0 ? Math.sin(Math.min(p.kickAnim, 1) * Math.PI) : 0;
    this.legs[0].rotation.x = Math.sin(this.walkPhase) * stride;
    // right leg does the kicking
    this.legs[1].rotation.x = kick > 0 ? -kick * 1.5 : Math.sin(this.walkPhase + Math.PI) * stride;

    const c = p.charge;
    this.ring.visible = c > 0.02;
    if (this.ring.visible) {
      const s = 1 + c * 0.5;
      this.ring.scale.set(s, s, 1);
      this.ring.material.opacity = 0.35 + c * 0.6;
    }
  }
}
