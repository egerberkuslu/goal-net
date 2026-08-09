import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// The physics owns the sag (XPBD, elsewhere); this file owns how the result
// reads. Two draw calls, not one: the free-hanging mesh, and the "header" —
// the cords whose both ends are pinned to the frame (crossbar, stanchion
// corners, ground pegs, the post lacing on the side panels). A real net is
// bound to the frame with a doubled rope along exactly those points, and
// rendering them heavier and a shade lighter than the interior mesh is the
// visible difference between a net that is ATTACHED and one that just stops
// near the post. invMass === 0 at both ends is enough to find them without
// this file knowing anything about the frame's geometry — net.js already
// zeroes invMass at every point that is laced rather than hanging free, so
// the split falls out of data this module already reads.
//
// Not every caller hands over a real Net: the arena's ArenaNets wraps each
// net in a { pos, collidable } proxy that drops invMass (it never needed it
// before). Those nets fall back to one draw call, exactly as before this
// split existed, rather than throwing on a missing array.
function splitHeader(groups) {
  const interior = [];
  const header = [];
  for (const { net, g } of groups) {
    const { ids, n } = g;
    if (!net.invMass) {
      interior.push({ net, g });
      continue;
    }
    const iIds = [], hIds = [];
    for (let c = 0; c < n; c++) {
      const a = ids[c * 2], b = ids[c * 2 + 1];
      const pinned = net.invMass[a] === 0 && net.invMass[b] === 0;
      (pinned ? hIds : iIds).push(a, b);
    }
    if (iIds.length) interior.push({ net, g: { ids: iIds, n: iIds.length / 2 } });
    if (hIds.length) header.push({ net, g: { ids: hIds, n: hIds.length / 2 } });
  }
  return { interior, header };
}

// Injected into LineMaterial's unlit fragment shader. The 'line' ShaderLib
// has no lighting pass at all — cords are drawn at a flat diffuse colour
// plus fog — which is why the net used to read as a cutout pasted over the
// pitch rather than something hanging under the floodlights. A height-based
// tint is a cheap, camera-angle-safe stand-in for a lit look: it only ever
// reads world Y, so unlike a normal-space trick it cannot swim as the camera
// moves. The rope by the crossbar catches the lights; the skirt down by the
// ground sits in its own shadow.
function addDepthTint(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      'attribute vec3 instanceEnd;',
      'attribute vec3 instanceEnd;\nvarying float vWorldY;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'void main() {\n\tvWorldY = ( position.y < 0.5 ? '
      + '(modelMatrix * vec4( instanceStart, 1.0 )).y : (modelMatrix * vec4( instanceEnd, 1.0 )).y );',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'uniform float linewidth;',
      'uniform float linewidth;\nvarying float vWorldY;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, alpha );',
      'float depthTint = clamp( vWorldY / 2.6, 0.0, 1.0 );\n\t'
      + 'vec3 tinted = mix( diffuse * 0.72, diffuse, depthTint );\n\t'
      + 'vec4 diffuseColor = vec4( tinted, alpha );',
    );
  };
}

function buildLineMesh(scene, { color, linewidth, opacity }) {
  const geometry = new LineSegmentsGeometry();
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 30);
  const material = new LineMaterial({
    color,
    linewidth,
    worldUnits: true,
    // The net used to sit outside the weather: unlit white cords at full
    // strength while the pitch, the stands and the crowd all faded into the
    // night fog behind them, which is what turned it into white speckle from
    // the broadcast camera instead of a net hanging in the air.
    fog: true,
    // Fat lines are quads, and an 11 mm quad seen edge-on from thirty metres
    // aliases into a dotted line. Alpha-to-coverage hands the edges to MSAA
    // and costs nothing.
    alphaToCoverage: true,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  addDepthTint(material);
  // LineMaterial needs the drawing-buffer size to size its quads; it was
  // never set, so the shader worked off the (1, 1) default.
  material.resolution.set(
    typeof innerWidth === 'number' ? innerWidth : 1,
    typeof innerHeight === 'number' ? innerHeight : 1,
  );
  const mesh = new LineSegments2(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, material, geometry };
}

// Renders every collidable cord of every net as world-unit fat lines. Two
// draw calls: the mesh, and the header lacing that binds it to the frame
// (see splitHeader above). Both update their interleaved buffers in place
// each frame.
export class NetView {
  constructor(nets, scene) {
    const groups = nets.flatMap((net) => net.collidable.map((g) => ({ net, g })));
    const { interior, header } = splitHeader(groups);
    this.entries = interior;
    this.headerEntries = header;
    this.segCount = interior.reduce((s, e) => s + e.g.n, 0);
    this.headerSegCount = header.reduce((s, e) => s + e.g.n, 0);
    this.array = new Float32Array(this.segCount * 6);
    this.headerArray = new Float32Array(this.headerSegCount * 6);

    this.fill();

    const near = buildLineMesh(scene, { color: 0xe9edf2, linewidth: 0.011, opacity: 0.92 });
    this.mesh = near.mesh;
    this.material = near.material;
    near.geometry.setPositions(this.array);
    this.buffer = near.geometry.attributes.instanceStart.data;

    // Only build the header draw call if there is anything pinned to draw —
    // a net-less scene (or a future net topology with no laced points) just
    // gets the one mesh, same as before this file learned to split them.
    if (this.headerSegCount > 0) {
      const far = buildLineMesh(scene, { color: 0xcfd6de, linewidth: 0.019, opacity: 0.95 });
      this.headerMesh = far.mesh;
      this.headerMaterial = far.material;
      far.geometry.setPositions(this.headerArray);
      this.headerBuffer = far.geometry.attributes.instanceStart.data;
    } else {
      this.headerMesh = null;
    }

    this.onResize = () => {
      this.material.resolution.set(innerWidth, innerHeight);
      if (this.headerMaterial) this.headerMaterial.resolution.set(innerWidth, innerHeight);
    };
    if (typeof addEventListener === 'function') addEventListener('resize', this.onResize);
  }

  fill() {
    fillSegments(this.entries, this.array);
    if (this.headerSegCount > 0) fillSegments(this.headerEntries, this.headerArray);
  }

  update() {
    this.fill();
    this.buffer.array.set(this.array);
    this.buffer.needsUpdate = true;
    if (this.headerMesh) {
      this.headerBuffer.array.set(this.headerArray);
      this.headerBuffer.needsUpdate = true;
    }
  }

  dispose() {
    if (this.onResize && typeof removeEventListener === 'function') {
      removeEventListener('resize', this.onResize);
    }
    for (const m of [this.mesh, this.headerMesh]) {
      if (!m) continue;
      m.parent?.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

function fillSegments(entries, array) {
  let o = 0;
  for (const { net, g } of entries) {
    const { pos } = net;
    const { ids, n } = g;
    for (let c = 0; c < n; c++) {
      const a = ids[c * 2] * 3, b = ids[c * 2 + 1] * 3;
      array[o++] = pos[a]; array[o++] = pos[a + 1]; array[o++] = pos[a + 2];
      array[o++] = pos[b]; array[o++] = pos[b + 1]; array[o++] = pos[b + 2];
    }
  }
}
