// Human input. "Up" and "right" are SCREEN intents: the world-space basis
// below is fed every frame by the camera rig, so controls always match what
// the player sees regardless of the camera mode.
//
// Three sources feed the same intent: the keyboard, the first/second gamepad
// and (on touch devices) an on-screen stick with two buttons. They are merged
// in update(), so the game layer keeps calling ctrl.update() and never learns
// which device the human is holding.
const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Slash',
]);

const pressed = new Set();
let listenersInstalled = false;

function installListeners() {
  if (listenersInstalled) return;
  if (typeof addEventListener !== 'function') return; // headless: tests, node
  listenersInstalled = true;
  addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    pressed.add(e.code);
  });
  addEventListener('keyup', (e) => pressed.delete(e.code));
  addEventListener('blur', () => pressed.clear());
}

// Synthetic key hook: lets headless tests (and any future replay/remote input)
// drive the very same code path a real keyboard drives.
export function setKeyDown(code, down = true) {
  if (down) pressed.add(code); else pressed.delete(code);
}
export function clearKeys() { pressed.clear(); }

// Jump sits next to the movement/kick/slide cluster on each scheme: 'KeyE'
// for WASD (right under the fingers already on W/D), 'KeyZ' for the arrow +
// X/C alt scheme (left of X/C, same row), 'Slash' for P2's arrow + Enter/
// Shift scheme (free key next to the arrow cluster on most layouts).
export const P1_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', kick: 'Space', slide: 'ShiftLeft', jump: 'KeyE' };
export const P1_ALT_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', kick: 'KeyX', slide: 'KeyC', jump: 'KeyZ' };
export const P1_X_KICK = { kick: 'KeyX', slide: 'KeyC', jump: 'KeyZ' };
export const P2_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', kick: 'Enter', slide: 'ShiftRight', jump: 'Slash' };

const KEYS_KEY = 'goalnet-keys';

// Controllers hold references to these map objects, so mutating the
// properties re-binds every controller instantly.
export function loadKeyOverrides() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEYS_KEY) || '{}');
    Object.assign(P1_KEYS, saved.p1 || {});
    Object.assign(P2_KEYS, saved.p2 || {});
  } catch { /* corrupted storage: defaults stand */ }
}

export function saveKeyOverrides() {
  try {
    localStorage.setItem(KEYS_KEY, JSON.stringify({ p1: P1_KEYS, p2: P2_KEYS }));
  } catch { /* private mode */ }
}

loadKeyOverrides();

// world-space directions for screen-up and screen-right (broadcast defaults)
let basisF = { x: -1, z: 0 };
let basisR = { x: 0, z: -1 };

/** Called by the camera rig with its current ground-projected view basis. */
export function setInputBasis(fx, fz, rx, rz) {
  basisF = { x: fx, z: fz };
  basisR = { x: rx, z: rz };
}

/** The basis currently in force (copy, for tests and debug overlays). */
export function getInputBasis() {
  return { f: { ...basisF }, r: { ...basisR } };
}

// Pure: turn a screen-space intent into a world-space direction. Defaults to
// the live basis, so tests can either set it via setInputBasis or pass one in.
export function screenToWorld(right, up, f = basisF, r = basisR) {
  return {
    x: f.x * up + r.x * right,
    z: f.z * up + r.z * right,
  };
}

// ---------------------------------------------------------------- gamepad ---

export const GAMEPAD_DEADZONE = 0.18;

// Standard mapping (developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping).
export const PAD_BUTTONS = {
  kick: 0,    // A / Cross
  slide: 1,   // B / Circle
  jump: 2,    // X / Square
  camera: 3,  // Y / Triangle — reported, wired by the coordinator
  dpadUp: 12, dpadDown: 13, dpadLeft: 14, dpadRight: 15,
};

/** Pure: radial deadzone that rescales so the analog range stays full. */
export function applyDeadzone(x, y, dz = GAMEPAD_DEADZONE) {
  const m = Math.hypot(x, y);
  if (!(m > dz)) return { x: 0, y: 0, m: 0 };
  const scaled = Math.min(1, (m - dz) / (1 - dz));
  return { x: (x / m) * scaled, y: (y / m) * scaled, m: scaled };
}

/** Pure: browsers hand back either GamepadButton objects or bare numbers. */
export function padPressed(button) {
  if (button == null) return false;
  if (typeof button === 'number') return button > 0.5;
  if (button.pressed) return true;
  return typeof button.value === 'number' && button.value > 0.5;
}

