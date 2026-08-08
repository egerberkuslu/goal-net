// Quick chat and emotes (feature matrix #37).
//
// Free text is not on offer. A player picks from a fixed Turkish phrase list or
// an emote wheel, so the only thing that can be weaponised is TIMING and
// REPETITION — which is exactly the Rocket League lesson the design note cites:
// "What a save!" was never a content problem, it was a frequency problem, and
// the fix is a cooldown plus a mute the receiver controls, not a censor.
//
// Three guards, all deterministic, all clock-injected:
//
//   cooldown    one message per `cooldownMs` per player (default 2.5 s)
//   burst       more than `burstLimit` messages inside `burstWindowMs` gags the
//               sender for `gagMs`; the gag is the SENDER's, applied by the
//               host, and is what stops a scripted client
//   repeat      the same phrase `repeatLimit` times in a row is refused before
//               it ever reaches the burst counter
//
// And one thing the host has no say in: MUTE. A mute list lives on the
// receiver, is never transmitted, and is checked at render time. Two players
// can mute each other without either learning about it, which is the only
// design where muting is socially free.

/** Fixed phrase set. Index is the wire id; the list may only ever grow. */
export const QUICK_PHRASES = Object.freeze([
  'İyi oyun!',
  'Pas ver!',
  'Bende!',
  'Savunma!',
  'Kaleci çık!',
  'Güzel kurtarış!',
  'Sağ ol!',
  'Üzgünüm',
  'Toparlanalım',
  'Sıra sende',
  'Hazırım',
  'Bir dakika',
]);

/** Emote wheel. Index is the wire id. Label is what a screen reader gets. */
export const EMOTES = Object.freeze([
  Object.freeze({ id: 0, glyph: '👏', label: 'Alkış' }),
  Object.freeze({ id: 1, glyph: '😄', label: 'Gülümse' }),
  Object.freeze({ id: 2, glyph: '😮', label: 'Şaşkın' }),
  Object.freeze({ id: 3, glyph: '😢', label: 'Üzgün' }),
  Object.freeze({ id: 4, glyph: '🔥', label: 'Ateş' }),
  Object.freeze({ id: 5, glyph: '🤝', label: 'Tokalaş' }),
]);

export const CHAT_KIND = Object.freeze({ PHRASE: 0, EMOTE: 1 });

export const CHAT_DEFAULTS = Object.freeze({
  cooldownMs: 2500,
  burstWindowMs: 12000,
  burstLimit: 5,
  gagMs: 20000,
  repeatLimit: 3,
});

/** True when (kind, id) names something that actually exists. */
export function isKnownMessage(kind, id) {
  if (!Number.isInteger(kind) || !Number.isInteger(id) || id < 0) return false;
  if (kind === CHAT_KIND.PHRASE) return id < QUICK_PHRASES.length;
  if (kind === CHAT_KIND.EMOTE) return id < EMOTES.length;
  return false;
}

/** The text a message renders as. Never returns undefined. */
export function renderMessage(kind, id) {
  if (!isKnownMessage(kind, id)) return '';
  return kind === CHAT_KIND.PHRASE ? QUICK_PHRASES[id] : `${EMOTES[id].glyph} ${EMOTES[id].label}`;
}

/**
 * createChatGuard(options) — the HOST's gate. One instance per room.
 *
 *   check(playerId, { kind, id }, now) -> { ok, reason, retryInMs, gagUntil }
 *
 * Reasons: 'unknown-message', 'gagged', 'repeat', 'cooldown', 'burst'.
 * `check` is the only mutating call; nothing here reads a clock.
 */
