// The three.js side of #18: turn the pure spec into a scene, in six draw calls.
//
// Nothing here invents geometry. It takes the typed arrays stadiumSpec.js
// produced, wraps them in BufferGeometry, and adds exactly six objects. If a
// future contributor wants another arch or another gantry, it belongs in the
// spec, where the offline GLB build will pick it up too.

import * as THREE from 'three';
import { buildStadiumSpec } from './stadiumSpec.js';
import { createTextures } from './textures.js';

/** Typed arrays -> BufferGeometry, with COLOR_0 wired to vertex colours. */
export function toBufferGeometry(mesh) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(mesh.position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normal, 3));
  if (mesh.uv?.length) geo.setAttribute('uv', new THREE.BufferAttribute(mesh.uv, 2));
  if (mesh.color?.length) geo.setAttribute('color', new THREE.BufferAttribute(mesh.color, 3));
  geo.setIndex(new THREE.BufferAttribute(mesh.index, 1));
  geo.computeBoundingSphere();
  geo.name = mesh.name;
  return geo;
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

/** An InstancedMesh from one of the spec's instance tables. */
function instanced(spec, geometry, material, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, spec.count);
  mesh.name = name;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spec.count * 3), 3);
  for (let i = 0; i < spec.count; i++) {
    _p.set(spec.position[i * 3], spec.position[i * 3 + 1], spec.position[i * 3 + 2]);
    _e.set(0, spec.rotationY[i], 0);
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    _c.setRGB(spec.color[i * 3], spec.color[i * 3 + 1], spec.color[i * 3 + 2]);
    mesh.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/**
 * Build the stadium into a scene.
 * @param {THREE.Scene} scene
 * @param {object} opts { quality, layout }
 */
export function buildStadium(scene, opts = {}) {
  const quality = opts.quality || {};
  const spec = buildStadiumSpec({
    layout: opts.layout,
    detail: quality.stadium,
  });
  const textures = createTextures(THREE, quality);
  const group = new THREE.Group();
  group.name = 'stadium';
  const disposables = [];

  // 1. the bowl: one merged mesh, vertex-coloured, one draw call
  const shellMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const shellGeo = toBufferGeometry(spec.meshes.shell);
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.name = 'stadium:shell';
  shell.castShadow = quality.shadows !== false;
  shell.receiveShadow = quality.shadows !== false;
  group.add(shell);
  disposables.push(shellGeo, shellMat);

  // 2. the seats: thousands of blocks, one draw call
  const seatGeo = toBufferGeometry(spec.meshes.seat);
  const seatMat = new THREE.MeshLambertMaterial();
  const seats = instanced(spec.instances.seats, seatGeo, seatMat, 'stadium:seats');
  seats.castShadow = false;
  seats.receiveShadow = false;
  group.add(seats);
  disposables.push(seatGeo, seatMat);

  // 3. the floodlight heads: unlit, so they read as lit lamps at night
  const lampGeo = toBufferGeometry(spec.meshes.lamp);
  const lampMat = new THREE.MeshBasicMaterial();
  const lamps = instanced(spec.instances.lamps, lampGeo, lampMat, 'stadium:lamps');
  group.add(lamps);
  disposables.push(lampGeo, lampMat);

  // 4. the goal frames: both ends merged into one mesh
  const goalGeo = toBufferGeometry(spec.meshes.goals);
  const goalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
  const goals = new THREE.Mesh(goalGeo, goalMat);
  goals.name = 'stadium:goals';
  goals.castShadow = quality.shadows !== false;
  group.add(goals);
  disposables.push(goalGeo, goalMat);

  // 5. the pitch markings, struck from the CORE's rectangle. Merged, unlit and
  //    depth-write-free so they never z-fight the turf.
  const lineGeo = toBufferGeometry(spec.meshes.lines);
  const lineMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.94, depthWrite: false,
  });
  const lines = new THREE.Mesh(lineGeo, lineMat);
  lines.name = 'stadium:lines';
  lines.renderOrder = 1;
  group.add(lines);
  disposables.push(lineGeo, lineMat);

  // 6. the hoardings: one atlas, one strip mesh
  const boardGeo = toBufferGeometry(spec.meshes.boards);
  const boardMat = new THREE.MeshLambertMaterial({
    map: textures.boards || null, side: THREE.DoubleSide,
  });
  const boards = new THREE.Mesh(boardGeo, boardMat);
  boards.name = 'stadium:boards';
  group.add(boards);
  disposables.push(boardGeo, boardMat);
  if (textures.boards) disposables.push(textures.boards);

  scene.add(group);

  return {
    group,
    spec,
    textures,
    stats: spec.stats,
    /** Swap the merged geometry for a baked GLB's, if one has been loaded. */
    parts: { shell, seats, lamps, goals, lines, boards },
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose?.();
      seats.dispose();
      lamps.dispose();
    },
  };
}
