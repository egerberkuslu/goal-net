// Goal replay. A fixed-size ring buffer records the last few seconds of play
// at 30 Hz (ball + the visual state of every player) with zero per-frame
// allocation, and plays it back in slow motion after the goal celebration.
//
// Playback rides the world.puppet hook (wave-2 contract §5): while puppet is
// true world.step() skips ball and player physics and only simulates the XPBD
// nets, so the recorded ball we write in every frame still billows the net
// exactly like the live shot did. Nothing here touches world.js / game.js.

const HZ = 30;                       // recording rate (frames are decimated)
const INTERVAL = 1 / HZ;
const WINDOW = 5;                    // seconds kept in the ring
const CAP = Math.round(WINDOW * HZ) + 2;

// ball slots: pos(3) vel(3) omega(3) grounded(1)
const BALL_STRIDE = 10;
// player slots: pos.x pos.z vel.x vel.z facing down downTotal dive diveTotal
// diveKind diveRecover diveDir.x diveDir.z jumpY kickAnim headerAnim charge
// tumbleSpin
const PLAYER_STRIDE = 18;
// saved live state while the replay owns the world: ball pos/prev/vel/omega +
// grounded
const SAVE_BALL = 13;

const CLIP = 2.2;                    // seconds of action a replay shows
const RATE = 0.55;                   // playback speed (slow motion)
const MIN_FRAMES = 4;

const lerp = (a, b, u) => a + (b - a) * u;

// shortest-arc angle blend (facing wraps at ±π)
function lerpAngle(a, b, u) {
  let d = b - a;
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * u;
}

function writeBall(arr, o, ball) {
  const { pos, vel, omega } = ball;
  arr[o] = pos.x; arr[o + 1] = pos.y; arr[o + 2] = pos.z;
  arr[o + 3] = vel.x; arr[o + 4] = vel.y; arr[o + 5] = vel.z;
  arr[o + 6] = omega.x; arr[o + 7] = omega.y; arr[o + 8] = omega.z;
  arr[o + 9] = ball.grounded ? 1 : 0;
}

function writePlayer(arr, o, p) {
  arr[o] = p.pos.x; arr[o + 1] = p.pos.z;
  arr[o + 2] = p.vel.x; arr[o + 3] = p.vel.z;
  arr[o + 4] = p.facing;
  arr[o + 5] = p.down; arr[o + 6] = p.downTotal;
  arr[o + 7] = p.dive; arr[o + 8] = p.diveTotal;
  arr[o + 9] = p.diveKind === 'slide' ? 1 : 0;
  arr[o + 10] = p.diveRecover;
  arr[o + 11] = p.diveDir.x; arr[o + 12] = p.diveDir.z;
  arr[o + 13] = p.jumpY;
  arr[o + 14] = p.kickAnim; arr[o + 15] = p.headerAnim;
  arr[o + 16] = p.charge;
  arr[o + 17] = p.tumbleSpin || 0;
}

// ---------------------------------------------------------------- recorder

export class ReplayRecorder {
  constructor(opts = {}) {
    this.cap = opts.cap ?? CAP;
    this.interval = opts.interval ?? INTERVAL;
    this.times = new Float64Array(this.cap);
    this.ball = new Float32Array(this.cap * BALL_STRIDE);
    this.players = new Float32Array(0);
    this.slots = 0;
    this.head = 0;
    this.count = 0;
    this.lastT = 0;
  }

  // Drop everything and (re)size for this world's roster. Called automatically
  // whenever the player count changes (match rebuilt from the lobby).
  reset(world = null) {
    this.head = 0;
    this.count = 0;
    this.lastT = 0;
    const n = world ? world.players.length : this.slots;
    if (n !== this.slots || this.players.length !== this.cap * n * PLAYER_STRIDE) {
      this.slots = n;
      this.players = new Float32Array(this.cap * n * PLAYER_STRIDE);
    }
  }

  get frames() { return this.count; }

  // seconds of action currently held
  get seconds() {
    if (this.count < 2) return 0;
    return this.times[this.index(this.count - 1)] - this.times[this.index(0)];
  }

  // ring index of the k-th oldest held frame
  index(k) {
    return (this.head - this.count + k + this.cap * 2) % this.cap;
  }

