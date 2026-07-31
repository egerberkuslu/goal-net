import {
  GOAL_W, GOAL_H, NET_TOP_DEPTH, NET_BOT_DEPTH, NET_CELL, NODE_MASS,
  COMPLIANCE_STRUCT, COMPLIANCE_SHEAR, COMPLIANCE_STITCH, STRAIN_LIMIT,
} from './constants.js';

// The net is one parametric main sheet (width columns x depth profile) draped
// from the crossbar over the back frame, plus two side panels stitched to the
// main sheet's edge columns. Solved with XPBD distance constraints.

function buildProfile() {
  // (z, y) polyline from crossbar back over the stanchion down to the ground pegs
  const pts = [
    { z: 0, y: GOAL_H },
    { z: -NET_TOP_DEPTH, y: GOAL_H - 0.1 },
    { z: -NET_BOT_DEPTH, y: 0 },
  ];
  const out = [];
  let kinkIndex = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s], b = pts[s + 1];
    const len = Math.hypot(b.z - a.z, b.y - a.y);
    const n = Math.max(1, Math.round(len / NET_CELL));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t });
    }
    if (s === 0) kinkIndex = out.length; // first point of the back slope
  }
  out.push({ z: pts[2].z, y: pts[2].y });
  return { profile: out, kinkIndex };
}

