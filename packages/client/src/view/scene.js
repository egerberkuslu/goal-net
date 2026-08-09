import * as THREE from 'three';
import {
  GOAL_W, GOAL_H, POST_R, NET_TOP_DEPTH, NET_BOT_DEPTH,
  PITCH_HALF_L, PITCH_HALF_W, WALL_X,
} from '../core/constants.js';

const DEFAULT_HALF_W = GOAL_W / 2;

/**
 * Everything the stadium needs to know about the playing area, in metres.
 *
 * The shipping game's numbers are the default, so `createScene(container)`
 * builds exactly the pitch it always did. The arena passes its own spec
 * because its core rectangle is narrower (17.14 m against 22 m) — drawing
 * this one from the caller's numbers is what keeps the painted boundary and
 * the simulated boundary the same line.
 */
const DEFAULT_PITCH = Object.freeze({
  halfW: PITCH_HALF_W,
  halfL: PITCH_HALF_L,
  wallX: WALL_X,
  goalHalfW: DEFAULT_HALF_W,
  penaltyHalfX: 7,
  penaltyDepth: 4.5,
  goalAreaHalfX: 4.5,
  goalAreaDepth: 1.8,
  centreR: 3,
  spotDist: 6,
  arcR: 2.6,
});

/** Grass beyond the touchlines, so the pitch never runs to the texture edge. */
const APRON_X = 4;
const APRON_Z = 6;

function tubeBetween(a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

// Texture covers the pitch plus its grass apron; the goal lines land on
// z = ±p.halfL whatever the caller's pitch measures.
function makePitchTexture(p) {
  const W = p.halfW * 2 + APRON_X * 2, L = p.halfL * 2 + APRON_Z * 2, S = 1600;
  const cv = document.createElement('canvas');
  cv.width = S * (W / L); cv.height = S;
  const g = cv.getContext('2d');
  const mPerPx = L / S;
  const px = (m) => m / mPerPx;
  const X = (x) => px(x + W / 2), Z = (z) => px(z + L / 2);

  // base + mowing stripes along z, with a soft grain
  for (let i = 0; i * 3 < L; i++) {
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
  g.strokeRect(X(-p.halfW), Z(-p.halfL), px(p.halfW * 2), px(p.halfL * 2));
  // halfway line + centre circle + spot
  g.beginPath(); g.moveTo(X(-p.halfW), Z(0)); g.lineTo(X(p.halfW), Z(0)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), px(p.centreR), 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), px(0.16), 0, Math.PI * 2); g.fill();
  // boxes, spots and arcs at both ends
  for (const s of [-1, 1]) {
    const gl = s * p.halfL;
    g.strokeRect(X(-p.penaltyHalfX), Math.min(Z(gl), Z(gl - s * p.penaltyDepth)),
      px(p.penaltyHalfX * 2), px(p.penaltyDepth));
    g.strokeRect(X(-p.goalAreaHalfX), Math.min(Z(gl), Z(gl - s * p.goalAreaDepth)),
      px(p.goalAreaHalfX * 2), px(p.goalAreaDepth));
    g.beginPath(); g.arc(X(0), Z(gl - s * p.spotDist), px(0.16), 0, Math.PI * 2); g.fill();
    g.beginPath();
    const a0 = s > 0 ? Math.PI * 1.25 : Math.PI * 0.25;
    g.arc(X(0), Z(gl - s * p.spotDist), px(p.arcR), a0, a0 + Math.PI * 0.5);
    g.stroke();
  }
  // corner arcs, the detail that reads as "this is a real pitch" up close
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a0 = sx > 0 ? (sz > 0 ? Math.PI : Math.PI * 0.5) : (sz > 0 ? Math.PI * 1.5 : 0);
    g.beginPath();
    g.arc(X(sx * p.halfW), Z(sz * p.halfL), px(0.9), a0, a0 + Math.PI * 0.5);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Goal frames + stanchions for both ends, sized from the match config. Kept
// out of createScene so a lobby can rebuild them when the goal size changes.
export function buildGoalFrames(scene, config) {
  const { goalW, goalH } = config;
  const halfW = goalW / 2;
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.35 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const end of [-1, 1]) {
    const gz = end * PITCH_HALF_L;
    const back = end * (PITCH_HALF_L + NET_BOT_DEPTH);
    const kink = end * (PITCH_HALF_L + NET_TOP_DEPTH);
    for (const s of [-1, 1]) {
      group.add(tubeBetween(V(s * halfW, 0, gz), V(s * halfW, goalH + POST_R, gz), POST_R, white));
      group.add(tubeBetween(V(s * halfW, goalH + POST_R, gz), V(s * halfW, goalH - 0.1, kink), 0.028, white));
      group.add(tubeBetween(V(s * halfW, goalH - 0.1, kink), V(s * halfW, 0, back), 0.028, white));
    }
    group.add(tubeBetween(V(-halfW - POST_R, goalH, gz), V(halfW + POST_R, goalH, gz), POST_R, white));
  }
  scene.add(group);
  return {
    group,
    dispose() {
      scene.remove(group);
      for (const m of group.children) m.geometry.dispose();
      group.clear();
      white.dispose();
    },
  };
}

