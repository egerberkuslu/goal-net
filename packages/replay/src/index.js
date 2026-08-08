// @goalnet/replay — record a match as inputs, play it back bit-exactly, share
// it, and cut the three best moments out of it.
//
// Feature matrix rows #30 (full-match replay), #31 (sharing), #32 (automatic
// highlights), against brain/20-tech-spec/replay-format.md.
//
//   format.js      the container: header + per-tick input stream, and the
//                  refusals (constantsHash, settingsHash, roster, truncation)
//   recorder.js    host-side capture with preallocated growth
//   player.js      deterministic playback, seek from keyframes, verify()
//   share.js       deflate + URL-safe base64, plus the short-id store path
//   highlights.js  pure ranking of the recorded marks into three clips
//
// Recording a match
//
//   import { createRecorder } from '@goalnet/replay';
//   const rec = createRecorder({ world });
//   for (let t = 0; t < ticks; t++) rec.tick(collectInputs());
//   const container = rec.finish();
//   const bytes = encode(container);
//
// Watching one
//
//   import { createPlayer, highlights } from '@goalnet/replay';
//   const p = createPlayer(bytes);          // throws ReplayError on a foreign build
//   p.seek(highlights(p.container)[0].startTick);
//   for (;;) { const e = p.step(); if (!e) break; render(p.world); }
//
// Nothing here writes to the core, and nothing here is allowed to "fix up" a
// replay it does not understand: every rejection is a ReplayError with a code.

export {
  REPLAY_MAGIC,
  REPLAY_END_MAGIC,
  FORMAT_VERSION,
  HEADER_BYTES,
  TRAILER_BYTES,
  SECTION_INPUTS,
  SECTION_MARKS,
  SECTION_KEYFRAMES,
  SECTION_CHECKSUMS,
  RAW_INPUT_BYTES,
  DEFAULT_KEYFRAME_INTERVAL,
  MARK,
  MARK_NAMES,
  ReplayError,
  encode,
  decode,
  inputsAt,
  rawInputBytes,
  measure,
  fnv1aBytes,
  chainDigestOf,
  createWriter,
  createReader,
} from './format.js';

export { createRecorder } from './recorder.js';

export { createPlayer } from './player.js';

export {
  URL_SAFE_LENGTH,
  toBase64Url,
  fromBase64Url,
  deflate,
  inflate,
  pack,
  unpack,
  encodeShare,
  decodeShare,
  fitsInUrl,
  toUrl,
  fromUrl,
  contentId,
  createMemoryStore,
  publish,
  fetchShared,
} from './share.js';

export {
  CLIP_PRE_TICKS,
  CLIP_POST_TICKS,
  LATE_WINDOW_TICKS,
  LONG_RANGE_UNITS,
  BASE_SCORES,
  candidates,
  highlights,
  describeHighlights,
} from './highlights.js';

export const REPLAY_VERSION = '0.1.0';
