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
});

const cache = new Map();

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
  const part = await vendorMesh(name);
  if (!part || !scene) return null;
  const THREE = await import('three');
  const mesh = new THREE.Mesh(part.geometry, part.material);
  mesh.position.set(at.x, at.y || 0, at.z);
  if (at.yaw) mesh.rotation.y = at.yaw;
  mesh.castShadow = at.shadow !== false;
  mesh.receiveShadow = false;
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