// Pure: navigator.getGamepads() returns a sparse array with holes for
// unplugged slots, so compact it before indexing by player number.
export function connectedPads(raw) {
  const out = [];
  for (const p of raw || []) {
    if (p && p.connected !== false) out.push(p);
  }
  return out;
}

/** Pure: one gamepad snapshot -> screen-space intent (null when unplugged). */
export function padIntent(pad, dz = GAMEPAD_DEADZONE) {
  if (!pad) return null;
  const ax = pad.axes || [];
  const bt = pad.buttons || [];
  const s = applyDeadzone(Number(ax[0]) || 0, Number(ax[1]) || 0, dz);
  let right = s.x;
  let up = -s.y; // stick pushes -1 upward; screen-up is +1 for us
  if (s.m === 0) { // stick idle: fall back to the d-pad
    right = (padPressed(bt[PAD_BUTTONS.dpadRight]) ? 1 : 0)
      - (padPressed(bt[PAD_BUTTONS.dpadLeft]) ? 1 : 0);
    up = (padPressed(bt[PAD_BUTTONS.dpadUp]) ? 1 : 0)
      - (padPressed(bt[PAD_BUTTONS.dpadDown]) ? 1 : 0);
  }
  return {
    right,
    up,
    kick: padPressed(bt[PAD_BUTTONS.kick]),
    slide: padPressed(bt[PAD_BUTTONS.slide]),
    jump: padPressed(bt[PAD_BUTTONS.jump]),
    camera: padPressed(bt[PAD_BUTTONS.camera]),
  };
}

const defaultPadSource = () => (
  typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
    ? navigator.getGamepads()
    : []
);
let padSource = defaultPadSource;

// Swap where pads come from (headless tests, replays). Pass nothing to restore.
export function setGamepadSource(fn) {
  padSource = typeof fn === 'function' ? fn : defaultPadSource;
}

/** Live, compacted list of pads. Unplugging simply shortens it. */
export function readPads() {
  try {
    return connectedPads(padSource());
  } catch {
    return []; // some browsers throw when the page is not focused
  }
}

if (typeof addEventListener === 'function') {
  // Nothing to cache — we poll — but dropping stale key state on a hotplug
  // avoids a button appearing stuck if the pad vanished mid-press.
  addEventListener('gamepaddisconnected', () => {});
  addEventListener('gamepadconnected', () => {});
}

// ------------------------------------------------------------ touch input ---

export const TOUCH_CLASSES = {
  root: 'gn-touch',
  zone: 'gn-touch-zone',
  stick: 'gn-touch-stick',
  knob: 'gn-touch-knob',
  buttons: 'gn-touch-buttons',
  button: 'gn-touch-btn',
  kick: 'gn-touch-kick',
  slide: 'gn-touch-slide',
  jump: 'gn-touch-jump',
  style: 'gn-touch-style',
};

const STICK_RADIUS = 56;   // px of travel for a full-magnitude push
const STICK_DEAD = 0.14;   // fraction of the radius ignored around the anchor

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  if ('ontouchstart' in window) return true;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

const TOUCH_CSS = `
.${TOUCH_CLASSES.root} { position: fixed; inset: 0; z-index: 15; pointer-events: none;
  touch-action: none; -webkit-user-select: none; user-select: none;
  font-family: 'Segoe UI', system-ui, sans-serif; }
.${TOUCH_CLASSES.zone} { position: absolute; left: 0; top: 0; width: 50%; height: 100%;
  pointer-events: auto; touch-action: none; }
.${TOUCH_CLASSES.stick} { position: absolute; width: ${STICK_RADIUS * 2}px; height: ${STICK_RADIUS * 2}px;
  margin: -${STICK_RADIUS}px 0 0 -${STICK_RADIUS}px; border-radius: 50%;
  background: rgba(255,255,255,0.10); border: 2px solid rgba(255,255,255,0.35);
  opacity: 0; transition: opacity 120ms ease; pointer-events: none; }
.${TOUCH_CLASSES.stick}.on { opacity: 1; }
.${TOUCH_CLASSES.knob} { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px;
  margin: -27px 0 0 -27px; border-radius: 50%;
  background: rgba(255,255,255,0.45); border: 2px solid rgba(255,255,255,0.7); }
.${TOUCH_CLASSES.buttons} { position: absolute; right: 18px; bottom: 22px;
  display: flex; align-items: flex-end; gap: 14px; pointer-events: none; }
.${TOUCH_CLASSES.button} { pointer-events: auto; touch-action: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; letter-spacing: 0.5px;
  border: 2px solid rgba(255,255,255,0.55); background: rgba(0,0,0,0.32);
  text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
.${TOUCH_CLASSES.button}.on { background: rgba(255,255,255,0.4); transform: scale(0.94); }
.${TOUCH_CLASSES.kick} { width: 96px; height: 96px; font-size: 19px;
  background: rgba(226,59,59,0.34); }
.${TOUCH_CLASSES.slide} { width: 74px; height: 74px; font-size: 14px;
  background: rgba(59,109,226,0.34); }
.${TOUCH_CLASSES.jump} { width: 74px; height: 74px; font-size: 13px;
  background: rgba(59,226,133,0.34); }
`;

