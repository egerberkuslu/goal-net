// The authoritative half of the netcode. Exactly one player runs this.
//
// Responsibilities, and nothing else
//   * own the one @goalnet/core world and step it at a fixed 60 Hz
//   * ingest peer input, having first disbelieved every field of it
//   * broadcast 20-30 Hz snapshots: full on join or resync, run-length delta
//     against whatever tick that peer last acknowledged
//   * run bots — this is the ONLY place a bot policy is ever called
//
// Clock injection. The session never reads Date or performance; `update(now)`
// takes milliseconds from the caller and derives the tick and snapshot
// schedules with integer arithmetic off a fixed start time, so a test driving
// it with a synthetic clock gets exactly the same tick boundaries a browser
// would. Catch-up is capped so a stalled tab cannot spiral.
//
// Anti-cheat scope (netcode-p2p.md). Peers author *input axes and a kick bit*
// and nothing else, so "position jump" cheats are structurally impossible
// rather than merely rejected: no message on the wire can move a body. What is
// left to police is rate and range, and that is what `limits` covers. The known
// residual is the host itself, which is a v2 dedicated-host problem.

import {
  createWorld,
  step,
  serialize,
  quantiseInput,
  playerOffset,
  stateLength,
  HDR_TICK,
  TICK_RATE,
  FIELD,
} from '../../core/src/index.js';

import {
  MSG_HELLO,
  MSG_INPUT,
  MAX_MESSAGE_BYTES,
  ProtocolError,
  decodeMessage,
  encodeDeltaWords,
  encodeSnapshotMessages,
  stateChecksumInt,
} from './protocol.js';

export const DEFAULT_LIMITS = Object.freeze({
  // A well-behaved peer sends one input per 60 Hz tick. The bucket has to
  // survive a burst arriving after a jitter spike, so the cap is generous while
  // the sustained rate is not.
  maxInputRateHz: 90,
  inputBurst: 30,
  // netcode-p2p.md locks the kick band at 4-12 per second; the core's own
  // 8-tick cooldown means 7.5/s is the most a legitimate client can produce.
  maxKickRateHz: 12,
  kickBurst: 6,
  // How far ahead of the host clock an input may claim to be. A speedhack
  // shows up here first.
  maxInputLeadTicks: 12,
  maxInputLagTicks: 180,
  // Queue depth per player. Beyond this the oldest input is dropped: a peer
  // cannot buy itself extra simulation time by hoarding.
  maxQueuedInputs: 8,
});

const REJECT_KEYS = [
  'oversize',
  'malformed',
  'constantsHash',
  'unknownPeer',
  'wrongType',
  'spoofedPlayer',
  'staleSeq',
  'outOfRange',
  'tickWindow',
  'rateLimit',
  'kickRate',
  'queueOverflow',
];

function codeToCounter(code) {
  if (code === 'oversize') return 'oversize';
  if (code === 'constants-hash') return 'constantsHash';
  if (code === 'input-range') return 'outOfRange';
  return 'malformed';
}

function emptyRejections() {
  const r = {};
  for (const k of REJECT_KEYS) r[k] = 0;
  return r;
}

/**
 * createHostSession(options)
 *
 *   world           an existing core world; otherwise one is built from
 *                   `players` / `teams` / `playerCount`
 *   hostPlayerId    slot the host itself drives (default 0)
 *   snapshotHz      20..30, default 20
 *   botSlots        player indices the bot policy owns
 *   botPolicy       ({ world, tick, playerIndex }) => { moveXFx, moveZFx, kick }
 *   limits          overrides for DEFAULT_LIMITS
 *   maxMessageBytes wire ceiling, default 16000
 *   historyTicks    how far back a peer may still delta against (default 180)
 *   maxCatchUpTicks ticks a single update() may burn (default 8)
 */
