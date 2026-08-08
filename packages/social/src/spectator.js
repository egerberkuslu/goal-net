// Spectator mode (feature matrix #35), and the reason it does not sink the host.
//
// A spectator is a peer with a seat and no input authority. That half is
// trivial: `receiveInput` refuses, unconditionally, with a counter. The half
// that needs engineering is COST, because the naive implementation — treat a
// spectator as another peer — makes host uplink grow linearly in spectators AND
// makes the host encode a distinct delta payload per spectator. On a home
// connection that is how a 4-spectator room turns into a stuttering match for
// the eight people actually playing.
//
// So the desk enforces a budget with four separate levers, and the test measures
// all four:
//
//   1. RATE. Spectators are served at `snapshotHz` (default 8) while players
//      keep the locked 20-30 Hz. Nobody is predicting from a spectator feed, so
//      interpolation over a 125 ms window is all it has to look right.
//
//   2. BASELINES. Only the first `maxBaselines` spectators (default 2) get a
//      private delta baseline. Everyone after that joins ONE shared stream:
//      a full keyframe every `keyframeEvery` sends, deltas against that
//      keyframe in between. Encoding work per broadcast is therefore capped at
//      `maxBaselines + 1` payloads NO MATTER how many spectators are seated —
//      the expensive part stops growing at three.
//
//   3. UPLINK. `admit` projects what one more spectator would cost at the
//      measured mean payload size and refuses with BUDGET before crossing
//      `maxUplinkBytesPerSec`.
//
//   4. HARD CAP. `maxSpectators` (default 8) is the last word, and the refusal
//      is explicit — CAP, not a silent drop — so the guest can be told why.
//
// Everything is clock-injected: `now` is a millisecond number the caller
// supplies, the send schedule is integer arithmetic off a fixed start, and no
// method reads Date or performance. A test drives years of it in a loop.

import { SPECTATE_REASON } from './wire.js';

export const SPECTATOR_DEFAULTS = Object.freeze({
  maxSpectators: 8,
  snapshotHz: 8,
  maxBaselines: 2,
  keyframeEvery: 5,
  /** Uplink the whole spectator gallery may take. 64 kB/s ~ 512 kbit/s. */
  maxUplinkBytesPerSec: 64000,
  /** Payload size assumed before anything has been measured. */
  assumedPayloadBytes: 700,
  /** A baseline older than this is refused and the spectator resynced. */
  maxBaselineAgeTicks: 180,
  open: true,
});

/**
 * createSpectatorDesk(options) — the host's spectator policy.
 *
 * The desk owns no sockets and no encoder. It answers three questions:
 * may this peer sit down, is a broadcast due, and which payloads must the host
 * encode for it. The caller does the encoding and the sending, which keeps the
 * whole thing testable with a synthetic clock and a counting encoder.
 */
