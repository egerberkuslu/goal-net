// One object that owns every player's animation and every player's pixels.
//
// ArenaView holds exactly one of these and calls update() once a frame. It is
// the seam between "what the core says" and "what is on screen", and it is the
// only place in this directory that touches the scene graph.

import * as THREE from 'three';
import {
  DEFAULT_TEAM_COLORS, deriveKeeperColor, sanitizeName, shade, teamPalette,
} from '../../view/playerView.js';
import { InstancedBodies, playerPalette } from './instancedBody.js';
import { PlayerAnimator } from './animator.js';
import { createPose } from './pose.js';

const TAG_Y = 2.16;
const TAG_WORLD_W = 1.1;

/** Distance in metres past which a name tag is not worth a draw call. */
const TAG_CULL_M = 34;

function makeNameSprite(name) {
  if (typeof document === 'undefined') return null;
  const W = 256;
  const H = 72;
  const pad = 10;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, W, H);
  ctx.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textW = Math.min(W - pad * 2, ctx.measureText(name).width + 34);
  const pillW = Math.max(64, textW);
  const pillH = H - pad * 2;
  ctx.fillStyle = 'rgba(12,16,22,0.72)';
  ctx.beginPath();
  const r = pillH / 2;
  const x = (W - pillW) / 2;
  ctx.moveTo(x + r, pad);
  ctx.arcTo(x + pillW, pad, x + pillW, pad + pillH, r);
  ctx.arcTo(x + pillW, pad + pillH, x, pad + pillH, r);
  ctx.arcTo(x, pad + pillH, x, pad, r);
  ctx.arcTo(x, pad, x + pillW, pad, r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, W / 2, H / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: true, depthWrite: false,
  }));
  sprite.scale.set(TAG_WORLD_W, TAG_WORLD_W * (H / W), 1);
  sprite.renderOrder = 5;
  return sprite;
}

/**
 * Every player on the pitch: an animator each, one shared instanced body, and
 * the charge rings and name tags that hang off them.
 */
