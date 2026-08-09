// Corner flags, on the same Verlet solver as the goal nets (matrix #23).
//
// Four sheets, one shared BufferGeometry, one draw call. The poles are a
// second instanced draw call. The solver is cloth.js; this file is only the
// bridge between its particle arrays and a vertex buffer.

import * as THREE from 'three';
import { ClothSheet, windAt } from './cloth.js';
import { windAt as coreWind } from '../../core/wind.js';
import { resolveTier } from './quality.js';

const POLE_H = 1.5;
const POLE_R = 0.022;
const FLAG_W = 0.44;
const FLAG_H = 0.3;

export class CornerFlags {
  /**
   * @param {THREE.Scene|{add:Function, remove?:Function}} scene
   * @param {{halfX:number, halfZ:number, tier?:string|object,
   *          colors?:number[]}} opts pitch half sizes in metres
   */
  constructor(scene, opts) {
    const tier = resolveTier(opts.tier);
    this.tier = tier;
    this.scene = scene;
    const [cols, rows] = tier.flagGrid;
    const colors = opts.colors || [0xffd257, 0xf2f2ef];

    this.corners = [];
    this.sheets = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * opts.halfX;
        const z = sz * opts.halfZ;
        // the flag flies away from the pitch, so it never hides play
        const right = [sx * 0.82, 0, sz * 0.57];
        this.corners.push({ x, z });
        this.sheets.push(new ClothSheet({
          cols, rows, width: FLAG_W, height: FLAG_H,
          origin: [x, POLE_H, z], right, up: [0, 1, 0],
          stiffness: 0.9,
        }));
      }
    }

    const perSheet = cols * rows;
    const totalVerts = perSheet * this.sheets.length;
    const positions = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const indices = [];
    for (let s = 0; s < this.sheets.length; s++) {
      const base = s * perSheet;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = base + r * cols + c;
          uvs[i * 2] = c / (cols - 1);
          uvs[i * 2 + 1] = 1 - r / (rows - 1);
          if (c < cols - 1 && r < rows - 1) {
            const a = i, b = i + 1, d = i + cols, e = i + cols + 1;
            indices.push(a, d, b, b, d, e);
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.positionAttr);
    // A lit material with no normal attribute shades to black. The sheet
    // changes shape every frame, so the normals are recomputed with it —
    // 500 triangles, which is nothing next to what it buys.
    this.normalAttr = new THREE.BufferAttribute(new Float32Array(totalVerts * 3), 3);
    this.normalAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('normal', this.normalAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 40);
    this.geometry = geo;
    this.triangles = indices.length / 3;

    this.material = new THREE.MeshLambertMaterial({
      color: colors[0], side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'atmos.flags';

    const poleGeo = new THREE.CylinderGeometry(POLE_R, POLE_R, POLE_H, 6);
    poleGeo.translate(0, POLE_H / 2, 0);
    this.poleMaterial = new THREE.MeshLambertMaterial({ color: colors[1] });
    this.poles = new THREE.InstancedMesh(poleGeo, this.poleMaterial, this.corners.length);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < this.corners.length; i++) {
      m4.makeTranslation(this.corners[i].x, 0, this.corners[i].z);
      this.poles.setMatrixAt(i, m4);
    }
    this.poles.instanceMatrix.needsUpdate = true;
    this.poles.name = 'atmos.flagPoles';

    this.group = new THREE.Group();
    this.group.name = 'atmos.corners';
    this.group.add(this.mesh, this.poles);
    scene.add(this.group);

    this.time = 0;
    this.resets = 0;
    this.lastSolveMs = 0;
    this.sync();
  }

  /** Copy every sheet's particles into the shared vertex buffer. */
  sync() {
    const dst = this.positionAttr.array;
    let o = 0;
    for (const sheet of this.sheets) {
      dst.set(sheet.pos, o);
      o += sheet.pos.length;
    }
    this.positionAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.normalAttr.needsUpdate = true;
  }

  /** @param {number} dt seconds @param {number} [strength] wind multiplier */
  update(dt, strength = 1) {
    const t0 = nowMs();
    const step = Math.max(0, Math.min(1 / 20, Number.isFinite(dt) ? dt : 0));
    if (step === 0) return;
    this.time += step;
    const air = coreWind(this.time);
    const wind = windAt(this.time, strength, [air.x, air.y, air.z]);
    for (const sheet of this.sheets) {
      sheet.step(step, { wind, iters: this.tier.flagIters });
      if (!sheet.finite()) { sheet.reset(); this.resets++; }
    }
    this.sync();
    this.lastSolveMs = nowMs() - t0;
  }

  stats() {
    return {
      flags: this.sheets.length,
      particles: this.sheets.reduce((s, f) => s + f.count, 0),
      links: this.sheets.reduce((s, f) => s + f.linkCount, 0),
      drawCalls: 2,
      triangles: this.triangles,
      iters: this.tier.flagIters,
      resets: this.resets,
      solveMs: this.lastSolveMs,
      maxStrain: this.sheets.reduce((m, f) => Math.max(m, f.maxStrain()), 0),
    };
  }

  dispose() {
    this.scene.remove?.(this.group);
    this.geometry.dispose();
    this.material.dispose();
    this.poles.geometry.dispose();
    this.poleMaterial.dispose();
    this.poles.dispose?.();
  }
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