  // Call once per rendered frame while the match is in 'play'. Uses world.time
  // as its clock and decimates to ~30 Hz, so the cost is a handful of typed
  // array writes and nothing is allocated.
  record(world) {
    if (!world || world.puppet) return false;
    if (world.players.length !== this.slots) this.reset(world);
    const t = world.time;
    if (this.count > 0) {
      const dt = t - this.lastT;
      if (dt < 0) this.reset(world);              // world rebuilt: clock reset
      // decimate to the ring rate. The epsilon matters: at 60 Hz two substep
      // clocks land a hair under 1/30 and a strict compare would silently
      // drop every other sample down to 20 Hz.
      else if (dt < this.interval - 1e-4) return false;
    }
    const i = this.head;
    this.times[i] = t;
    writeBall(this.ball, i * BALL_STRIDE, world.ball);
    const base = i * this.slots * PLAYER_STRIDE;
    for (let k = 0; k < this.slots; k++) {
      writePlayer(this.players, base + k * PLAYER_STRIDE, world.players[k]);
    }
    this.head = (i + 1) % this.cap;
    if (this.count < this.cap) this.count++;
    this.lastT = t;
    return true;
  }

  // Build (but do not start) a player for the last `clip` seconds.
  // Returns null when there is not enough material.
  makeReplay(opts = {}) {
    if (this.count < MIN_FRAMES) return null;
    const clip = opts.clip ?? CLIP;
    const last = this.count - 1;
    const tEnd = this.times[this.index(last)];
    let first = 0;
    for (let k = last; k >= 0; k--) {
      if (tEnd - this.times[this.index(k)] > clip) { first = k + 1; break; }
      first = k;
    }
    if (last - first + 1 < MIN_FRAMES) return null;
    return new ReplayPlayer(this, first, last, opts);
  }

  // One-call form used by the coordinator: build + take over the world.
  startReplay(world, camera = null, opts = {}) {
    const rp = this.makeReplay(opts);
    if (!rp) return null;
    rp.start(world, camera);
    return rp;
  }
}

// ------------------------------------------------------------------ player

export class ReplayPlayer {
  constructor(rec, first, last, opts = {}) {
    this.rec = rec;
    this.first = first;
    this.last = last;
    this.rate = opts.rate ?? RATE;
    this.label = opts.label ?? 'TEKRAR';
    this.camera = null;
    this.active = false;
    this.t = 0;
    this.cursor = first;
    this.t0 = rec.times[rec.index(first)];
    this.duration = rec.times[rec.index(last)] - this.t0;
    // playback wall-clock length, handy for the coordinator's hold-off timer
    this.wallDuration = this.rate > 0 ? this.duration / this.rate : 0;
    this.savedBall = new Float32Array(SAVE_BALL);
    this.savedPlayers = new Float32Array(rec.slots * PLAYER_STRIDE);
    this.chip = null;
    // preallocated camera state, no per-frame objects
    this.cam = { x: -16, y: 3.4, z: 0, lx: 0, ly: 0, lz: 0 };
    this.follow = { x: 0, y: 0, z: 0 };
  }

  // Take over the world: snapshot the live state, flip the puppet hook, warp
  // ball and players onto the first recorded frame and raise the chip.
  start(world, camera = null) {
    if (this.active) return this;
    this.camera = camera ?? null;
    this.saveLive(world);
    world.puppet = true;
    this.active = true;
    this.t = 0;
    this.cursor = this.first;
    this.apply(world, 0);
    const b = world.ball;
    b.prev.x = b.pos.x; b.prev.y = b.pos.y; b.prev.z = b.pos.z;
    this.follow.x = b.pos.x; this.follow.y = b.pos.y; this.follow.z = b.pos.z;
    this.aimCamera(0, true);
    this.chip = makeChip(this.label);
    return this;
  }

  // One rendered frame of playback. Returns true while the replay is still
  // running, false on the frame that finishes it.
  update(dt, world = this.world) {
    if (!this.active) return false;
    const w = world ?? this.world;
    this.t += dt * this.rate;
    const done = this.t >= this.duration;
    this.apply(w, Math.min(this.t, this.duration));
    this.aimCamera(this.duration > 0 ? Math.min(this.t / this.duration, 1) : 1, false);
    return !done;
  }

  // Give the world back: puppet off, live state restored, chip removed.
  stop(world = this.world) {
    if (!this.active) return;
    const w = world ?? this.world;
    this.active = false;
    w.puppet = false;
    this.restoreLive(w);
    if (this.chip) { this.chip.remove(); this.chip = null; }
  }

  // -------------------------------------------------------------- internals

