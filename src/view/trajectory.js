import * as THREE from 'three';
import { Ball } from '../core/ball.js';

// Dashed preview of the shot arc while dragging (aerodynamics only, no net).
export class TrajectoryPreview {
  constructor(scene) {
    this.maxPoints = 50;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(this.maxPoints * 3), 3));
    this.line = new THREE.Line(geometry, new THREE.LineDashedMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55,
      dashSize: 0.25, gapSize: 0.18,
    }));
    this.line.visible = false;
    this.line.frustumCulled = false;
    scene.add(this.line);
    this.sim = new Ball();
  }

  show(from, vel, omega) {
    const { sim } = this;
    sim.pos = { ...from }; sim.prev = { ...from };
    sim.vel = { ...vel }; sim.omega = { ...omega };
    const attr = this.line.geometry.attributes.position;
    const h = 1 / 40;
    let n = 0;
    for (let i = 0; i < this.maxPoints; i++) {
      attr.setXYZ(i, sim.pos.x, sim.pos.y, sim.pos.z);
      n = i + 1;
      if (sim.pos.z < -0.2 || sim.pos.y < 0.05) break;
      sim.integrate(h);
    }
    this.line.geometry.setDrawRange(0, n);
    attr.needsUpdate = true;
    this.line.computeLineDistances();
    this.line.visible = true;
  }

  hide() { this.line.visible = false; }
}