class TouchControls {
  constructor(root) {
    const doc = root.ownerDocument || document;
    if (!doc.getElementById(TOUCH_CLASSES.style)) {
      const style = doc.createElement('style');
      style.id = TOUCH_CLASSES.style;
      style.textContent = TOUCH_CSS;
      doc.head.appendChild(style);
    }

    this.state = { right: 0, up: 0, kick: false, slide: false, jump: false };
    this.pointerId = null;
    this.anchor = { x: 0, y: 0 };

    this.el = doc.createElement('div');
    this.el.className = TOUCH_CLASSES.root;

    this.zone = doc.createElement('div');
    this.zone.className = TOUCH_CLASSES.zone;
    this.el.appendChild(this.zone);

    this.stick = doc.createElement('div');
    this.stick.className = TOUCH_CLASSES.stick;
    this.knob = doc.createElement('div');
    this.knob.className = TOUCH_CLASSES.knob;
    this.stick.appendChild(this.knob);
    this.zone.appendChild(this.stick);

    const bar = doc.createElement('div');
    bar.className = TOUCH_CLASSES.buttons;
    this.jumpBtn = this.#makeButton(doc, TOUCH_CLASSES.jump, 'ZIPLA', 'jump');
    this.slideBtn = this.#makeButton(doc, TOUCH_CLASSES.slide, 'KAYMA', 'slide');
    this.kickBtn = this.#makeButton(doc, TOUCH_CLASSES.kick, 'ŞUT', 'kick');
    bar.append(this.jumpBtn, this.slideBtn, this.kickBtn);
    this.el.appendChild(bar);

    this.zone.addEventListener('pointerdown', this.#onDown, { passive: false });
    this.zone.addEventListener('pointermove', this.#onMove, { passive: false });
    this.zone.addEventListener('pointerup', this.#onUp);
    this.zone.addEventListener('pointercancel', this.#onUp);
    this.zone.addEventListener('lostpointercapture', this.#onUp);

    root.appendChild(this.el);
  }

  #makeButton(doc, cls, label, field) {
    const b = doc.createElement('div');
    b.className = `${TOUCH_CLASSES.button} ${cls}`;
    b.textContent = label;
    const set = (on) => (e) => {
      e.preventDefault();
      this.state[field] = on;
      b.classList.toggle('on', on);
      if (on && b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    };
    b.addEventListener('pointerdown', set(true), { passive: false });
    b.addEventListener('pointerup', set(false));
    b.addEventListener('pointercancel', set(false));
    b.addEventListener('lostpointercapture', set(false));
    return b;
  }

  #onDown = (e) => {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.anchor = { x: e.clientX, y: e.clientY };
    this.stick.style.left = `${e.clientX}px`;
    this.stick.style.top = `${e.clientY}px`;
    this.stick.classList.add('on');
    try { this.zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  #onMove = (e) => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - this.anchor.x;
    const dy = e.clientY - this.anchor.y;
    const len = Math.hypot(dx, dy);
    const mag = Math.min(1, len / STICK_RADIUS);
    if (mag <= STICK_DEAD || len === 0) {
      this.state.right = 0; this.state.up = 0;
      this.knob.style.transform = 'translate(0px, 0px)';
      return;
    }
    const scaled = (mag - STICK_DEAD) / (1 - STICK_DEAD);
    const nx = dx / len, ny = dy / len;
    this.state.right = nx * scaled;
    this.state.up = -ny * scaled; // screen y grows downward
    const px = nx * mag * STICK_RADIUS, py = ny * mag * STICK_RADIUS;
    this.knob.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  };

  #onUp = (e) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.state.right = 0; this.state.up = 0;
    this.stick.classList.remove('on');
    this.knob.style.transform = 'translate(0px, 0px)';
  };

  setVisible(on) { this.el.style.display = on ? '' : 'none'; }

  destroy() {
    this.el.parentNode?.removeChild(this.el);
    this.state = { right: 0, up: 0, kick: false, slide: false, jump: false };
  }
}

let touchCtl = null;
let touchProbed = false;

// Builds the on-screen pad the first time a P1 controller asks for it, and
// only on a touch device. `{ force: true }` builds it anyway (debug/manual QA).
export function ensureTouchControls(opts = {}) {
  if (touchProbed && !opts.force) return touchCtl;
  touchProbed = true;
  if (touchCtl) return touchCtl;
  if (typeof document === 'undefined' || !document.body) return null;
  if (!opts.force && !isTouchDevice()) return null;
  touchCtl = new TouchControls(opts.root || document.body);
  return touchCtl;
}

export function getTouchControls() { return touchCtl; }

export function destroyTouchControls() {
  touchCtl?.destroy();
  touchCtl = null;
  touchProbed = false;
}

// ------------------------------------------------------------------ merge ---

// Pure: fold every source into one intent. Buttons are an OR (any device can
// kick), movement goes to the strongest push with earlier sources winning
// ties — so a held key always beats a stick that is at most fully deflected.
export function mergeIntents(sources) {
  let right = 0, up = 0, best = 0;
  let kick = false, slide = false, jump = false, camera = false;
  for (const s of sources) {
    if (!s) continue;
    kick = kick || !!s.kick;
    slide = slide || !!s.slide;
    jump = jump || !!s.jump;
    camera = camera || !!s.camera;
    const m = Math.hypot(s.right || 0, s.up || 0);
    if (m > best + 1e-9) { best = m; right = s.right || 0; up = s.up || 0; }
  }
  return { right, up, kick, slide, jump, camera };
}

/** Pure: the union of several key maps against a set of held key codes. */
export function keyboardIntent(maps, held = pressed) {
  let right = 0, up = 0, kick = false, slide = false, jump = false;
  for (const k of maps) {
    right += (held.has(k.right) ? 1 : 0) - (held.has(k.left) ? 1 : 0);
    up += (held.has(k.up) ? 1 : 0) - (held.has(k.down) ? 1 : 0);
    kick = kick || held.has(k.kick);
    slide = slide || held.has(k.slide);
    jump = jump || (!!k.jump && held.has(k.jump));
  }
  return {
    right: Math.max(-1, Math.min(1, right)),
    up: Math.max(-1, Math.min(1, up)),
    kick,
    slide,
    jump,
  };
}

// Accepts one key map or several; movement is the union and any map's kick
// key fires (so 1P can play WASD+Space or arrows+X interchangeably). Player 1
// additionally reads gamepad #1 and the on-screen touch pad; player 2 reads
// gamepad #2. Every source lands in the same screen-space intent.
export class KeyboardController {
  constructor(maps, opts = {}) {
    this.maps = Array.isArray(maps) ? maps : [maps];
    // Slot 0 = player one. The P2 map is the only marker the call sites give
    // us, and every existing construction site passes one of the shared maps.
    this.slot = opts.slot ?? (this.maps.includes(P2_KEYS) ? 1 : 0);
    this.useGamepad = opts.gamepad !== false;
    this.useTouch = opts.touch !== false && this.slot === 0;
    this.cameraEdge = false;
    this._cameraWas = false;
    installListeners();
    if (this.useTouch) ensureTouchControls();
  }

  /** Screen-space intent for this frame, before the camera basis is applied. */
  intent() {
    const sources = [keyboardIntent(this.maps)];
    if (this.useTouch && touchCtl) sources.push(touchCtl.state);
    if (this.useGamepad) sources.push(padIntent(readPads()[this.slot]));
    return mergeIntents(sources);
  }

  update() {
    const m = this.intent();
    // rising edge only, so a held Y/Triangle does not spin the camera
    this.cameraEdge = m.camera && !this._cameraWas;
    this._cameraWas = m.camera;
    const dir = screenToWorld(m.right, m.up);
    return {
      x: dir.x,
      z: dir.z,
      kick: m.kick,
      slide: m.slide,
      jump: m.jump,
      camera: this.cameraEdge,
    };
  }
}
