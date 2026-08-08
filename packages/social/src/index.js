// @goalnet/social — the social and competitive layer (feature matrix #33-#37).
//
//   rating.js     OpenSkill (Plackett-Luce) with placement and inactivity decay
//   season.js     soft reset, finishing badges, injected persistence
//   spectator.js  a spectator gallery with a host cost budget that is enforced
//   names.js      clan tags and a homoglyph/leet-aware Turkish name filter
//   quickChat.js  fixed phrases, emotes, cooldown, spam gag, receiver-side mute
//   wire.js       the "GNSC" binary frame, validated like packages/net does it
//
// No runtime dependencies, no DOM, no clock reads. Every function that cares
// about time takes `now` as an argument, which is what makes the whole package
// testable from a synthetic loop.

export const SOCIAL_VERSION_STRING = '0.1.0';

export {
  RATING_DEFAULTS,
  TIERS,
  applyDecay,
  createRating,
  displayRating,
  isPlacement,
  normaliseRating,
  ordinal,
  placementBoost,
  rate,
  rateMatch,
  tierOf,
  tierOfRating,
} from './rating.js';

export {
  SEASON_DEFAULTS,
  STORE_VERSION,
  closeSeason,
  createSocialStore,
  memoryStore,
  seasonBadge,
  softReset,
  webStorageStore,
} from './season.js';

export {
  SPECTATOR_DEFAULTS,
  createSpectatorDesk,
} from './spectator.js';

export {
  ALLOWLIST,
  BLOCKLIST,
  BLOCKLIST_LONG,
  BLOCKLIST_SHORT,
  NAME_LIMITS,
  SHORT_TERM_LEN,
  TAG_COOLDOWN_MS,
  blockedTerm,
  canChangeTag,
  foldCase,
  formatDisplayName,
  isAllowedName,
  isAllowedTag,
  normaliseForms,
  normaliseName,
  sanitiseName,
} from './names.js';

export {
  CHAT_DEFAULTS,
  CHAT_KIND,
  EMOTES,
  QUICK_PHRASES,
  createChatGuard,
  createMuteList,
  isKnownMessage,
  renderMessage,
} from './quickChat.js';

export {
  CHAT_BYTES,
  MAX_SOCIAL_BYTES,
  SOCIAL_MAGIC,
  SOCIAL_VERSION,
  SOC_CHAT,
  SOC_SPECTATE,
  SOC_SPECTATE_ACK,
  SPECTATE_ACK_BYTES,
  SPECTATE_BYTES,
  SPECTATE_REASON,
  SocialProtocolError,
  decodeSocial,
  encodeChat,
  encodeSpectate,
  encodeSpectateAck,
  isSocialFrame,
} from './wire.js';