  saveLive(world) {
    this.world = world;
    const b = world.ball, s = this.savedBall;
    s[0] = b.pos.x; s[1] = b.pos.y; s[2] = b.pos.z;
    s[3] = b.prev.x; s[4] = b.prev.y; s[5] = b.prev.z;
    s[6] = b.vel.x; s[7] = b.vel.y; s[8] = b.vel.z;
    s[9] = b.omega.x; s[10] = b.omega.y; s[11] = b.omega.z;
    s[12] = b.grounded ? 1 : 0;
    const n = Math.min(this.rec.slots, world.players.length);
    for (let k = 0; k < n; k++) {
      writePlayer(this.savedPlayers, k * PLAYER_STRIDE, world.players[k]);
    }
  }

  restoreLive(world) {
    const b = world.ball, s = this.savedBall;
    b.pos.x = s[0]; b.pos.y = s[1]; b.pos.z = s[2];
    b.prev.x = s[3]; b.prev.y = s[4]; b.prev.z = s[5];
    b.vel.x = s[6]; b.vel.y = s[7]; b.vel.z = s[8];
    b.omega.x = s[9]; b.omega.y = s[10]; b.omega.z = s[11];
    b.grounded = s[12] > 0.5;
    b.contacts.length = 0;
    const n = Math.min(this.rec.slots, world.players.length);
    for (let k = 0; k < n; k++) {
      this.writeBackPlayer(world.players[k], this.savedPlayers, k * PLAYER_STRIDE);
    }
  }

  writeBackPlayer(p, arr, o) {
    p.pos.x = arr[o]; p.pos.z = arr[o + 1];
    p.vel.x = arr[o + 2]; p.vel.z = arr[o + 3];
    p.facing = arr[o + 4];
    p.down = arr[o + 5]; p.downTotal = arr[o + 6] || p.downTotal;
    p.dive = arr[o + 7]; p.diveTotal = arr[o + 8] || p.diveTotal;
    p.diveKind = arr[o + 9] > 0.5 ? 'slide' : 'dive';
    p.diveRecover = arr[o + 10];
    p.diveDir.x = arr[o + 11]; p.diveDir.z = arr[o + 12];
    p.jumpY = arr[o + 13];
    p.kickAnim = arr[o + 14]; p.headerAnim = arr[o + 15];
    p.charge = arr[o + 16];
    p.tumbleSpin = arr[o + 17];
  }

  // Write the recorded state at source time `st` (0..duration) onto the world,
  // interpolating between the two bracketing 30 Hz frames.
  apply(world, st) {
    const rec = this.rec;
    let k = this.cursor;
    if (k < this.first) k = this.first;
    while (k < this.last && rec.times[rec.index(k + 1)] - this.t0 <= st) k++;
    this.cursor = k;
    const k1 = Math.min(k + 1, this.last);
    const ta = rec.times[rec.index(k)] - this.t0;
    const tb = rec.times[rec.index(k1)] - this.t0;
    let u = tb > ta ? (st - ta) / (tb - ta) : 0;
    if (u < 0) u = 0; else if (u > 1) u = 1;

    const B = rec.ball;
    const ia = rec.index(k) * BALL_STRIDE, ib = rec.index(k1) * BALL_STRIDE;
    const b = world.ball;
    // the net only ever sees the ball through its position, but keeping prev
    // one frame behind means anything reading the ball's motion (view, sfx)
    // still gets the right velocity while it is scripted
    b.prev.x = b.pos.x; b.prev.y = b.pos.y; b.prev.z = b.pos.z;
    b.pos.x = lerp(B[ia], B[ib], u);
    b.pos.y = lerp(B[ia + 1], B[ib + 1], u);
    b.pos.z = lerp(B[ia + 2], B[ib + 2], u);
    // slow motion scales the apparent speed, so the rolling/spin views match
    b.vel.x = lerp(B[ia + 3], B[ib + 3], u) * this.rate;
    b.vel.y = lerp(B[ia + 4], B[ib + 4], u) * this.rate;
    b.vel.z = lerp(B[ia + 5], B[ib + 5], u) * this.rate;
    b.omega.x = lerp(B[ia + 6], B[ib + 6], u) * this.rate;
    b.omega.y = lerp(B[ia + 7], B[ib + 7], u) * this.rate;
    b.omega.z = lerp(B[ia + 8], B[ib + 8], u) * this.rate;
    b.grounded = (u < 0.5 ? B[ia + 9] : B[ib + 9]) > 0.5;

    const P = rec.players;
    const slots = rec.slots;
    const baseA = rec.index(k) * slots * PLAYER_STRIDE;
    const baseB = rec.index(k1) * slots * PLAYER_STRIDE;
    const n = Math.min(slots, world.players.length);
    for (let s = 0; s < n; s++) {
      const p = world.players[s];
      const oa = baseA + s * PLAYER_STRIDE, ob = baseB + s * PLAYER_STRIDE;
      p.pos.x = lerp(P[oa], P[ob], u);
      p.pos.z = lerp(P[oa + 1], P[ob + 1], u);
      p.vel.x = lerp(P[oa + 2], P[ob + 2], u) * this.rate;
      p.vel.z = lerp(P[oa + 3], P[ob + 3], u) * this.rate;
      p.facing = lerpAngle(P[oa + 4], P[ob + 4], u);
      p.down = lerp(P[oa + 5], P[ob + 5], u);
      p.downTotal = P[oa + 6] || p.downTotal;
      p.dive = lerp(P[oa + 7], P[ob + 7], u);
      p.diveTotal = P[oa + 8] || p.diveTotal;
      p.diveKind = (u < 0.5 ? P[oa + 9] : P[ob + 9]) > 0.5 ? 'slide' : 'dive';
      p.diveRecover = lerp(P[oa + 10], P[ob + 10], u);
      p.diveDir.x = lerp(P[oa + 11], P[ob + 11], u);
      p.diveDir.z = lerp(P[oa + 12], P[ob + 12], u);
      p.jumpY = lerp(P[oa + 13], P[ob + 13], u);
      p.kickAnim = lerp(P[oa + 14], P[ob + 14], u);
      p.headerAnim = lerp(P[oa + 15], P[ob + 15], u);
      p.charge = lerp(P[oa + 16], P[ob + 16], u);
      p.tumbleSpin = lerp(P[oa + 17], P[ob + 17], u);
      p.input.x = 0; p.input.z = 0;
    }
  }

