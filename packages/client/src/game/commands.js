// Chat commands: change your own shirt without leaving the match.
//
// The kit and the squad number are cosmetic, and cosmetic things should be
// changeable where the player already is — in the chat box, mid-match, without
// a settings screen. `/numara 10` and `/forma sari-lacivert` are the whole
// feature.
//
// Everything here is pure: parse() turns a line into an intent, and the caller
// decides what to do with it. That is what lets the same parser serve the
// multiplayer chat, the single-player console hook and the tests, and it is why
// nothing in this file touches the DOM or the scene.
//
// A command is never broadcast as chat. Typing `/numara 10` in a room sends
// nothing to anyone; it changes your shirt and prints a local line.

import { KIT_PRESETS } from '../view/kitTexture.js';

/** Shirt numbers a player may pick. 0 is not a football number. */
export const MIN_NUMBER = 1;
export const MAX_NUMBER = 99;

/** What the presets look like, for `/forma liste`. */
const KIT_LABELS = Object.freeze({
  'sari-kirmizi': 'sarı-kırmızı çubuklu',
  'sari-lacivert': 'sarı-lacivert çubuklu',
  'siyah-beyaz': 'siyah-beyaz çubuklu',
  'bordo-mavi': 'bordo-mavi yarım',
  'kirmizi-beyaz': 'kırmızı-beyaz enine',
  'mavi-beyaz': 'mavi-beyaz çapraz',
  'yesil-beyaz': 'yeşil-beyaz çubuklu',
  'turuncu-lacivert': 'turuncu-lacivert enine',
});

/** Every kit name, in the order the list prints them. */
export function kitNames() {
  return Object.keys(KIT_PRESETS);
}

function kitList() {
  return kitNames().map((k) => `${k} (${KIT_LABELS[k] || k})`).join(', ');
}

/**
 * Turn one typed line into an intent.
 *
 * @param {string} line what the player typed
 * @returns {{kind:'chat'|'number'|'kit'|'info'|'error', text?:string,
 *            number?:number, kit?:string}}
 *   `chat` means it was not a command and should be sent as a message.
 */
export function parse(line) {
  const raw = typeof line === 'string' ? line.trim() : '';
  if (!raw.startsWith('/')) return { kind: 'chat', text: raw };

  const [head, ...rest] = raw.slice(1).split(/\s+/);
  const cmd = head.toLowerCase();
  const arg = rest.join(' ').trim();

  if (cmd === 'numara' || cmd === 'number') {
    if (!arg) return { kind: 'error', text: `Kullanım: /numara <${MIN_NUMBER}-${MAX_NUMBER}>` };
    // Number('') is 0 and Number('7x') is NaN; both must be refused, and a
    // decimal must not silently become a different shirt.
    const n = Number(arg);
    if (!Number.isInteger(n) || n < MIN_NUMBER || n > MAX_NUMBER) {
      return { kind: 'error', text: `Numara ${MIN_NUMBER} ile ${MAX_NUMBER} arasında bir tam sayı olmalı.` };
    }
    return { kind: 'number', number: n, text: `Forma numaran: ${n}` };
  }

  if (cmd === 'forma' || cmd === 'kit' || cmd === 'avatar') {
    if (!arg || arg.toLowerCase() === 'liste' || arg.toLowerCase() === 'list') {
      return { kind: 'info', text: `Formalar: ${kitList()}` };
    }
    const key = arg.toLowerCase().replace(/\s+/g, '-');
    if (!KIT_PRESETS[key]) {
      return { kind: 'error', text: `"${arg}" diye bir forma yok. /forma liste ile bak.` };
    }
    return { kind: 'kit', kit: key, text: `Forman: ${KIT_LABELS[key] || key}` };
  }

  if (cmd === 'yardim' || cmd === 'help' || cmd === '?') {
    return {
      kind: 'info',
      text: '/numara <1-99> · /forma <ad> · /forma liste · /yardim',
    };
  }

  return { kind: 'error', text: `Bilinmeyen komut: /${cmd} — /yardim yaz.` };
}

/**
 * Run a line against a player view and say what happened.
 *
 * Kept separate from parse() so the parsing stays testable without a renderer,
 * and so a caller with no view (a spectator, the lobby) can still parse.
 *
 * @param {string} line
 * @param {{setKit?:(spec:object)=>void}} view the local player's view
 * @returns {{kind:string, text:string}} what to print locally, or the chat to send
 */
export function apply(line, view) {
  const intent = parse(line);
  if (intent.kind === 'number' && view?.setKit) view.setKit({ number: intent.number });
  if (intent.kind === 'kit' && view?.setKit) view.setKit({ kit: intent.kit });
  return intent;
}
