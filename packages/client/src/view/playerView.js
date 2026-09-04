import * as THREE from 'three';
import {
  KIT_PRESETS, defaultKitFor, kitImage, loadKitImage, makeHeadTexture, makeKitTexture,
  makeLegTexture,
} from './kitTexture.js';
// Bodies authored in Blender (tools/blender/make-view-parts.py) at exactly the
// primitives' own extents, so they drop in as a geometry swap: shoulders, a
// waist, a jaw and a calf where there were four smooth solids, and not one
// line of the animation below has to change. Missing file, no problem — the
// primitive stays.
import { useAuthoredPart } from './parts.js';

/** A three.js colour number as the '#rrggbb' the kit table speaks. */
const css6 = (c) => `#${(c >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
import { PLAYER_SPEED } from '../core/constants.js';

export const DEFAULT_TEAM_COLORS = [0xe23b3b, 0x3b6de2];

// ------------------------------------------------------------- palette -----

const _c = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };

/** Pure: nudge a colour's lightness. amount > 0 lightens, < 0 darkens. */
export function shade(hex, amount) {
  _c.setHex(hex >>> 0);
  _c.getHSL(_hsl);
  const l = Math.max(0, Math.min(1, _hsl.l + amount));
  return _c.setHSL(_hsl.h, _hsl.s, l).getHex();
}

// Pure: the keeper wears an accent derived from their own team colour rather
// than a hard-coded yellow/teal — rotate the hue half a turn and brighten, so
// it can never be confused with the outfield shirt whatever the team picked.
export function deriveKeeperColor(hex) {
  _c.setHex(hex >>> 0);
  _c.getHSL(_hsl);
  const h = (_hsl.h + 0.5) % 1;
  const s = Math.max(0.55, Math.min(1, _hsl.s));
  const l = Math.max(0.52, Math.min(0.72, _hsl.l + 0.16));
  return _c.setHSL(h, s, l).getHex();
}

// Pure: full kit for both teams from the optional config.teamColors contract
// (`[0xRRGGBB, 0xRRGGBB]`); anything missing or malformed falls back.
export function teamPalette(teamColors) {
  const base = [0, 1].map((i) => {
    const v = Array.isArray(teamColors) ? teamColors[i] : undefined;
    return Number.isFinite(v) ? (v >>> 0) & 0xffffff : DEFAULT_TEAM_COLORS[i];
  });
  return {
    jersey: base,
    shorts: base.map((c) => shade(c, -0.22)),
    keeper: base.map(deriveKeeperColor),
    keeperShorts: base.map((c) => shade(deriveKeeperColor(c), -0.28)),
    ring: base,
  };
}

// ------------------------------------------------------------ name tags ----

export const NAME_MAX = 14;
const TAG_WORLD_W = 1.1;   // metres wide, constant in world space
const TAG_Y = 2.06;        // just above the head

// Pure: names arrive from other peers, so collapse whitespace, drop control
// characters and cap the length before it ever reaches a canvas.
export function sanitizeName(raw, max = NAME_MAX) {
  if (typeof raw !== 'string') return '';
  const clean = raw
    .replace(new RegExp(String.raw`[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f]`, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 1))}…`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A canvas-texture Sprite: always camera-facing for free, one draw call, and
