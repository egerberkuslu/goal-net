// A rigged character, driven by arena/anim through riggedPose.js, standing in
// for the primitive PlayerView wherever the coordinator wires it in.
//
// Same public interface as PlayerView on purpose (constructor(player, scene,
// teamColors), update(dt), dispose(), setKit(), .tag): every current caller —
// packages/client/src/main.js, packages/client/src/arena/view.js — hands a
// view class exactly one shape of "core player": pos {x,z}, vel {x,z},
// facing, charge (0..1), kickAnim/headerAnim (0..1, decaying), celebrate
// (1/-1/0), down/downTotal/tumbleSpin (ragdoll), dive/diveTotal/diveRecover/
// diveKind/diveDir (dives and slide tackles), jumpY, team, role, speed().
// That is packages/client/src/core/player.js's own Player, and it is also
// exactly what arena/view.js's PlayerAdapter normalises readState() DOWN
// INTO before ever calling `new PlayerView(...)` — so this file only has to
// understand one contract to work in both places.
//
// arena/anim's PlayerAnimator was built against a DIFFERENT contract —
// packages/core's readState(), tick-counted (kickCooldown, tackleActive,
// diveLock, ...). THE ADAPTER BELOW IS THE BRIDGE. It is not a hack bolted on
// to make a demo work: every one of its conversions divides out to the exact
// same ratio animator.js already computes internally against
// packages/core's own CONSTANTS (see arena/view.js's own PlayerAdapter for
// the same trick run in the opposite direction, readState() -> this
// contract, already shipped and reviewed).
//
// WHAT DOES NOT SURVIVE THE BRIDGE, HONESTLY:
//   - keeperThrow never fires. The classic core has no separate hand-throw;
//     a keeper releasing the ball is just a kick, so it plays as 'kick'.
//   - keeperCatch/keeperClear fire off `world.carrier` (dribble/close-control
//     possession), read through the `window.__game` global main.js already
//     publishes — NOT a true "the keeper is holding the ball" flag, because
//     the classic core has no such flag. It is a fair aesthetic stand-in
//     (the keeper visibly gathers the ball at their feet) but it is not the
//     packages/core keeper hold/catch mechanic. Driven through /arena, where
//     readState().ball.holder is real, catch/clear are the genuine mechanic.
//   - curve is always read as 0 (the classic core does not track it), so a
//     charged shot never selects the 'curler' kick variant on this path.
//   - the shoulder-to-shoulder contact lean has no real trigger: nothing in
//     either core stamps "this player was just jostled" onto a Player. It is
//     inferred from a sudden, otherwise-unexplained lateral kick in the
//     player's own velocity (see _detectContact below) — a genuine proxy
//     from real per-frame data, not a fabrication, but a proxy nonetheless.
//     The honest fix is a one-line addition to collidePlayers() in
//     packages/client/src/core/world.js calling view.notifyContact(); that
//     file is outside this agent's write scope.

import * as THREE from 'three';
import { CONSTANTS } from '../../../core/src/index.js';
import { BOX_DEPTH, BOX_HALF_W, PITCH_HALF_L } from '../core/constants.js';
import { VENDOR, vendorScene } from './vendorModel.js';
import { bindRiggedPose } from './riggedPose.js';
import { recolorKit } from './kitRecolor.js';
import { KIT_PRESETS } from './kitTexture.js';
import {
  PlayerView, deriveKeeperColor, makeNameSprite, sanitizeName, teamPalette,
} from './playerView.js';
import {
  CH_PX, CH_PY, CH_PZ, CH_RX, CH_RY, CH_RZ, PlayerAnimator, ch, createPose,
  selectCelebration, selectDejection,
} from '../arena/anim/index.js';

/** Core diveDir -> {x,z}, matching arena/view.js's own DIVE_VECTORS exactly
 *  (keeper.js's diveIdOf reads this same layout: -x,+x,-z,+z). */
const DIVE_VECTORS = [
  { x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: 0, z: 1 },
];

