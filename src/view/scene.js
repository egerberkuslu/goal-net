import * as THREE from 'three';
import {
  GOAL_W, GOAL_H, POST_R, NET_BOT_DEPTH, PITCH_HALF_L, PITCH_HALF_W, WALL_X,
} from '../core/constants.js';

const HALF_W = GOAL_W / 2;

function tubeBetween(a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

// Texture spans x in [-15,15], z in [-24,24]; goal lines at z = ±18.
function makePitchTexture() {
  const W = 30, L = 48, S = 1600;
  const cv = document.createElement('canvas');
  cv.width = S * (W / L); cv.height = S;
  const g = cv.getContext('2d');
  const mPerPx = L / S;
  const px = (m) => m / mPerPx;
  const X = (x) => px(x + W / 2), Z = (z) => px(z + L / 2);

  // base + mowing stripes along z, with a soft grain
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#2c8a3c' : '#33984a';
    g.fillRect(0, px(i * 3), cv.width, px(3));
  }
  const noise = g.createImageData(cv.width, cv.height);
  // cheap grain: sparse random darkening dots
  for (let i = 0; i < 60000; i++) {
    const x = (Math.random() * cv.width) | 0, y = (Math.random() * cv.height) | 0;
    g.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    g.fillRect(x, y, 2, 2);
  }
  void noise;

  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = px(0.12);
  // touchlines + goal lines
  g.strokeRect(X(-PITCH_HALF_W), Z(-PITCH_HALF_L),
    px(PITCH_HALF_W * 2), px(PITCH_HALF_L * 2));
  // halfway line + centre circle + spot
  g.beginPath(); g.moveTo(X(-PITCH_HALF_W), Z(0)); g.lineTo(X(PITCH_HALF_W), Z(0)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), px(3), 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), px(0.16), 0, Math.PI * 2); g.fill();
  // boxes, spots and arcs at both ends
  for (const s of [-1, 1]) {
    const gl = s * PITCH_HALF_L;
    g.strokeRect(X(-7), Math.min(Z(gl), Z(gl - s * 4.5)), px(14), px(4.5));
    g.strokeRect(X(-4.5), Math.min(Z(gl), Z(gl - s * 1.8)), px(9), px(1.8));
    g.beginPath(); g.arc(X(0), Z(gl - s * 6), px(0.16), 0, Math.PI * 2); g.fill();
    g.beginPath();
    const a0 = s > 0 ? Math.PI * 1.25 : Math.PI * 0.25;
    g.arc(X(0), Z(gl - s * 6), px(2.6), a0, a0 + Math.PI * 0.5);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Futsal-cage style transparent walls: everything except the goal mouths is
// closed off, and the ball visibly rebounds off them.
function addCage(scene) {
  const H = 4;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = (w, h) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 1.2, h / 1.2);
    return new THREE.MeshBasicMaterial({
      map: t, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false,
    });
  };
  const panel = (w, h, x, y, z, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(w, h));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    scene.add(m);
  };
  // side walls along the touchlines
  panel(2 * PITCH_HALF_L, H, WALL_X, H / 2, 0, Math.PI / 2);
  panel(2 * PITCH_HALF_L, H, -WALL_X, H / 2, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    const z = s * PITCH_HALF_L;
    const sideW = WALL_X - HALF_W;
    // end walls left/right of the goal, plus the strip above the crossbar
    panel(sideW, H, -(HALF_W + sideW / 2), H / 2, z);
    panel(sideW, H, HALF_W + sideW / 2, H / 2, z);
    panel(GOAL_W, H - GOAL_H, 0, GOAL_H + (H - GOAL_H) / 2, z);
  }
}

function addStadium(scene) {
  const standMat = new THREE.MeshLambertMaterial({ color: 0x232c44 });
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x2e3a5c });
  // tiered stands along the touchlines and behind the goals
  for (const side of [-1, 1]) {
    for (let t = 0; t < 3; t++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6 + t * 0.4, 52), t % 2 ? seatMat : standMat);
      s.position.set(side * (14.5 + t * 2.3), (1.6 + t * 0.4) / 2 + t * 1.1, 0);
      scene.add(s);
      const e = new THREE.Mesh(new THREE.BoxGeometry(34, 1.6 + t * 0.4, 2.2), t % 2 ? seatMat : standMat);
      e.position.set(0, (1.6 + t * 0.4) / 2 + t * 1.1, side * (23.5 + t * 2.3));
      scene.add(e);
    }
  }
  // floodlight pylons
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8b94a8 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 14, 8), poleMat);
    pole.position.set(sx * 13.5, 7, sz * 22.5);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.3), headMat);
    head.position.set(sx * 13.5, 14.2, sz * 22.5);
    head.lookAt(0, 0, 0);
    scene.add(head);
  }
  // low ad boards ringing the pitch (the visual for the invisible walls)
  const colors = [0x1c3f8f, 0x8f1c2e, 0x1c8f5a, 0xa8781c];
  const along = new THREE.BoxGeometry(6, 0.75, 0.1);
  const across = new THREE.BoxGeometry(0.1, 0.75, 6);
  let ci = 0;
  for (const side of [-1, 1]) {
    for (let z = -18; z < 18; z += 6) {
      const b = new THREE.Mesh(across, new THREE.MeshLambertMaterial({ color: colors[ci++ % 4] }));
      b.position.set(side * (WALL_X + 0.15), 0.38, z + 3);
      b.castShadow = true;
      scene.add(b);
    }
    for (let x = -12; x < 12; x += 6) {
      const b = new THREE.Mesh(along, new THREE.MeshLambertMaterial({ color: colors[ci++ % 4] }));
      b.position.set(x + 3, 0.38, side * 20.9);
      b.castShadow = true;
      scene.add(b);
    }
  }
}

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1226);
  scene.fog = new THREE.Fog(0x0b1226, 60, 160);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
  camera.position.set(28, 23, 0);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xc4d6ff, 0x1c3a24, 0.8));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
  sun.position.set(24, 34, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 90;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 48),
    new THREE.MeshLambertMaterial({ map: makePitchTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0x101c2e }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  scene.add(apron);

  // goal frames + stanchions at both ends
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.35 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const end of [-1, 1]) {
    const gz = end * PITCH_HALF_L;
    const back = end * (PITCH_HALF_L + NET_BOT_DEPTH);
    const kink = end * (PITCH_HALF_L + 0.85);
    for (const s of [-1, 1]) {
      scene.add(tubeBetween(V(s * HALF_W, 0, gz), V(s * HALF_W, GOAL_H + POST_R, gz), POST_R, white));
      scene.add(tubeBetween(V(s * HALF_W, GOAL_H + POST_R, gz), V(s * HALF_W, GOAL_H - 0.1, kink), 0.028, white));
      scene.add(tubeBetween(V(s * HALF_W, GOAL_H - 0.1, kink), V(s * HALF_W, 0, back), 0.028, white));
    }
    scene.add(tubeBetween(V(-HALF_W - POST_R, GOAL_H, gz), V(HALF_W + POST_R, GOAL_H, gz), POST_R, white));
  }

  addStadium(scene);
  addCage(scene);

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  return { renderer, scene, camera };
}