export class Net {
  // Built at the origin (goal line z=0, mouth facing +z, net draping to -z),
  // then transformed: worldZ = goalZ + sign * localZ. sign=-1 mirrors the net
  // so its mouth faces -z (the far goal).
  constructor({ goalZ = 0, sign = 1 } = {}) {
    this.goalZ = goalZ;
    this.sign = sign;
    const positions = [];
    const invMass = [];
    const addNode = (x, y, z, w) => {
      positions.push(x, y, z);
      invMass.push(w);
      return positions.length / 3 - 1;
    };

    const { profile, kinkIndex } = buildProfile();
    const NP = profile.length;
    const NW = Math.round(GOAL_W / NET_CELL);
    const halfW = GOAL_W / 2;

    // --- main sheet ---
    const mainIdx = []; // [j][i]
    for (let j = 0; j < NP; j++) {
      mainIdx.push([]);
      for (let i = 0; i <= NW; i++) {
        const x = -halfW + (GOAL_W * i) / NW;
        let w = 1 / NODE_MASS;
        if (j === 0) w = 0; // laced to the crossbar
        if (j === kinkIndex && (i === 0 || i === NW)) w = 0; // stanchion corners
        if (j === NP - 1 && i % 3 === 0) w = 0; // ground pegs on the back skirt
        mainIdx[j].push(addNode(x, profile[j].y, profile[j].z, w));
      }
    }

    const struct = []; // [i0, i1, rest]
    const shear = [];
    const stitch = [];
    const dist = (a, b) => {
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      return Math.hypot(bx - ax, by - ay, bz - az);
    };
    const link = (list, a, b, slack = 1.0) => list.push([a, b, dist(a, b) * slack]);

    for (let j = 0; j < NP; j++) {
      for (let i = 0; i <= NW; i++) {
        if (i < NW) link(struct, mainIdx[j][i], mainIdx[j][i + 1]);
        if (j < NP - 1) link(struct, mainIdx[j][i], mainIdx[j + 1][i]);
        if (i < NW && j < NP - 1) link(shear, mainIdx[j][i], mainIdx[j + 1][i + 1]);
      }
    }

    // --- side panels ---
    // Vertical plane x = ±halfW between the post (z=0) and the profile curve.
    const yTopAt = (z) => {
      if (z >= -NET_TOP_DEPTH) {
        const t = -z / NET_TOP_DEPTH;
        return GOAL_H + (GOAL_H - 0.1 - GOAL_H) * t;
      }
      const t = (-z - NET_TOP_DEPTH) / (NET_BOT_DEPTH - NET_TOP_DEPTH);
      return (GOAL_H - 0.1) * (1 - t);
    };
    const edgeColumn = (side) => mainIdx.map((row) => row[side < 0 ? 0 : NW]);

    for (const side of [-1, 1]) {
      const x = side * halfW;
      const NZ = Math.round(NET_BOT_DEPTH / NET_CELL);
      const cols = [];
      for (let k = 0; k <= NZ; k++) {
        const z = -(NET_BOT_DEPTH * k) / NZ;
        const yTop = yTopAt(z);
        const nRows = Math.floor(yTop / NET_CELL);
        if (k > 0 && nRows < 1) { cols.push([]); continue; }
        const col = [];
        for (let r = 0; r <= nRows; r++) {
          const y = Math.min(r * NET_CELL, yTop);
          let w = 1 / NODE_MASS;
          if (k === 0) w = 0; // laced to the post
          if (r === 0 && k % 2 === 0) w = 0; // ground pegs
          col.push(addNode(x, y === 0 ? 0.012 : y, z, w));
        }
        cols.push(col);
      }
      for (let k = 0; k < cols.length; k++) {
        const col = cols[k];
        for (let r = 0; r < col.length; r++) {
          if (r < col.length - 1) link(struct, col[r], col[r + 1]);
          const next = cols[k + 1];
          if (next && next[r] !== undefined) {
            link(struct, col[r], next[r]);
            if (r < col.length - 1 && next[r + 1] !== undefined) {
              link(shear, col[r], next[r + 1]);
            }
          }
        }
      }
      // stitch each column's top knot to the nearest main-sheet edge knot
      const edge = edgeColumn(side);
      for (let k = 1; k < cols.length; k++) {
        const col = cols[k];
        if (!col.length) continue;
        const top = col[col.length - 1];
        let best = edge[0], bestD = Infinity;
        for (const e of edge) {
          const d = dist(top, e);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (bestD < NET_CELL * 1.8) link(stitch, top, best);
      }
    }

    const N = positions.length / 3;
    for (let i = 0; i < N; i++) {
      positions[i * 3 + 2] = goalZ + sign * positions[i * 3 + 2];
    }
    this.count = N;
    this.pos = new Float32Array(positions);
    this.prev = new Float32Array(positions);
    this.vel = new Float32Array(N * 3);
    this.invMass = new Float32Array(invMass);

    const pack = (list) => ({
      ids: new Int32Array(list.flatMap(([a, b]) => [a, b])),
      rest: new Float32Array(list.map(([, , r]) => r)),
      n: list.length,
    });
    this.struct = pack(struct);
    this.shear = pack(shear);
    this.stitch = pack(stitch);
    // segments the ball can touch and that get rendered as cords
    this.collidable = [this.struct, this.stitch];
  }

  integrate(h, time) {
    const { pos, prev, vel, invMass, count } = this;
    const damp = Math.exp(-2.2 * h);
    for (let i = 0; i < count; i++) {
      if (invMass[i] === 0) continue;
      const o = i * 3;
      vel[o + 1] -= 9.81 * h;
      // gentle ambient breeze so the net idles alive
      vel[o + 2] += 0.05 * Math.sin(time * 0.8 + pos[o] * 0.9) * h;
      vel[o] *= damp; vel[o + 1] *= damp; vel[o + 2] *= damp;
      prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
      pos[o] += vel[o] * h;
      pos[o + 1] += vel[o + 1] * h;
      pos[o + 2] += vel[o + 2] * h;
    }
  }

  solveGroup(group, compliance, h) {
    const { pos, invMass } = this;
    const alpha = compliance / (h * h);
    const { ids, rest, n } = group;
    for (let c = 0; c < n; c++) {
      const a = ids[c * 2], b = ids[c * 2 + 1];
      const wa = invMass[a], wb = invMass[b];
      const wSum = wa + wb;
      if (wSum === 0) continue;
      const oa = a * 3, ob = b * 3;
      const dx = pos[ob] - pos[oa];
      const dy = pos[ob + 1] - pos[oa + 1];
      const dz = pos[ob + 2] - pos[oa + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-9) continue;
      const corr = (d - rest[c]) / (d * (wSum + alpha));
      const cx = dx * corr, cy = dy * corr, cz = dz * corr;
      pos[oa] += cx * wa; pos[oa + 1] += cy * wa; pos[oa + 2] += cz * wa;
      pos[ob] -= cx * wb; pos[ob + 1] -= cy * wb; pos[ob + 2] -= cz * wb;
    }
  }

  solveConstraints(h) {
    this.solveGroup(this.struct, COMPLIANCE_STRUCT, h);
    this.solveGroup(this.stitch, COMPLIANCE_STITCH, h);
    this.solveGroup(this.shear, COMPLIANCE_SHEAR, h);
  }

  // Hard strain limiter: cords are knotted nylon, they simply do not stretch
  // far. Rigidly projects any cord beyond STRAIN_LIMIT back to the cap, which
  // is what keeps a fast ball from opening a hole in the mesh.
  limitStrain() {
    const { pos, invMass } = this;
    for (const group of [this.struct, this.stitch]) {
      const { ids, rest, n } = group;
      for (let c = 0; c < n; c++) {
        const a = ids[c * 2], b = ids[c * 2 + 1];
        const wa = invMass[a], wb = invMass[b];
        const wSum = wa + wb;
        if (wSum === 0) continue;
        const oa = a * 3, ob = b * 3;
        const dx = pos[ob] - pos[oa];
        const dy = pos[ob + 1] - pos[oa + 1];
        const dz = pos[ob + 2] - pos[oa + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const cap = rest[c] * STRAIN_LIMIT;
        if (d <= cap || d < 1e-9) continue;
        const corr = (d - cap) / (d * wSum);
        const cx = dx * corr, cy = dy * corr, cz = dz * corr;
        pos[oa] += cx * wa; pos[oa + 1] += cy * wa; pos[oa + 2] += cz * wa;
        pos[ob] -= cx * wb; pos[ob + 1] -= cy * wb; pos[ob + 2] -= cz * wb;
      }
    }
  }

  collideGround() {
    const { pos, prev, invMass, count } = this;
    for (let i = 0; i < count; i++) {
      if (invMass[i] === 0) continue;
      const o = i * 3;
      if (pos[o + 1] < 0.012) {
        pos[o + 1] = 0.012;
        // strong ground friction: cords don't slide on grass
        prev[o] += (pos[o] - prev[o]) * 0.9;
        prev[o + 2] += (pos[o + 2] - prev[o + 2]) * 0.9;
      }
    }
  }

  updateVelocities(h) {
    const { pos, prev, vel, invMass, count } = this;
    const inv = 1 / h;
    for (let i = 0; i < count; i++) {
      if (invMass[i] === 0) continue;
      const o = i * 3;
      vel[o] = (pos[o] - prev[o]) * inv;
      vel[o + 1] = (pos[o + 1] - prev[o + 1]) * inv;
      vel[o + 2] = (pos[o + 2] - prev[o + 2]) * inv;
    }
  }
}
