// Headless checks for the input layer and the player identity visuals.
// Everything the browser owns (navigator.getGamepads, touch DOM, canvas 2d)
// is either injected or guarded, so this runs under plain node with no network.
//
//   node scripts/input-test.mjs      (or: npm run test:input)

import * as THREE from 'three';
import {
  KeyboardController, P1_KEYS, P1_ALT_KEYS, P2_KEYS,
  setInputBasis, getInputBasis, screenToWorld,
  applyDeadzone, padPressed, padIntent, connectedPads, mergeIntents,
  keyboardIntent, setGamepadSource, setKeyDown, clearKeys,
  isTouchDevice, ensureTouchControls, getTouchControls, destroyTouchControls,
  GAMEPAD_DEADZONE, PAD_BUTTONS,
} from '../src/game/input.js';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// A gamepad snapshot in the shape browsers hand back.
function pad({ ax = [0, 0], down = [] } = {}) {
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 });
  return { connected: true, axes: ax, buttons, mapping: 'standard' };
}
const usePads = (...pads) => setGamepadSource(() => pads);

// ------------------------------------------- 1) camera-basis stick mapping --
{
  // screen-up = +z, screen-right = +x
  setInputBasis(0, 1, 1, 0);
  const r = screenToWorld(1, 0);
  const u = screenToWorld(0, 1);
  check('basis A: stick right -> +x', near(r.x, 1) && near(r.z, 0), JSON.stringify(r));
  check('basis A: stick up -> +z', near(u.x, 0) && near(u.z, 1), JSON.stringify(u));

  // broadcast default: screen-up = -x, screen-right = -z
  setInputBasis(-1, 0, 0, -1);
  const r2 = screenToWorld(1, 0);
  const u2 = screenToWorld(0, 1);
  check('basis B: stick right -> -z', near(r2.x, 0) && near(r2.z, -1), JSON.stringify(r2));
  check('basis B: stick up -> -x', near(u2.x, -1) && near(u2.z, 0), JSON.stringify(u2));

  // a 45° camera keeps the intent's length (the basis is orthonormal)
  const s = Math.SQRT1_2;
  setInputBasis(s, s, s, -s);
  const d = screenToWorld(1, 0);
  check('basis C: magnitude preserved', near(Math.hypot(d.x, d.z), 1), JSON.stringify(d));
  const got = getInputBasis();
  check('getInputBasis reports the live basis', near(got.f.x, s) && near(got.r.z, -s));

  // an explicit basis argument overrides the live one (pure form)
  const p = screenToWorld(0, 1, { x: 0, z: 1 }, { x: 1, z: 0 });
  check('screenToWorld accepts an explicit basis', near(p.x, 0) && near(p.z, 1));
}

// ------------------------------------------------ 2) deadzone / analog fall --
{
  check('deadzone: inside is dead', applyDeadzone(0.1, 0).m === 0);
  check('deadzone: exactly at the edge is dead', applyDeadzone(GAMEPAD_DEADZONE, 0).m === 0);
  const full = applyDeadzone(1, 0);
  check('deadzone: full deflection reaches 1', near(full.m, 1) && near(full.x, 1), JSON.stringify(full));
  const half = applyDeadzone(0.59, 0);
  check('deadzone: rescales past the edge', near(half.m, (0.59 - 0.18) / 0.82, 1e-9),
    `m=${half.m}`);
  const diag = applyDeadzone(0.5, 0.5);
  check('deadzone: direction preserved on a diagonal',
    near(diag.x, diag.y) && near(Math.hypot(diag.x, diag.y), diag.m),
    JSON.stringify(diag));
  const slow = applyDeadzone(0.35, 0);
  check('deadzone: slow walking survives', slow.m > 0 && slow.m < 0.35, `m=${slow.m}`);
}