function addStadium(scene, p) {
  const standMat = new THREE.MeshLambertMaterial({ color: 0x232c44 });
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x2e3a5c });
  // tiered stands: far touchline + both goal ends. The near (+x) side is
  // deliberately open — broadcast style — so the camera always sees the
  // bottom of the pitch; only the ad boards line that edge.
  for (const side of [-1, 1]) {
    for (let t = 0; t < 3; t++) {
      if (side < 0) {
        const s = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 1.6 + t * 0.4, p.halfL * 2 + 16),
          t % 2 ? seatMat : standMat,
        );
        s.position.set(side * (p.halfW + 3.5 + t * 2.3), (1.6 + t * 0.4) / 2 + t * 1.1, 0);
        scene.add(s);
      }
      const e = new THREE.Mesh(
        new THREE.BoxGeometry(p.halfW * 2 + 12, 1.6 + t * 0.4, 2.2),
        t % 2 ? seatMat : standMat,
      );
      e.position.set(0, (1.6 + t * 0.4) / 2 + t * 1.1, side * (p.halfL + 5.5 + t * 2.3));
      scene.add(e);
    }
  }
  // floodlight pylons
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8b94a8 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 14, 8), poleMat);
    pole.position.set(sx * (p.halfW + 2.5), 7, sz * (p.halfL + 4.5));
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.3), headMat);
    head.position.set(sx * (p.halfW + 2.5), 14.2, sz * (p.halfL + 4.5));
    head.lookAt(0, 0, 0);
    scene.add(head);
  }
  // ad boards sit flush with the invisible walls, right behind the lines,
  // so wall rebounds visibly come off the boards
  const colors = [0x1c3f8f, 0x8f1c2e, 0x1c8f5a, 0xa8781c];
  const along = new THREE.BoxGeometry(6, 0.75, 0.1);
  const across = new THREE.BoxGeometry(0.1, 0.75, 6);
  const endBoard = new THREE.BoxGeometry(3.8, 0.75, 0.1);
  let ci = 0;
  for (const side of [-1, 1]) {
    // touchline boards at the side walls; the near (+x, camera-side) run is
    // translucent so it never hides the ball along the bottom touchline
    for (let z = -p.halfL; z < p.halfL; z += 6) {
      const mat = new THREE.MeshLambertMaterial({ color: colors[ci++ % 4] });
      if (side > 0) {
        mat.transparent = true;
        mat.opacity = 0.3;
        mat.depthWrite = false;
      }
      const b = new THREE.Mesh(across, mat);
      b.position.set(side * (p.wallX + 0.06), 0.38, z + 3);
      b.castShadow = side < 0;
      scene.add(b);
    }
    // goal-line boards from each post out to the side walls
    const post = p.goalHalfW + 0.19;
    const nEnd = Math.max(1, Math.round((p.wallX - post) / 3.8));
    for (const sx of [-1, 1]) {
      for (let i = 0; i < nEnd; i++) {
        const b = new THREE.Mesh(endBoard, new THREE.MeshLambertMaterial({ color: colors[ci++ % 4] }));
        b.position.set(sx * (post + 1.9 + i * 3.8), 0.38, side * (p.halfL + 0.12));
        b.castShadow = true;
        scene.add(b);
      }
    }
  }
}

/**
 * Real grass on top of the drawn pitch.
 *
 * The canvas texture owns the layout — the mown stripes, the lines, the arcs —
 * and it has to, because those are metres measured off the pitch spec. What it
 * cannot do is look like grass from two metres away: it is flat colour with a
 * noise dither. So a photographed CC0 grass tile (ambientCG, fetched by
 * tools/fetch-textures.mjs) is laid over it as normal and roughness detail,
 * repeated once per metre, which is what puts blades under the light without
 * touching a single line.
 *
 * Loads late and applies when it lands; a checkout that never ran the fetch
 * script gets exactly the pitch it got before.
 */
function addGrassDetail(material, spanX, spanZ) {
  if (typeof fetch !== 'function') return;
  const base = '/dist-assets/textures/Grass005/Grass005_1K-JPG';
  const loader = new THREE.TextureLoader();
  const tile = (url, onto) => new Promise((done) => {
    loader.load(url, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      // one tile per metre: any coarser and the blades read as a pattern
      tex.repeat.set(spanX, spanZ);
      tex.anisotropy = 8;
      onto(tex);
      done(true);
    }, undefined, () => done(false));
  });
  // A HEAD first, so a missing pack is one 404 instead of three console errors.
  fetch(`${base}_NormalGL.jpg`, { method: 'HEAD' }).then((r) => {
    if (!r.ok) return;
    tile(`${base}_NormalGL.jpg`, (t) => {
      material.normalMap = t;
      material.normalScale = new THREE.Vector2(0.35, 0.35);
      material.needsUpdate = true;
    });
    tile(`${base}_Roughness.jpg`, (t) => {
      material.roughnessMap = t;
      material.needsUpdate = true;
    });
  }).catch(() => { /* no pack, no grass, no noise */ });
}

export function createScene(container, opts = {}) {
  const p = { ...DEFAULT_PITCH, ...(opts.pitch || {}) };
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

  // Standard, not Lambert: the grass detail below needs a normal and a
  // roughness map, and Lambert has neither. The pitch looked identical the
  // frame before the maps arrive.
  const spanX = p.halfW * 2 + APRON_X * 2;
  const spanZ = p.halfL * 2 + APRON_Z * 2;
  const groundMat = new THREE.MeshStandardMaterial({
    map: makePitchTexture(p), roughness: 0.92, metalness: 0,
  });
  addGrassDetail(groundMat, spanX, spanZ);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(spanX, spanZ), groundMat);
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

  // goal frames are built separately by buildGoalFrames(scene, config)

  addStadium(scene, p);
  // no cage: the low ad boards are the boundary, high balls go out of play

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  return { renderer, scene, camera };
}
