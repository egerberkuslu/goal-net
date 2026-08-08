// Quick chat and emote surfaces for the arena.
//
// Same house rules as src/mp/chatUI.js, which this deliberately does not fork:
// all DOM is built here (index.html is off limits), all text goes in through
// textContent, and no key event that belongs to a control reaches the window
// listeners the game installs.
//
// What is different from the shipping chat is that there is no text field at
// all. A player presses a number for a phrase or holds V for the emote wheel,
// and every line carries a "sustur" button, because the mute is the actual
// moderation tool and hiding it behind a menu is how it stops being used.

const STYLE_ID = 'arena-social-style';
const OVERLAY_LINES = 5;
const FADE_MS = 6000;

const CSS = `
#arenaSocial { position: fixed; left: 16px; bottom: 96px; z-index: 42;
  display: flex; flex-direction: column; gap: 5px; align-items: flex-start;
  pointer-events: none; font-family: inherit; max-width: min(440px, 62vw); }
#arenaSocial.hidden { display: none; }
.arena-social-line { background: rgba(4, 8, 20, .66); padding: 4px 10px;
  border-radius: 9px; font-size: 14px; color: #dce6ff; transition: opacity .5s ease;
  display: flex; gap: 8px; align-items: baseline; pointer-events: auto; }
.arena-social-line.fade { opacity: 0; }
.arena-social-line .who { color: #9fb0d8; font-weight: 700; }
.arena-social-line .mute { background: none; border: 0; color: #7f8ec0; font: inherit;
  font-size: 12px; cursor: pointer; padding: 0 2px; }
.arena-social-line .mute:hover { color: #ff9aa2; }

#arenaSocialWheel { position: fixed; inset: 0; z-index: 60; display: grid;
  place-items: center; background: rgba(2, 4, 12, .55); }
#arenaSocialWheel.hidden { display: none; }
.arena-wheel-box { background: rgba(6, 12, 28, .95); border: 1px solid rgba(120, 150, 220, .4);
  border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;
  max-width: min(560px, 92vw); }
.arena-wheel-box h3 { margin: 0; font-size: 15px; color: #9fb0d8; font-weight: 700; }
.arena-wheel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.arena-wheel-grid.emotes { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.arena-wheel-grid button { background: rgba(20, 32, 62, .9); color: #eef3ff; border: 1px solid rgba(120, 150, 220, .3);
  border-radius: 10px; padding: 9px 10px; font: inherit; font-size: 14px; cursor: pointer; text-align: left; }
.arena-wheel-grid button:hover { border-color: rgba(150, 190, 255, .8); }
.arena-wheel-grid button .key { color: #7fa6ff; font-weight: 700; margin-right: 6px; }
.arena-wheel-grid.emotes button { text-align: center; font-size: 22px; padding: 8px 0; }
.arena-wheel-hint { color: #7f8ec0; font-size: 12px; }
.arena-wheel-hint.warn { color: #ffb4a2; }
`;

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** True when the player is typing into a name or code field. */
function typingElsewhere() {
  const el = typeof document === 'undefined' ? null : document.activeElement;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
}

/**
 * ArenaSocialUI({ phrases, emotes, onSend, onMute, isMuted, canSend })
 *
 * The UI never decides whether a message may be sent — it calls `onSend` and
 * paints whatever `onSend` reports back, so the cooldown and the gag stay in
 * one place (the guard) instead of being duplicated in the view.
 */
export class ArenaSocialUI {
  constructor(options = {}) {
    this.phrases = options.phrases || [];
    this.emotes = options.emotes || [];
    this.cb = {
      onSend: options.onSend || (() => ({ ok: false, reason: 'no-handler' })),
      onMute: options.onMute || (() => {}),
      isMuted: options.isMuted || (() => false),
      canSend: options.canSend || (() => true),
    };
    this.el = null;
    this.wheel = null;
    this.lines = [];
    this.timers = new Set();
    this.keyHandler = null;
  }