// ------------------------------------------------- 3) gamepad button mapping --
{
  check('padIntent: no pad -> null', padIntent(null) === null);
  const i = padIntent(pad({ down: [PAD_BUTTONS.kick] }));
  check('pad A/Cross = kick', i.kick === true && i.slide === false);
  const j = padIntent(pad({ down: [PAD_BUTTONS.slide, PAD_BUTTONS.camera] }));
  check('pad B/Circle = slide, Y/Triangle = camera', j.slide === true && j.camera === true && j.kick === false);
  const stick = padIntent(pad({ ax: [1, -1] }));
  check('pad stick up is -y on the wire, +up for us', stick.up > 0 && stick.right > 0,
    JSON.stringify(stick));
  const dpad = padIntent(pad({ down: [PAD_BUTTONS.dpadRight, PAD_BUTTONS.dpadUp] }));
  check('pad d-pad fills in for an idle stick', dpad.right === 1 && dpad.up === 1);
  const both = padIntent(pad({ ax: [-1, 0], down: [PAD_BUTTONS.dpadRight] }));
  check('pad stick wins over the d-pad', both.right < 0, JSON.stringify(both));
  check('padPressed accepts bare numbers', padPressed(1) && !padPressed(0.2) && !padPressed(null));
}

// ------------------------------------------ 4) connect / disconnect handling --
{
  check('connectedPads skips holes', connectedPads([null, pad(), undefined, pad()]).length === 2);
  check('connectedPads skips disconnected', connectedPads([{ connected: false, axes: [], buttons: [] }]).length === 0);
  check('connectedPads tolerates nothing at all', connectedPads(null).length === 0);

  usePads();
  const c = new KeyboardController([P1_KEYS, P1_ALT_KEYS]);
  const idle = c.update();
  check('unplugged pad leaves the player still', near(idle.x, 0) && near(idle.z, 0));
  usePads(pad({ ax: [1, 0] }));
  check('hot-plugged pad is picked up on the next frame',
    Math.hypot(c.update().x, c.update().z) > 0.5);
  usePads();
  check('unplugging mid-press does not stick', near(c.update().x, 0) && near(c.update().z, 0));
}

// ----------------------------------------- 5) keyboard + gamepad merge rules --
{
  setInputBasis(0, 1, 1, 0); // screen-up = +z, screen-right = +x
  clearKeys();
  usePads();
  const c = new KeyboardController([P1_KEYS, P1_ALT_KEYS]);

  setKeyDown(P1_KEYS.up, true);
  const kbOnly = c.update();
  check('keyboard alone drives the player', near(kbOnly.z, 1) && near(kbOnly.x, 0), JSON.stringify(kbOnly));

  // a fully deflected stick pointing right, while W is held: keyboard wins
  usePads(pad({ ax: [1, 0] }));
  const bothHeld = c.update();
  check('keyboard beats the stick on movement', near(bothHeld.z, 1) && near(bothHeld.x, 0),
    JSON.stringify(bothHeld));

  // ...but the pad's kick button still fires while the keyboard steers
  usePads(pad({ ax: [1, 0], down: [PAD_BUTTONS.kick] }));
  check('pad kick merges with keyboard movement', c.update().kick === true);

  setKeyDown(P1_KEYS.up, false);
  const padOnly = c.update();
  check('stick takes over when the keys are released', padOnly.x > 0.9 && near(padOnly.z, 0),
    JSON.stringify(padOnly));

  // analog magnitude survives the whole pipeline, so half-tilt = slow walk
  usePads(pad({ ax: [0.5, 0] }));
  const slow = c.update();
  const mag = Math.hypot(slow.x, slow.z);
  check('analog magnitude reaches the game layer', mag > 0.2 && mag < 0.5, `|v|=${mag.toFixed(3)}`);

  // keyboard kick also fires with no pad at all
  usePads();
  setKeyDown(P1_KEYS.kick, true);
  check('keyboard kick still works with no pad', c.update().kick === true);
  setKeyDown(P1_KEYS.kick, false);
  setKeyDown(P1_KEYS.slide, true);
  check('keyboard slide still works', c.update().slide === true);
  clearKeys();

  // pure merge rule, independent of any device
  const merged = mergeIntents([
    { right: 0, up: 1, kick: false, slide: false },
    { right: 0.9, up: 0, kick: true, slide: false },
  ]);
  check('mergeIntents ORs buttons, picks the strongest push',
    merged.kick === true && near(merged.up, 1) && near(merged.right, 0), JSON.stringify(merged));
  const tie = mergeIntents([{ right: 1, up: 0 }, { right: -1, up: 0 }]);
  check('mergeIntents breaks ties for the earlier source', near(tie.right, 1));
  check('mergeIntents ignores absent sources', mergeIntents([null, undefined]).right === 0);

  const held = new Set([P1_KEYS.right, P1_ALT_KEYS.right]);
  check('keyboardIntent clamps the union of maps',
    keyboardIntent([P1_KEYS, P1_ALT_KEYS], held).right === 1);
}

