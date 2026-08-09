// Headless gate for @goalnet/replay.
//
//   node test/run.mjs        PASS/FAIL lines, a size table, non-zero exit on failure
//
// The subject is a real 60-second scripted match (see match.mjs), recorded the
// way a host records one. Everything below is asserted against that recording:
// playback reproduces the checksum chain tick for tick, seek lands on the same
// state as an uninterrupted run, a tampered header is refused with a named
// reason, the encoder is smaller than raw and round-trips byte-exactly, the
// share codec round-trips, and the highlight pass returns three deterministic,
// non-overlapping clips that contain every goal.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  HDR_TICK,
  checksumInts,
  constantsHash,
  createWorld,
  normaliseSettings,
  settingsHash,
  step,
  toHex32,
} from '../../core/src/index.js';

import {
  DEFAULT_KEYFRAME_INTERVAL,
  MARK,
  ReplayError,
  candidates,
  contentId,
  createMemoryStore,
  createPlayer,
  createRecorder,
  decode,
  decodeShare,
  describeHighlights,
  encode,
  encodeShare,
  fetchShared,
  fnv1aBytes,
  fromBase64Url,
  highlights,
  measure,
  pack,
  publish,
  toBase64Url,
  toUrl,
  unpack,
} from '../src/index.js';

import { playAndRecord } from './match.mjs';

// The match under test: 2v2, one keeper, hard against easy, 60 seconds at 60 Hz.
// Six, not four. ADR-0009 widened the pitch to the shipping game's 22 m, and
// four scripted players on a full-size field spend a minute passing it around
// without scoring — which is realistic football and useless as a fixture,
// because the highlight reel needs something to find. Six fills the space.
const SHAPE = {
  teams: [0, 1, 0, 1, 0, 1],
  roles: { 1: 'keeper' },
  difficulty: {
    0: 'zor', 1: 'kolay', 2: 'zor', 3: 'kolay', 4: 'zor', 5: 'kolay',
  },
};
const SETTINGS = { durationSeconds: 180, scoreLimit: 0, pitch: 'orta', mercyRule: false };
const TICKS = 3600;

/**
 * --dump-summary prints the three numbers a second process has to agree on:
 * the chain digest, the encoded bytes, and a digest of the highlight reel. The
 * main run spawns it, which is how "deterministic" stops meaning "deterministic
 * inside one warmed-up V8".
 */
if (process.argv.includes('--dump-summary')) {
  const c = playAndRecord({ shape: SHAPE, settings: SETTINGS, ticks: TICKS, seed: 1337 }).container;
  const enc = encode(c);
  console.log(
    JSON.stringify({
      chainDigest: toHex32(c.chainDigest >>> 0),
      bytes: enc.length,
      fileDigest: toHex32(fnv1aBytes(enc)),
      reel: describeHighlights(highlights(c)).join(' | '),
    }),
  );
  process.exit(0);
}

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(title) {
  console.log(`\n--- ${title}`);
}
function kb(n) {
  return `${(n / 1024).toFixed(1)} kB`;
}

/** Assert that `fn` throws a ReplayError with `code`. */
function refuses(name, code, fn) {
  try {
    fn();
    check(name, false, 'nothing was thrown');
  } catch (err) {
    const ok = err instanceof ReplayError && err.code === code;
    check(name, ok, ok ? '' : `${err.name}/${err.code || '-'}: ${err.message}`);
  }
}

/** Apply a byte mutation and repair the trailer digest, so the tamper survives. */
function tamper(bytes, mutate) {
  const copy = Uint8Array.from(bytes);
  mutate(copy, new DataView(copy.buffer));
  const digest = fnv1aBytes(copy, 0, copy.length - 4);
  new DataView(copy.buffer).setUint32(copy.length - 4, digest, true);
  return copy;
}

// ------------------------------------------------------------------ record

section('recording a scripted 60-second match');

const recorded = playAndRecord({ shape: SHAPE, settings: SETTINGS, ticks: TICKS, seed: 1337 });
const container = recorded.container;
const liveChain = Int32Array.from(recorded.rec.chain());

check('the match produced goals to find', recorded.stats.goals[0] + recorded.stats.goals[1] > 0,
  JSON.stringify(recorded.stats));
