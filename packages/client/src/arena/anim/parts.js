// Loading the authored body parts.
//
// tools/blender/make-parts.py writes dist-assets/player-parts.glb: four unit
// meshes named limb, body, head and boot, generated headlessly by Blender from
// a script that lives in this repo. They are shaped versions of the four
// primitives instancedBody.js builds — a limb with a muscle, a torso with
// shoulders, a head with a jaw, a boot with a toe — and they obey exactly the
// same unit-box convention, so swapping one for the other changes how a player
// looks and nothing else.
//
// Like the baked stadium, this is an enhancement and never a dependency: if the
// file is missing, unreadable, or the wrong shape, the primitives stay. A build
// artefact must not be the difference between a game and a black screen.

export const PARTS_URL = '/dist-assets/player-parts.glb';

/** The four names the rig instances, and the unit half-extents each must obey. */
const EXPECTED = {
  limb: [1, 0.5, 1],
  body: [1, 0.5, 1],
  head: [1, 1, 1],
  boot: [0.5, 0.5, 0.5],
};

/** How far a part may miss its unit box before it is rejected, in unit space. */
const TOLERANCE = 0.02;

/**
 * A part that is off-centre or oversized would silently resize every limb in
 * the game, because the instance scale assumes the unit box. Checking here
 * means a bad export degrades to the primitives instead of to a deformed team.
 */
function fitsUnitBox(geometry, limits) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  if (!b) return false;
  const axes = [['x', 0], ['y', 1], ['z', 2]];
  for (const [axis, i] of axes) {
    const half = (b.max[axis] - b.min[axis]) / 2;
    const centre = (b.max[axis] + b.min[axis]) / 2;
    if (Math.abs(half - limits[i]) > TOLERANCE) return false;
    if (Math.abs(centre) > TOLERANCE) return false;
  }
  return true;
}

/**
 * Try to load the authored parts.
 *
 * @param {object} THREE passed in so this module imports nothing a headless
 *   test would have to stub
 * @param {{url?:string}} [opts]
 * @returns {Promise<Record<string, object>|null>} geometries by part name, or
 *   null when anything at all is not right
 */
export async function loadAuthoredParts(THREE, opts = {}) {
  const url = opts.url || PARTS_URL;
  if (typeof fetch !== 'function') return null;
  // Magic bytes, not a HEAD check: an unknown path on a dev server comes back
  // as index.html with a 200, which passes "is it there?" and fails everything
  // after it.
  try {
    const probe = await fetch(url, { headers: { Range: 'bytes=0-3' } });
    if (!probe.ok) return null;
    const head4 = new Uint8Array(await probe.arrayBuffer());
    if (head4.length < 4 || String.fromCharCode(...head4.slice(0, 4)) !== 'glTF') return null;
  } catch {
    return null;
  }
  let GLTFLoader;
  try {
    ({ GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'));
  } catch {
    return null;
  }
  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(url);
  } catch {
    return null;
  }

  const found = Object.create(null);
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !EXPECTED[o.name]) return;
    const geo = o.geometry;
    // The exporter writes Y-up with the object's transform baked, but a node
    // transform can still survive; fold it in before measuring anything.
    o.updateWorldMatrix(true, false);
    geo.applyMatrix4(o.matrixWorld);
    if (fitsUnitBox(geo, EXPECTED[o.name])) found[o.name] = geo;
  });

  // All four or none: a mix of authored and primitive parts on one body looks
  // like a bug, and it is easier to see a missing file than a mismatched knee.
  for (const name of Object.keys(EXPECTED)) {
    if (!found[name]) return null;
  }
  return found;
}
