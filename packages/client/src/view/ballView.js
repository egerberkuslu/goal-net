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
  const uv = (d) => {
    const len = Math.hypot(...d);
    const [x, y, z] = d.map((v) => v / len);
    const lat = Math.asin(y), lon = Math.atan2(z, x);
    return {
      u: ((lon + Math.PI) / (2 * Math.PI)) * cv.width,
      v: ((Math.PI / 2 - lat) / Math.PI) * cv.height,
      lat,
    };
  };
  // seams between neighbouring panels (icosahedron edges span ~63.4 deg)
  g.strokeStyle = 'rgba(40,40,40,0.55)';
  g.lineWidth = 7;
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const a = dirs[i], b = dirs[j];
      const la = Math.hypot(...a), lb = Math.hypot(...b);
      const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
      if (cos < 0.35 || cos > 0.55) continue; // keep true edges only
      const pa = uv(a), pb = uv(b);
      if (Math.abs(pa.lat) > 1.15 || Math.abs(pb.lat) > 1.15) continue;
      for (const du of [-cv.width, 0, cv.width]) {
        let ua = pa.u + du, ub = pb.u + du;
        if (Math.abs(ua - ub) > cv.width / 2) continue; // avoid seam-wrapping lines
        g.beginPath(); g.moveTo(ua, pa.v); g.lineTo(ub, pb.v); g.stroke();
      }
    }
  }
  // black pentagon patches on top of the seams
  g.fillStyle = '#181818';
  for (const d of dirs) {
    const { u, v, lat } = uv(d);
    const r = 95, rx = Math.min(r / Math.max(Math.cos(lat), 0.25), 420);
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
    const { pos, vel, omega, grounded } = this.ball;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    if (grounded) {
      // on the ground the ball ROLLS: spin comes from its travel, axis
      // perpendicular to the motion — this is what sells dribbling
      const sp = Math.hypot(vel.x, vel.z);
      if (sp > 0.05) {
        this.spinAxis.set(vel.z / sp, 0, -vel.x / sp);
        this.mesh.rotateOnWorldAxis(this.spinAxis, (sp / BALL_R) * dt);
      }
    } else {
      const w = Math.hypot(omega.x, omega.y, omega.z);
      if (w > 1e-3) {
        this.spinAxis.set(omega.x / w, omega.y / w, omega.z / w);
        this.mesh.rotateOnWorldAxis(this.spinAxis, w * dt);
      }
    }
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.material.dispose();
  }
}
