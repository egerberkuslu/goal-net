// The local player's social profile: display name, clan tag, rating, badges.
//
// One object, one storage key, one validation path. The rules all live in
// @goalnet/social; this file only decides WHERE they are stored and hands back
// refusal reasons in Turkish, because that is the only part the arena's DOM
// cares about.
//
// Storage is optional by design. A browser with localStorage disabled, a
// private window, a quota error — none of them may take the match down, so
// every read and write is wrapped and the profile simply falls back to
// in-memory defaults.

import {
  canChangeTag,
  createSocialStore,
  displayRating,
  formatDisplayName,
  isAllowedName,
  isAllowedTag,
  tierOf,
} from '../../../../social/src/index.js';

const PROFILE_KEY = 'goalnet.arena.profile.v1';
const SOCIAL_KEY = 'goalnet.arena.social.v1';
const MUTE_KEY = 'goalnet.arena.mutes.v1';

const REASONS = Object.freeze({
  empty: 'Bir isim yaz.',
  'too-short': 'İsim en az 2 karakter olmalı.',
  'too-long': 'İsim en fazla 20 karakter olabilir.',
  'no-letters': 'İsimde en az bir harf olmalı.',
  blocked: 'Bu isim kullanılamaz.',
  charset: 'Klan tag\'i sadece harf ve rakam içerebilir.',
  cooldown: 'Klan tag\'ini haftada bir kez değiştirebilirsin.',
});

/** Turkish text for a refusal reason. Unknown reasons never print raw. */
export function reasonText(reason) {
  return REASONS[reason] || 'Bu değer kabul edilmedi.';
}

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__goalnet_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/**
 * createProfile({ storage, now })
 *
 * `storage` is any Web Storage lookalike; omit it and localStorage is used
 * when it works and an in-memory map when it does not. `now` is injected so a
 * test can drive the tag cooldown without waiting a week.
 */
export function createProfile({ storage, now = () => Date.now() } = {}) {
  const store = storage || safeStorage() || memoryStorage();

  let profile;
  try {
    profile = JSON.parse(store.getItem(PROFILE_KEY) || 'null') || {};
  } catch {
    profile = {};
  }
  if (typeof profile !== 'object' || profile === null) profile = {};

  const social = createSocialStore({
    load: () => {
      try { return JSON.parse(store.getItem(SOCIAL_KEY) || 'null'); } catch { return null; }
    },
    save: (state) => {
      try { store.setItem(SOCIAL_KEY, JSON.stringify(state)); } catch { /* optional */ }
    },
    now: now(),
  });

  function persist() {
    try { store.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* optional */ }
  }

  return {
    /** The mute list's storage pair, so index.js can build one without knowing keys. */
    muteStorage: {
      load: () => {
        try { return JSON.parse(store.getItem(MUTE_KEY) || '[]'); } catch { return []; }
      },
      save: (ids) => {
        try { store.setItem(MUTE_KEY, JSON.stringify(ids)); } catch { /* optional */ }
      },
    },

    social,
    get name() { return profile.name || ''; },
    get tag() { return profile.tag || ''; },

    /** Display form, used everywhere a name is painted. */
    display() { return formatDisplayName({ name: profile.name, tag: profile.tag }); },

    /** Set the display name. Returns { ok, reason, text }. */
    setName(raw) {
      const res = isAllowedName(raw);
      if (!res.ok) return { ok: false, reason: res.reason, text: reasonText(res.reason) };
      profile.name = res.display;
      persist();
      return { ok: true, reason: null, text: '' };
    },

    /** Set the clan tag, honouring the weekly cooldown. */
    setTag(raw, at = now()) {
      if (raw === '' || raw === null || raw === undefined) {
        profile.tag = '';
        profile.tagChangedAt = at;
        persist();
        return { ok: true, reason: null, text: '' };
      }
      const res = isAllowedTag(raw);
      if (!res.ok) return { ok: false, reason: res.reason, text: reasonText(res.reason) };
      const gate = canChangeTag(profile.tagChangedAt, at);
      if (!gate.ok && res.tag !== profile.tag) {
        const days = Math.ceil(gate.waitMs / 86400000);
        return { ok: false, reason: 'cooldown', text: `${reasonText('cooldown')} (${days} gün)` };
      }
      profile.tag = res.tag;
      profile.tagChangedAt = at;
      persist();
      return { ok: true, reason: null, text: '' };
    },

    /** My rating, minted on first read. */
    rating(at = now()) { return social.rating('me', at); },

    /** Everything the HUD needs to paint a rating chip. */
    chip(at = now()) {
      const r = social.rating('me', at);
      const display = displayRating(r);
      const tier = tierOf(display);
      return {
        display,
        tier: tier.id,
        tierName: tier.name,
        games: r.games,
        badges: social.badgesOf('me'),
      };
    },

    /** Store the result of a finished match. `teams` is what rate() returned. */
    putRating(rating) { return social.putRating('me', rating); },
  };
}
