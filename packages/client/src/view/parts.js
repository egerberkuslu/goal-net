// Swapping the primitives for the Blender-authored body parts.
//
// tools/blender/make-view-parts.py writes dist-assets/view-parts.glb: a torso
// with shoulders, a head with a jaw, and two limbs with muscle, authored at
// exactly the extents of the CapsuleGeometry, SphereGeometry and
// CylinderGeometry that playerView.js builds. Because the extents match, this
// is a geometry assignment and nothing else — no offsets to retune, no
// animation to re-time, and no change to the shipping game's proportions.
//
// It is an enhancement, never a dependency. A missing or malformed file leaves
// the primitives in place, which is what happens on any checkout that has not
// run `npm run build:viewparts`.
//
// One load serves every player in the session: the geometries are shared, and
// meshes created before the file arrives are swapped when it does.

import * as THREE from 'three';

export const PARTS_URL = '/dist-assets/view-parts.glb';

/**
 * Each part's expected half-extents in metres, and where its pivot goes.
 *
 * `pivotY` matches the translate playerView applies to the primitive: a leg
 * hangs from the hip and an arm from the shoulder, so their geometry is shifted
 * down by half their length. Getting this wrong puts the knee through the
 * ground, so it is asserted rather than assumed.
 */
const EXPECTED = {
  torso: { half: [0.26, 0.485, 0.26], pivotY: 0 },
  head: { half: [0.16, 0.16, 0.16], pivotY: 0 },
  leg: { half: [0.075, 0.275, 0.075], pivotY: -0.275 },
  arm: { half: [0.055, 0.24, 0.055], pivotY: -0.24 },
};

/** Metres a part may miss its expected extents by before it is rejected. */
const TOLERANCE = 0.004;

/**
 * Why the authored parts are not being used, if they are not.
 *
 * Every bail-out below is a silent fallback by design — a missing asset must
 * never break the game — but silent also means undebuggable, and this cost an
 * hour of looking in the wrong place. The reason is recorded here and surfaced
 * on the debug hook.
 */
export let lastFailure = null;

let ready = null;          // Promise<Record<string, BufferGeometry>|null>
let resolved = null;       // the geometries, once they are in
const waiting = [];        // meshes created before the file arrived

function fits(geometry, half) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  if (!b) return false;
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < 3; i++) {
    const a = axes[i];
    if (Math.abs((b.max[a] - b.min[a]) / 2 - half[i]) > TOLERANCE) return false;
    if (Math.abs((b.max[a] + b.min[a]) / 2) > TOLERANCE) return false;
  }
  return true;
}

async function load() {
  if (typeof fetch !== 'function') { lastFailure = 'no fetch'; return null; }
  // Fetch the bytes and check the magic before handing anything to a parser.
  // A dev server that answers an unknown path with index.html returns 200 and
  // HTML, which a HEAD check happily accepts and a glTF parser then dies on —
  // that exact confusion hid a broken asset path for a whole session.
  let buffer;
  try {
    const res = await fetch(PARTS_URL);
    if (!res.ok) { lastFailure = `GET ${PARTS_URL} -> ${res.status}`; return null; }
    buffer = await res.arrayBuffer();
  } catch (err) {
    lastFailure = `fetch failed: ${err.message}`;
    return null;
  }
  if (buffer.byteLength < 12 || new DataView(buffer).getUint32(0, true) !== 0x46546c67) {
    lastFailure = 'not a GLB (wrong magic) — is dist-assets being served?';
    return null;
  }
  let GLTFLoader;
  try {
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch (err) {
    lastFailure = `no GLTFLoader: ${err.message}`;
    return null;
  }
  let gltf;
  try {
    gltf = await new Promise((ok, fail) => {
      new GLTFLoader().parse(buffer, '', ok, fail);
    });
  } catch (err) {
    lastFailure = `parse failed: ${err.message}`;
    return null;
  }

  const out = Object.create(null);
  gltf.scene.traverse((o) => {
    const spec = o.isMesh ? EXPECTED[o.name] : null;
    if (!spec) return;
    const geo = o.geometry;
    o.updateWorldMatrix(true, false);
    geo.applyMatrix4(o.matrixWorld);          // fold in any node transform
    if (!fits(geo, spec.half)) {
      geo.computeBoundingBox();
      const b = geo.boundingBox;
      lastFailure = `${o.name} is `
        + `${((b.max.x - b.min.x) / 2).toFixed(3)}/`
        + `${((b.max.y - b.min.y) / 2).toFixed(3)}/`
        + `${((b.max.z - b.min.z) / 2).toFixed(3)}, want ${spec.half.join('/')}`;
      return;
    }
    if (spec.pivotY) geo.translate(0, spec.pivotY, 0);
    // One geometry serves every player, so nobody's dispose() may free it.
    geo.userData.sharedPart = true;
    out[o.name] = geo;
  });

  // All four or none. A body wearing one authored limb and three cylinders
  // looks like a bug and is harder to spot than a missing file.
  for (const name of Object.keys(EXPECTED)) {
    if (!out[name]) {
      lastFailure = lastFailure || `${name} is missing from the file`;
      return null;
    }
  }
  lastFailure = null;
  return out;
}

/**
 * Primitives that have been swapped out and are waiting to be freed.
 *
 * They cannot be freed inside apply(): playerView builds ONE leg geometry and
 * hands it to both legs, so disposing it while swapping the first leg would
 * pull it out from under the second. Freeing on a microtask means every
 * synchronous swap has happened by the time anything is released, and no frame
 * can be drawn in between.
 */
const orphans = new Set();
let sweepQueued = false;

function sweep() {
  sweepQueued = false;
  for (const geo of orphans) geo.dispose();
  orphans.clear();
}

function apply(mesh, kind, geometries) {
  const geo = geometries[kind];
  if (!geo || !mesh || mesh.geometry === geo) return;
  const previous = mesh.geometry;
  mesh.geometry = geo;
  if (previous && !previous.userData.sharedPart) {
    orphans.add(previous);
    if (!sweepQueued) {
      sweepQueued = true;
      queueMicrotask(sweep);
    }
  }
}

/**
 * Draw this mesh with the authored part when it is available.
 *
 * Safe to call before, during or after the load, and safe to call when there is
 * no file at all.
 *
 * @param {THREE.Mesh} mesh
 * @param {'torso'|'head'|'leg'|'arm'} kind
 */
export function useAuthoredPart(mesh, kind) {
  if (!mesh || !EXPECTED[kind]) return;
  if (resolved) { apply(mesh, kind, resolved); return; }
  waiting.push({ mesh, kind });
  if (ready) return;
  ready = load().then((geometries) => {
    if (!geometries) { publish(); return null; }
    resolved = geometries;
    for (const item of waiting) apply(item.mesh, item.kind, geometries);
    waiting.length = 0;
    publish();
    return geometries;
  }).catch((err) => { lastFailure = `load threw: ${err.message}`; publish(); return null; });
}

/** For tests and the debug hook: have the authored parts landed? */
export function authoredPartsLoaded() {
  return !!resolved;
}

/**
 * Publish the outcome where a console can see it.
 *
 * Importing this module from devtools gets a different instance than the game
 * is using — vite serves it under a versioned URL — so probing the import tells
 * you nothing about the running game. One global is worth the hour that cost.
 */
function publish() {
  if (typeof window === 'undefined') return;
  window.__parts = { loaded: !!resolved, reason: lastFailure, url: PARTS_URL };
}