export function createSpectatorDesk(options = {}) {
  const o = { ...SPECTATOR_DEFAULTS, ...options };
  if (!(o.snapshotHz > 0 && o.snapshotHz <= 30)) {
    throw new RangeError(`spectator snapshotHz ${o.snapshotHz} outside 1..30`);
  }
  if (!(o.maxBaselines >= 0)) throw new RangeError('maxBaselines must be >= 0');
  if (!(o.maxSpectators >= 0)) throw new RangeError('maxSpectators must be >= 0');

  const seats = new Map(); // id -> seat
  let open = o.open !== false;
  let startNow = null;
  let sendIndex = -1;
  let keyframeCount = 0;
  let sharedBaseTick = -1;

  const stats = {
    admitted: 0,
    released: 0,
    broadcasts: 0,
    payloadsEncoded: 0,
    messagesSent: 0,
    bytesSent: 0,
    keyframes: 0,
    refused: { cap: 0, budget: 0, closed: 0, already: 0 },
    rejectedInputs: 0,
  };

  let meanPayloadBytes = o.assumedPayloadBytes;
  let firstSendAt = null;
  let lastSendAt = null;

  /** Bytes per second one spectator costs at the measured mean payload size. */
  function perSpectatorBytesPerSec() {
    return meanPayloadBytes * o.snapshotHz;
  }

  function projectedBytesPerSec(count) {
    return perSpectatorBytesPerSec() * count;
  }

  /**
   * Seat a spectator. Returns { ok, reason } where `reason` is a
   * SPECTATE_REASON code, so the caller can put it straight on the wire.
   */
  function admit(id, now = 0) {
    if (typeof id !== 'string' || !id) {
      stats.refused.closed++;
      return { ok: false, reason: SPECTATE_REASON.CLOSED };
    }
    if (seats.has(id)) {
      stats.refused.already++;
      return { ok: false, reason: SPECTATE_REASON.ALREADY };
    }
    if (!open) {
      stats.refused.closed++;
      return { ok: false, reason: SPECTATE_REASON.CLOSED };
    }
    if (seats.size >= o.maxSpectators) {
      stats.refused.cap++;
      return { ok: false, reason: SPECTATE_REASON.CAP };
    }
    if (projectedBytesPerSec(seats.size + 1) > o.maxUplinkBytesPerSec) {
      stats.refused.budget++;
      return { ok: false, reason: SPECTATE_REASON.BUDGET };
    }
    // baselines go to the earliest arrivals; the rest ride the shared stream
    const privateSeats = [...seats.values()].filter((s) => s.private).length;
    seats.set(id, {
      id,
      at: now,
      private: privateSeats < o.maxBaselines,
      ackTick: -1,
      needsFull: true,
    });
    stats.admitted++;
    return { ok: true, reason: SPECTATE_REASON.OK };
  }

  function release(id) {
    const seat = seats.get(id);
    if (!seat) return false;
    seats.delete(id);
    stats.released++;
    // promote the longest-waiting shared spectator into the freed baseline slot
    if (seat.private) {
      const shared = [...seats.values()].filter((s) => !s.private).sort((a, b) => a.at - b.at);
      if (shared.length) {
        shared[0].private = true;
        shared[0].needsFull = true;
        shared[0].ackTick = -1;
      }
    }
    return true;
  }

  /**
   * A spectator sent something on the input channel. There is no code path that
   * accepts it: this returns the same shape hostSession.receive() does, so a
   * caller cannot mistake it for an acceptance.
   */
  function receiveInput(id) {
    stats.rejectedInputs++;
    return { accepted: false, reason: `spectator ${id} has no input authority`, bucket: 'spectatorInput' };
  }

  /** Spectators never author state, so this is the whole authority answer. */
  const hasInputAuthority = () => false;

  /** Record an acknowledged tick from a private-baseline spectator. */
  function noteAck(id, tick) {
    const seat = seats.get(id);
    if (!seat || !seat.private) return false;
    if (!Number.isInteger(tick) || tick < seat.ackTick) return false;
    seat.ackTick = tick;
    return true;
  }

  /** Integer send schedule off a fixed start, exactly like hostSession does. */
  function due(now) {
    if (startNow === null) startNow = now;
    const elapsed = Math.max(0, now - startNow);
    return Math.floor((elapsed * o.snapshotHz) / 1000) > sendIndex;
  }

  /**
   * plan(now, { tick }) -> { due, groups }
   *
   * `groups` is what the host must encode, at most `maxBaselines + 1` entries:
   *
   *   { kind: 'full' | 'delta', baseTick, ids: [...] }
   *
   * The shared group is always last and is the one that holds the crowd. When
   * nothing is due, or nobody is seated, `groups` is empty and the host does no
   * work at all.
   */
  function plan(now, { tick } = {}) {
    if (!due(now)) return { due: false, groups: [] };
    const elapsed = Math.max(0, now - startNow);
    sendIndex = Math.floor((elapsed * o.snapshotHz) / 1000);
    if (seats.size === 0) return { due: true, groups: [] };

    const currentTick = Number.isInteger(tick) ? tick : 0;
    const groups = [];

    for (const seat of seats.values()) {
      if (!seat.private) continue;
      const stale = seat.ackTick < 0 || currentTick - seat.ackTick > o.maxBaselineAgeTicks;
      if (seat.needsFull || stale) {
        groups.push({ kind: 'full', baseTick: -1, ids: [seat.id] });
        seat.needsFull = false;
      } else {
        groups.push({ kind: 'delta', baseTick: seat.ackTick, ids: [seat.id] });
      }
    }

    const shared = [...seats.values()].filter((s) => !s.private).map((s) => s.id);
    if (shared.length) {
      const needKeyframe = sharedBaseTick < 0
        || keyframeCount % o.keyframeEvery === 0
        || currentTick - sharedBaseTick > o.maxBaselineAgeTicks;
      if (needKeyframe) {
        groups.push({ kind: 'full', baseTick: -1, ids: shared });
        sharedBaseTick = currentTick;
        stats.keyframes++;
      } else {
        groups.push({ kind: 'delta', baseTick: sharedBaseTick, ids: shared });
      }
      keyframeCount++;
    }

    stats.broadcasts++;
    stats.payloadsEncoded += groups.length;
    return { due: true, groups };
  }

  /**
   * Tell the desk what a planned broadcast actually cost. `payloadBytes` is the
   * size of ONE encoded payload; `recipients` is how many peers it went to.
   * The running mean feeds the admission projection, so the budget tightens on
   * its own when the match gets busy.
   */
  function noteSent(payloadBytes, recipients, now = 0) {
    const bytes = payloadBytes * recipients;
    stats.messagesSent += recipients;
    stats.bytesSent += bytes;
    // exponential mean; a single fat keyframe must not close the door forever
    meanPayloadBytes = meanPayloadBytes * 0.9 + payloadBytes * 0.1;
    if (firstSendAt === null) firstSendAt = now;
    lastSendAt = now;
    return bytes;
  }

  /** What the host is spending, and whether it is over. */
  function budget(now = lastSendAt ?? 0) {
    const span = firstSendAt === null ? 0 : Math.max(0, now - firstSendAt);
    const measuredBytesPerSec = span > 0 ? (stats.bytesSent * 1000) / span : 0;
    return {
      spectators: seats.size,
      privateBaselines: [...seats.values()].filter((s) => s.private).length,
      snapshotHz: o.snapshotHz,
      meanPayloadBytes,
      maxPayloadsPerBroadcast: o.maxBaselines + 1,
      payloadsPerBroadcast: stats.broadcasts ? stats.payloadsEncoded / stats.broadcasts : 0,
      measuredBytesPerSec,
      projectedBytesPerSec: projectedBytesPerSec(seats.size),
      limitBytesPerSec: o.maxUplinkBytesPerSec,
      overBudget: measuredBytesPerSec > o.maxUplinkBytesPerSec,
    };
  }

  return {
    options: Object.freeze({ ...o }),
    stats,
    admit,
    release,
    receiveInput,
    hasInputAuthority,
    noteAck,
    due,
    plan,
    noteSent,
    budget,
    count: () => seats.size,
    has: (id) => seats.has(id),
    ids: () => [...seats.keys()],
    seat: (id) => {
      const s = seats.get(id);
      return s ? { id: s.id, private: s.private, ackTick: s.ackTick, needsFull: s.needsFull } : null;
    },
    setOpen(value) { open = value !== false; return open; },
    get open() { return open; },
  };
}
