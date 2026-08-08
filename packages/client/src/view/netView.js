import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// Renders every collidable cord of every net as world-unit fat lines in one
// draw call, updating the interleaved buffer in place each frame.
export class NetView {
  constructor(nets, scene) {
    this.entries = nets.flatMap((net) => net.collidable.map((g) => ({ net, g })));
    this.segCount = this.entries.reduce((s, e) => s + e.g.n, 0);
    this.array = new Float32Array(this.segCount * 6);

    this.fill();
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(this.array);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 30);
    this.material = new LineMaterial({
      color: 0xf2f2ef,
      linewidth: 0.013,
      worldUnits: true,
    });
    this.mesh = new LineSegments2(geometry, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.buffer = geometry.attributes.instanceStart.data;
  }

  fill() {
    let o = 0;
    for (const { net, g } of this.entries) {
      const { pos } = net;
      const { ids, n } = g;
      for (let c = 0; c < n; c++) {
        const a = ids[c * 2] * 3, b = ids[c * 2 + 1] * 3;
        this.array[o++] = pos[a]; this.array[o++] = pos[a + 1]; this.array[o++] = pos[a + 2];
        this.array[o++] = pos[b]; this.array[o++] = pos[b + 1]; this.array[o++] = pos[b + 2];
      }
    }
  }

  update() {
    this.fill();
    this.buffer.array.set(this.array);
    this.buffer.needsUpdate = true;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
