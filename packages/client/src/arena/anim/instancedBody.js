// Drawing ten animated characters in four draw calls.
//
// This is the file that makes row #19 arithmetically possible. The budget in
// rendering-optimization.md is 50 draw calls on mobile for the WHOLE scene. A
// thirteen-part rig drawn the obvious way — one Mesh per limb, parented into a
// Group per player — is 130 draw calls before the pitch, the goals, the stands
// or the ball have drawn a single triangle. There is no amount of stadium
// optimisation that recovers from that.
//
// So the rig hierarchy in rig.js is used only to COMPOSE matrices, and the
// matrices are then poured into four InstancedMeshes keyed by unit primitive:
//
//   body   pelvis + chest          2 instances per player
//   head   head                    1
//   limb   arms, forearms,         8   (all four bone types are the same
//          thighs, shins               cylinder at different per-instance
//   boot   boots                   2    scales — that is the trick)
//
// 4 draw calls, 10 players, any number of poses. Per-instance colour carries
// the kit, so two teams and a keeper's contrasting shirt cost nothing extra.
//
// One skeleton object is reused for every player in turn: apply pose, read the
// world matrices out, write the instances, move to the next. Ten skeletons
// would be ten times the memory for no benefit, since nothing survives the
// frame.

import * as THREE from 'three';
import { PARTS, PARTS_PER_KEY, PART_KEYS, applyPoseToSkeleton, createSkeleton } from './rig.js';
import { JOINTS } from './pose.js';

/** Radial segments per limb. Low on purpose: these are 1.7 m tall and never
 *  fill more than a few hundred pixels. rendering-optimization.md caps the
 *  whole scene at 150k triangles and the players must not be most of it. */
const SEGMENTS = { limb: 7, head: [10, 7], body: 8 };

/** Build the four unit geometries. Each is centred on its own origin. */
export function buildPartGeometries(quality = {}) {
  const limbSeg = quality.limbSegments || SEGMENTS.limb;
  const headSeg = quality.headSegments || SEGMENTS.head;

  // limb: a slightly tapered cylinder of unit height along -Y..+Y, so the
  // per-instance Y scale is literally the bone length.
  const limb = new THREE.CylinderGeometry(0.85, 1.0, 1, limbSeg, 1, false);
  // body: a rounded box is too many triangles; an 8-sided prism reads as a
  // torso at this size and costs 32 triangles.
  const body = new THREE.CylinderGeometry(1, 1, 1, SEGMENTS.body, 1, false);
  const head = new THREE.SphereGeometry(1, headSeg[0], headSeg[1]);
  const boot = new THREE.BoxGeometry(1, 1, 1);
  return { limb, body, head, boot };
}

const TINTS = ['jersey', 'shorts', 'skin', 'boot'];

/**
 * The colour every part takes, per player. Kept here rather than in the rig so
 * the rig has no opinion about kits.
 */
export function playerPalette(slot, teamColors, helpers) {
  const { teamPalette, deriveKeeperColor, shade } = helpers;
  const pal = teamPalette(teamColors);
  const keeper = slot.role === 'keeper' || slot.role === 1;
  const team = slot.team | 0;
  return {
    jersey: keeper ? pal.keeper[team] : pal.jersey[team],
    shorts: keeper ? pal.keeperShorts[team] : pal.shorts[team],
    skin: 0xe8b98f,
    boot: keeper ? shade(deriveKeeperColor(pal.jersey[team]), -0.45) : 0x1a1a20,
  };
}

const _m = new THREE.Matrix4();
const _partLocal = new THREE.Matrix4();
const _color = new THREE.Color();

/**
 * All the players on the pitch, as four InstancedMeshes.
 */
