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
export const P2_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', kick: 'Enter' };

export class KeyboardController {
  constructor(keys) {
    this.keys = keys;
    installListeners();
  }

  update() {
    const k = this.keys;
    const right = (pressed.has(k.right) ? 1 : 0) - (pressed.has(k.left) ? 1 : 0);
    const up = (pressed.has(k.up) ? 1 : 0) - (pressed.has(k.down) ? 1 : 0);
    return { x: -up, z: -right, kick: pressed.has(k.kick) };
  }
}