export function createHostSession(options = {}) {
  const {
    world = createWorld({
      players: options.players,
      teams: options.teams,
      playerCount: options.playerCount,
    }),
    hostPlayerId = 0,
    snapshotHz = 20,
    tickRate = TICK_RATE,
    botSlots = [],
    botPolicy = null,
    maxMessageBytes = MAX_MESSAGE_BYTES,
    historyTicks = 180,
    maxCatchUpTicks = 8,
  } = options;

  if (!(snapshotHz >= 20 && snapshotHz <= 30)) {
    throw new RangeError(`snapshotHz ${snapshotHz} outside the locked 20..30 band`);
  }
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const playerCount = world.playerCount;
  const botSet = new Set(botSlots.map((i) => i | 0));
  for (const b of botSet) {
    if (b < 0 || b >= playerCount) throw new RangeError(`bot slot ${b} outside 0..${playerCount - 1}`);
  }
  if (botSet.has(hostPlayerId)) throw new RangeError('the host slot cannot also be a bot slot');

  const peers = new Map(); // peerId -> peer record
  const byPlayer = new Map(); // playerId -> peerId

  const queues = [];
  const lastInput = [];
  const appliedSeq = new Uint32Array(playerCount);
  for (let i = 0; i < playerCount; i++) {
    queues.push([]);
    lastInput.push({ moveXFx: 0, moveZFx: 0, kick: 0, buttons: 0 });
  }
  let localInput = { moveXFx: 0, moveZFx: 0, kick: 0, buttons: 0 };

  const history = new Map(); // tick -> Int32Array state as it was broadcast
  const checksums = new Map(); // tick -> int32 checksum

  let startNow = null;
  let snapshotIndex = -1;
  let snapshotSeq = 0;

  const stats = {
    ticks: 0,
    snapshots: 0,
    fullSnapshots: 0,
    deltaSnapshots: 0,
    messagesSent: 0,
    bytesSent: 0,
    accepted: 0,
    helloAccepted: 0,
    botCalls: 0,
    rejected: emptyRejections(),
  };

  // ------------------------------------------------------------------ peers

  function makePeer(peerId, playerId, now) {
    return {
      peerId,
      playerId,
      needsFull: true,
      ackTick: -1,
      lastSeq: -1,
      inputTokens: limits.inputBurst,
      inputTokenAt: now,
      kickTokens: limits.kickBurst,
      kickTokenAt: now,
      prevKick: 0,
    };
  }

  function addPeer(peerId, playerId, now = 0) {
    const pid = playerId | 0;
    if (pid < 0 || pid >= playerCount) throw new RangeError(`playerId ${pid} outside the world`);
    if (pid === hostPlayerId) throw new RangeError('the host slot is not remotely drivable');
    if (botSet.has(pid)) throw new RangeError(`slot ${pid} is a bot slot`);
    if (byPlayer.has(pid) && byPlayer.get(pid) !== peerId) {
      throw new RangeError(`slot ${pid} already belongs to peer ${byPlayer.get(pid)}`);
    }
    const peer = makePeer(peerId, pid, now);
    peers.set(peerId, peer);
    byPlayer.set(pid, peerId);
    return peer;
  }

  function removePeer(peerId) {
    const peer = peers.get(peerId);
    if (!peer) return false;
    peers.delete(peerId);
    byPlayer.delete(peer.playerId);
    queues[peer.playerId].length = 0;
    lastInput[peer.playerId] = { moveXFx: 0, moveZFx: 0, kick: 0, buttons: 0 };
    return true;
  }

  // ------------------------------------------------------------------ intake

  function reject(bucket, reason) {
    stats.rejected[bucket]++;
    return { accepted: false, reason, bucket };
  }

  function takeToken(peer, field, atField, rateHz, burst, now) {
    const dt = Math.max(0, now - peer[atField]);
    peer[atField] = now;
    peer[field] = Math.min(burst, peer[field] + (dt * rateHz) / 1000);
    if (peer[field] < 1) return false;
    peer[field] -= 1;
    return true;
  }

  /**
   * Ingest one raw message from `peerId`. Never throws: every failure comes
   * back as { accepted: false, reason, bucket } and bumps a counter.
   */
  function receive(peerId, data, now = 0) {
    const peer = peers.get(peerId);
    if (!peer) return reject('unknownPeer', `no such peer ${peerId}`);

    let msg;
    try {
      msg = decodeMessage(data, { maxMessageBytes });
    } catch (err) {
      if (err instanceof ProtocolError) return reject(codeToCounter(err.code), err.message);
      return reject('malformed', String(err && err.message));
    }

    if (msg.type === MSG_HELLO) {
      if (msg.playerId !== peer.playerId) {
        return reject('spoofedPlayer', `peer ${peerId} claimed slot ${msg.playerId}`);
      }
      if (msg.wantFull) {
        peer.needsFull = true;
        peer.ackTick = -1;
      }
      stats.helloAccepted++;
      return { accepted: true, reason: 'hello' };
    }

    if (msg.type !== MSG_INPUT) return reject('wrongType', `type ${msg.type} is not peer-to-host`);

    if (msg.playerId !== peer.playerId) {
      return reject('spoofedPlayer', `peer ${peerId} claimed slot ${msg.playerId}`);
    }
    // seq is uint32 and monotone per peer; anything not newer is a duplicate or
    // a reordered straggler and the host has already moved past it.
    if (peer.lastSeq >= 0 && msg.seq <= peer.lastSeq) {
      return reject('staleSeq', `seq ${msg.seq} <= ${peer.lastSeq}`);
    }
    const nowTick = world.buf[HDR_TICK];
    if (msg.tick > nowTick + limits.maxInputLeadTicks) {
      return reject('tickWindow', `input tick ${msg.tick} is ${msg.tick - nowTick} ticks ahead`);
    }
    if (msg.tick < nowTick - limits.maxInputLagTicks) {
      return reject('tickWindow', `input tick ${msg.tick} is ${nowTick - msg.tick} ticks behind`);
    }
    if (!takeToken(peer, 'inputTokens', 'inputTokenAt', limits.maxInputRateHz, limits.inputBurst, now)) {
      return reject('rateLimit', `peer ${peerId} exceeded ${limits.maxInputRateHz} inputs/s`);
    }
    if (msg.kick && !peer.prevKick) {
      if (!takeToken(peer, 'kickTokens', 'kickTokenAt', limits.maxKickRateHz, limits.kickBurst, now)) {
        peer.prevKick = 0;
        return reject('kickRate', `peer ${peerId} exceeded ${limits.maxKickRateHz} kicks/s`);
      }
    }
    peer.prevKick = msg.kick;
    peer.lastSeq = msg.seq;
    if (msg.ackTick > peer.ackTick) peer.ackTick = msg.ackTick;

    const q = queues[peer.playerId];
    if (q.length >= limits.maxQueuedInputs) {
      q.shift();
      stats.rejected.queueOverflow++;
    }
    q.push({
      seq: msg.seq,
      tick: msg.tick,
      // the whole button mask reaches the core; kick stays split out so the
      // rate limiter above and older callers keep working
      input: {
        moveXFx: msg.moveXFx,
        moveZFx: msg.moveZFx,
        kick: msg.kick,
        buttons: msg.buttons ?? (msg.kick ? 1 : 0),
      },
    });
    stats.accepted++;
    return { accepted: true, reason: 'input' };
  }

  // -------------------------------------------------------------------- sim

  function gatherInputs() {
    const inputs = new Array(playerCount).fill(null);
    for (let i = 0; i < playerCount; i++) {
      if (i === hostPlayerId) {
        inputs[i] = localInput;
        continue;
      }
      if (botSet.has(i)) {
        // The one and only bot call site in the codebase.
        if (botPolicy) {
          stats.botCalls++;
          const raw = botPolicy({ world, tick: world.buf[HDR_TICK], playerIndex: i });
          const q = quantiseInput(raw);
          // `buttons` already carries the kick bit, so a policy that only kicks
          // produces exactly the mask it always produced; anything else it asks
          // for now survives instead of being silently dropped here.
          inputs[i] = { moveXFx: q.mx, moveZFx: q.mz, kick: q.kick, buttons: q.buttons };
        }
        continue;
      }
      const q = queues[i];
      if (q.length) {
        const m = q.shift();
        lastInput[i] = m.input;
        appliedSeq[i] = m.seq;
      }
      // Starvation repeats the last input. One input is consumed per tick, so a
      // client replaying its unacknowledged inputs one per tick reproduces this
      // exactly whenever nothing was lost.
      inputs[i] = lastInput[i];
    }
    return inputs;
  }

  function stepOnce() {
    const events = step(world, gatherInputs());
    stats.ticks++;
    return events;
  }

  function pruneHistory() {
    const cutoff = world.buf[HDR_TICK] - historyTicks;
    for (const t of history.keys()) if (t < cutoff) history.delete(t);
    for (const t of checksums.keys()) if (t < cutoff) checksums.delete(t);
  }

  function buildSnapshotMessages() {
    const tick = world.buf[HDR_TICK];
    const state = serialize(world);
    const checksum = stateChecksumInt(state);
    history.set(tick, state);
    checksums.set(tick, checksum);
    snapshotSeq = (snapshotSeq + 1) >>> 0;
    stats.snapshots++;

    const out = [];
    for (const peer of peers.values()) {
      const base = peer.needsFull ? null : history.get(peer.ackTick);
      let payload;
      let baseTick;
      if (base) {
        payload = encodeDeltaWords(base, state);
        baseTick = peer.ackTick;
        stats.deltaSnapshots++;
      } else {
        payload = state;
        baseTick = -1;
        stats.fullSnapshots++;
        peer.needsFull = false;
      }
      const buffers = encodeSnapshotMessages({
        seq: snapshotSeq,
        tick,
        baseTick,
        checksum,
        playerCount,
        ackSeqs: appliedSeq,
        payload,
        maxMessageBytes,
      });
      for (const buffer of buffers) {
        stats.messagesSent++;
        stats.bytesSent += buffer.byteLength;
        out.push({ to: peer.peerId, playerId: peer.playerId, buffer });
      }
    }
    pruneHistory();
    return out;
  }

  /**
   * Advance the simulation to wall clock `now` and return the messages that
   * should go out, as [{ to, playerId, buffer }]. Pure with respect to the
   * clock: the same `now` sequence always yields the same tick boundaries.
   */
  function update(now) {
    if (startNow === null) startNow = now;
    const elapsed = Math.max(0, now - startNow);

    const targetTick = Math.floor((elapsed * tickRate) / 1000);
    let burned = 0;
    while (world.buf[HDR_TICK] < targetTick && burned < maxCatchUpTicks) {
      stepOnce();
      burned++;
    }
    if (world.buf[HDR_TICK] < targetTick) {
      // Fell behind beyond the catch-up cap: re-anchor the clock instead of
      // accumulating a debt we would never repay.
      startNow = now - (world.buf[HDR_TICK] * 1000) / tickRate;
    }

    // Read the clock again AFTER a possible re-anchor. Using the pre-anchor
    // elapsed here would push snapshotIndex to a tick the world never reached,
    // and the broadcast would then go silent for exactly as long as the stall
    // lasted — a stutter turning into a blackout.
    const snapshotElapsed = Math.max(0, now - startNow);
    const targetSnapshot = Math.floor((snapshotElapsed * snapshotHz) / 1000);
    if (targetSnapshot <= snapshotIndex || peers.size === 0) {
      if (targetSnapshot > snapshotIndex) snapshotIndex = targetSnapshot;
      return [];
    }
    snapshotIndex = targetSnapshot;
    return buildSnapshotMessages();
  }

  // ------------------------------------------------------------- inspection

  return {
    world,
    playerCount,
    hostPlayerId,
    snapshotHz,
    limits,
    stats,
    addPeer,
    removePeer,
    receive,
    update,
    setLocalInput(input) {
      const q = quantiseInput(input);
      // Same widening as the bot path: the host's own player may charge, slide
      // and use the keeper's hands, which a kick-only field could not express.
      localInput = { moveXFx: q.mx, moveZFx: q.mz, kick: q.kick, buttons: q.buttons };
    },
    get tick() {
      return world.buf[HDR_TICK];
    },
    get snapshotSeq() {
      return snapshotSeq;
    },
    checksumAt(tick) {
      return checksums.has(tick) ? checksums.get(tick) : null;
    },
    stateAt(tick) {
      return history.has(tick) ? Int32Array.from(history.get(tick)) : null;
    },
    snapshot() {
      return serialize(world);
    },
    checksum() {
      return stateChecksumInt(serialize(world));
    },
    playerSlot(index) {
      const o = playerOffset(index);
      return world.buf.slice(o, o + 8);
    },
    peerCount() {
      return peers.size;
    },
    peerState(peerId) {
      const p = peers.get(peerId);
      return p ? { playerId: p.playerId, ackTick: p.ackTick, needsFull: p.needsFull } : null;
    },
    stateWords: stateLength(playerCount),
    FIELD,
  };
}