// --------------------------------------------------- 6) per-player pad slots --
{
  setInputBasis(0, 1, 1, 0);
  clearKeys();
  const p1 = new KeyboardController([P1_KEYS, P1_ALT_KEYS]);
  const p2 = new KeyboardController(P2_KEYS);
  check('slot detection: P1 maps -> pad 0', p1.slot === 0);
  check('slot detection: P2 map -> pad 1', p2.slot === 1);
  usePads(pad({ ax: [1, 0] }), pad({ ax: [-1, 0] }));
  const a = p1.update(), b = p2.update();
  check('player one reads the first pad', a.x > 0.9, JSON.stringify(a));
  check('player two reads the second pad', b.x < -0.9, JSON.stringify(b));
  check('touch is player one only', p1.useTouch === true && p2.useTouch === false);

  // Y/Triangle is reported as a rising edge; wiring it to the camera is the
  // coordinator's call (main.js owns the 'V' cycle today).
  usePads(pad({ down: [PAD_BUTTONS.camera] }));
  check('camera button reports one edge, not a stream',
    p1.update().camera === true && p1.update().camera === false);
  setGamepadSource(null);
}

// ------------------------------------------------------- 7) touch detection --
{
  check('no touch controls are built headlessly', ensureTouchControls() === null);
  check('isTouchDevice is false without a window', isTouchDevice() === false);
  check('getTouchControls stays null', getTouchControls() === null);
}

// ------------------------------------------------ 7b) touch stick behaviour --
// A hand-rolled element stub is enough to drive the pointer maths: the widget
// only reads clientX/clientY and writes class names and transforms. The look
// of the overlay itself is left to visual verification.
{
  const nodes = [];
  function el() {
    const n = {
      className: '', id: '', textContent: '', style: {}, children: [],
      listeners: {},
      classList: {
        set: new Set(),
        add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); },
        toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); },
        contains(c) { return this.set.has(c); },
      },
      appendChild(c) { n.children.push(c); c.parentNode = n; return c; },
      removeChild(c) { const i = n.children.indexOf(c); if (i >= 0) n.children.splice(i, 1); c.parentNode = null; return c; },
      append(...cs) { for (const c of cs) n.appendChild(c); },
      addEventListener(type, fn) { (n.listeners[type] ||= []).push(fn); },
      setPointerCapture() {}, releasePointerCapture() {},
      fire(type, ev) { for (const fn of n.listeners[type] || []) fn({ preventDefault() {}, ...ev }); },
    };
    nodes.push(n);
    return n;
  }
  const body = el(), head = el();
  globalThis.document = { body, head, createElement: el, getElementById: () => null };

  const tc = ensureTouchControls({ force: true, root: body });
  check('touch: force-built on demand', !!tc && getTouchControls() === tc);
  check('touch: overlay is attached to the root', body.children.includes(tc.el));
  check('touch: class hooks are in place',
    tc.el.className === 'gn-touch' && tc.zone.className === 'gn-touch-zone'
    && tc.kickBtn.textContent === 'ŞUT' && tc.slideBtn.textContent === 'KAYMA');

  // touch-down anchors the stick wherever the thumb landed
  tc.zone.fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 });
  check('touch: stick anchors at the touch point',
    tc.stick.style.left === '100px' && tc.stick.style.top === '300px'
    && tc.stick.classList.contains('on'));
  check('touch: a fresh press alone does not move the player',
    tc.state.right === 0 && tc.state.up === 0);

  tc.zone.fire('pointermove', { pointerId: 1, clientX: 160, clientY: 300 });
  check('touch: drag right is screen-right', tc.state.right > 0.9 && near(tc.state.up, 0, 1e-9),
    JSON.stringify(tc.state));
  tc.zone.fire('pointermove', { pointerId: 1, clientX: 100, clientY: 240 });
  check('touch: drag up is screen-up (y grows downward)', tc.state.up > 0.9,
    JSON.stringify(tc.state));
  tc.zone.fire('pointermove', { pointerId: 1, clientX: 118, clientY: 300 });
  const partial = Math.hypot(tc.state.right, tc.state.up);
  check('touch: partial drag walks slowly', partial > 0 && partial < 0.5, `|v|=${partial.toFixed(3)}`);
  tc.zone.fire('pointermove', { pointerId: 1, clientX: 103, clientY: 300 });
  check('touch: tiny wobble inside the deadzone is ignored',
    tc.state.right === 0 && tc.state.up === 0);
  tc.zone.fire('pointermove', { pointerId: 2, clientX: 400, clientY: 300 });
  check('touch: a second finger does not hijack the stick', tc.state.right === 0);

  // a P1 controller folds the touch state in exactly like extra keys
  setInputBasis(0, 1, 1, 0);
  clearKeys();
  setGamepadSource(() => []);
  const c = new KeyboardController([P1_KEYS, P1_ALT_KEYS]);
  tc.zone.fire('pointermove', { pointerId: 1, clientX: 160, clientY: 300 });
  const moved = c.update();
  check('touch: movement reaches the controller through the camera basis',
    moved.x > 0.9 && near(moved.z, 0, 1e-9), JSON.stringify(moved));

  tc.kickBtn.fire('pointerdown', { pointerId: 3 });
  check('touch: ŞUT is hold-to-charge', c.update().kick === true && tc.kickBtn.classList.contains('on'));
  tc.kickBtn.fire('pointerup', { pointerId: 3 });
  check('touch: releasing ŞUT lets the shot go', c.update().kick === false);
  tc.slideBtn.fire('pointerdown', { pointerId: 4 });
  check('touch: KAYMA taps', c.update().slide === true);
  tc.slideBtn.fire('pointercancel', { pointerId: 4 });
  check('touch: a cancelled tap clears', c.update().slide === false);

  tc.zone.fire('pointerup', { pointerId: 1 });
  check('touch: lifting the thumb centres the stick',
    tc.state.right === 0 && tc.state.up === 0 && !tc.stick.classList.contains('on'));
  check('touch: player two never gets a touch pad',
    new KeyboardController(P2_KEYS).useTouch === false);

  destroyTouchControls();
  check('touch: destroy detaches the overlay and clears the singleton',
    getTouchControls() === null && !body.children.includes(tc.el));
  setGamepadSource(null);
  delete globalThis.document;
}

