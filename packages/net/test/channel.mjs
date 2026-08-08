// In-process fake DataChannel. No sockets, no timers, no real clock.
//
// Everything is driven by the caller's synthetic millisecond clock, so a run
// with 12% loss and reordering is byte-for-byte repeatable: the loss pattern
// comes from a seeded integer PRNG, never from Math.random.

/** xorshift32. Integer only, so a seed reproduces a run exactly. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= (s << 13) >>> 0;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= (s << 5) >>> 0;
    s >>>= 0;
    return s >>> 0;
  };
}

/**
 * createChannel({ latencyMs, jitterMs, lossPct, reorderPct, seed })
 *
 *   send(data, now)     queue a message for delivery at now + latency + jitter
 *   deliver(now)        pop everything due, in ARRIVAL order (which after
 *                       jitter is not send order — that is the point)
 *   stats               { sent, dropped, delivered, reordered }
 */
export function createChannel(options = {}) {
  const {
    latencyMs = 50,
    jitterMs = 0,
    lossPct = 0,
    reorderPct = 0,
    reorderMs = 40,
    seed = 0x9e3779b9,
  } = options;

  const rng = makeRng(seed);
  const inFlight = [];
  const stats = { sent: 0, dropped: 0, delivered: 0, reordered: 0, outOfOrder: 0 };
  let highWater = -Infinity;

  function roll(pct) {
    return pct > 0 && rng() % 10000 < pct * 100;
  }

  function send(data, now) {
    stats.sent++;
    if (roll(lossPct)) {
      stats.dropped++;
      return false;
    }
    let due = now + latencyMs;
    if (jitterMs > 0) due += (rng() % (jitterMs * 2 + 1)) - jitterMs;
    if (roll(reorderPct)) {
      due += reorderMs;
      stats.reordered++;
    }
    if (due < now) due = now;
    inFlight.push({ data, due, order: stats.sent });
    return true;
  }

  function deliver(now) {
    const out = [];
    for (let i = inFlight.length - 1; i >= 0; i--) {
      if (inFlight[i].due <= now) {
        out.push(inFlight[i]);
        inFlight.splice(i, 1);
      }
    }
    // Stable order by due time; equal due times keep send order.
    out.sort((a, b) => a.due - b.due || a.order - b.order);
    for (const m of out) {
      stats.delivered++;
      // `reordered` counts the delays we injected; `outOfOrder` counts the
      // arrivals that actually landed behind an already-delivered message,
      // which is what the receiver has to survive.
      if (m.order < highWater) stats.outOfOrder++;
      highWater = Math.max(highWater, m.order);
    }
    return out.map((m) => m.data);
  }

  return {
    send,
    deliver,
    stats,
    get inFlight() {
      return inFlight.length;
    },
  };
}