export function createChatGuard(options = {}) {
  const o = { ...CHAT_DEFAULTS, ...options };
  const state = new Map(); // playerId -> record

  function recordOf(id) {
    let r = state.get(id);
    if (!r) {
      r = { lastAt: -Infinity, stamps: [], lastKey: null, repeats: 0, gagUntil: -Infinity, sent: 0, refused: 0 };
      state.set(id, r);
    }
    return r;
  }

  return {
    options: Object.freeze({ ...o }),

    check(playerId, message, now) {
      const kind = message ? message.kind : undefined;
      const id = message ? message.id : undefined;
      const r = recordOf(playerId);

      if (!isKnownMessage(kind, id)) {
        r.refused++;
        return { ok: false, reason: 'unknown-message', retryInMs: 0, gagUntil: r.gagUntil };
      }
      if (now < r.gagUntil) {
        r.refused++;
        return { ok: false, reason: 'gagged', retryInMs: r.gagUntil - now, gagUntil: r.gagUntil };
      }

      const key = `${kind}:${id}`;
      if (key === r.lastKey && r.repeats + 1 > o.repeatLimit) {
        r.refused++;
        return { ok: false, reason: 'repeat', retryInMs: 0, gagUntil: r.gagUntil };
      }
      if (now - r.lastAt < o.cooldownMs) {
        r.refused++;
        return {
          ok: false,
          reason: 'cooldown',
          retryInMs: Math.ceil(o.cooldownMs - (now - r.lastAt)),
          gagUntil: r.gagUntil,
        };
      }

      // burst is measured over ACCEPTED messages, so a client that keeps
      // hammering into the cooldown cannot also trip the gag by accident
      const stamps = r.stamps.filter((t) => now - t < o.burstWindowMs);
      if (stamps.length >= o.burstLimit) {
        r.stamps = stamps;
        r.gagUntil = now + o.gagMs;
        r.refused++;
        return { ok: false, reason: 'burst', retryInMs: o.gagMs, gagUntil: r.gagUntil };
      }

      stamps.push(now);
      r.stamps = stamps;
      r.lastAt = now;
      r.repeats = key === r.lastKey ? r.repeats + 1 : 1;
      r.lastKey = key;
      r.sent++;
      return { ok: true, reason: null, retryInMs: o.cooldownMs, gagUntil: r.gagUntil };
    },

    /** Drop a player's history when they leave, so ids cannot be farmed. */
    forget(playerId) { return state.delete(playerId); },

    /** Read-only view for the HUD and for the test. */
    inspect(playerId) {
      const r = state.get(playerId);
      if (!r) return null;
      return {
        sent: r.sent,
        refused: r.refused,
        repeats: r.repeats,
        gagUntil: r.gagUntil === -Infinity ? null : r.gagUntil,
      };
    },

    isGagged(playerId, now) {
      const r = state.get(playerId);
      return !!r && now < r.gagUntil;
    },
  };
}

/**
 * createMuteList({ load, save }) — the RECEIVER's list.
 *
 * Local by construction: nothing in this object is serialised onto the wire,
 * and the host is never told. `load`/`save` are injected the same way the
 * season store's are, so localStorage and a test array are interchangeable.
 */
export function createMuteList({ load, save } = {}) {
  const read = typeof load === 'function' ? load : () => null;
  const write = typeof save === 'function' ? save : () => {};

  let ids;
  try {
    const raw = read();
    ids = new Set(Array.isArray(raw) ? raw.filter((v) => typeof v === 'string') : []);
  } catch {
    ids = new Set();
  }

  const flush = () => {
    try { write([...ids]); } catch { /* storage is optional */ }
  };

  return {
    isMuted: (id) => ids.has(id),
    mute(id) {
      if (typeof id !== 'string' || !id) return false;
      if (ids.has(id)) return false;
      ids.add(id);
      flush();
      return true;
    },
    unmute(id) {
      if (!ids.delete(id)) return false;
      flush();
      return true;
    },
    toggle(id) { return this.isMuted(id) ? (this.unmute(id), false) : (this.mute(id), true); },
    list: () => [...ids].sort(),
    clear() { ids.clear(); flush(); },
    /** What the receiver should actually show for an inbound message. */
    filter(fromId, kind, id) {
      if (ids.has(fromId)) return null;
      const text = renderMessage(kind, id);
      return text ? { fromId, kind, id, text } : null;
    },
  };
}