check('every tick was recorded', container.tickCount === TICKS, `${container.tickCount}`);
check('the roster carries team and role',
  container.roster.length === SHAPE.teams.length && container.roster[1].role === 1,
  `${container.roster.length} slots`);
check(
  'keyframes land on the cadence',
  container.keyframes.length === Math.ceil(TICKS / DEFAULT_KEYFRAME_INTERVAL) &&
    container.keyframes.every((k, i) => k.tick === i * DEFAULT_KEYFRAME_INTERVAL),
  `${container.keyframes.length} keyframes`,
);
check(
  'the header pins this physics build',
  decode(encode(container)).constantsHash === constantsHash,
);
check(
  'the header pins this room',
  decode(encode(container)).settingsHash === settingsHash(SETTINGS),
);
check(
  'the recorder refuses a tick out of order',
  (() => {
    const w = createWorld({ players: [{ team: 0 }, { team: 1 }] });
    const r = createRecorder({ world: w });
    try {
      r.record(7, [null, null]);
      return false;
    } catch (err) {
      return err instanceof ReplayError && err.code === 'tick-order';
    }
  })(),
);

// -------------------------------------------------------------- playback

section('playback reproduces the run');

const bytes = encode(container);
const reloaded = decode(bytes);
const player = createPlayer(reloaded);
const verdict = player.verify();
check('playback verifies against the recorded chain', verdict.ok, JSON.stringify(verdict));

const playedChain = player.chain();
let firstDivergence = -1;
for (let i = 0; i < TICKS; i++) {
  if (playedChain[i] !== liveChain[i]) {
    firstDivergence = i;
    break;
  }
}
check(
  'the checksum chain matches tick for tick',
  firstDivergence === -1,
  firstDivergence >= 0 ? `first divergence at tick ${firstDivergence}` : '',
);
check(
  'the chain digest is the one in the header',
  verdict.ok && verdict.digest === toHex32(container.chainDigest >>> 0),
);

// An independent uninterrupted run, straight off the core, for seek to match.
const reference = new Map();
{
  const w = createWorld({ players: container.roster, settings: container.settings });
  // The input arrays are one entry per player per tick, so the stride is the
  // roster size. It was written as a literal 4 and quietly read every sixth
  // player's input as the first player's the moment the fixture grew.
  const seats = container.roster.length;
  const scratch = new Array(seats);
  for (let t = 0; t < TICKS; t++) {
    for (let i = 0; i < seats; i++) {
      const j = t * seats + i;
      scratch[i] = {
        moveXFx: container.inputs.mx[j],
        moveZFx: container.inputs.mz[j],
        buttons: container.inputs.buttons[j],
      };
    }
    step(w, scratch);
    reference.set(w.buf[HDR_TICK], checksumInts(w.buf));
  }
}

section('seek');

const seekTargets = [0, 1, 599, 600, 601, 1234, 2999, 3000, 3599, 3600];
let seekOk = true;
let seekDetail = '';
let worstSeek = 0;
for (const t of seekTargets) {
  const fresh = createPlayer(reloaded);
  fresh.seek(t);
  worstSeek = Math.max(worstSeek, fresh.lastSeekSteps);
  const want = t === 0 ? checksumInts(createWorld({ players: container.roster, settings: container.settings }).buf) : reference.get(t);
  const got = checksumInts(fresh.world.buf);
  if (want !== got) {
    seekOk = false;
    seekDetail = `tick ${t}: ${got} != ${want}`;
    break;
  }
}
check('seek lands on the uninterrupted state', seekOk, seekDetail);
check(
  'no seek costs more than one keyframe interval',
  worstSeek <= DEFAULT_KEYFRAME_INTERVAL,
  `worst ${worstSeek} steps`,
);

{
  // backward seeks in one player, the case that has to rewind
  const p = createPlayer(reloaded);
  let ok = true;
  for (const t of [3000, 120, 2400, 601, 3599]) {
    p.seek(t);
    if (checksumInts(p.world.buf) !== reference.get(t)) ok = false;
  }
  check('backward seeks rewind to a keyframe correctly', ok);
}