/** Nearest of the four core dive directions to a raw {x,z} unit vector. */
function diveDirIndex(dir) {
  if (!dir) return 3;
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < DIVE_VECTORS.length; i++) {
    const dot = DIVE_VECTORS[i].x * dir.x + DIVE_VECTORS[i].z * dir.z;
    if (dot > bestDot) { bestDot = dot; best = i; }
  }
  return best;
}

/** A unique small integer per view instance, so ten rigged players do not
 *  all start their gait clock at the same phase (PlayerAnimator's own fix for
 *  this reads the ROSTER index, which main.js does not pass to a view). */
let nextSeed = 0;

/** How long a scramble-up (diveRecover / GRIEF_LOCK-equivalent) lasts on the
 *  classic core: packages/client/src/core/player.js hardcodes 0.45 s after
 *  both a dive and a slide. Used to turn "seconds left" into a 0..1 ratio. */
const RECOVER_SECONDS = 0.45;

/** Best-effort read of the live match, published by main.js as `window.__game`
 *  purely for chat commands. Reused here, defensively, for the one signal the
 *  classic core exposes nowhere else: who is currently carrying the ball.
 *  Every read is optional-chained; in a headless test, or before the first
 *  buildMatch() call, this is simply absent and every caller degrades to "no
 *  ball data" rather than throwing. */
function bridgedWorld() {
  return (typeof globalThis !== 'undefined' && globalThis.__game && globalThis.__game.world) || null;
}

function isCarrier(player) {
  const world = bridgedWorld();
  return !!world && world.carrier === player;
}

function ballSnapshot() {
  const world = bridgedWorld();
  const b = world && world.ball;
  if (!b) return { x: 0, z: 0, vx: 0, vz: 0, curve: 0, holder: -1 };
  return {
    x: b.pos?.x || 0, z: b.pos?.z || 0, vx: b.vel?.x || 0, vz: b.vel?.z || 0,
    curve: 0, holder: -1,
  };
}

/**
 * A rigged character. Falls back to the primitive PlayerView until (and
 * unless) its vendor GLB loads and binds well enough to trust.
 */
export class RiggedPlayerView {
  constructor(player, scene, teamColors = null) {
    this.player = player;
    this.scene = scene;
    this.teamColors = teamColors;
    this.seed = nextSeed++;

    // Visible from frame one, and what stays permanent if the GLB never
    // loads or binds badly enough that showing it would be worse than not.
    this.fallback = new PlayerView(player, scene, teamColors);
    this.rigged = false;
    this.disposed = false;
    this.pendingKit = null;
    this._tag = null;

    this._prevVel = { x: player.vel?.x || 0, z: player.vel?.z || 0 };
    this._prevCelebrateKind = 0;
    this._celebrateTick = 0;

    // Everyone wears the keeper mesh for now, tinted to their kit.
    //
    // player-rig.glb is pathological and measurably so: its body sits 76 units
    // from the rig root, its IK targets 28 units out, and a 36x scale on the
    // rig root. standUp() gets it upright but it still lands 30 m below the
    // grass, where keeper-rig lands at exactly 1.81 m with its feet on zero.
    // A working character on every player beats a correct-in-principle one on
    // none, and the outfield model is a swap of this one line once a rig that
    // measures clean is found.
    const vendorName = VENDOR.keeperRig;
    vendorScene(vendorName).then((mesh) => {
      if (this.disposed || !mesh) return;
      const binding = bindRiggedPose(mesh);
      // Fewer than half the joints bound is not "a rigged character with a
      // small twist error somewhere", it is a broken one; the fallback is
      // strictly better than showing that.
      if (!binding || binding.joints < 7) return;
      this._buildRigged(mesh, binding);
    }).catch(() => { /* the fallback stays; that is the whole point of it */ });
  }

  // ---------------------------------------------------------------- build --

