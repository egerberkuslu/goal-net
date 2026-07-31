// Keyboard controllers. "Up" and "right" are SCREEN intents: the world-space
// basis below is fed every frame by the camera rig, so controls always match
// what the player sees regardless of the camera mode.
const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter',
]);

const pressed = new Set();
let listenersInstalled = false;

function installListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    pressed.add(e.code);
  });
  addEventListener('keyup', (e) => pressed.delete(e.code));
  addEventListener('blur', () => pressed.clear());
}

export const P1_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', kick: 'Space', slide: 'ShiftLeft' };
export const P1_ALT_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', kick: 'KeyX', slide: 'KeyC' };
export const P1_X_KICK = { kick: 'KeyX', slide: 'KeyC' };
export const P2_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', kick: 'Enter', slide: 'ShiftRight' };

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

// Accepts one key map or several; movement is the union and any map's kick
// key fires (so 1P can play WASD+Space or arrows+X interchangeably).
export class KeyboardController {
  constructor(maps) {
    this.maps = Array.isArray(maps) ? maps : [maps];
    installListeners();
  }

  update() {
    let right = 0, up = 0, kick = false, slide = false;
    for (const k of this.maps) {
      right += (pressed.has(k.right) ? 1 : 0) - (pressed.has(k.left) ? 1 : 0);
      up += (pressed.has(k.up) ? 1 : 0) - (pressed.has(k.down) ? 1 : 0);
      kick = kick || pressed.has(k.kick);
      slide = slide || pressed.has(k.slide);
    }
    right = Math.max(-1, Math.min(1, right));
    up = Math.max(-1, Math.min(1, up));
    return {
      x: basisF.x * up + basisR.x * right,
      z: basisF.z * up + basisR.z * right,
      kick, slide,
    };
  }
}