  // Dedicated replay camera: a low, slow arc on the OPPOSITE side of the
  // broadcast rig (which sits at +x), dollying in on the ball.
  aimCamera(u, snap) {
    const cam = this.cam;
    const b = this.world ? this.world.ball.pos : null;
    if (b) {
      const kf = snap ? 1 : 0.12;
      this.follow.x += (b.x - this.follow.x) * kf;
      this.follow.y += (b.y - this.follow.y) * kf;
      this.follow.z += (b.z - this.follow.z) * kf;
    }
    const f = this.follow;
    const side = Math.sign(f.z) || 1;
    const tx = -(14.5 - 4.5 * u) + f.x * 0.3;
    const ty = 3.5 - 1.4 * u;
    const tz = f.z * 0.55 + side * (8.5 - 3.5 * u);
    const k = snap ? 1 : 0.09;
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.z += (tz - cam.z) * k;
    cam.lx += (f.x - cam.lx) * (snap ? 1 : 0.18);
    cam.ly += (f.y + 0.25 - cam.ly) * (snap ? 1 : 0.18);
    cam.lz += (f.z - cam.lz) * (snap ? 1 : 0.18);
    if (this.camera) {
      this.camera.position.set(cam.x, cam.y, cam.z);
      this.camera.lookAt(cam.lx, cam.ly, cam.lz);
    }
  }
}

// ------------------------------------------------------------- 'TEKRAR' chip

const STYLE_ID = 'replay-chip-style';
const CHIP_CSS = `
#replayChip { position: fixed; z-index: 12; left: 22px; bottom: 20px;
  display: flex; align-items: center; gap: 9px; pointer-events: none;
  background: rgba(8, 14, 30, .62); backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 210, 87, .35); border-radius: 999px;
  padding: 8px 18px 8px 14px; color: #ffd257;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 15px; font-weight: 800; letter-spacing: 2px; }
#replayChip i { width: 9px; height: 9px; border-radius: 50%; background: #ff5468;
  box-shadow: 0 0 10px #ff5468; animation: replayBlink 1s steps(1) infinite; }
@keyframes replayBlink { 50% { opacity: .15; } }`;

function makeChip(label) {
  if (typeof document === 'undefined' || !document.body) return null;
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CHIP_CSS;
    document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.id = 'replayChip';
  const dot = document.createElement('i');
  el.appendChild(dot);
  el.appendChild(document.createTextNode(label));
  document.body.appendChild(el);
  return el;
}

export { CLIP as REPLAY_CLIP, RATE as REPLAY_RATE, HZ as REPLAY_HZ };