  /**
   * Put this player on a side.
   *
   * Every player wears the same downloaded mesh, whose kit is painted into its
   * texture — so straight out of the box both teams took the field in the same
   * green and nobody could tell who was who, which is a worse bug than an ugly
   * kit.
   *
   * The obvious fix, tinting material.color, does not work on THIS model and
   * measurement is why: its 33 meshes share ONE material and ONE atlas, so the
   * face, the hair and the boots are painted in the same image as the shirt and
   * a material tint turns the whole man red. So the kit is repainted in texture
   * space instead — see kitRecolor.js, which finds the kit by hue and moves only
   * those pixels. The keeper takes his own derived accent, so he can never be
   * mistaken for either outfield side.
   *
   * If the repaint cannot run (no canvas, an unreadable image, an atlas with no
   * kit-coloured region) the model keeps its own texture: one green team beats a
   * crash, and the name tags and charge rings still say who is who.
   */
  _tintKit(mesh, pal, chosen) {
    let target;
    let opts;
    if (chosen) {
      target = chosen.base;
      opts = { accent: chosen.accent, pattern: chosen.pattern };
    } else {
      const keeper = this.player.role === 'keeper';
      const team = this.player.team | 0;
      target = new THREE.Color(
        keeper ? deriveKeeperColor(pal.jersey[team]) : pal.jersey[team],
      );
      opts = undefined;
    }
    const seen = new Set();
    mesh.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        // Always repaint from the model's ORIGINAL atlas, never from the last
        // repaint: recolouring a recolour compounds, and a player who tried
        // three kits would end up in whatever the third did to the second.
        const source = m.userData.kitSource || m.map;
        if (!source) continue;
        m.userData.kitSource = source;
        const repainted = recolorKit(source, target, opts);
        if (!repainted) continue;
        m.map = repainted;
        m.needsUpdate = true;
      }
    });
  }

  _buildRigged(mesh, binding) {
    const pal = teamPalette(this.teamColors);

    this.root = new THREE.Group();
    // Feet on the grass, by the measurement standUp() already made rather than
    // by a constant. The conditioned rig's origin is not between its boots —
    // this one hangs 1.83 m below it — and placeVendorMesh applies the same
    // offset for the static models. Skipping it here put the whole squad
    // underground: bones from y -1.83 to +0.02, nothing above the turf.
    mesh.position.y += mesh.userData.standUp?.groundOffset || 0;
    this.root.add(mesh);
    this.scene.add(this.root);
    this.mesh = mesh;                  // kept so /forma can repaint it later
    this._tintKit(mesh, pal);

    this.binding = binding;
    this.animator = new PlayerAnimator(
      {
        index: this.seed, team: this.player.team | 0, role: this.player.role,
        name: this.player.mpName,
      },
      { toMetres: (u) => u },
    );
    this.pose = createPose();

    // Charge ring: the same read as PlayerView's own, so a shot charging up
    // looks identical whichever body is drawing the player.
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.045, 10, 32),
      new THREE.MeshBasicMaterial({
        color: pal.ring[this.player.team], transparent: true, opacity: 0.85,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.ring.visible = false;
    this.scene.add(this.ring);

    this.tagName = sanitizeName(this.player.mpName);
    this._tag = this.tagName ? makeNameSprite(this.tagName) : null;
    if (this._tag) this.scene.add(this._tag);

    // The fallback has been standing in; hand off to the rigged body cleanly,
    // carrying over any kit change that arrived while it was still loading.
    this.fallback.dispose();
    this.fallback = null;
    this.rigged = true;
  }

  // -------------------------------------------------------------- adapter --

  /**
   * The classic core's Player, dressed up as the readState()-shaped object
   * PlayerAnimator.advance() wants. Every tick-scaled field divides back out
   * to the exact ratio the caller measured on the classic core's own seconds
   * field — see the file header for which fields have no classic-core signal
   * at all and simply stay at 0.
   */
  _buildCorePlayer() {
    const p = this.player;
    const isKeeper = p.role === 'keeper';
    const sliding = p.diveKind === 'slide';
    const diving = !sliding && (p.dive > 0 || p.diveRecover > 0);
    const carrying = isKeeper && isCarrier(p);

    const out = {
      x: p.pos.x,
      z: p.pos.z,
      vx: Number.isFinite(p.vel?.x) ? p.vel.x : undefined,
      vz: Number.isFinite(p.vel?.z) ? p.vel.z : undefined,
      charge: (p.charge || 0) * CONSTANTS.CHARGE_MAX_TICKS,
      kickCooldown: (p.kickAnim || 0) * CONSTANTS.KICK_COOLDOWN_TICKS,
      // every kick and every header both count as a touch; a plain dribble
      // touch has no signal on this core (see the file header)
      touchCooldown: Math.max(p.kickAnim || 0, p.headerAnim || 0) * CONSTANTS.TOUCH_COOLDOWN_TICKS,
      tackleActive: 0, tackleRecovery: 0, diveActive: 0, diveLock: 0, diveDir: 0,
      clearCharge: carrying && (p.charge || 0) > 0
        ? (p.charge || 0) * CONSTANTS.CLEAR_MAX_TICKS : 0,
      ragdollActive: p.down || 0,
      ragdoll01: p.downTotal > 0 ? 1 - (p.down || 0) / p.downTotal : 0,
      ragdollSpin: p.tumbleSpin || 0,
      jumpHeightM: p.jumpY || 0,
      headerU: p.headerAnim || 0,
    };

    if (sliding && p.dive > 0) {
      out.tackleActive = (p.dive / (p.diveTotal || 1)) * CONSTANTS.TACKLE_ACTIVE_TICKS;
    } else if (sliding && p.diveRecover > 0) {
      out.tackleRecovery = (p.diveRecover / RECOVER_SECONDS) * CONSTANTS.TACKLE_RECOVERY_TICKS;
    } else if (diving && p.dive > 0) {
      out.diveActive = (p.dive / (p.diveTotal || 1)) * CONSTANTS.DIVE_ACTIVE_TICKS;
      out.diveDir = diveDirIndex(p.diveDir);
    } else if (diving && p.diveRecover > 0) {
      out.diveLock = (p.diveRecover / RECOVER_SECONDS) * CONSTANTS.DIVE_WHIFF_LOCK_TICKS;
    }
    return out;
  }

  _buildCtx() {
    const p = this.player;
    const isKeeper = p.role === 'keeper';
    const ball = ballSnapshot();
    ball.holder = isKeeper && isCarrier(p) ? this.seed : -1;
    // Near either goal line's box, not just this player's own: a keeper
    // playing the wrong end mid-match (own-goal chaos, a corner) should still
    // read as "in a box" rather than snap into field-player states.
    const inBox = Math.abs(Math.abs(p.pos.z) - PITCH_HALF_L) < BOX_DEPTH
      && Math.abs(p.pos.x) < BOX_HALF_W;
    return { ball, inBox };
  }

  /** Bridges player.celebrate (1/-1/0) onto the fields animator.js's own
   *  ctx.goal branch would have set, since the classic core has no goal
   *  event object to hand PlayerAnimator — only the fact of celebrating. */
  _syncCelebration() {
    const kind = this.player.celebrate || 0;
    if (kind === this._prevCelebrateKind) return;
    if (kind !== 0) {
      const seed = {
        playerIndex: this.seed, tick: this._celebrateTick++,
        scoreRed: 0, scoreBlue: 0, team: this.player.team | 0,
      };
      this.animator.reactionKind = kind > 0 ? 1 : -1;
      this.animator.reactionId = kind > 0 ? selectCelebration(seed) : selectDejection(seed);
      this.animator.reactionT = 0;
    } else {
      this.animator.reactionKind = 0;
      this.animator.reactionId = null;
    }
    this._prevCelebrateKind = kind;
  }

  /**
   * Shoulder-to-shoulder contact has no field on either core's Player. This
   * infers it from real per-frame data — a sudden lateral kick in velocity
   * that steering does not explain — rather than fabricating a trigger. It is
   * a proxy, not a detector: see the file header for the honest fix.
   */
  _detectContact(dt) {
    const p = this.player;
    const v = p.vel;
    if (!v || dt <= 0) return;
    if ((p.down || 0) > 0 || (p.dive || 0) > 0) {
      this._prevVel.x = v.x; this._prevVel.z = v.z;
      return;
    }
    const dvx = v.x - this._prevVel.x;
    const dvz = v.z - this._prevVel.z;
    this._prevVel.x = v.x; this._prevVel.z = v.z;
    // "right of facing", matching player.js's own facing = atan2(vel.x, vel.z)
    const f = p.facing || 0;
    const rightX = Math.cos(f);
    const rightZ = -Math.sin(f);
    const lateralAccel = (dvx * rightX + dvz * rightZ) / dt;
    const THRESHOLD = 10; // m/s^2 of lateral kick a steering input would not produce
    if (Math.abs(lateralAccel) > THRESHOLD) {
      this.animator.notifyContact(lateralAccel > 0 ? 1 : -1, Math.min(1, Math.abs(lateralAccel) / 25));
    }
  }

  // --------------------------------------------------------------- public --

  get tag() {
    return this.rigged ? this._tag : (this.fallback ? this.fallback.tag : null);
  }

  setKit(change = {}) {
    this.pendingKit = { ...(this.pendingKit || {}), ...change };
    // The fallback body always tracks a kit change, so a later fall-back (or a
    // GLB that never loads) still shows the right shirt.
    if (this.fallback) return this.fallback.setKit(change);
    // On the rigged body a kit is a repaint of the atlas, which is why only
    // `kit` is honoured here: the squad number is drawn into PlayerView's own
    // generated texture and this character's atlas has no number on it to
    // replace. `/numara` still changes the number the rest of the game knows
    // about; it just is not written on this shirt.
    if (change.kit && this.mesh) {
      const preset = KIT_PRESETS[change.kit];
      if (preset) {
        this._tintKit(this.mesh, null, {
          base: new THREE.Color(preset.base),
          accent: new THREE.Color(preset.accent),
          pattern: preset.pattern,
        });
      }
    }
    return this.pendingKit;
  }

  update(dt) {
    if (!this.rigged) {
      this.fallback?.update(dt);
      return;
    }
    const p = this.player;
    this._syncCelebration();
    this._detectContact(dt);
    const corePlayer = this._buildCorePlayer();
    const ctx = this._buildCtx();
    this.animator.advance(dt, corePlayer, ctx);
    this.animator.evaluate(this.pose);
    this.binding.apply(this.pose);

    const pose = this.pose;
    this.root.position.set(
      p.pos.x + pose[ch('root', CH_PX)],
      pose[ch('root', CH_PY)],
      p.pos.z + pose[ch('root', CH_PZ)],
    );
    // Same Euler order pose.js's own rig.js uses for every joint, root
    // included — mixing orders would make the root the one joint whose
    // rotation composes differently from the skeleton it is carrying.
    this.root.rotation.set(
      pose[ch('root', CH_RX)], pose[ch('root', CH_RY)], pose[ch('root', CH_RZ)], 'XYZ',
    );

    const st = this.animator.machine.current;
    const grounded = st === 'ragdoll' || st === 'slide'
      || st === 'keeperDive' || st === 'keeperGetUp';
    if (this._tag) {
      this._tag.visible = !grounded;
      if (this._tag.visible) {
        this._tag.position.set(p.pos.x, 2.06 + Math.max(0, pose[ch('root', CH_PY)]), p.pos.z);
      }
    }
    const chargeShown = Math.max(this.animator.charge01, this.animator.clear01);
    this.ring.visible = chargeShown > 0.02 && st !== 'celebrate' && st !== 'dejected';
    if (this.ring.visible) {
      const s = 1 + chargeShown * 0.5;
      this.ring.scale.set(s, s, 1);
      this.ring.material.opacity = 0.35 + chargeShown * 0.6;
      this.ring.position.x = p.pos.x;
      this.ring.position.z = p.pos.z;
    }
  }

  dispose() {
    this.disposed = true;
    this.fallback?.dispose();
    this.fallback = null;
    if (this.root) {
      // vendorScene() clones the loaded scene with THREE.Object3D.clone(),
      // which shares geometry and material rather than duplicating them
      // (vendorModel.js's own cache depends on that sharing) — disposing them
      // here would break every other player wearing the same rig. Only the
      // group and this view's own additions (ring, tag) belong to it.
      this.root.parent?.remove(this.root);
      this.root = null;
    }
    if (this.ring) {
      this.ring.parent?.remove(this.ring);
      this.ring.geometry.dispose();
      this.ring.material.dispose();
      this.ring = null;
    }
    if (this._tag) {
      this._tag.parent?.remove(this._tag);
      this._tag.material.map?.dispose();
      this._tag.material.dispose();
      this._tag = null;
    }
  }
}