{
  // the share path drops keyframes; seek still has to work
  const stripped = decode(encode({ ...container, keyframes: [], keyframeInterval: 0 }));
  const p = createPlayer(stripped);
  p.seek(2400);
  const first = checksumInts(p.world.buf);
  p.seek(1200);
  const second = checksumInts(p.world.buf);
  check(
    'a keyframe-less replay seeks by rebuilding the index',
    first === reference.get(2400) && second === reference.get(1200),
  );
  check('the rebuilt index is populated as it plays', p.keyframeTicks.length > 1, `${p.keyframeTicks.length}`);
}

{
  const t0 = process.hrtime.bigint();
  const p = createPlayer(reloaded);
  for (let i = 0; i < 20; i++) p.seek(600 + ((i * 137) % 2999));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
  console.log(`      seek cost: ${ms.toFixed(2)} ms average over 20 random seeks (<= 599 steps each)`);
  check('a seek is comfortably inside one frame', ms < 16, `${ms.toFixed(2)} ms`);
}

check(
  'stateAt reads the same tick it was asked for',
  createPlayer(reloaded).stateAt(1800).tick === 1800,
);

// ---------------------------------------------------------------- refusals

section('refusals');

refuses('a foreign physics build is refused', 'constants-hash', () =>
  decode(tamper(bytes, (b, v) => v.setInt32(8, 0x0badf00d, true))),
);
refuses('a tampered settings hash word is refused', 'settings-hash', () =>
  decode(tamper(bytes, (b, v) => v.setInt32(12, 0x12345678, true))),
);
refuses('a tampered settings word is refused', 'settings-hash', () =>
  decode(tamper(bytes, (b, v) => v.setInt32(16, 90, true))),
);
refuses('a replay from another room is refused', 'settings-hash', () =>
  decode(bytes, { settings: normaliseSettings({ ...SETTINGS, pitch: 'buyuk' }) }),
);
refuses('a roster byte with unknown bits is refused', 'roster', () =>
  decode(tamper(bytes, (b) => {
    b[64] |= 0x40;
  })),
);
refuses('a roster that disagrees with the keyframe is refused', 'roster', () =>
  decode(tamper(bytes, (b) => {
    b[64] ^= 1; // move slot 0 to the other team
  })),
);
refuses('the wrong magic is refused', 'bad-magic', () =>
  decode(tamper(bytes, (b, v) => v.setUint32(0, 0x41414141, true))),
);
refuses('a future format version is refused', 'bad-version', () =>
  decode(tamper(bytes, (b, v) => v.setUint32(4, 99, true))),
);
refuses('a truncated replay is refused', 'corrupt', () => decode(bytes.subarray(0, bytes.length - 64)));
refuses('a replay cut mid-section is refused', 'corrupt', () =>
  decode(bytes.subarray(0, Math.floor(bytes.length / 2))),
);
refuses('a single flipped byte is refused', 'corrupt', () => {
  const copy = Uint8Array.from(bytes);
  copy[Math.floor(copy.length / 2)] ^= 0x20;
  return decode(copy);
});
refuses('a replay shorter than a header is refused', 'short', () => decode(new Uint8Array(16)));
refuses('a section length that overruns the file is refused', 'truncated', () =>
  decode(tamper(bytes, (b, v) => v.setUint32(72, 0x00ffffff, true))),
);
refuses('a non-binary replay is refused', 'not-binary', () => decode('not bytes'));
refuses('a bogus share code is refused', 'bad-base64', () => fromBase64Url('not base64 !!'));

{
  // a repaired-digest roster swap on a keyframe-less replay cannot desync
  // silently: the chain it produces is not the chain the header claims
  const lean = encode({ ...container, keyframes: [], keyframeInterval: 0 });
  const swapped = tamper(lean, (b) => {
    b[64] ^= 1;
  });
  const p = createPlayer(decode(swapped));
  const v = p.verify();
  check('a swapped roster is caught by the chain digest', !v.ok && v.reason === 'digest', JSON.stringify(v));
}

{
  const good = createPlayer(reloaded);
  const bad = { ...reloaded, chainDigest: reloaded.chainDigest ^ 1 };
  check('verify reports a digest mismatch rather than playing on', !createPlayer(bad).verify().ok);
  check('an untouched replay still verifies', good.verify().ok);
}

