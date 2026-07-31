import * as THREE from 'three';
import { BALL_R } from '../core/constants.js';

function makeBallTexture() {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S * 2; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f4f4';
  g.fillRect(0, 0, cv.width, cv.height);
  // black pentagon patches at the 12 icosahedral vertex directions
  const phi = (1 + Math.sqrt(5)) / 2;
  const dirs = [];
  for (const a of [-1, 1]) for (const b of [-phi, phi]) {
    dirs.push([0, a, b], [a, b, 0], [b, 0, a]);
  }
  g.fillStyle = '#181818';
  for (const d of dirs) {
    const len = Math.hypot(...d);
    const [x, y, z] = d.map((v) => v / len);
    const lat = Math.asin(y), lon = Math.atan2(z, x);
    const u = ((lon + Math.PI) / (2 * Math.PI)) * cv.width;
    const v = ((Math.PI / 2 - lat) / Math.PI) * cv.height;
    const r = 105, rx = Math.min(r / Math.max(Math.cos(lat), 0.25), 420);
    for (const du of [-cv.width, 0, cv.width]) { // wrap seam
      g.beginPath();
      g.ellipse(u + du, v, rx, r, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class BallView {
  constructor(ball, scene) {
    this.ball = ball;
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 40, 28),
      new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.55 }),
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.spinAxis = new THREE.Vector3();
  }

  update(dt) {
    const { pos, omega } = this.ball;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    const w = Math.hypot(omega.x, omega.y, omega.z);
    if (w > 1e-3) {
      this.spinAxis.set(omega.x / w, omega.y / w, omega.z / w);
      this.mesh.rotateOnWorldAxis(this.spinAxis, w * dt);
    }
  }
}
