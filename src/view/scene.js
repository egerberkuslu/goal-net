import * as THREE from 'three';
import { GOAL_W, GOAL_H, POST_R, NET_BOT_DEPTH } from '../core/constants.js';

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

function makePitchTexture() {
  // 60 m (x) x 40 m (z) area centered on the goal line; goal at z=0, play at z>0
  const S = 2048, mPerPx = 60 / S;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = Math.round(40 / mPerPx);
  const g = cv.getContext('2d');
  const px = (m) => m / mPerPx;
  // mowing stripes
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#2e8b3d' : '#339843';
    g.fillRect(0, px(i * 2.5), cv.width, px(2.5));
  }
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = px(0.12);
  const zLine = px(8); // goal line at 8 m from the top edge of the texture
  const cx = cv.width / 2;
  // goal line
  g.beginPath(); g.moveTo(0, zLine); g.lineTo(cv.width, zLine); g.stroke();
  // penalty area 40.32 x 16.5, goal area 18.32 x 5.5
  for (const [w, d] of [[40.32, 16.5], [18.32, 5.5]]) {
    g.strokeRect(cx - px(w / 2), zLine, px(w), px(d));
  }
  // penalty spot + arc
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.arc(cx, zLine + px(11), px(0.16), 0, Math.PI * 2); g.fill();
  g.beginPath();
  g.arc(cx, zLine + px(11), px(9.15), Math.PI * 0.196, Math.PI * 0.804);
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
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
  scene.background = new THREE.Color(0x0e1a33);
  scene.fog = new THREE.Fog(0x0e1a33, 55, 140);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
  camera.position.set(0, 1.75, 15.2);
  camera.lookAt(0, 1.4, 0);

  scene.add(new THREE.HemisphereLight(0xbdd4ff, 0x1e3d1e, 0.75));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -8;
  sun.shadow.camera.far = 70;
  scene.add(sun);

  // pitch: texture spans x∈[-30,30], z∈[-8,32]
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40),
    new THREE.MeshLambertMaterial({ map: makePitchTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 12);
  ground.receiveShadow = true;
  scene.add(ground);
  // dark surround beyond the pitch
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0x11251a }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  scene.add(apron);

  // goal frame
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.35 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const s of [-1, 1]) {
    scene.add(tubeBetween(V(s * HALF_W, 0, 0), V(s * HALF_W, GOAL_H + POST_R, 0), POST_R, white));
    // stanchion: post top -> back kink -> ground peg line
    scene.add(tubeBetween(V(s * HALF_W, GOAL_H + POST_R, 0), V(s * HALF_W, GOAL_H - 0.1, -0.85), 0.028, white));
    scene.add(tubeBetween(V(s * HALF_W, GOAL_H - 0.1, -0.85), V(s * HALF_W, 0, -NET_BOT_DEPTH), 0.028, white));
  }
  scene.add(tubeBetween(V(-HALF_W - POST_R, GOAL_H, 0), V(HALF_W + POST_R, GOAL_H, 0), POST_R, white));

  // advertising boards behind the goal
  const boardGeo = new THREE.BoxGeometry(6.2, 0.9, 0.12);
  [0x1c3f8f, 0x8f1c2e, 0x1c8f5a].forEach((color, i) => {
    const b = new THREE.Mesh(boardGeo, new THREE.MeshLambertMaterial({ color }));
    b.position.set((i - 1) * 6.6, 0.45, -4.2);
    b.castShadow = true;
    scene.add(b);
  });

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  return { renderer, scene, camera };
}
