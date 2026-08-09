import * as THREE from 'three';

// Loading the downloaded models, once they have been conditioned.
//
// tools/fetch-models.mjs downloads them, tools/blender/prep-vendor.py sizes and
// centres them, and this reads the result. Because the conditioning step
// guarantees the contract — centred on the origin, +Y up, +Z forward, sized in
// metres to what the game needs — nothing here scales, rotates or offsets
// anything. If a vendor model looks wrong in the scene, the fix belongs in the
// Blender script, not in a correction factor here.
//
// Everything is optional. vendor-assets/ and dist-assets/ are both gitignored,
// so a fresh checkout has none of this and must still play: every loader
// resolves to null and the caller keeps what it drew before.
//
// Attribution: these are CC-BY, which means the credit has to travel with the
// build. vendor-assets/CREDITS.md is the record; see asset-sources.md for why
// nothing NonCommercial or NoDerivs is ever in here.

const BASE = '/dist-assets/vendor';

/** Names conditioned by prep-vendor.py. */
export const VENDOR = Object.freeze({
  ball: 'soccer-ball',
  seating: 'bleacher-seating',
  stadium: 'stadium-lowpoly',
  bench: 'bench',
  scoreboard: 'scoreboard',
  seat: 'stadium-seat',
  floodlight: 'floodlight',
  substitute: 'substitute',
  playerRig: 'player-rig',
  keeperRig: 'keeper-rig',
});

const cache = new Map();
const sceneCache = new Map();

/** Why the last load gave up, for the debug hook. */
export let lastVendorFailure = null;

async function loadGlb(name) {
  if (typeof fetch !== 'function') { lastVendorFailure = 'no fetch'; return null; }
  const url = `${BASE}/${name}.glb`;
  let buffer;
  try {
    const res = await fetch(url);
    if (!res.ok) { lastVendorFailure = `${url} -> ${res.status}`; return null; }
    buffer = await res.arrayBuffer();
  } catch (err) {
    lastVendorFailure = `${url}: ${err.message}`;
    return null;
  }
  // A dev server that answers unknown paths with index.html returns 200 and
  // HTML; the magic bytes are the only honest check.
  if (buffer.byteLength < 12 || new DataView(buffer).getUint32(0, true) !== 0x46546c67) {
    lastVendorFailure = `${url} is not a GLB — has prep:vendor run?`;
    return null;
  }
  let GLTFLoader;
  try {
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch (err) {
    lastVendorFailure = `no GLTFLoader: ${err.message}`;
    return null;
  }
  try {
    return await new Promise((ok, fail) => {
      new GLTFLoader().parse(buffer, '', ok, fail);
    });
  } catch (err) {
    lastVendorFailure = `parse failed: ${err.message}`;
    return null;
  }
}

/**
 * The first mesh of a conditioned model, as geometry plus material.
 *
 * Returned rather than added to a scene, so the caller decides what to do with
 * it — swapping both onto an existing mesh keeps every position, shadow flag
 * and update path that was already written.
 *
 * @param {string} name one of VENDOR
 * @returns {Promise<{geometry:object, material:object}|null>}
 */
export async function vendorMesh(name) {
  if (cache.has(name)) return cache.get(name);
  const promise = loadGlb(name).then((gltf) => {
    if (!gltf) return null;
    let found = null;
    gltf.scene.traverse((o) => {
      if (found || !o.isMesh) return;
      o.updateWorldMatrix(true, false);
      const geometry = o.geometry;
      geometry.applyMatrix4(o.matrixWorld);   // fold the node transform in
      geometry.userData.sharedPart = true;    // one copy serves every user
      found = { geometry, material: o.material };
    });
    if (!found) lastVendorFailure = `${name}: no mesh in the file`;
    return found;
  });
  cache.set(name, promise);
  return promise;
}

/**
 * The WHOLE conditioned model, materials and hierarchy intact.
 *
 * vendorMesh() returns the first mesh it finds, which is right for swapping a
 * ball onto an existing sphere and badly wrong for anything built from parts:
 * the substitute footballer arrived as an 11 cm fragment of himself because his
 * shirt, shorts, skin and boots are four meshes and only the first came back.
 *
 * @param {string} name one of VENDOR
 * @returns {Promise<object|null>} a fresh clone, safe to place more than once
 */
export async function vendorScene(name) {
  if (!sceneCache.has(name)) sceneCache.set(name, loadGlb(name));
  const gltf = await sceneCache.get(name);
  if (!gltf) return null;
  const root = await cloneModel(gltf.scene);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
  });
  standUp(root);
  return root;
}

