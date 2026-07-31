// Chat surfaces for the network match: a panel inside the lobby overlay and a
// small in-match overlay opened with T. All DOM is built here (index.html is
// off limits), all text goes in through textContent, and every key event that
// belongs to the chat input is stopped at the target so the game's window-level
// keyboard listeners never see it.

import { MAX_CHAT, sanitizeChat } from './protocol.js';

/** Canned lines bound to keys 1-4 while a network match runs. */
export const QUICK_MESSAGES = Object.freeze([
  'İyi gol!', 'Şanslıydı!', 'Pas ver!', 'Savunma!',
]);

/** How many lines the in-match overlay shows. */
const OVERLAY_LINES = 4;
/** How long an in-match line stays before it fades (ms). */
const OVERLAY_FADE_MS = 6000;
/** Lines kept in the lobby log. */
const LOG_LIMIT = 60;

const STYLE_ID = 'mp-chat-style';

const CSS = `
.mp-chat { display: flex; flex-direction: column; gap: 6px; margin: 14px auto 0;
  width: min(520px, 92%); text-align: left; }
.mp-chat-log { list-style: none; margin: 0; padding: 8px 10px; height: 132px;
  overflow-y: auto; border-radius: 12px; background: rgba(4, 8, 20, .5);
  border: 1px solid rgba(120, 150, 220, .28); display: flex; flex-direction: column; gap: 4px; }
.mp-chat-line { font-size: 14px; line-height: 1.35; color: #dce6ff; word-break: break-word; }
.mp-chat-line .mp-chat-from { color: #9fb0d8; font-weight: 700; margin-right: 6px; }
.mp-chat-line.is-own .mp-chat-from { color: #7fa6ff; }
.mp-chat-line.is-sys { color: #9fb0d8; font-style: italic; }
.mp-chat-row { display: flex; gap: 6px; }
.mp-chat-row input { flex: 1; }
.overlay .mp-chat-row button { margin: 0; padding: 8px 16px; font-size: 14px; border-radius: 10px; }
.mp-chat-empty { color: #7f8ec0; font-size: 13px; font-style: italic; }

#mpChatOverlay { position: fixed; left: 16px; bottom: 90px; z-index: 40;
  display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
  pointer-events: none; font-family: inherit; max-width: min(420px, 60vw); }
#mpChatOverlay.hidden { display: none; }
#mpChatOverlay .mp-chat-line { background: rgba(4, 8, 20, .62); padding: 4px 10px;
  border-radius: 9px; font-size: 14px; transition: opacity .5s ease; }
#mpChatOverlay .mp-chat-line.fade { opacity: 0; }
#mpChatEntry { pointer-events: auto; display: flex; gap: 6px; align-items: center;
  background: rgba(4, 8, 20, .78); padding: 6px 8px; border-radius: 10px;
  border: 1px solid rgba(120, 150, 220, .4); }
#mpChatEntry.hidden { display: none; }
#mpChatEntry .mp-chat-caret { color: #9fb0d8; font-size: 13px; font-weight: 700; }
#mpChatEntry input { width: 260px; border: 0; outline: none; background: transparent;
  color: #eef3ff; font: inherit; font-size: 14px; }
#mpChatHint { color: #9fb0d8; font-size: 12px; background: rgba(4, 8, 20, .55);
  padding: 3px 8px; border-radius: 8px; }
#mpChatHint.hidden { display: none; }
`;

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** True when the user is typing somewhere else (name field, code field...). */
function typingElsewhere() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
}

export class ChatUI {
  /**
   * @param {{onSend?:(text:string)=>void, isInMatch?:()=>boolean,
   *          canChat?:()=>boolean}} [callbacks]
   */
  constructor(callbacks = {}) {
    this.cb = {
      onSend: () => {},
      isInMatch: () => false,
      canChat: () => false,
      ...callbacks,
    };
    this.lines = [];          // {from, text, own, sys}
    this.overlayTimers = new Set();
    this.mounted = false;
    if (typeof document === 'undefined') return;
    injectStyle();
    this.#buildLobbyPanel();
    this.#buildMatchOverlay();
    this.#bindKeys();
    this.mounted = true;
  }

  // ---------- public API ----------

  /**
   * Show one line on both surfaces.
   * @param {{from?:string, text:string, own?:boolean, sys?:boolean}} line
   */
  push(line) {
    const text = sanitizeChat(line?.text);
    if (!text) return;
    const entry = { from: line.from ?? '', text, own: !!line.own, sys: !!line.sys };
    this.lines.push(entry);
    if (this.lines.length > LOG_LIMIT) this.lines.shift();
    if (!this.mounted) return;
    this.#appendToLog(entry);
    this.#appendToOverlay(entry);
  }

  /** Local-only notice (joins, drops, reconnects). */
  system(text) {
    this.push({ text, sys: true });
  }

  /** Attach the lobby panel to the lobby overlay (idempotent). */
  mountLobby(container) {
    if (!this.mounted || !container || this.panel.parentElement === container) return;
    container.appendChild(this.panel);
  }

  /** Match started/ended: only the in-match overlay follows this. */
  setInMatch(on) {
    if (!this.mounted) return;
    this.overlay.classList.toggle('hidden', !on);
    if (!on) this.closeEntry();
  }

  /** Wipe both surfaces (leaving a room). */
  clear() {
    this.lines.length = 0;
    if (!this.mounted) return;
    this.log.textContent = '';
    this.overlay.textContent = '';
    this.overlay.append(this.entry, this.hint);
    this.#renderEmpty();
    this.closeEntry();
  }

