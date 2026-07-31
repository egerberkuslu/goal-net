import { CAM_MODES } from '../view/cameraRig.js';
import { P1_KEYS, P2_KEYS, saveKeyOverrides } from './input.js';

const KEY_ROWS = [
  ['Yukarı', 'up'], ['Aşağı', 'down'], ['Sol', 'left'], ['Sağ', 'right'],
  ['Şut', 'kick'], ['Kayma', 'slide'],
];

function keyLabel(code) {
  return String(code || '?')
    .replace('Key', '').replace('Arrow', '')
    .replace('ShiftLeft', 'Sol Shift').replace('ShiftRight', 'Sağ Shift')
    .replace('Up', '↑').replace('Down', '↓').replace('Left', '←').replace('Right', '→');
}

// ESC overlay: resume, camera mode, volume, key rebinding, exit to menu.
// In multiplayer the simulation cannot stop, so the overlay only floats.
export class PauseMenu {
  // hooks: { getRig(), sfx, isMp(), onExit() }
  constructor(hooks) {
    this.hooks = hooks;
    this.active = false;
    this.capture = null; // {map, key, btn} while waiting for a key press
    const $ = (id) => document.getElementById(id);
    this.el = {
      root: $('pause'), hint: $('pauseHint'), cam: $('pauseCam'),
      vol: $('pauseVol'), volVal: $('pauseVolVal'), keys: $('pauseKeys'),
      resume: $('pauseResume'), exit: $('pauseExit'),
    };
    this.el.resume.addEventListener('click', () => this.hide());
    this.el.exit.addEventListener('click', () => { this.hide(); hooks.onExit(); });
    this.el.vol.addEventListener('input', () => {
      hooks.sfx.setVolume(this.el.vol.value / 100);
      this.el.volVal.textContent = `${this.el.vol.value}%`;
    });
    this.#buildCam();
    this.#buildKeys();
    addEventListener('keydown', (e) => this.#onKey(e), true);
  }

  toggle() { this.active ? this.hide() : this.show(); }

  show() {
    this.active = true;
    this.el.root.classList.remove('hidden');
    this.el.hint.textContent = this.hooks.isMp()
      ? 'Çok oyunculuda oyun durmaz — ESC ile kapat'
      : 'ESC ile devam';
    this.el.vol.value = Math.round(this.hooks.sfx.volume * 100);
    this.el.volVal.textContent = `${this.el.vol.value}%`;
    this.#refreshCam();
    this.#refreshKeys();
  }

  hide() {
    this.active = false;
    this.capture = null;
    this.el.root.classList.add('hidden');
  }

  #buildCam() {
    for (const m of CAM_MODES) {
      const b = document.createElement('button');
      b.textContent = m.label.replace('Kamera: ', '');
      b.dataset.mode = m.id;
      b.addEventListener('click', () => {
        const rig = this.hooks.getRig();
        while (rig.mode !== m.id) rig.cycle();
        this.#refreshCam();
      });
      this.el.cam.appendChild(b);
    }
  }

  #refreshCam() {
    const mode = this.hooks.getRig()?.mode;
    for (const b of this.el.cam.children) b.classList.toggle('on', b.dataset.mode === mode);
  }

  #buildKeys() {
    const grid = this.el.keys;
    const head = (txt) => {
      const s = document.createElement('span');
      s.className = 'mp-setlabel'; s.textContent = txt;
      grid.appendChild(s);
    };
    head(''); head('Kırmızı (P1)'); head(''); head('Mavi (P2)');
    this.keyButtons = [];
    for (const [label, key] of KEY_ROWS) {
      for (const map of [P1_KEYS, P2_KEYS]) {
        const l = document.createElement('span');
        l.className = 'mp-setlabel'; l.textContent = label;
        const b = document.createElement('button');
        b.className = 'mp-small mp-ghost';
        b.addEventListener('click', () => {
          this.capture = { map, key, btn: b };
          b.textContent = '…tuşa bas';
        });
        this.keyButtons.push({ map, key, btn: b });
        grid.append(l, b);
      }
    }
  }

  #refreshKeys() {
    for (const { map, key, btn } of this.keyButtons) btn.textContent = keyLabel(map[key]);
  }

  #onKey(e) {
    if (!this.capture) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code !== 'Escape') {
      this.capture.map[this.capture.key] = e.code;
      saveKeyOverrides();
    }
    this.capture = null;
    this.#refreshKeys();
  }
}
