// Procedural geometry, with no three.js and no browser in sight.
//
// There is no Blender in this environment and no Mixamo download to retarget
// (brain/40-progress/HUMAN-QUEUE.md), so the stadium is AUTHORED IN CODE. That
// turns out to be a better deal than it sounds for a set of hard-edged low-poly
// blocks, on one condition: the same code has to produce the runtime scene and
// the exported GLB, or the "asset pipeline" is a second implementation that
// drifts from the first.
//
// Hence this file. It emits plain JavaScript arrays — positions, normals, uvs,
// colours, indices — and knows nothing about THREE.BufferGeometry or about
// @gltf-transform accessors. assets/stadium.js wraps the output in the former;
// tools/build-assets.mjs wraps the identical output in the latter. One source,
// two consumers, and the triangle count the test asserts is the triangle count
// that ships.
//
// COLOUR LIVES IN THE VERTICES
//
// Every static piece of the stadium is one merged mesh with one material,
// because a material per colour is a draw call per colour and row #19 has 50 of
// them for the entire scene on mobile. Vertex colours cost 12 bytes a vertex
// and buy an unlimited palette for free. glTF calls the same thing COLOR_0, so
// it survives the export intact.
//
// Coordinates are metres, +Y up, the pitch centred on the origin, the goals on
// +/-Z. That is the arena's own frame, taken from arena/units.js.

/** A growable soup of triangles that will become one mesh. */
export function createMeshBuilder(name = 'mesh') {
  return {
    name,
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
    indices: [],

    get vertexCount() { return this.positions.length / 3; },
    get triangleCount() { return this.indices.length / 3; },

    vertex(x, y, z, nx, ny, nz, u, v, c) {
      this.positions.push(x, y, z);
      this.normals.push(nx, ny, nz);
      this.uvs.push(u, v);
      this.colors.push(c[0], c[1], c[2]);
      return this.vertexCount - 1;
    },

    tri(a, b, c) { this.indices.push(a, b, c); },

    /** A flat quad, wound counter-clockwise seen from the normal's side. */
    quad(p0, p1, p2, p3, color, uv) {
      const n = faceNormal(p0, p1, p2);
      const t = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
      const a = this.vertex(p0[0], p0[1], p0[2], n[0], n[1], n[2], t[0][0], t[0][1], color);
      const b = this.vertex(p1[0], p1[1], p1[2], n[0], n[1], n[2], t[1][0], t[1][1], color);
      const c = this.vertex(p2[0], p2[1], p2[2], n[0], n[1], n[2], t[2][0], t[2][1], color);
      const d = this.vertex(p3[0], p3[1], p3[2], n[0], n[1], n[2], t[3][0], t[3][1], color);
      this.tri(a, b, c);
      this.tri(a, c, d);
    },

    /** Absorb another builder's triangles. This IS the merge step. */
    absorb(other) {
      const base = this.vertexCount;
      for (const v of other.positions) this.positions.push(v);
      for (const v of other.normals) this.normals.push(v);
      for (const v of other.uvs) this.uvs.push(v);
      for (const v of other.colors) this.colors.push(v);
      for (const i of other.indices) this.indices.push(base + i);
      return this;
    },

    /** Typed arrays, ready for a BufferGeometry or a glTF accessor. */
    build() {
      return {
        name: this.name,
        position: new Float32Array(this.positions),
        normal: new Float32Array(this.normals),
        uv: new Float32Array(this.uvs),
        color: new Float32Array(this.colors),
        index: this.vertexCount > 65535
          ? new Uint32Array(this.indices)
          : new Uint16Array(this.indices),
        vertexCount: this.vertexCount,
        triangleCount: this.triangleCount,
      };
    },
  };
}

function faceNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/** Hex to a linear-ish [r,g,b] triple. */
export function rgb(hex) {
  return [
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255,
  ];
}

/** An axis-aligned box. 12 triangles, the workhorse of the whole set. */
export function box(b, cx, cy, cz, sx, sy, sz, color) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2;
  const y0 = cy - sy / 2, y1 = cy + sy / 2;
  const z0 = cz - sz / 2, z1 = cz + sz / 2;
  b.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color); // top
  b.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color); // bottom
  b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color); // +z
  b.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color); // -z
  b.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color); // +x
  b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color); // -x
  return b;
}

/**
 * A raked terrace: a wedge whose top face slopes up and away from the pitch.
 * This is the shape that makes a stand read as a stand rather than as a wall.
 *
 * `axis` is 'x' for the touchline stands (they run along z) and 'z' for the
 * ends (they run along x). `away` is +1 or -1: which way is up-and-back.
 */
export function terrace(b, opts) {
  const {
    axis, away, near, depth, length, centre, front, back, color,
  } = opts;
  const far = near + depth * away;
  const along0 = centre - length / 2;
  const along1 = centre + length / 2;
  const P = axis === 'x'
    ? (across, y, along) => [across, y, along]
    : (across, y, along) => [along, y, across];

  const a = away > 0 ? 1 : -1;
  // top: the rake
  b.quad(
    P(near, front, along0), P(near, front, along1),
    P(far, back, along1), P(far, back, along0),
    color,
  );
  // the vertical face the crowd looks over
  b.quad(
    P(near, 0, along0 * a), P(near, 0, along1 * a),
    P(near, front, along1 * a), P(near, front, along0 * a),
    color,
  );
  // back wall and the two ends, so it is a closed solid from every angle
  b.quad(
    P(far, 0, along1 * a), P(far, 0, along0 * a),
    P(far, back, along0 * a), P(far, back, along1 * a),
    color,
  );
  box(b, ...(axis === 'x'
    ? [(near + far) / 2, front / 2, along0, Math.abs(depth), front, 0.12]
    : [along0, front / 2, (near + far) / 2, 0.12, front, Math.abs(depth)]), color);
  box(b, ...(axis === 'x'
    ? [(near + far) / 2, front / 2, along1, Math.abs(depth), front, 0.12]
    : [along1, front / 2, (near + far) / 2, 0.12, front, Math.abs(depth)]), color);
  return b;
}

