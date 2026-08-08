// The arena's own scene: renderer, lights, turf, and the procedural stadium.
//
// Why not view/scene.js. That one belongs to the shipping single-player game
// and is built the obvious way — a Mesh per stand tier, a Mesh per pylon, a
// Mesh per advertising board, fourteen Meshes for the goal frames. Counted up
// it is somewhere north of forty draw calls before a player is drawn, which is
// most of row #19's mobile budget spent on scenery that never moves. It is a
// perfectly good scene for a game that draws ten characters as seventy meshes;
// it is the wrong starting point for one that has to fit under fifty calls.
//
// So the arena gets its own, sharing the same footprint and the same look, with
// everything static merged and everything repeated instanced. The shipping
// scene is untouched.

import * as THREE from 'three';
import { buildStadium } from './stadium.js';
import { createTextures } from './textures.js';
import { autoQuality, qualityFor, rendererLimits } from './quality.js';

/**
 * @param {HTMLElement} container
 * @param {object} [opts] { quality, tier, layout }
 * @returns {{renderer, scene, camera, stadium, quality, dispose}}
 */
export function createArenaScene(container, opts = {}) {
  // The tier has to be decided in two passes: the cheap signals first, so the
  // renderer can be created with the right pixel ratio and antialias flag, then
  // refined once the GL context can be asked what it can actually do.
  let quality = opts.quality || autoQuality({ force: opts.tier });

  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias !== false });
  renderer.setPixelRatio(Math.min(
    typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1,
    quality.pixelRatio || 2,
  ));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = quality.shadows !== false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  if (!opts.quality) {
    const refined = autoQuality({ force: opts.tier, ...rendererLimits(renderer) });
    if (refined.tier !== quality.tier) {
      quality = refined;
      renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
      renderer.shadowMap.enabled = quality.shadows !== false;
    }
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1226);
  scene.fog = new THREE.Fog(0x0b1226, 60, 160);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
  camera.position.set(28, 23, 0);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xc4d6ff, 0x1c3a24, 0.85));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
  sun.position.set(24, 34, 12);
  sun.castShadow = quality.shadows !== false;
  const shadowSize = quality.shadowMapSize || 1024;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 90;
  scene.add(sun);

  // turf + apron: two draw calls, and the apron is unlit because nothing ever
  // casts an interesting shadow on tarmac
  const textures = createTextures(THREE, quality);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 48),
    new THREE.MeshLambertMaterial({ map: textures.turf || null, color: textures.turf ? 0xffffff : 0x2f8f45 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality.shadows !== false;
  ground.name = 'arena:turf';
  scene.add(ground);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ color: 0x101c2e }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.name = 'arena:apron';
  scene.add(apron);

  const stadium = buildStadium(scene, { quality, layout: opts.layout });

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  return {
    renderer,
    scene,
    camera,
    stadium,
    quality,
    /** Static draw calls, before any player is drawn. For the budget report. */
    staticDrawCalls: 2 + 6,
    dispose() {
      removeEventListener('resize', onResize);
      stadium.dispose();
      scene.remove(ground);
      scene.remove(apron);
      ground.geometry.dispose();
      ground.material.map?.dispose();
      ground.material.dispose();
      apron.geometry.dispose();
      apron.material.dispose();
    },
  };
}

export { qualityFor };