let skeletonUtils;

/**
 * Copy a model so that two copies are genuinely two characters.
 *
 * Object3D.clone() copies the node tree and shares everything hanging off it:
 * geometry, materials, AND — for a SkinnedMesh — the Skeleton. The tree it
 * hands back has fresh Bone objects, but every skinned mesh in it still points
 * at the ORIGINAL skeleton, so eleven cloned players are eleven bodies driven
 * by one set of bones: pose the first and all eleven strike the same pose,
 * while the bones they each think they own do nothing.
 *
 * SkeletonUtils.clone() is three's own answer — it rebuilds the skeleton
 * against the cloned bones. It lives in the addons bundle, so it is imported
 * the same way GLTFLoader is, and a build without it falls back to the plain
 * clone rather than to nothing at all.
 *
 * Materials are cloned per copy on top of that, because a caller tinting one
 * player's shirt must not repaint the whole squad — the tint writes to
 * material.color, and a shared material means the last write wins for
 * everybody. Maps and textures stay shared; only the small material object is
 * duplicated.
 */
async function cloneModel(scene) {
  let skinned = false;
  scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
  let root = null;
  if (skinned) {
    if (skeletonUtils === undefined) {
      try {
        skeletonUtils = await import('three/addons/utils/SkeletonUtils.js');
      } catch {
        skeletonUtils = null;
      }
    }
    if (skeletonUtils?.clone) root = skeletonUtils.clone(scene);
  }
  if (!root) root = scene.clone(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => m.clone())
      : o.material.clone();
  });
  return root;
}

/**
 * Stand a character up, by measuring rather than by a magic rotation.
 *
 * A Sketchfab FBX arrives wrapped in a chain that encodes its own axis
 * convention — Sketchfab_model turns -90 about X, the .fbx node turns +90 back,
 * the rig root turns -90 again. Blender reads that correctly, but the exporter
 * then adds its own Z-up to Y-up conversion on top of a chain that already
 * carries one, and the footballer arrives lying face down: head y -0.85, foot
 * y -0.77, 1.43 m apart horizontally.
 *
 * The static models never hit this because their transforms are baked into the
 * vertices; a rig cannot be baked that way, and applying the transform to the
 * armature instead breaks the skin binding (tried, both characters came out
 * several times their size and still flat).
 *
 * So the correction happens here, and it is derived rather than assumed: try
 * the four quarter-turns about X, keep whichever makes the skeleton tallest,
 * then drop it so its lowest bone sits on the ground. A model that is already
 * upright scores best at zero rotation and is left alone.
 */
/** Bone-name tests, deliberately loose: rigs vary but nearly all say so. */
const HEAD_RE = /head|skull|neck/i;
const FOOT_RE = /foot|toe|ankle|heel/i;
// Exporters emit a terminator bone per chain — HeadTop_End, LeftToe_End,
// LeftHandThumb4 — and this rig parks every one of them at the same y, 1.81 m,
// wherever the joint it terminates actually is. Reading HeadTop_End as "the
// head" said the head was above the feet on a character standing on his skull.
const END_RE = /(^|[_.\b])end([_.\b]|$)|_end_/i;

/**
 * Is this rig, at this rotation, standing on its head?
 *
 * Returns false when the rig names neither end — an unnamed skeleton is left
 * exactly as the height measurement placed it rather than flipped on a guess.
 *
 * @param {object[]} bones every bone in the rig
 * @param {object} root the model root, rotated in place while measuring
 * @param {number} turns quarter turns about X to test
 */
function upsideDown(bones, root, turns) {
  root.rotation.x = turns * Math.PI / 2;
  root.updateMatrixWorld(true);
  const head = [];
  const foot = [];
  for (const b of bones) {
    if (END_RE.test(b.name)) continue;
    const y = b.getWorldPosition(new THREE.Vector3()).y;
    if (HEAD_RE.test(b.name)) head.push(y);
    else if (FOOT_RE.test(b.name)) foot.push(y);
  }
  if (!head.length || !foot.length) return false;
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return mean(head) < mean(foot);
}