/** A closed cylinder along Y. `segments` is the whole poly budget knob. */
export function cylinder(b, cx, cy, cz, rTop, rBottom, height, segments, color) {
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;
  const ring = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    ring.push([Math.cos(t), Math.sin(t)]);
  }
  for (let i = 0; i < segments; i++) {
    const [c0, s0] = ring[i];
    const [c1, s1] = ring[(i + 1) % segments];
    b.quad(
      [cx + c0 * rBottom, y0, cz + s0 * rBottom],
      [cx + c1 * rBottom, y0, cz + s1 * rBottom],
      [cx + c1 * rTop, y1, cz + s1 * rTop],
      [cx + c0 * rTop, y1, cz + s0 * rTop],
      color,
    );
  }
  // caps: a fan each
  const capTop = b.vertex(cx, y1, cz, 0, 1, 0, 0.5, 0.5, color);
  const capBot = b.vertex(cx, y0, cz, 0, -1, 0, 0.5, 0.5, color);
  for (let i = 0; i < segments; i++) {
    const [c0, s0] = ring[i];
    const [c1, s1] = ring[(i + 1) % segments];
    const t0 = b.vertex(cx + c0 * rTop, y1, cz + s0 * rTop, 0, 1, 0, 0, 0, color);
    const t1 = b.vertex(cx + c1 * rTop, y1, cz + s1 * rTop, 0, 1, 0, 1, 0, color);
    b.tri(capTop, t0, t1);
    const b0 = b.vertex(cx + c0 * rBottom, y0, cz + s0 * rBottom, 0, -1, 0, 0, 0, color);
    const b1 = b.vertex(cx + c1 * rBottom, y0, cz + s1 * rBottom, 0, -1, 0, 1, 0, color);
    b.tri(capBot, b1, b0);
  }
  return b;
}

/** A capsule-free tube between two points. Used for the goal frames. */
export function tube(b, from, to, radius, segments, color) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return b;
  const ax = dx / len, ay = dy / len, az = dz / len;
  // any vector not parallel to the axis, to build a frame from
  const upX = Math.abs(ay) > 0.9 ? 1 : 0;
  const upY = Math.abs(ay) > 0.9 ? 0 : 1;
  let rx = upY * az - 0 * ay;
  let ry = 0 * ax - upX * az;
  let rz = upX * ay - upY * ax;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  const sx = ay * rz - az * ry;
  const sy = az * rx - ax * rz;
  const sz = ax * ry - ay * rx;
  const at = (t, c, s) => [
    from[0] + ax * len * t + (rx * c + sx * s) * radius,
    from[1] + ay * len * t + (ry * c + sy * s) * radius,
    from[2] + az * len * t + (rz * c + sz * s) * radius,
  ];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    b.quad(at(0, c0, s0), at(0, c1, s1), at(1, c1, s1), at(1, c0, s0), color);
  }
  return b;
}

/**
 * A flat strip on the ground, for pitch markings. Width is in metres.
 *
 * The offset is +dz/-dx rather than the more natural -dz/+dx, and that sign is
 * load-bearing: it is what winds the quad counter-clockwise seen from ABOVE.
 * Wound the other way every pitch marking is back-facing, and since the
 * material is unlit and single-sided the entire set of touchlines, goal lines
 * and penalty areas simply does not draw — while the centre circle, which comes
 * from groundArc and happened to wind the other way, does. That asymmetry is
 * exactly what it looked like on screen, and no triangle count noticed.
 */
export function groundLine(b, x0, z0, x1, z1, width, y, color) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return b;
  const nx = dz / len * width / 2;
  const nz = -dx / len * width / 2;
  b.quad(
    [x0 - nx, y, z0 - nz], [x1 - nx, y, z1 - nz],
    [x1 + nx, y, z1 + nz], [x0 + nx, y, z0 + nz],
    color,
  );
  return b;
}

/** A flat ring on the ground: the centre circle and the D. */
export function groundArc(b, cx, cz, radius, width, y, segments, color, from = 0, to = Math.PI * 2) {
  const r0 = radius - width / 2;
  const r1 = radius + width / 2;
  for (let i = 0; i < segments; i++) {
    const a0 = from + (to - from) * (i / segments);
    const a1 = from + (to - from) * ((i + 1) / segments);
    b.quad(
      [cx + Math.cos(a0) * r0, y, cz + Math.sin(a0) * r0],
      [cx + Math.cos(a1) * r0, y, cz + Math.sin(a1) * r0],
      [cx + Math.cos(a1) * r1, y, cz + Math.sin(a1) * r1],
      [cx + Math.cos(a0) * r1, y, cz + Math.sin(a0) * r1],
      color,
    );
  }
  return b;
}

/** A textured quad, for the pitch and the advertising strips. */
export function texturedQuad(b, p0, p1, p2, p3, uv, color = [1, 1, 1]) {
  b.quad(p0, p1, p2, p3, color, uv);
  return b;
}
