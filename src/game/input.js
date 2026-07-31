// Keyboard controllers for the side-on camera (camera sits at +x):
// screen-right = world -z, screen-up = world -x.
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

export const P1_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', kick: 'Space' };
export const P1_ALT_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', kick: 'KeyX' };
export const P1_X_KICK = { kick: 'KeyX' };
export const P2_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', kick: 'Enter' };

// Accepts one key map or several; movement is the union and any map's kick
// key fires (so 1P can play WASD+Space or arrows+X interchangeably).
export class KeyboardController {
  constructor(maps) {
    this.maps = Array.isArray(maps) ? maps : [maps];
    installListeners();
  }

  update() {
    let right = 0, up = 0, kick = false;
    for (const k of this.maps) {
      right += (pressed.has(k.right) ? 1 : 0) - (pressed.has(k.left) ? 1 : 0);
      up += (pressed.has(k.up) ? 1 : 0) - (pressed.has(k.down) ? 1 : 0);
      kick = kick || pressed.has(k.kick);
    }
    right = Math.max(-1, Math.min(1, right));
    up = Math.max(-1, Math.min(1, up));
    return { x: -up, z: -right, kick };
  }
}
