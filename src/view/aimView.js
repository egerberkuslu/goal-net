import * as THREE from 'three';
import { Ball } from '../core/ball.js';
import { BALL_R } from '../core/constants.js';

const TEAM_AIM = [0xff9a9a, 0x9ab8ff];

// Dashed preview of where a kick would send the ball, per human player.
// Appears when the ball is in reach and live-updates with the kick charge.
export class AimView {
  constructor(player, world, scene) {
    this.player = player;
    this.world = world;
    this.maxPoints = 44;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(this.maxPoints * 3), 3));
    this.line = new THREE.Line(geometry, new THREE.LineDashedMaterial({
      color: TEAM_AIM[player.team], transparent: true, opacity: 0.5,
      dashSize: 0.3, gapSize: 0.22,
    }));
    this.line.visible = false;
    this.line.frustumCulled = false;
    scene.add(this.line);

    this.dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: TEAM_AIM[player.team], transparent: true, opacity: 0.8 }),
    );
    this.dot.visible = false;
    scene.add(this.dot);
    this.sim = new Ball();
  }

  update(visible) {
    const p = this.player;
    const charging = p.charge > 0.01;
    // a tap kick is previewed while approaching; the arc grows with charge
    const params = visible
      ? this.world.kickParams(p, charging ? p.charge : 0.12, 0.3)
      : null;
    if (!params) {
      this.line.visible = this.dot.visible = false;
      return;
    }
    const { sim } = this;
    const b = this.world.ball;
    sim.pos = { ...b.pos }; sim.prev = { ...b.pos };
    sim.vel = { ...params.vel }; sim.omega = { ...params.omega };
    const attr = this.line.geometry.attributes.position;
    const h = 1 / 40;
    let n = 0;
    for (let i = 0; i < this.maxPoints; i++) {
      attr.setXYZ(i, sim.pos.x, sim.pos.y, sim.pos.z);
      n = i + 1;
      // stop at the first ground touch or once past either goal line
      if ((i > 2 && sim.pos.y <= BALL_R && sim.vel.y < 0) || Math.abs(sim.pos.z) > 18) break;
      sim.integrate(h);
    }
    this.line.geometry.setDrawRange(0, n);
    attr.needsUpdate = true;
    this.line.computeLineDistances();
    this.line.material.opacity = charging ? 0.95 : 0.45;
    this.line.visible = true;
    this.dot.position.set(sim.pos.x, Math.max(sim.pos.y, 0.05), sim.pos.z);
    this.dot.visible = true;
  }

  dispose() {
    for (const o of [this.line, this.dot]) {
      o.parent?.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}