export class InstancedBodies {
  /**
   * @param {THREE.Scene} scene
   * @param {object[]} slots roster slots
   * @param {object} opts { palettes, bodyScale, castShadow, material }
   */
  constructor(scene, slots, opts = {}) {
    this.scene = scene;
    this.count = slots.length;
    this.bodyScale = opts.bodyScale || 1;
    this.geometries = buildPartGeometries(opts.quality || {});
    this.material = opts.material || new THREE.MeshLambertMaterial({ vertexColors: false });
    this.ownsMaterial = !opts.material;
    this.skeleton = createSkeleton();
    this.jointOf = PARTS.map((p) => JOINTS.indexOf(p.joint));

    // Pre-baked local matrix for each part: its offset and its unit scale.
    // Constant for the life of the view, so it is composed once here and then
    // only ever multiplied by the bone's world matrix.
    this.partLocal = PARTS.map((p) => new THREE.Matrix4().compose(
      new THREE.Vector3(p.offset[0], p.offset[1], p.offset[2]),
      new THREE.Quaternion(),
      new THREE.Vector3(p.scale[0], p.scale[1], p.scale[2]),
    ));

    /** For each part key: the InstancedMesh, and the slot each part writes to. */
    this.meshes = Object.create(null);
    this.slotOfPart = new Int32Array(PARTS.length);
    const cursor = Object.create(null);
    for (const key of PART_KEYS) cursor[key] = 0;
    for (let i = 0; i < PARTS.length; i++) {
      const key = PARTS[i].part;
      this.slotOfPart[i] = cursor[key]++;
    }

    // T(world) . S(bodyScale), rebuilt per player per frame. The scale must sit
    // INSIDE the world translation, or the pitch coordinates get scaled along
    // with the character. See the note in animator.js evaluate().
    this.rootScale = new THREE.Matrix4().makeScale(this.bodyScale, this.bodyScale, this.bodyScale);
    this.rootWorld = new THREE.Matrix4();

    for (const key of PART_KEYS) {
      const per = PARTS_PER_KEY[key];
      const mesh = new THREE.InstancedMesh(this.geometries[key], this.material, per * this.count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false; // one bounding box for the whole pitch anyway
      mesh.name = `players:${key}`;
      // Per-instance colour: the kit, without a material per player.
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(per * this.count * 3), 3,
      );
      scene.add(mesh);
      this.meshes[key] = mesh;
    }

    // The primitives above are the shape this always had and the shape it falls
    // back to. Blender-authored versions of the same four unit meshes land
    // asynchronously and are swapped in when they arrive: an InstancedMesh's
    // geometry can be replaced outright, and the instance matrices and colours
    // are untouched by the swap because both obey the same unit box.
    if (opts.authoredParts !== false) this._loadAuthoredParts();

    this.palettes = opts.palettes || slots.map(() => ({
      jersey: 0xcccccc, shorts: 0x888888, skin: 0xe8b98f, boot: 0x222222,
    }));
    this._writeColors();
    this.visible = new Uint8Array(this.count).fill(1);
  }

  /** Swap the primitives for the authored parts once they load. Never throws
   *  and never blocks: a body drawn with cylinders is a fine body. */
  async _loadAuthoredParts() {
    let parts = null;
    try {
      parts = await loadAuthoredParts(THREE);
    } catch {
      parts = null;
    }
    if (!parts || this.disposed) return;
    for (const key of PART_KEYS) {
      const mesh = this.meshes[key];
      if (!mesh || !parts[key]) continue;
      const previous = this.geometries[key];
      mesh.geometry = parts[key];
      this.geometries[key] = parts[key];
      if (previous && previous !== parts[key]) previous.dispose();
    }
    this.authored = true;
  }

  _writeColors() {
    for (let player = 0; player < this.count; player++) {
      const pal = this.palettes[player] || {};
      for (let i = 0; i < PARTS.length; i++) {
        const key = PARTS[i].part;
        const mesh = this.meshes[key];
        const idx = this.slotOfPart[i] * this.count + player;
        _color.setHex((pal[PARTS[i].tint] ?? 0xcccccc) >>> 0);
        mesh.instanceColor.setXYZ(idx, _color.r, _color.g, _color.b);
      }
    }
    for (const key of PART_KEYS) this.meshes[key].instanceColor.needsUpdate = true;
  }

  /** Recolour one player in place, e.g. when a kit changes in the lobby. */
  setPalette(player, palette) {
    this.palettes[player] = palette;
    this._writeColors();
  }

  /**
   * Pour one player's pose into the instance buffers.
   * @param {number} player slot index
   * @param {Float64Array} pose
   * @param {number} x world position in metres
   * @param {number} z world position in metres
   */
  writePose(player, pose, x = 0, z = 0) {
    applyPoseToSkeleton(this.skeleton, pose);
    this.rootWorld.makeTranslation(x, 0, z).multiply(this.rootScale);
    const nodes = this.skeleton.nodes;
    for (let i = 0; i < PARTS.length; i++) {
      const bone = nodes[this.jointOf[i]];
      _partLocal.multiplyMatrices(bone.matrixWorld, this.partLocal[i]);
      _m.multiplyMatrices(this.rootWorld, _partLocal);
      const key = PARTS[i].part;
      const idx = this.slotOfPart[i] * this.count + player;
      this.meshes[key].setMatrixAt(idx, _m);
    }
  }

  /** Park a player's parts at the origin, scaled to nothing. Cheaper than a
   *  visibility flag, which InstancedMesh does not have per instance. */
  hide(player) {
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < PARTS.length; i++) {
      const idx = this.slotOfPart[i] * this.count + player;
      this.meshes[PARTS[i].part].setMatrixAt(idx, _m);
    }
  }

  /** Call once after every player has been written this frame. */
  flush() {
    for (const key of PART_KEYS) this.meshes[key].instanceMatrix.needsUpdate = true;
  }

  /** Draw calls this object is responsible for. Used by the budget report. */
  get drawCalls() { return PART_KEYS.length; }

  /** Triangles this object puts in the scene, for the budget report. */
  get triangles() {
    let total = 0;
    for (const key of PART_KEYS) {
      const geo = this.geometries[key];
      const tris = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
      total += tris * PARTS_PER_KEY[key] * this.count;
    }
    return total;
  }

  dispose() {
    this.disposed = true;
    for (const key of PART_KEYS) {
      const mesh = this.meshes[key];
      this.scene.remove(mesh);
      mesh.dispose();
    }
    for (const key of Object.keys(this.geometries)) this.geometries[key].dispose();
    if (this.ownsMaterial) this.material.dispose();
  }
}

export { TINTS };