function standUp(root) {
  const bones = [];
  root.traverse((o) => { if (o.isBone) bones.push(o); });
  if (bones.length < 4) return root;          // not a character; nothing to do

  // Reject the control bones before measuring anything.
  //
  // A rig carries IK targets and pole vectors that sit metres from the body by
  // design — this player's are 28 units away — and they are bones like any
  // other. Measuring with them in said the character was 32.8 m tall and chose
  // the wrong quarter-turn. Keeping only bones near the median position throws
  // them out without needing to know their names.
  const world = new THREE.Vector3();
  const sample = () => {
    root.updateMatrixWorld(true);
    return bones.map((b) => b.getWorldPosition(new THREE.Vector3()));
  };
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[s.length >> 1];
  };
  const body = (points) => {
    const mid = new THREE.Vector3(
      median(points.map((p) => p.x)),
      median(points.map((p) => p.y)),
      median(points.map((p) => p.z)),
    );
    const near = points.filter((p) => p.distanceTo(mid) < 2.5);
    return near.length >= 4 ? near : points;
  };

  const span = (turns) => {
    root.rotation.x = turns * Math.PI / 2;
    const pts = body(sample());
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pts) {
      if (p.y < lo) lo = p.y;
      if (p.y > hi) hi = p.y;
    }
    return { height: hi - lo, lo };
  };

  let best = 0;
  let bestSpan = span(0);
  for (const turns of [1, 2, 3]) {
    const s = span(turns);
    if (s.height > bestSpan.height) { best = turns; bestSpan = s; }
  }
  // Tallest is not the same as right way up: a quarter-turn and its opposite
  // measure exactly the same height, and the tie was going to whichever was
  // tried first — which put a whole team on the pitch standing on their heads.
  // The skeleton settles it. Every rig this loads names a Head and a Foot, so
  // the check is which of the two ends up higher, and the fix is the half turn
  // that swaps them.
  if (upsideDown(bones, root, best)) best = (best + 2) % 4;
  const chosen = span(best);
  // The drop is REPORTED rather than applied, because placeVendorMesh sets the
  // position outright and would wipe it. Feet-on-grass is the caller's job now.
  root.userData.standUp = {
    turns: best, height: chosen.height, groundOffset: -chosen.lo,
  };
  void world;
  return root;
}

/**
 * Put a conditioned model into the scene at a spot on the pitch.
 *
 * Nothing is scaled or rotated on the way in beyond the yaw asked for: the
 * Blender step already sized it in metres and stood it the right way up. If it
 * lands wrong, the fix is in tools/blender/prep-vendor.py.
 *
 * @param {object} scene
 * @param {string} name one of VENDOR
 * @param {{x:number, y:number, z:number, yaw?:number, shadow?:boolean}} at
 * @returns {Promise<object|null>} the mesh, once it exists
 */
export async function placeVendorMesh(scene, name, at) {
  // The whole model, not its first mesh: a footballer is four meshes and a
  // floodlight is three, and taking only the first placed a fragment.
  const mesh = await vendorScene(name);
  if (!mesh || !scene) return null;
  // standUp() measured how far to drop the character so his feet meet the
  // grass; add it rather than let the placement overwrite it.
  const drop = mesh.userData.standUp ? mesh.userData.standUp.groundOffset : 0;
  mesh.position.set(at.x, (at.y || 0) + drop, at.z);
  if (at.yaw) mesh.rotation.y = at.yaw;
  if (at.shadow === false) mesh.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  mesh.name = `vendor:${name}`;
  scene.add(mesh);
  if (typeof window !== 'undefined') {
    window.__vendor = { ...(window.__vendor || {}), [name]: true };
  }
  return mesh;
}

/**
 * Draw an existing mesh with a vendor model's geometry and material.
 *
 * @param {object} mesh a THREE.Mesh already in the scene
 * @param {string} name one of VENDOR
 */
export function useVendorMesh(mesh, name) {
  if (!mesh) return;
  vendorMesh(name).then((part) => {
    if (!part || !mesh.parent) return;
    const oldGeo = mesh.geometry;
    const oldMat = mesh.material;
    mesh.geometry = part.geometry;
    mesh.material = part.material;
    if (oldGeo && !oldGeo.userData.sharedPart) oldGeo.dispose();
    if (oldMat && oldMat !== part.material) {
      oldMat.map?.dispose();
      oldMat.dispose();
    }
    if (typeof window !== 'undefined') {
      window.__vendor = { ...(window.__vendor || {}), [name]: true };
    }
  }).catch(() => { /* the primitive stays; that is the whole design */ });
}