refuses('a container from another room is refused at the player', 'settings-hash', () =>
  createPlayer(reloaded, { settings: normaliseSettings({ ...SETTINGS, pitch: 'kucuk' }) }),
);

// ----------------------------------------------------------------- encoding

section('encoding');

const again = encode(reloaded);
check(
  'encode(decode(bytes)) is byte-identical',
  again.length === bytes.length && again.every((b, i) => b === bytes[i]),
);
check(
  'every recorded input survives the round trip',
  ['mx', 'mz', 'buttons'].every((k) =>
    container.inputs[k].every((v, i) => v === reloaded.inputs[k][i]),
  ),
);
check(
  'the marks survive the round trip',
  JSON.stringify(container.marks) === JSON.stringify(reloaded.marks),
);
check(
  'the keyframes survive the round trip',
  container.keyframes.length === reloaded.keyframes.length &&
    container.keyframes.every((k, i) =>
      k.tick === reloaded.keyframes[i].tick && checksumInts(k.state) === checksumInts(reloaded.keyframes[i].state),
    ),
);

const m4 = measure(container);
check('the encoder beats raw inputs', m4.total < m4.raw, `${m4.total} vs ${m4.raw}`);

const six = playAndRecord({
  shape: {
    teams: [0, 1, 0, 1, 0, 1],
    roles: { 1: 'keeper', 0: 'keeper' },
    difficulty: { 0: 'zor', 1: 'kolay', 2: 'zor', 3: 'kolay', 4: 'orta', 5: 'orta' },
  },
  settings: SETTINGS,
  ticks: TICKS,
  seed: 4242,
});
check('a 6-player match records too', six.container.playerCount === 6);
check('a 6-player replay verifies', createPlayer(decode(encode(six.container))).verify().ok);

// A held-input recording, i.e. what a human actually produces, to show what the
// run-length half of the encoder is for.
const human = (() => {
  const world = createWorld({ players: [{ team: 0 }, { team: 1 }], settings: SETTINGS });
  const rec = createRecorder({ world });
  for (let t = 0; t < TICKS; t++) {
    const phase = Math.floor(t / 40) % 4;
    const a = { moveX: phase === 0 ? 1 : phase === 2 ? -1 : 0, moveZ: phase === 1 ? 1 : 0, kick: t % 137 === 0 };
    const b = { moveX: 0, moveZ: phase === 3 ? -1 : 0 };
    rec.tick([a, b]);
  }
  return rec.finish();
})();

// ------------------------------------------------------------------ sharing

section('sharing');

const shared = await encodeShare(container);
const back = await decodeShare(shared);
check('a share code round-trips to the same replay', back.chainDigest === container.chainDigest);
check(
  'the shared replay still plays',
  createPlayer(back).verify().ok,
);
check(
  'base64 is a faithful codec',
  (() => {
    const probe = Uint8Array.from({ length: 257 }, (_, i) => (i * 37) & 0xff);
    const round = fromBase64Url(toBase64Url(probe));
    return round.length === probe.length && round.every((b, i) => b === probe[i]);
  })(),
);

const link = await toUrl(container, { base: 'https://goal.net/r' });
check('a full match is refused a URL rather than truncated', !link.ok && link.reason === 'too-long',
  `${link.length} chars`);