  mount(root = typeof document !== 'undefined' ? document.body : null) {
    if (!root || this.el) return this;
    injectStyle();

    this.el = document.createElement('div');
    this.el.id = 'arenaSocial';
    this.el.className = 'hidden';
    root.appendChild(this.el);

    this.wheel = document.createElement('div');
    this.wheel.id = 'arenaSocialWheel';
    this.wheel.className = 'hidden';
    const box = document.createElement('div');
    box.className = 'arena-wheel-box';

    const h1 = document.createElement('h3');
    h1.textContent = 'Hazır mesajlar';
    const grid = document.createElement('div');
    grid.className = 'arena-wheel-grid';
    this.phrases.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = i < 9 ? String(i + 1) : '·';
      b.appendChild(key);
      b.appendChild(document.createTextNode(text));
      b.addEventListener('click', () => this.send(0, i));
      grid.appendChild(b);
    });

    const h2 = document.createElement('h3');
    h2.textContent = 'Emote';
    const emoteGrid = document.createElement('div');
    emoteGrid.className = 'arena-wheel-grid emotes';
    this.emotes.forEach((e, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e.glyph;
      b.title = e.label;
      b.setAttribute('aria-label', e.label);
      b.addEventListener('click', () => this.send(1, i));
      emoteGrid.appendChild(b);
    });

    this.hint = document.createElement('div');
    this.hint.className = 'arena-wheel-hint';
    this.hint.textContent = 'V ile aç/kapat · 1-9 hazır mesaj · Esc kapatır';

    box.append(h1, grid, h2, emoteGrid, this.hint);
    this.wheel.appendChild(box);
    this.wheel.addEventListener('click', (e) => {
      if (e.target === this.wheel) this.closeWheel();
    });
    root.appendChild(this.wheel);

    this.keyHandler = (e) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);
    return this;
  }

  onKey(e) {
    if (typingElsewhere() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && this.wheel && !this.wheel.classList.contains('hidden')) {
      this.closeWheel();
      e.preventDefault();
      return;
    }
    if (!this.cb.canSend()) return;
    if (e.key === 'v' || e.key === 'V') {
      this.toggleWheel();
      e.preventDefault();
      return;
    }
    if (e.key >= '1' && e.key <= '9') {
      const idx = Number(e.key) - 1;
      if (idx < this.phrases.length) {
        this.send(0, idx);
        e.preventDefault();
      }
    }
  }

  toggleWheel() {
    if (!this.wheel) return;
    this.wheel.classList.toggle('hidden');
  }

  closeWheel() {
    if (this.wheel) this.wheel.classList.add('hidden');
  }

  send(kind, id) {
    const res = this.cb.onSend(kind, id) || {};
    if (res.ok) {
      this.closeWheel();
      return res;
    }
    this.warn(res);
    return res;
  }

  /** Paint a refusal where the player is already looking. */
  warn(res) {
    if (!this.hint) return;
    const text = {
      cooldown: `Biraz bekle (${Math.ceil((res.retryInMs || 0) / 1000)} sn)`,
      repeat: 'Aynı mesajı üst üste gönderme.',
      burst: 'Çok hızlı gönderdin, kısa süre susturuldun.',
      gagged: 'Spam nedeniyle geçici olarak susturuldun.',
      'unknown-message': 'Böyle bir mesaj yok.',
      'not-connected': 'Bağlantı yok.',
    }[res.reason] || 'Mesaj gönderilemedi.';
    this.hint.textContent = text;
    this.hint.classList.add('warn');
    const t = setTimeout(() => {
      if (!this.hint) return;
      this.hint.textContent = 'V ile aç/kapat · 1-9 hazır mesaj · Esc kapatır';
      this.hint.classList.remove('warn');
      this.timers.delete(t);
    }, 2500);
    this.timers.add(t);
  }

  /** Show one inbound (or own) line. `who` is already display-formatted. */
  push({ who, text, fromId, own = false }) {
    if (!this.el || !text) return;
    this.el.classList.remove('hidden');

    const line = document.createElement('div');
    line.className = 'arena-social-line';
    const whoEl = document.createElement('span');
    whoEl.className = 'who';
    whoEl.textContent = `${who}:`;
    const textEl = document.createElement('span');
    textEl.textContent = text;
    line.append(whoEl, textEl);

    if (!own && fromId) {
      const mute = document.createElement('button');
      mute.type = 'button';
      mute.className = 'mute';
      mute.textContent = this.cb.isMuted(fromId) ? 'sesi aç' : 'sustur';
      mute.addEventListener('click', () => {
        const muted = this.cb.onMute(fromId);
        mute.textContent = muted ? 'sesi aç' : 'sustur';
      });
      line.appendChild(mute);
    }

    this.el.appendChild(line);
    this.lines.push(line);
    while (this.lines.length > OVERLAY_LINES) {
      const old = this.lines.shift();
      old.remove();
    }
    const t = setTimeout(() => {
      line.classList.add('fade');
      const t2 = setTimeout(() => {
        line.remove();
        const i = this.lines.indexOf(line);
        if (i >= 0) this.lines.splice(i, 1);
        if (!this.lines.length && this.el) this.el.classList.add('hidden');
        this.timers.delete(t2);
      }, 600);
      this.timers.add(t2);
      this.timers.delete(t);
    }, FADE_MS);
    this.timers.add(t);
  }

  dispose() {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.el?.remove();
    this.wheel?.remove();
    this.el = null;
    this.wheel = null;
    this.lines = [];
  }
}
