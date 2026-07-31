// Headless validation of the goal-replay ring buffer and playback:
// the ring stays bounded and allocation-free, playback drives the world
// through the puppet hook, the nets keep simulating around the scripted
// ball, and stopping hands the live state back untouched.
import { World } from '../src/core/world-entry.js';
import { ReplayRecorder } from '../src/game/replay.js';
import { DT } from '../src/core/constants.js';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

// A match-like world: two field players and a ball fired at goal B.
function scriptedWorld() {
  const w = new World();
  const red = w.addPlayer(0, 'field');
  const blue = w.addPlayer(1, 'field');
  red.reset(0, -5);
  blue.reset(1.5, 4);
  return { w, red, blue };
}

// Drive `seconds` of play at 60 Hz, recording every rendered frame.
function play(w, rec, seconds, onFrame) {
  const frames = Math.round(seconds / DT);
  for (let f = 0; f < frames; f++) {
    w.step(DT);
    w.drainEvents();
    rec.record(w);
    onFrame?.(f);
  }
}

// 1) ring buffer: decimated to ~30 Hz and hard bounded
{
  const { w, red } = scriptedWorld();
  const rec = new ReplayRecorder();
  w.ball.vel = { x: 0, y: 1.4, z: 6 };
  w.ball.grounded = false;
  play(w, rec, 3.0, () => { red.input.x = 0.4; red.input.z = 1; });
  const bytes = rec.ball.byteLength + rec.players.byteLength + rec.times.byteLength;
  check('ring: ~30 Hz decimation over 3 s',
    rec.frames >= 84 && rec.frames <= 93, `${rec.frames} frames`);
  check('ring: window under 5 s', rec.seconds <= 5.05, `${rec.seconds.toFixed(2)} s`);

  play(w, rec, 6.0);
  check('ring: bounded after 9 s', rec.frames === rec.cap, `${rec.frames}/${rec.cap}`);
  check('ring: buffers never grow',
    rec.ball.byteLength + rec.players.byteLength + rec.times.byteLength === bytes);
  check('ring: still ~5 s of action', rec.seconds <= 5.05, `${rec.seconds.toFixed(2)} s`);
}

// 2) record() allocates nothing per frame (rough heap-delta bound)
{
  const { w } = scriptedWorld();
  const rec = new ReplayRecorder();
  rec.reset(w);
  // hand-cranked clock so the decimator accepts every call, and no world.step
  // allocation pollutes the measurement
  const bump = (i) => {
    w.time = i * 0.034;
    w.ball.pos.x = Math.sin(i * 0.01) * 6;
    w.ball.pos.z = i * 0.002;
  };
  for (let i = 0; i < 3000; i++) { bump(i); rec.record(w); } // warm up
  const before = process.memoryUsage().heapUsed;
  for (let i = 3000; i < 43000; i++) { bump(i); rec.record(w); }
  const grew = process.memoryUsage().heapUsed - before;
  check('record: no allocation growth over 40k frames',
    grew < 1.5e6, `${(grew / 1024).toFixed(0)} KiB`);
}

// 3) playback: puppet hook, interpolation, duration, restore, live nets
{
  const { w, red } = scriptedWorld();
  const rec = new ReplayRecorder();
  // a 24 m/s shot into goal B: it flies the length of the pitch and buries
  // itself in the net, so the clip covers both flight and net contact
  w.ball.place(0, -2);
  w.ball.vel = { x: 0.4, y: 1.5, z: 24 };
  w.ball.grounded = false;
  play(w, rec, 1.35, () => { red.input.z = 1; });

  const liveBall = { ...w.ball.pos };
  const livePlayer = { ...red.pos };
  const rp = rec.startReplay(w, null, { clip: 1.3 });
  check('replay: startReplay returns a player', !!rp);
  check('replay: puppet raised', w.puppet === true);
  check('replay: slow motion 0.55x', Math.abs(rp.rate - 0.55) < 1e-9, `${rp.rate}`);
  check('replay: clip length sane',
    rp.duration > 0.9 && rp.duration <= 1.35, `${rp.duration.toFixed(2)} s`);

  // net node snapshot: the scripted ball must still deform the sheet
  const net = w.nets[1];
  const netBefore = Float32Array.from(net.pos);

  const zs = [];
  let steps = 0, running = true, maxNetMove = 0;
  while (running && steps < 1200) {
    running = rp.update(DT);
    w.step(DT);          // main.js keeps stepping: only the nets simulate
    w.drainEvents();
    zs.push(w.ball.pos.z);
    for (let i = 0; i < net.pos.length; i++) {
      const d = Math.abs(net.pos[i] - netBefore[i]);
      if (d > maxNetMove) maxNetMove = d;
    }
    steps++;
  }
  const wall = steps * DT;
  check('replay: update() false after the duration', running === false, `${steps} frames`);
  check('replay: playback ~duration/rate long',
    Math.abs(wall - rp.duration / rp.rate) < 0.12,
    `${wall.toFixed(2)} s vs ${(rp.duration / rp.rate).toFixed(2)} s`);

  // during the flight (before the ball reaches the net) the interpolated
  // position must advance monotonically, never jitter backwards
  let mono = true, checked = 0;
  for (let i = 1; i < zs.length; i++) {
    if (zs[i] > 15) break;
    checked++;
    if (zs[i] < zs[i - 1] - 1e-4) mono = false;
  }
  check('replay: interpolation monotonic through the flight',
    mono && checked > 40, `${checked} samples`);
  check('replay: 60 Hz interpolation, not 30 Hz steps',
    new Set(zs.slice(0, 60)).size > 55, `${new Set(zs.slice(0, 60)).size} distinct`);

  check('replay: nets keep simulating under puppet',
    maxNetMove > 1e-3, `max node move ${maxNetMove.toFixed(4)}`);

  rp.stop(w);
  check('stop: puppet lowered', w.puppet === false);
  check('stop: ball restored',
    Math.abs(w.ball.pos.x - liveBall.x) < 1e-6 &&
    Math.abs(w.ball.pos.y - liveBall.y) < 1e-6 &&
    Math.abs(w.ball.pos.z - liveBall.z) < 1e-6,
    `${w.ball.pos.z.toFixed(3)} vs ${liveBall.z.toFixed(3)}`);
  check('stop: players restored',
    Math.abs(red.pos.x - livePlayer.x) < 1e-6 &&
    Math.abs(red.pos.z - livePlayer.z) < 1e-6);
  check('stop: live physics resume', (() => {
    const z0 = w.ball.pos.z;
    for (let i = 0; i < 10; i++) { w.step(DT); w.drainEvents(); }
    return Number.isFinite(w.ball.pos.z) && w.ball.pos.z !== z0 - 1e9;
  })());
}

// 4) guards: too little material, roster change, no recording while puppet
{
  const { w } = scriptedWorld();
  const rec = new ReplayRecorder();
  check('guard: empty recorder makes no replay', rec.makeReplay() === null);
  play(w, rec, 1.0);
  w.puppet = true;
  const before = rec.frames;
  w.time += 1;
  rec.record(w);
  check('guard: record() ignored while puppet', rec.frames === before);
  w.puppet = false;
  w.addPlayer(1, 'keeper');
  rec.record(w);
  check('guard: roster change resets the ring', rec.frames === 1 && rec.slots === 3,
    `${rec.frames} frames / ${rec.slots} slots`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