const store = createMemoryStore();
const published = await publish(container, store, { base: 'https://goal.net/r' });
const fetched = await fetchShared(published.url, store);
check('the short-id path round-trips', fetched.chainDigest === container.chainDigest);
check('the id is content-addressed', published.id === contentId(await pack(container)));
check('storing the same replay twice keeps one object', (await publish(container, store)).id === published.id && store.size === 1);
check('an id nobody stored is refused', await (async () => {
  try {
    await fetchShared('0000000000000000', store);
    return false;
  } catch (err) {
    return err instanceof ReplayError && err.code === 'not-found';
  }
})());
check(
  'a share code that does not inflate is refused',
  await (async () => {
    try {
      await unpack(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
      return false;
    } catch (err) {
      return err instanceof ReplayError && err.code === 'corrupt';
    }
  })(),
);

// A clip-sized share, the case the URL path exists for.
const clip = { ...container, tickCount: 600, inputs: {
  mx: container.inputs.mx.slice(0, 600 * 4),
  mz: container.inputs.mz.slice(0, 600 * 4),
  buttons: container.inputs.buttons.slice(0, 600 * 4),
}, marks: container.marks.filter((m) => m.tick <= 600), keyframes: [], keyframeInterval: 0 };
const clipLink = await toUrl(clip, { base: 'https://goal.net/r' });
console.log(`      10-second clip link: ${clipLink.url.length} chars, ${clipLink.ok ? 'fits' : 'too long'}`);

// ---------------------------------------------------------------- highlights

section('highlights');

const clips = highlights(container);
const goalTicks = container.marks.filter((m) => m.kind === MARK.GOAL).map((m) => m.tick);
check('three moments are returned', clips.length === 3, `${clips.length}`);
check(
  'every goal is in the reel',
  goalTicks.every((t) => clips.some((c) => c.tick === t)),
  `goals at ${goalTicks.join(', ')}`,
);
check(
  'the clips do not overlap',
  clips.every((c, i) => i === 0 || clips[i - 1].endTick < c.startTick),
  clips.map((c) => `${c.startTick}..${c.endTick}`).join(' '),
);
check(
  'clips stay inside the recording',
  clips.every((c) => c.startTick >= 0 && c.endTick <= TICKS && c.startTick < c.endTick),
);
check('clips carry a build-up window', clips.every((c) => c.tick - c.startTick > 0));
check(
  'the reel is deterministic across runs',
  (() => {
    const second = playAndRecord({ shape: SHAPE, settings: SETTINGS, ticks: TICKS, seed: 1337 });
    return (
      JSON.stringify(highlights(second.container)) === JSON.stringify(clips) &&
      JSON.stringify(highlights(container)) === JSON.stringify(clips)
    );
  })(),
);
{
  const here = fileURLToPath(import.meta.url);
  const out = execFileSync(process.execPath, [here, '--dump-summary'], { encoding: 'utf8' });
  const fresh = JSON.parse(out);
  const mine = {
    chainDigest: toHex32(container.chainDigest >>> 0),
    bytes: bytes.length,
    fileDigest: toHex32(fnv1aBytes(bytes)),
    reel: describeHighlights(clips).join(' | '),
  };
  check(
    'a fresh process records the same bytes and the same reel',
    JSON.stringify(fresh) === JSON.stringify(mine),
    `${JSON.stringify(fresh)} vs ${JSON.stringify(mine)}`,
  );
}

check(
  'ranks are assigned best-first',
  clips.slice().sort((a, b) => a.rank - b.rank).every((c, i, arr) => i === 0 || arr[i - 1].score >= c.score),
);

{
  // scoring, on a synthetic mark set: the table from replay-format.md, the late
  // multiplier, and the long-range cut
  const synthetic = {
    startTick: 0,
    tickCount: 10800,
    tickRate: 60,
    settings: normaliseSettings(SETTINGS),
    marks: [
      { tick: 100, kind: MARK.GOAL, player: 0, v0: 0, v1: 0 },
      { tick: 2000, kind: MARK.SAVE, player: 1, v0: 400, v1: 0 },
      { tick: 4000, kind: MARK.WOODWORK, player: 2, v0: 300, v1: 500 },
      { tick: 5000, kind: MARK.SHOT, player: 3, v0: 100, v1: 500 },
      { tick: 5500, kind: MARK.SHOT, player: 3, v0: 100, v1: 100 },
      { tick: 9000, kind: MARK.SAVE, player: 1, v0: 500, v1: 0 },
    ],
  };
  const cands = candidates(synthetic);
  const byTick = new Map(cands.map((c) => [c.tick, c]));
  check('a goal scores 100', byTick.get(100).score === 100);
  check('a save scores 70', byTick.get(2000).score === 70);
  check('woodwork scores 50', byTick.get(4000).score === 50);
  check('a long-range shot scores 30', byTick.get(5000).score === 30);
  check('a shot from close in is not a moment', !byTick.has(5500));
  check('the last minute is worth 1.5x', byTick.get(9000).score === 105, `${byTick.get(9000).score}`);
  const reel = highlights(synthetic);
  check('the goal survives a higher-scoring late save', reel.some((c) => c.tick === 100));
  check('the late save takes a slot', reel.some((c) => c.tick === 9000));
  check('three clips, still no overlap', reel.length === 3 && reel.every((c, i) => i === 0 || reel[i - 1].endTick < c.startTick));
}

{
  // more goals than slots, and goals close enough to share a window
  const crowded = {
    startTick: 0,
    tickCount: 10800,
    tickRate: 60,
    settings: normaliseSettings(SETTINGS),
    marks: [
      { tick: 1000, kind: MARK.GOAL, player: 0, v0: 0, v1: 0 },
      { tick: 1100, kind: MARK.GOAL, player: 1, v0: 1, v1: 0 },
      { tick: 1150, kind: MARK.GOAL, player: 0, v0: 0, v1: 0 },
      { tick: 9000, kind: MARK.GOAL, player: 1, v0: 1, v1: 0 },
    ],
  };
  const reel = highlights(crowded);
  check('a four-goal match still returns three clips', reel.length === 3);
  check(
    'clips split at the seam instead of overlapping',
    reel.every((c, i) => i === 0 || reel[i - 1].endTick < c.startTick),
    reel.map((c) => `${c.startTick}..${c.endTick}`).join(' '),
  );
  check('the late goal outranks the early ones', reel.find((c) => c.tick === 9000).rank === 0);
}

check('a goalless match still returns its best moments', highlights({
  startTick: 0,
  tickCount: 3600,
  tickRate: 60,
  settings: normaliseSettings(SETTINGS),
  marks: [{ tick: 500, kind: MARK.WOODWORK, player: 0, v0: 10, v1: 400 }],
}).length === 1);

// -------------------------------------------------------------------- sizes

section('sizes');

const table = [];
async function row(label, c) {
  const m = measure(c);
  const packed = await pack(c);
  const packedWithKf = await pack(c, { keyframes: true });
  const code = toBase64Url(packed);
  table.push({
    label,
    ticks: c.tickCount,
    players: c.playerCount,
    raw: m.raw,
    encoded: m.total,
    noKeyframes: m.withoutKeyframes,
    deflated: packed.length,
    deflatedWithKeyframes: packedWithKf.length,
    base64: code.length,
  });
}

await row('3 min bots, 4 players', await threeMinutes(SHAPE, 1337));
await row('3 min bots, 6 players', await threeMinutes({
  teams: [0, 1, 0, 1, 0, 1],
  roles: { 0: 'keeper', 1: 'keeper' },
  difficulty: { 0: 'zor', 1: 'kolay', 2: 'zor', 3: 'kolay', 4: 'orta', 5: 'orta' },
}, 4242));
await row('1 min bots, 4 players', container);
await row('1 min held input, 2 players', human);

async function threeMinutes(shape, seed) {
  return playAndRecord({ shape, settings: SETTINGS, ticks: 10800, seed }).container;
}

console.log(
  `\n${'match'.padEnd(26)}${'ticks'.padStart(7)}${'raw'.padStart(10)}${'encoded'.padStart(10)}${'no-kf'.padStart(10)}${'deflated'.padStart(10)}${'base64'.padStart(9)}`,
);
for (const r of table) {
  console.log(
    `${r.label.padEnd(26)}${String(r.ticks).padStart(7)}${kb(r.raw).padStart(10)}${kb(r.encoded).padStart(10)}${kb(
      r.noKeyframes,
    ).padStart(10)}${kb(r.deflated).padStart(10)}${String(r.base64).padStart(9)}`,
  );
}
const threeMinFour = table[0];
check('the 3-minute 4-player replay is smaller than raw', threeMinFour.encoded < threeMinFour.raw);
check('deflate is worth having', threeMinFour.deflated < threeMinFour.noKeyframes);
check('a held-input recording collapses', table[3].encoded < table[3].raw / 20,
  `${table[3].encoded} vs ${table[3].raw}`);

console.log(`\nreplay 0.1.0 · constantsHash ${constantsHash} · settingsHash ${settingsHash(SETTINGS)}`);
console.log(describeHighlights(clips).join('\n'));
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