// ------------------------------------------------------ 8) name sanitizing ---
const { sanitizeName, deriveKeeperColor, teamPalette, shade, DEFAULT_TEAM_COLORS, PlayerView } =
  await import('../src/view/playerView.js');
{
  check('name: undefined -> no tag', sanitizeName(undefined) === '');
  check('name: non-string -> no tag', sanitizeName(42) === '');
  check('name: whitespace only -> no tag', sanitizeName('   ') === '');
  check('name: trimmed and collapsed', sanitizeName('  Ege   Erberk ') === 'Ege Erberk');
  check('name: turkish characters survive', sanitizeName('Şükrü') === 'Şükrü');
  const long = sanitizeName('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  check('name: capped at 14', long.length === 14 && long.endsWith('…'), long);
  check('name: custom cap honoured', sanitizeName('abcdefgh', 4).length === 4);
  check('name: control characters stripped',
    sanitizeName('Eg eX') === 'Eg e X', JSON.stringify(sanitizeName('Eg eX')));
}

// ------------------------------------------------ 9) team / keeper colours ---
{
  const pal = teamPalette();
  check('palette: no config falls back to red/blue',
    pal.jersey[0] === DEFAULT_TEAM_COLORS[0] && pal.jersey[1] === DEFAULT_TEAM_COLORS[1]);
  const custom = teamPalette([0x00ff00, 0xffffff]);
  check('palette: config.teamColors is used', custom.jersey[0] === 0x00ff00 && custom.jersey[1] === 0xffffff);
  const broken = teamPalette(['nope', null]);
  check('palette: malformed entries fall back', broken.jersey[0] === DEFAULT_TEAM_COLORS[0]);
  check('palette: shorts are darker than the shirt',
    new THREE.Color(pal.shorts[0]).getHSL({}).l < new THREE.Color(pal.jersey[0]).getHSL({}).l);

  for (const base of [DEFAULT_TEAM_COLORS[0], DEFAULT_TEAM_COLORS[1], 0x00ff00, 0x808080, 0x000000]) {
    const k = deriveKeeperColor(base);
    const ok = Number.isInteger(k) && k >= 0 && k <= 0xffffff && k !== base;
    check(`keeper accent derived from #${base.toString(16).padStart(6, '0')}`, ok,
      `#${k.toString(16).padStart(6, '0')}`);
  }
  check('keeper accent is deterministic',
    deriveKeeperColor(0xe23b3b) === deriveKeeperColor(0xe23b3b));
  {
    const hsl = {};
    new THREE.Color(deriveKeeperColor(0xe23b3b)).getHSL(hsl);
    const base = {};
    new THREE.Color(0xe23b3b).getHSL(base);
    const dh = Math.abs(hsl.h - base.h);
    check('keeper accent shifts hue well away from the shirt',
      Math.min(dh, 1 - dh) > 0.3 && hsl.l >= base.l, JSON.stringify(hsl));
  }
  check('shade lightens and darkens', shade(0x808080, 0.2) > 0x808080 && shade(0x808080, -0.2) < 0x808080);
}

// ------------------------------------------- 10) PlayerView smoke (stub DOM) --
{
  // A canvas stub is enough: three only records the element until it uploads.
  const ctx2d = new Proxy({}, {
    get: (t, k) => {
      if (k === 'measureText') return (s) => ({ width: String(s).length * 16 });
      if (k in t) return t[k];
      return () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }),
  };

  const scene = new THREE.Scene();
  const mk = (over = {}) => ({
    team: 0, role: 'field', pos: { x: 1, z: 2 }, vel: { x: 0, z: 0 },
    facing: 0, charge: 0, kickAnim: 0, headerAnim: 0, jumpY: 0,
    down: 0, downTotal: 1, tumbleSpin: 0, dive: 0, diveTotal: 0.55,
    diveRecover: 0, diveKind: 'dive', diveDir: { x: 1, z: 0 },
    speed: () => 0, ...over,
  });

  const named = new PlayerView(mk({ mpName: '  Ege  ' }), scene, [0x00ff00, 0x123456]);
  check('view: body group is added to the scene', scene.children.includes(named.group));
  check('view: jersey uses the configured team colour',
    named.group.children[0].material.color.getHex() === 0x00ff00);
  check('view: charge ring uses the configured team colour',
    named.ring.material.color.getHex() === 0x00ff00);
  check('view: name tag is a camera-facing sprite', named.tag instanceof THREE.Sprite);
  check('view: name tag text is sanitized', named.tagName === 'Ege');
  check('view: name tag is added to the scene, not the body group',
    scene.children.includes(named.tag) && !named.group.children.includes(named.tag));

  named.update(0.016);
  check('view: tag floats above the head at the player position',
    named.tag.visible === true && near(named.tag.position.x, 1) && near(named.tag.position.z, 2)
    && named.tag.position.y > 1.8, JSON.stringify(named.tag.position));

  named.player.down = 0.5;
  named.update(0.016);
  check('view: tag hides while ragdolled', named.tag.visible === false);

  const keeper = new PlayerView(mk({ role: 'keeper', team: 1, mpName: 'K' }), scene, [0x00ff00, 0x123456]);
  check('view: keeper jersey is the derived accent, not the shirt',
    keeper.group.children[0].material.color.getHex() === deriveKeeperColor(0x123456));

  named.player.down = 0;
  named.setName('Rename');
  named.update(0.016);
  check('view: setName rebuilds the tag in place',
    named.tagName === 'Rename' && scene.children.includes(named.tag) && named.tag.visible === true);
  const dropped = named.tag;
  named.setName('');
  check('view: setName("") removes the tag',
    named.tag === null && !scene.children.includes(dropped));
  named.setName('  Ege  ');

  const anon = new PlayerView(mk({ mpName: '' }), scene);
  check('view: empty mpName means no tag at all', anon.tag === null);
  const missing = new PlayerView(mk(), scene);
  check('view: missing mpName means no tag at all', missing.tag === null);

  const before = scene.children.length;
  const tag = named.tag;
  named.dispose();
  check('view: dispose drops both the body and the tag',
    scene.children.length === before - 2
    && !scene.children.includes(tag) && named.tag === null, `${before} -> ${scene.children.length}`);
  let threw = false;
  try { keeper.dispose(); anon.dispose(); missing.dispose(); } catch { threw = true; }
  check('view: dispose is safe with and without a tag', !threw);

  delete globalThis.document;
}

console.log(failures ? `\n${failures} FAILED` : '\nall input/identity checks passed');
process.exit(failures ? 1 : 0);