  /** Close the in-match input without sending. */
  closeEntry() {
    if (!this.mounted) return;
    this.entry.classList.add('hidden');
    this.hint.classList.add('hidden');
    this.entryInput.value = '';
    if (document.activeElement === this.entryInput) this.entryInput.blur();
  }

  /** @returns {boolean} true while the in-match input has focus */
  get isTyping() {
    return this.mounted && !this.entry.classList.contains('hidden');
  }

  // ---------- construction ----------

  #buildLobbyPanel() {
    const panel = document.createElement('div');
    panel.className = 'mp-chat';
    panel.id = 'mpChat';

    const label = document.createElement('span');
    label.className = 'mp-label';
    label.textContent = 'Sohbet';

    const log = document.createElement('ul');
    log.className = 'mp-chat-log';
    log.id = 'mpChatLog';

    const row = document.createElement('div');
    row.className = 'mp-chat-row';
    const input = document.createElement('input');
    input.id = 'mpChatInput';
    input.className = 'mp-input';
    input.type = 'text';
    input.maxLength = MAX_CHAT;
    input.placeholder = 'Mesaj yaz…';
    input.autocomplete = 'off';
    const send = document.createElement('button');
    send.id = 'mpChatSend';
    send.className = 'mp-small';
    send.textContent = 'Gönder';

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.#sendFrom(input); }
    }, true);
    input.addEventListener('keyup', (e) => e.stopPropagation(), true);
    send.addEventListener('click', () => this.#sendFrom(input));

    row.append(input, send);
    panel.append(label, log, row);

    this.panel = panel;
    this.log = log;
    this.lobbyInput = input;
    this.#renderEmpty();
  }

  #buildMatchOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'mpChatOverlay';
    overlay.className = 'hidden';

    const entry = document.createElement('div');
    entry.id = 'mpChatEntry';
    entry.className = 'hidden';
    const caret = document.createElement('span');
    caret.className = 'mp-chat-caret';
    caret.textContent = 'Mesaj:';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_CHAT;
    input.autocomplete = 'off';
    input.spellcheck = false;

    // Capture at the target so window-level game keys never see chat typing.
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.#sendFrom(input); this.closeEntry(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.closeEntry(); }
    }, true);
    input.addEventListener('keyup', (e) => e.stopPropagation(), true);
    input.addEventListener('keypress', (e) => e.stopPropagation(), true);

    entry.append(caret, input);

    const hint = document.createElement('div');
    hint.id = 'mpChatHint';
    hint.className = 'hidden';
    hint.textContent = 'Enter gönderir · Esc kapatır';

    overlay.append(entry, hint);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.entry = entry;
    this.entryInput = input;
    this.hint = hint;
  }

  #bindKeys() {
    addEventListener('keydown', (e) => {
      if (!this.cb.canChat()) return;
      if (this.isTyping || typingElsewhere()) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code === 'KeyT') { e.preventDefault(); this.openEntry(); return; }
      if (!this.cb.isInMatch()) return;
      const quick = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (quick >= 0) { e.preventDefault(); this.cb.onSend(QUICK_MESSAGES[quick]); }
    });
  }

  /** Open the in-match input (T). */
  openEntry() {
    if (!this.mounted || !this.cb.isInMatch()) return;
    this.entry.classList.remove('hidden');
    this.hint.classList.remove('hidden');
    this.entryInput.value = '';
    this.entryInput.focus();
  }

  // ---------- rendering ----------

  #sendFrom(input) {
    const text = sanitizeChat(input.value);
    input.value = '';
    if (!text) return;
    this.cb.onSend(text);
  }

  #renderEmpty() {
    if (this.log.children.length) return;
    const li = document.createElement('li');
    li.className = 'mp-chat-empty';
    li.dataset.empty = '1';
    li.textContent = 'Henüz mesaj yok.';
    this.log.appendChild(li);
  }

  #lineEl(entry) {
    const li = document.createElement('li');
    li.className = 'mp-chat-line';
    if (entry.own) li.classList.add('is-own');
    if (entry.sys) li.classList.add('is-sys');
    if (entry.from && !entry.sys) {
      const from = document.createElement('span');
      from.className = 'mp-chat-from';
      from.textContent = `${entry.from}:`;
      li.appendChild(from);
    }
    li.appendChild(document.createTextNode(entry.text));
    return li;
  }

  #appendToLog(entry) {
    const empty = this.log.querySelector('[data-empty]');
    if (empty) empty.remove();
    this.log.appendChild(this.#lineEl(entry));
    while (this.log.children.length > LOG_LIMIT) this.log.firstElementChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }

  #appendToOverlay(entry) {
    const el = this.#lineEl(entry);
    this.overlay.insertBefore(el, this.entry);
    const lines = [...this.overlay.querySelectorAll('.mp-chat-line')];
    for (const extra of lines.slice(0, Math.max(0, lines.length - OVERLAY_LINES))) extra.remove();
    const fade = setTimeout(() => {
      el.classList.add('fade');
      const drop = setTimeout(() => { el.remove(); this.overlayTimers.delete(drop); }, 600);
      this.overlayTimers.add(drop);
      this.overlayTimers.delete(fade);
    }, OVERLAY_FADE_MS);
    this.overlayTimers.add(fade);
  }
}