// a fixed world size so it does not swell when the camera comes close.
// Exported so view/riggedPlayerView.js can hang the same tag off a rigged
// character instead of re-drawing the same canvas a second way.
export function makeNameSprite(name) {
  if (typeof document === 'undefined') return null; // headless
  const W = 256, H = 72, pad = 10;
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
  roundRectPath(ctx, (W - pillW) / 2, pad, pillW, pillH, pillH / 2);
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

// Minimal procedural character: capsule torso, sphere head, two swinging legs.
// No skeletal animation — lean, walk-cycle and kick swing are all computed.
export class PlayerView {
  // `teamColors` is the optional config.teamColors pair; omit it for defaults.
  constructor(player, scene, teamColors = null) {
    this.player = player;
    this.group = new THREE.Group();

    const pal = teamPalette(teamColors);
    this.palette = pal;
    const keeper = player.role === 'keeper';
    const jerseyColor = keeper ? pal.keeper[player.team] : pal.jersey[player.team];
    const shortsColor = keeper ? pal.keeperShorts[player.team] : pal.shorts[player.team];
    // The shirt: a kit texture where there is a DOM to draw one on, the flat
    // colour otherwise (headless tests, and any browser that fails to give us
    // a 2D context). The map is tinted white so the pattern's own colours come
    // through; without a map the colour IS the shirt, exactly as before.
    // The keeper gets a kit too, and it has to lose to neither side: a keeper
    // in the outfield pattern is the one thing a viewer must never misread.
    // His own colour with a plain shirt and a contrasting collar does that.
    const kitSpec = player.kit && KIT_PRESETS[player.kit]
      ? { ...KIT_PRESETS[player.kit], number: player.number }
      : {
        ...defaultKitFor(jerseyColor, player.team),
        ...(keeper ? { pattern: 'plain', base: css6(jerseyColor), motif: null } : null),
        number: player.number ?? (keeper ? 1 : undefined),
      };
    const kitMap = makeKitTexture(kitSpec);
    // The sleeves wear the same kit WITHOUT the number: the arms carry the same
    // cylindrical wrap as the torso, so a number baked once landed on the shirt
    // and on both biceps.
    const sleeveMap = kitSpec.number == null
      ? kitMap
      : makeKitTexture({ ...kitSpec, number: null });
    this.baseKitSpec = kitSpec;
    const jersey = new THREE.MeshStandardMaterial(kitMap
      ? { map: kitMap, color: 0xffffff, roughness: 0.7 }
      : { color: jerseyColor, roughness: 0.7 });
    const sleeve = sleeveMap && sleeveMap !== kitMap
      ? new THREE.MeshStandardMaterial({ map: sleeveMap, color: 0xffffff, roughness: 0.7 })
      : jersey;
    this.kitMap = kitMap;
    this.sleeveMap = sleeveMap !== kitMap ? sleeveMap : null;
    // What the shirt is showing. With a kit texture the colour lives in the
    // pixels and the material is tinted white, so this is the only place left
    // that answers "which team is this player wearing?".
    this.kitSpec = kitMap ? kitSpec : { base: css6(jerseyColor), pattern: 'plain' };
    this.shirtNumber = kitSpec.number ?? null;
    // After kitSpec is set: the reload compares identity against it.
    this.#wantKitImage(this.kitSpec);
    // Skin, hair and the sock, which is the kit colour a viewer reads at the
    // ankle when the shirt is hidden behind another player.
    const SKIN = 0xe8b98f;
    const HAIR = 0x2a1c12;
    // A head with hair and a face, and a leg that is shorts, then leg, then
    // sock, then boot. Both fall back to the flat colour they always had where
    // there is no canvas to draw on.
    const headMap = makeHeadTexture({ skin: SKIN, hair: HAIR });
    const legMap = makeLegTexture({
      shorts: shortsColor, skin: SKIN, sock: jerseyColor,
    });
    this.headMap = headMap;
    this.legMap = legMap;
    const shorts = legMap
      ? new THREE.MeshStandardMaterial({ map: legMap, color: 0xffffff, roughness: 0.7 })
      : new THREE.MeshStandardMaterial({ color: shortsColor, roughness: 0.7 });
    const skin = headMap
      ? new THREE.MeshStandardMaterial({ map: headMap, color: 0xffffff, roughness: 0.8 })
      : new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.45, 6, 14), jersey);
    body.position.y = 0.95;
    body.castShadow = true;
    // Named so a cosmetic layer can re-skin the torso without reaching into
    // group.children by index. Nothing here reads it; purely additive.
    this.body = body;
    this.group.add(body);
    useAuthoredPart(body, 'torso');

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), skin);
    head.position.y = 1.52;
    head.castShadow = true;
    this.head = head;
    this.group.add(head);
    useAuthoredPart(head, 'head');

    const legGeo = new THREE.CylinderGeometry(0.075, 0.06, 0.55, 10);
    legGeo.translate(0, -0.275, 0); // pivot at the hip
    this.legs = [-1, 1].map((side) => {
      const leg = new THREE.Mesh(legGeo, shorts);
      leg.position.set(side * 0.11, 0.62, 0);
      leg.castShadow = true;
      this.group.add(leg);
      useAuthoredPart(leg, 'leg');
      return leg;
    });

    const armGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.48, 10);
    armGeo.translate(0, -0.24, 0); // pivot at the shoulder
    this.arms = [-1, 1].map((side) => {
      const arm = new THREE.Mesh(armGeo, sleeve);
      // Against the shoulder of the authored torso, which is wider at the
      // chest than the capsule was: at 0.32 the arms floated clear of the
      // body with daylight between.
      arm.position.set(side * 0.285, 1.30, 0);
      arm.rotation.z = side * 0.16; // resting flare away from the torso
      arm.castShadow = true;
      this.group.add(arm);
      useAuthoredPart(arm, 'arm');
      return arm;
    });

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.045, 10, 32),
      new THREE.MeshBasicMaterial({ color: pal.ring[player.team], transparent: true, opacity: 0.85 }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.ring.visible = false;
    this.group.add(this.ring);

    // Name tag lives in the scene, not in the body group: the group pitches
    // and rolls through dives and ragdolls, and the label must not tumble.
    this.tagName = sanitizeName(player.mpName);
    this.tag = this.tagName ? makeNameSprite(this.tagName) : null;
    if (this.tag) scene.add(this.tag);

    this.walkPhase = 0;
    scene.add(this.group);
  }

  // Names can land after the view exists (a peer renames in the lobby), so the
  // tag can be rebuilt in place. Passing an empty name removes it.
  setName(name) {
    const clean = sanitizeName(name);
    if (clean === this.tagName) return;
    const scene = this.tag?.parent ?? this.group.parent;
    if (this.tag) {
      this.tag.parent?.remove(this.tag);
      this.tag.material.map?.dispose();
      this.tag.material.dispose();
      this.tag = null;
    }
    this.tagName = clean;
    this.tag = clean ? makeNameSprite(clean) : null;
    if (this.tag && scene) scene.add(this.tag);
  }

  /**
   * If this kit is drawn from a generated image that has not arrived yet,
   * fetch it and redraw once it has. The identity check drops a stale load:
   * a player who changed kit again in the meantime keeps the newer one.
   */
  #wantKitImage(spec) {
    const key = typeof spec?.motif === 'string' ? spec.motif
      : (typeof spec?.image === 'string' ? spec.image : null);
    if (!key || kitImage(key)) return;
    loadKitImage(key).then((ok) => {
      if (ok && this.kitSpec === spec && this.body) this.setKit({});
    });
  }

  /**
   * Change this player's shirt while the match is running.
   *
   * Redraws both canvases and swaps the maps in place; the materials, meshes
   * and every animation state stay exactly as they were, which is what makes
   * this safe to call from a chat command mid-run.
   *
   * @param {{number?:number|null, kit?:string}} change
   */
  setKit(change = {}) {
    if (!this.baseKitSpec) return this.kitSpec;
    const next = { ...this.baseKitSpec };
    if ('number' in change) next.number = change.number;
    if (change.kit && KIT_PRESETS[change.kit]) {
      Object.assign(next, KIT_PRESETS[change.kit], { number: next.number });
    }
    const shirt = makeKitTexture(next);
    if (!shirt) return this.kitSpec;
    const sleeve = next.number == null
      ? shirt : makeKitTexture({ ...next, number: null });

    const oldShirt = this.kitMap;
    const oldSleeve = this.sleeveMap;
    this.body.material.map = shirt;
    this.body.material.color.setHex(0xffffff);
    this.body.material.needsUpdate = true;

    // A numberless kit lets the sleeves share the torso's material. The moment
    // a number appears they must stop sharing, or writing the sleeve map onto
    // that one material also strips the number off the shirt.
    const sharing = this.arms.length > 0 && this.arms[0].material === this.body.material;
    if (sleeve !== shirt && sharing) {
      const sleeveMat = new THREE.MeshStandardMaterial({
        map: sleeve, color: 0xffffff, roughness: 0.7,
      });
      for (const arm of this.arms) arm.material = sleeveMat;
      this.ownSleeveMaterial = sleeveMat;
    } else if (sleeve === shirt && !sharing) {
      // and back again: no number means the sleeves can rejoin the shirt
      const dead = this.arms[0].material;
      for (const arm of this.arms) arm.material = this.body.material;
      if (dead !== this.body.material) dead.dispose();
      this.ownSleeveMaterial = null;
    } else {
      for (const arm of this.arms) {
        arm.material.map = sleeve || shirt;
        arm.material.color.setHex(0xffffff);
        arm.material.needsUpdate = true;
      }
    }
    oldShirt?.dispose();
    if (oldSleeve && oldSleeve !== oldShirt) oldSleeve.dispose();

    this.baseKitSpec = next;
    this.kitSpec = next;
    this.#wantKitImage(next);
    this.kitMap = shirt;
    this.sleeveMap = sleeve !== shirt ? sleeve : null;
    this.shirtNumber = next.number ?? null;
    return this.kitSpec;
  }

  update(dt) {
    const p = this.player;
    const sp = p.speed();

    if (this.tag) {
      this.tag.visible = p.down <= 0; // no label on a ragdolled player
      if (this.tag.visible) {
        this.tag.position.set(p.pos.x, TAG_Y + (p.jumpY || 0), p.pos.z);
      }
    }

    if (p.down > 0) {
      // ragdoll: topple onto the back with a tumble, then scramble up
      const t = 1 - p.down / p.downTotal; // 0 -> 1 over the knockdown
      const fall = Math.min(t / 0.2, 1);
      const rise = Math.max(0, (t - 0.72) / 0.28);
      const flat = fall * fall * (1 - rise * rise);
      const pitch = -flat * (Math.PI / 2) * 1.04;
      const hop = Math.sin(Math.min(t / 0.3, 1) * Math.PI) * 0.3 * (1 - t);
      const flail = Math.sin(t * 26) * 0.45 * (1 - t);
      // the group pivots at the feet, so lying flat would sink the torso
      // halfway into the grass — lift by the body radius while horizontal
      this.group.position.set(p.pos.x, hop + flat * 0.3, p.pos.z);
      this.group.rotation.set(pitch, p.facing + p.tumbleSpin * flat, flail * 0.4, 'YXZ');
      this.legs[0].rotation.x = flail + flat * 0.5;
      this.legs[1].rotation.x = -flail + flat * 0.7;
      this.legs[0].rotation.z = flat * 0.35;
      this.legs[1].rotation.z = -flat * 0.35;
      // arms fly up and windmill while going down, settle spread on the grass
      const wind = Math.sin(t * 32 + 1.3) * 0.9 * (1 - t);
      this.arms[0].rotation.x = -2.4 * flat + wind;
      this.arms[1].rotation.x = -2.4 * flat - wind;
      this.arms[0].rotation.z = 0.16 + flat * 1.1 + wind * 0.3;
      this.arms[1].rotation.z = -0.16 - flat * 1.1 + wind * 0.3;
      this.ring.visible = false;
      return;
    }
    this.legs[0].rotation.z = 0;
    this.legs[1].rotation.z = 0;

    // keeper dive: superman stretch toward the dive direction
    const divePose = p.dive > 0
      ? Math.min((p.diveTotal - p.dive) / 0.18, 1)
      : (p.diveRecover > 0 ? p.diveRecover / 0.45 : 0);
    if (divePose > 0.01) {
      const yaw = Math.atan2(p.diveDir.x, p.diveDir.z);
      if (p.diveKind === 'slide') {
        // slide tackle: leaning back, one leg stretched out in front
        this.group.position.set(p.pos.x, -0.35 * divePose, p.pos.z);
        this.group.rotation.set(-divePose * 1.05, yaw, 0, 'YXZ');
        this.legs[0].rotation.x = -divePose * 1.5;  // tackling leg forward
        this.legs[1].rotation.x = divePose * 0.5;   // trailing leg folded
        this.arms[0].rotation.x = divePose * 1.6;
        this.arms[1].rotation.x = -divePose * 0.7;
        this.arms[0].rotation.z = 0.16 + divePose * 0.5;
        this.arms[1].rotation.z = -0.16 - divePose * 0.3;
      } else {
        // keeper dive: superman stretch toward the dive direction
        const air = p.dive > 0 ? Math.sin(Math.min((p.diveTotal - p.dive) / p.diveTotal, 1) * Math.PI) : 0;
        this.group.position.set(p.pos.x, air * 0.55, p.pos.z);
        this.group.rotation.set(divePose * 1.35, yaw, 0, 'YXZ');
        for (const [i, s] of [[0, 1], [1, -1]]) {
          this.legs[i].rotation.x = divePose * 0.25 * s;
          this.arms[i].rotation.x = -divePose * 2.9;
          this.arms[i].rotation.z = s * 0.16 * (1 - divePose);
        }
      }
      this.ring.visible = false;
      return;
    }

    // goal aftermath: scorers bounce with arms up, the conceding side slumps
    if (p.celebrate !== 0 && p.down <= 0 && p.dive <= 0) {
      this.walkPhase += dt * 6;
      if (p.celebrate === 1) {
        const hop = Math.abs(Math.sin(this.walkPhase)) * 0.28;
        const wave = Math.sin(this.walkPhase * 1.7) * 0.25;
        this.group.position.set(p.pos.x, hop, p.pos.z);
        this.group.rotation.set(0, p.facing, 0, 'YXZ');
        this.arms[0].rotation.x = -2.7 + wave;
        this.arms[1].rotation.x = -2.7 - wave;
        this.arms[0].rotation.z = 0.35;
        this.arms[1].rotation.z = -0.35;
        this.legs[0].rotation.x = hop * 0.6;
        this.legs[1].rotation.x = -hop * 0.6;
      } else {
        this.group.position.set(p.pos.x, 0, p.pos.z);
        this.group.rotation.set(0.34, p.facing, 0, 'YXZ'); // hung head
        this.arms[0].rotation.x = 0.25;
        this.arms[1].rotation.x = 0.25;
        this.arms[0].rotation.z = 0.05;
        this.arms[1].rotation.z = -0.05;
        this.legs[0].rotation.x = 0;
        this.legs[1].rotation.x = 0;
      }
      this.ring.visible = false;
      if (this.tag) this.tag.position.set(p.pos.x, 2.06 + (this.group.position.y || 0), p.pos.z);
      return;
    }

    this.group.position.set(p.pos.x, p.jumpY || 0, p.pos.z);
    // header: a sharp forward nod of the whole upper body
    const nod = p.headerAnim > 0 ? Math.sin(Math.min(p.headerAnim, 1) * Math.PI) : 0;
    const lean = Math.min(sp / PLAYER_SPEED, 1) * 0.16 + nod * 0.5;
    this.group.rotation.set(lean, p.facing, 0, 'YXZ');
    // arms shoot straight up during a leap
    if (p.jumpY > 0.03) {
      this.arms[0].rotation.x = -2.9;
      this.arms[1].rotation.x = -2.9;
      this.arms[0].rotation.z = 0.1;
      this.arms[1].rotation.z = -0.1;
      this.legs[0].rotation.x = 0.35;
      this.legs[1].rotation.x = -0.2;
      this.ring.visible = false;
      return;
    }
    this.head.position.y = 1.52 + nod * 0.1;
    this.head.position.z = nod * 0.16;

    this.walkPhase += dt * (4 + sp * 2.6);
    const stride = Math.min(sp / PLAYER_SPEED, 1) * 0.55;
    const kick = p.kickAnim > 0 ? Math.sin(Math.min(p.kickAnim, 1) * Math.PI) : 0;
    this.legs[0].rotation.x = Math.sin(this.walkPhase) * stride;
    // right leg does the kicking
    this.legs[1].rotation.x = kick > 0 ? -kick * 1.5 : Math.sin(this.walkPhase + Math.PI) * stride;
    // arms swing opposite the legs; the kicking motion throws them out
    this.arms[0].rotation.x = Math.sin(this.walkPhase + Math.PI) * stride * 0.8 + kick * 0.9;
    this.arms[1].rotation.x = Math.sin(this.walkPhase) * stride * 0.8 - kick * 0.5;
    this.arms[0].rotation.z = 0.16 + kick * 0.5;
    this.arms[1].rotation.z = -0.16 - kick * 0.2;

    const c = p.charge;
    this.ring.visible = c > 0.02;
    if (this.ring.visible) {
      const s = 1 + c * 0.5;
      this.ring.scale.set(s, s, 1);
      this.ring.material.opacity = 0.35 + c * 0.6;
    }
  }

  dispose() {
    if (this.tag) {
      this.tag.parent?.remove(this.tag);
      this.tag.material.map?.dispose();
      this.tag.material.dispose();
      this.tag = null;
    }
    this.group.parent?.remove(this.group);
    this.kitMap?.dispose();
    this.sleeveMap?.dispose();
    this.group.traverse((o) => {
      // The Blender-authored parts are one geometry shared by every player on
      // the pitch; one player leaving must not free the pitch's legs.
      if (o.geometry && !o.geometry.userData.sharedPart) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
