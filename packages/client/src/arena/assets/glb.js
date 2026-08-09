// Loading the baked stadium — the runtime end of the offline pipeline.
//
// tools/build-assets.mjs writes dist-assets/stadium.glb: the same geometry the
// runtime builds, but Draco-compressed and with the two textures as KTX2/ETC1S.
// This module loads it if it is there and quietly does nothing if it is not.
//
// That "quietly" is deliberate. The procedural stadium is the source of truth
// and it costs about a millisecond to build; the GLB is a size and load-time
// optimisation for a CDN, not a dependency. A missing or corrupt artefact must
// never be the difference between a game and a black screen, and a build step
// that can break the game is a build step people stop running.
//
// The decoders are the ones three.js ships in its own package, so nothing is
// fetched from a CDN and the strict-CSP case works.

export const GLB_URL = '/dist-assets/stadium.glb';

/**
 * Try to load the baked stadium.
 *
 * @param {object} THREE the three namespace, passed in so this module has no
 *   import of its own that a headless test would have to stub
 * @param {object} [opts] { url, renderer }
 * @returns {Promise<{scene:object, stats:object}|null>} null if unavailable
 */
export async function loadBakedStadium(THREE, opts = {}) {
  const url = opts.url || GLB_URL;
  if (typeof fetch !== 'function') return null;
  // A HEAD check is not enough: a dev server answers an unknown path with
  // index.html and a 200, so "the file is there" was true of a page of HTML.
  // The magic bytes are the only honest answer.
  try {
    const probe = await fetch(url, { headers: { Range: 'bytes=0-3' } });
    if (!probe.ok) return null;
    const head4 = new Uint8Array(await probe.arrayBuffer());
    if (head4.length < 4 || String.fromCharCode(...head4.slice(0, 4)) !== 'glTF') return null;
  } catch {
    return null;
  }
  let GLTFLoader;
  let DRACOLoader;
  let KTX2Loader;
  try {
    ({ GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'));
    ({ DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js'));
    ({ KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js'));
  } catch {
    return null;                     // the example loaders are not bundled
  }

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  // three ships the decoder in its own package; no CDN, no CSP problem.
  draco.setDecoderPath(new URL('three/examples/jsm/libs/draco/', import.meta.url).href);
  loader.setDRACOLoader(draco);

  if (opts.renderer) {
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(new URL('three/examples/jsm/libs/basis/', import.meta.url).href);
    ktx2.detectSupport(opts.renderer);
    loader.setKTX2Loader(ktx2);
  }

  try {
    const gltf = await loader.loadAsync(url);
    let triangles = 0;
    let meshes = 0;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
        * (o.isInstancedMesh ? o.count : 1);
    });
    return { scene: gltf.scene, stats: { triangles, meshes } };
  } catch (err) {
    console.warn('[arena] baked stadium failed to load, using the procedural one', err?.message);
    return null;
  } finally {
    draco.dispose?.();
  }
}