export class AnimRoster {
  /**
   * @param {THREE.Scene} scene
   * @param {object[]} slots roster slots
   * @param {object} opts { teamColors, bodyScale, toMetres, quality }
   */
  constructor(scene, slots, opts = {}) {
    this.scene = scene;
    this.slots = slots;
    this.quality = opts.quality || {};
    this.bodyScale = opts.bodyScale || 1;
    const toMetres = opts.toMetres || ((u) => u);

    this.animators = slots.map((slot) => new PlayerAnimator(slot, { toMetres }));
    this.poses = slots.map(() => createPose());

    const helpers = { teamPalette, deriveKeeperColor, shade };
    const palettes = slots.map((slot) => playerPalette(slot, opts.teamColors || DEFAULT_TEAM_COLORS, helpers));
    this.bodies = new InstancedBodies(scene, slots, {
      palettes,
      bodyScale: this.bodyScale,
      quality: this.quality,
      castShadow: this.quality.playerShadows !== false,
    });

    // Charge rings: one InstancedMesh for the whole pitch, one draw call, and
    // a zero scale where no one is charging.
    const ringGeo = new THREE.RingGeometry(0.42, 0.50, this.quality.ringSegments || 20);
    ringGeo.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }),
      slots.length,
    );
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rings.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(slots.length * 3), 3,
    );
    this.rings.frustumCulled = false;
    this.rings.name = 'players:rings';
    const c = new THREE.Color();
    for (let i = 0; i < slots.length; i++) {
      c.setHex(palettes[i].jersey >>> 0);
      this.rings.instanceColor.setXYZ(i, c.r, c.g, c.b);
    }
    this.rings.instanceColor.needsUpdate = true;
    scene.add(this.rings);

    // Name tags are sprites: one draw call each, so they are the first thing
    // culled when the tier is tight. See quality.js.
    this.tagsEnabled = this.quality.nameTags !== false;
    this.tags = slots.map((slot) => {
      if (!this.tagsEnabled) return null;
      const name = sanitizeName(slot.name || slot.mpName || '');
      if (!name) return null;
      const sprite = makeNameSprite(name);
      if (sprite) {
        // The label sits over a body scaled onto the core's collision radius,
        // so it has to grow with it or it reads as a speck at the player's feet.
        const s = Math.max(1, this.bodyScale * 0.8);
        sprite.scale.multiplyScalar(s);
        scene.add(sprite);
      }
      return sprite;
    });

    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  /** Re-seed every animator from the next frame, dropping stale edge state.
   *  Used when the picture cuts (a replay starting or ending). */
  reseed() {
    for (const a of this.animators) a.seeded = false;
  }

  /**
   * One frame.
   * @param {number} dt
   * @param {object} state a readState() or a sample()
   * @param {object} ctx { goal, inBox, cameraPos }
   */
  update(dt, state, ctx = {}) {
    const players = state.players || [];
    for (let i = 0; i < this.animators.length; i++) {
      const a = this.animators[i];
      const p = players[i];
      if (!p) { this.bodies.hide(i); continue; }
      a.advance(dt, p, {
        ball: state.ball,
        goal: ctx.goal,
        inBox: ctx.inBox ? ctx.inBox(i, p) : undefined,
      });
      a.evaluate(this.poses[i]);
      this.bodies.writePose(i, this.poses[i], a.x, a.z);
    }
    this.bodies.flush();
    this._updateRings();
    this._updateTags(ctx.cameraPos);
  }

  _updateRings() {
    let any = false;
    for (let i = 0; i < this.animators.length; i++) {
      const a = this.animators[i];
      const charge = Math.max(a.charge01, a.clear01);
      if (charge > 0.02 && a.machine.current !== 'celebrate' && a.machine.current !== 'dejected') {
        const s = (1 + charge * 0.5) * this.bodyScale;
        this._v.set(a.x, 0.035, a.z);
        this._s.set(s, 1, s);
        this._m.compose(this._v, this._q.identity(), this._s);
        any = true;
      } else {
        this._m.makeScale(0, 0, 0);
      }
      this.rings.setMatrixAt(i, this._m);
    }
    this.rings.instanceMatrix.needsUpdate = true;
    this.rings.visible = any;
  }

  _updateTags(cameraPos) {
    if (!this.tagsEnabled) return;
    const limit = (this.quality.tagCullMetres || TAG_CULL_M);
    for (let i = 0; i < this.tags.length; i++) {
      const tag = this.tags[i];
      if (!tag) continue;
      const a = this.animators[i];
      const st = a.machine.current;
      // No label on a body that is on the floor: the sprite does not tumble
      // with it and a name hovering over a prone keeper looks like a bug.
      const grounded = st === 'slide' || st === 'keeperDive' || st === 'keeperGetUp';
      let visible = !grounded;
      if (visible && cameraPos) {
        const d = Math.hypot(a.x - cameraPos.x, a.z - cameraPos.z);
        visible = d <= limit;
      }
      tag.visible = visible;
      if (visible) tag.position.set(a.x, TAG_Y * this.bodyScale, a.z);
    }
  }

  /** Where a player is, in metres. The camera's `me` needs this. */
  actor(index) {
    const a = this.animators[index];
    return a ? { x: a.x, z: a.z, facing: a.facing, speed: a.speed } : null;
  }

  /** Draw calls this roster is responsible for, for the budget report. */
  get drawCalls() {
    return this.bodies.drawCalls
      + (this.rings.visible ? 1 : 0)
      + this.tags.reduce((n, t) => n + (t && t.visible ? 1 : 0), 0);
  }

  get triangles() { return this.bodies.triangles; }

  dispose() {
    this.bodies.dispose();
    this.scene.remove(this.rings);
    this.rings.geometry.dispose();
    this.rings.material.dispose();
    this.rings.dispose();
    for (const tag of this.tags) {
      if (!tag) continue;
      tag.parent?.remove(tag);
      tag.material.map?.dispose();
      tag.material.dispose();
    }
  }
}
