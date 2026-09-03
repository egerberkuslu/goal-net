// What the commentator says, and when he is allowed to say it.
//
// Eleven short Turkish lines, one per match event that deserves a voice. They
// mirror the HUD messages in game/game.js word for word, so the ear and the eye
// never disagree about what just happened. Recorded once by tools/make-voice.mjs
// in the player's own cloned voice; played by view/sfx.js.
//
// This module has no three.js and no DOM so that both the generator (node, at
// tool time) and the test (node, headless) can import the same table the game
// reads. If the table and the clips on disk ever drift apart, the test says so.
//
// What is deliberately NOT here: kick (fires several times a second), ragdoll,
// shoulder, keeper-release. A commentator who narrates every touch is noise.

export const VOICE_LINES = Object.freeze([
  { id: 'gol', text: 'Gooool!', events: ['goal'], priority: 2 },
  { id: 'altin-gol', text: 'Altın gol!', events: ['golden'], priority: 2 },
  { id: 'direk', text: 'Direk!', events: ['post', 'crossbar'], priority: 1 },
  { id: 'faul', text: 'Faul!', events: ['foul'], priority: 1 },
  { id: 'kurtardi', text: 'Kurtardı!', events: ['catch'], priority: 1 },
  { id: 'penalti', text: 'Penaltı!', events: ['penalty'], priority: 1 },
  { id: 'devre', text: 'Devre arası.', events: ['half'], priority: 1 },
  { id: 'tac', text: 'Taç!', events: ['throwin'], priority: 0 },
  { id: 'korner', text: 'Korner!', events: ['corner'], priority: 0 },
  { id: 'kale-vurusu', text: 'Kale vuruşu!', events: ['goalkick'], priority: 0 },
  { id: 'serbest-vurus', text: 'Serbest vuruş!', events: ['freekick'], priority: 0 },
]);

/** event type -> line id, derived once so the two can never disagree. */
export const LINE_FOR_EVENT = Object.freeze(
  VOICE_LINES.reduce((acc, line) => {
    for (const ev of line.events) acc[ev] = line.id;
    return acc;
  }, Object.create(null)),
);

/** Lines never come closer together than this, whatever happens. */
export const MIN_GAP_MS = 1200;
/** The same line is not repeated within this window: a ball pinballing off
 *  the boards is one throw-in, not four. */
export const REPEAT_MS = 4000;
/** On a whistle event the referee goes first, then the commentator. */
export const WHISTLE_DELAY_MS = 250;
export const WHISTLE_EVENTS = new Set(['throwin', 'goalkick', 'corner']);

/** Fresh anti-spam state; one per Sfx. */
export function createVoiceState() {
  return { lastAt: -Infinity, lastId: null, busyUntil: 0 };
}

/**
 * Which line, if any, an event earns right now.
 *
 * Pure, so it can be driven from a test with a fake clock. It reads and writes
 * `state` (lastAt, lastId) but never `busyUntil`: the caller sets that from the
 * real decoded duration of the clip it started, which this module cannot know.
 *
 * Priority 2 (a goal) beats everything — the gap, the repeat rule and a line
 * still in flight. That is what a goal is.
 *
 * @param {{lastAt:number, lastId:string|null, busyUntil:number}} state
 * @param {string} eventType
 * @param {number} nowMs
 * @returns {string|null} the line id, or null for silence
 */
export function pickVoice(state, eventType, nowMs) {
  const id = LINE_FOR_EVENT[eventType];
  if (!id) return null;
  const line = VOICE_LINES.find((l) => l.id === id);
  if (line.priority < 2) {
    if (nowMs < state.busyUntil) return null;
    if (nowMs - state.lastAt < MIN_GAP_MS) return null;
    if (state.lastId === id && nowMs - state.lastAt < REPEAT_MS) return null;
  }
  state.lastAt = nowMs;
  state.lastId = id;
  return id;
}
