// The match loop, outside any framework.
//
// One class runs both halves of the netcode, because from the loop's point of
// view they differ in only three places: who owns the world, where the render
// state comes from, and who is allowed to run bots.
//
//   HOST   owns the one core world, steps it at a fixed 60 Hz inside
//          hostSession.update(now), runs every bot, and broadcasts 20 Hz
//          snapshots. Renders readState(world) — live, not interpolated.
//
//   GUEST  owns no world. It sends one input per 60 Hz tick, applies the
//          snapshots it is given, and renders client.sample(now), which is
//          ~100 ms in the past with the local player predicted forward.
//          It has no bot policy and no way to acquire one.
//
// The render loop is a plain requestAnimationFrame; the simulation clock is the
// session's, derived from the wall clock with integer arithmetic. Nothing here
// steps the core directly — that would be a second authority.

import { createWorld, readState, HDR_TICK } from '../../../core/src/index.js';
import { createHostSession, createClientSession } from '../../../net/src/index.js';
import { createArenaBotPolicy } from './bots.js';
import { AMSG, decodeLobby, encodeLobby, frameKind } from './protocol.js';
import { matchStatus, clockText } from './matchRules.js';
import { TICK_MS } from './units.js';
import { RenderSmoother } from './smooth.js';

const SNAPSHOT_HZ = 20;
const INTERPOLATION_MS = 100;

export class ArenaMatch {
  /**
   * @param {{role:'host'|'guest', roster:object, settings:object,
   *          localIndex:number, transport:object, hostPeerId?:string,
   *          view:object, input:object, hud:object,
   *          present?:object, onEnd?:(result:object)=>void}} options
   */
  constructor(options) {
    this.role = options.role;
    this.roster = options.roster;
    this.settings = options.settings;
    this.localIndex = options.localIndex;
    this.transport = options.transport;
    this.hostPeerId = options.hostPeerId || null;
    this.view = options.view;
    this.input = options.input;
    this.hud = options.hud || {};
    // The presentation layer (matrix #38-#41) is optional and strictly
    // downstream: it is handed the events and the state and hands nothing back.
    // A null `present` removes commentary, tension and the stats screen and
    // changes nothing else, which is the property that keeps it cosmetic.
    this.present = options.present || null;
    this.onEnd = options.onEnd || (() => {});

    this.host = null;
    this.client = null;
    this.botPolicy = null;
    this.botCalls = 0;
    this.running = false;
    this.finished = null;
    this.raf = 0;
    this.ticker = null;
    this.frames = 0;
    this.pumps = 0;
    this.lastRenderMs = 0;
    this.lastPumpMs = 0;
    this.inputClockMs = 0;
    this.lastScore = [0, 0];
    this.lastKickCooldown = this.roster.slots.map(() => 0);
    this.flow = 'kickoff';
    // Host-only: the simulation clock and the display clock are independent,
    // so what is drawn is blended between the last two ticks. See smooth.js.
    this.smoother = new RenderSmoother(TICK_MS);
    this.drawnTick = -1;
    this.flowUntilMs = 0;

    if (this.role === 'host') this._buildHost();
    else this._buildGuest();
  }

  // ------------------------------------------------------------------ setup

  _buildHost() {
    const world = createWorld({ players: this.roster.players });
    const raw = createArenaBotPolicy(this.roster);
    // Counting here rather than trusting hostSession's own counter keeps the
    // two-tab proof honest: this number can only move in a tab that owns bots.
    this.botPolicy = raw
      ? (ctx) => { this.botCalls++; return raw(ctx); }
      : null;
    this.host = createHostSession({
      world,
      hostPlayerId: this.localIndex,
      snapshotHz: SNAPSHOT_HZ,
      botSlots: this.roster.botSlots,
      botPolicy: this.botPolicy,
      // One read per simulated tick, for the cosmetic layer only. The core's
      // event list is consumed inside hostSession and would otherwise be lost.
      onEvents: this.present
        ? (events) => this._observe(events)
        : null,
    });
    // Every human slot that is not ours belongs to a connected peer, and the
    // lobby id IS the transport peer id, so the mapping needs no side table.
    for (const slot of this.roster.slots) {
      if (slot.kind !== 'human' || slot.index === this.localIndex) continue;
      try {
        this.host.addPeer(slot.id, slot.index, 0);
      } catch (err) {
        console.warn('[arena] could not seat peer', slot.id, err.message);
      }
    }
  }

  _buildGuest() {
    this.client = createClientSession({
      localPlayerId: this.localIndex,
      interpolationMs: INTERPOLATION_MS,
    });
  }

  // ------------------------------------------------------------------ wire

  /** One inbound binary frame from the transport. */
  receive(peerId, data) {
    const kind = frameKind(data);
    if (kind === 'net') {
      if (this.role === 'host') this.host.receive(peerId, data, now());
      else this.client.receive(data, now());
      return;
    }
    if (kind !== 'lobby') return;
    const msg = decodeLobby(data);
    if (!msg) return;
    if (msg.t === AMSG.END && this.role === 'guest') {
      this._finish({ score: msg.score, winner: msg.winner, reason: msg.reason });
    }
  }

  peerLeft(peerId) {
    if (this.role === 'host' && this.host) this.host.removePeer(peerId);
  }

  // ------------------------------------------------------------------ loop

  start() {
    if (this.running) return;
    this.running = true;
    this.lastRenderMs = now();
    this.lastPumpMs = this.lastRenderMs;
    this.inputClockMs = this.lastRenderMs;
    if (this.role === 'guest') this._sendHello();
    const tick = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      this.frame(now());
    };
    this.raf = requestAnimationFrame(tick);
    this._startPumpTicker();
  }

  /**
   * The pump must not be hostage to the renderer.
   *
   * requestAnimationFrame is the wrong clock for netcode twice over: it is
   * throttled to a crawl in a tab that is not in front, and it is capped by how
   * long a frame takes to draw. A host in a background tab would stop being the
   * authority; a guest on a weak GPU would send inputs at its frame rate, which
   * the host then has to paper over by repeating the last one.
   *
   * So a worker timer — which neither throttling nor the GPU can slow — runs the
   * PUMP (simulate, send, receive) at 60 Hz whenever rAF is not already doing
   * it, and drives a cheap HUD refresh a few times a second so a background tab
   * never shows a stale score. Drawing stays on rAF, where it belongs.
   */
  _startPumpTicker() {
    if (typeof Worker !== 'function' || typeof Blob !== 'function') return;
    try {
      const url = URL.createObjectURL(new Blob(
        ['setInterval(() => postMessage(0), 8);'], { type: 'text/javascript' },
      ));
      this.ticker = new Worker(url);
      URL.revokeObjectURL(url);
      this.ticker.onmessage = () => {
        if (!this.running) return;
        const t = now();
        // rAF at 60 Hz pumps every ~16.7 ms and this does nothing
        if (t - this.lastPumpMs >= 16) this.pump(t);
        if (t - this.lastRenderMs >= 250) this.render(t, { draw: false });
      };
    } catch {
      this.ticker = null; // no worker: a background tab simply crawls, as before
    }
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.ticker) { this.ticker.terminate(); this.ticker = null; }
  }

  _sendHello() {
    if (!this.hostPeerId) return;
    this.transport.sendRaw(this.hostPeerId, this.client.hello());
  }

  /** Pump then draw. Public so a headless harness can drive it by hand. */
  frame(nowMs) {
    this.pump(nowMs);
    this.render(nowMs);
  }

  /** Simulate and talk. Cheap, fixed rate, never skipped. */
  pump(nowMs) {
    this.lastPumpMs = nowMs;
    this.pumps++;
    if (this.role === 'host') this._hostPump(nowMs);
    else this._guestPump(nowMs);
    this._captureForDraw(nowMs);
  }

  /**
   * Hand the newly simulated tick to the smoother, stamped with the time it
   * was simulated.
   *
   * This has to happen HERE and not in render(). Pumps come from two places —
   * rAF and the worker ticker — so the delay between a tick being simulated and
   * a frame observing it is anything from 0 to 16 ms and changes every frame.
   * Stamping at render time therefore fed the interpolator a wobbly clock and
   * left the twitch it was supposed to remove: measured on screen, the drawn
   * speed still varied by 60% frame to frame. Stamped here it is the real tick
   * clock, and the blend is a clean ramp.
   */
  _captureForDraw(nowMs) {
    if (this.role !== 'host' || !this.host) return;
    const tick = this.host.world.buf[HDR_TICK];
    if (tick === this.drawnTick) return;      // no tick happened this pump
    this.drawnTick = tick;
    this.smoother.push(readState(this.host.world), nowMs);
  }

  /** Draw and paint. Skippable: a dropped frame costs smoothness and nothing else. */
  render(nowMs, { draw = true } = {}) {
    const dt = Math.min(0.1, Math.max(0, (nowMs - this.lastRenderMs) / 1000));
    this.lastRenderMs = nowMs;
    this.frames++;
    const state = this.role === 'host' ? readState(this.host.world) : this._guestSample(nowMs);
    if (!state) return;
    this._reactToState(state, dt);
    // The guest decides the match is over from the same authoritative numbers
    // the host used, so the two end screens agree without a message. The host
    // sends one anyway, for a guest whose snapshot stream died.
    if (this.role === 'guest' && !this.finished) {
      const status = matchStatus(this.client.tick, state.score, this.settings);
      if (status.over) {
        this._finish({ score: state.score, winner: status.winner, reason: status.reason });
      }
    }
    // A hidden tab has nobody to draw for; the scoreboard is three text nodes
    // and is painted anyway, so a tab brought back to the front is never showing
    // a stale score even for one frame.
    const visible = typeof document === 'undefined' || !document.hidden;
    if (draw && visible) {
      // Rules, netcode and the HUD all run on `state`, the authoritative tick.
      // Only the picture is smoothed, and only for the host: a guest's sample
      // is already interpolated by packages/net.
      const drawn = this.role === 'host' ? (this.smoother.sample(nowMs) || state) : state;
      this.view.update(drawn, dt, { state: this.flow, me: this.localIndex });
    }
    if (this.present) {
      // A guest owns no world and sees no events, so it feeds the layer its
      // sampled state and lets bus.deriveEvents() find the goals in it.
      if (this.role === 'guest') {
        const status = matchStatus(this.client.tick, state.score, this.settings);
        this.present.feed(null, state, {
          secondsLeft: status.secondsLeft, golden: status.golden, nowMs: nowMs,
        });
      }
      this.present.render(dt, state, nowMs);
    }
    this._paintHud(state);
  }

  _hostPump(nowMs) {
    if (this.finished) return;
    const raw = this.input.read();
    this.host.setLocalInput({
      moveX: raw.moveX, moveZ: raw.moveZ, buttons: raw.buttons,
    });
    for (const out of this.host.update(nowMs)) {
      this.transport.sendRaw(out.to, out.buffer);
    }
    const state = readState(this.host.world);
    const status = matchStatus(state.tick, state.score, this.settings);
    if (status.over) this._endAsHost(state, status);
  }

  _guestPump(nowMs) {
    if (this.client.needsFull) this._sendHello();
    // One input per 60 Hz tick: the host consumes exactly one per tick, so any
    // other rate would make the client's replay diverge from the host's intake.
    //
    // Two brakes, both of them the host's rules read from this side:
    //
    //   MAX_LEAD   sendInput() advances the prediction by a tick, so a frame
    //              that fires a long burst would stamp inputs with ticks the
    //              host has not reached. Past limits.maxInputLeadTicks (12) it
    //              rejects them as a speedhack — correctly, since a client
    //              really is claiming time it does not have. Stop at 10.
    //   BURST      the host queues at most limits.maxQueuedInputs (8) per
    //              player and drops the oldest beyond that, so sending more
    //              than a few per frame throws away the inputs it just made.
    //
    // A frame slower than 16.7 ms therefore does not "catch up" by shouting; it
    // simply sends fewer inputs, and the host repeats the last one, which is
    // exactly what the client's own replay reproduces.
    const MAX_LEAD = 10;
    const MAX_BURST = 3;
    if (!this.finished) {
      const raw = this.input.read();
      let guard = 0;
      while (nowMs - this.inputClockMs >= TICK_MS && guard++ < MAX_BURST) {
        if (this.client.tick >= 0 && this.client.predictedTick - this.client.tick >= MAX_LEAD) {
          break;
        }
        const sent = this.client.sendInput({
          moveX: raw.moveX, moveZ: raw.moveZ, buttons: raw.buttons,
        });
        this.inputClockMs += TICK_MS;
        if (sent && this.hostPeerId) this.transport.sendRaw(this.hostPeerId, sent.buffer);
      }
      // never let the backlog grow into a burst the host would refuse
      if (nowMs - this.inputClockMs > MAX_BURST * TICK_MS) this.inputClockMs = nowMs;
    }
  }

  /** The guest's render state: interpolated authority, local player predicted. */
  _guestSample(nowMs) {
    const sample = this.client.sample(nowMs);
    if (!sample) return null;
    return {
      tick: Math.round(sample.renderTick),
      score: sample.score,
      ball: sample.ball,
      players: sample.players,
    };
  }

  // ----------------------------------------------------------- presentation

  /**
   * Host only: one simulated tick, handed to the presentation layer. Called
   * from inside hostSession's step loop, so `readState` here is the state of
   * exactly that tick and not of the last one in a catch-up burst.
   */
  _observe(events) {
    if (!this.present) return;
    const state = readState(this.host.world);
    const status = matchStatus(state.tick, state.score, this.settings);
    this.present.feed(events, state, {
      secondsLeft: status.secondsLeft,
      golden: status.golden,
      nowMs: now(),
    });
  }

  /**
   * The core's events do not cross the wire, so the two visible reactions are
   * derived from the authoritative state instead: a score that moved is a goal,
   * a kick cooldown that jumped to full is a strike. Both are true on a guest's
   * interpolated sample as well, which is exactly why it is done this way.
   */
  _reactToState(state, dt) {
    void dt;
    const [r, b] = state.score;
    if (r !== this.lastScore[0] || b !== this.lastScore[1]) {
      const team = r > this.lastScore[0] ? 0 : 1;
      this.lastScore = [r, b];
      this.view.onGoal(team);
      this.flow = 'goal';
      this.flowUntilMs = now() + 2600;
      this._say(team === 0 ? 'GOL! KIRMIZI' : 'GOL! MAVİ', 'gol');
    } else if (this.flow === 'goal' && now() > this.flowUntilMs) {
      this.flow = 'play';
    }
    for (let i = 0; i < state.players.length; i++) {
      const cd = state.players[i].kickCooldown || 0;
      if (cd > this.lastKickCooldown[i]) this.view.onStrike(i);
      this.lastKickCooldown[i] = cd;
    }
  }

  _paintHud(state) {
    const status = matchStatus(
      this.role === 'host' ? state.tick : this.client.tick,
      state.score,
      this.settings,
    );
    const h = this.hud;
    if (h.scoreRed) h.scoreRed.textContent = String(state.score[0]);
    if (h.scoreBlue) h.scoreBlue.textContent = String(state.score[1]);
    if (h.timer) h.timer.textContent = (status.golden ? 'AG ' : '') + clockText(status.secondsLeft);
    if (h.diag) {
      h.diag.textContent = `${this.role} · tick ${this.role === 'host' ? state.tick : this.client.tick}`
        + ` · ${this.roster.mode} · bot ${this.botCalls}`;
    }
  }

  _say(text, cls) {
    const el = this.hud.msg;
    if (!el) return;
    el.textContent = text;
    el.className = `hud show ${cls || ''}`;
    clearTimeout(this._sayTimer);
    this._sayTimer = setTimeout(() => { el.className = 'hud'; }, 1800);
  }

  // ------------------------------------------------------------------- end

  _endAsHost(state, status) {
    const payload = {
      t: AMSG.END,
      score: [state.score[0], state.score[1]],
      winner: status.winner,
      reason: status.reason,
    };
    const frame = encodeLobby(payload);
    if (frame) this.transport.broadcastRaw(frame);
    this._finish({ score: payload.score, winner: status.winner, reason: status.reason });
  }

  _finish(result) {
    if (this.finished) return;
    this.finished = result;
    this.flow = 'end';
    this.present?.showEnd(result);
    this.onEnd(result);
  }

  // ------------------------------------------------------------ diagnostics

  /**
   * Everything scripts/arena-2tab.mjs needs to assert, and nothing that could
   * be faked from the other side of the wire.
   */
  diag() {
    if (this.role === 'host') {
      return {
        role: 'host',
        tick: this.host.world.buf[HDR_TICK],
        score: readState(this.host.world).score,
        checksum: this.host.checksum(),
        hasHostSession: true,
        botPolicyInstalled: !!this.botPolicy,
        botCalls: this.botCalls,
        hostBotCalls: this.host.stats.botCalls,
        peers: this.host.peerCount(),
        snapshots: this.host.stats.snapshots,
        accepted: this.host.stats.accepted,
        rejected: { ...this.host.stats.rejected },
        frames: this.frames,
        pumps: this.pumps,
      };
    }
    const auth = this.client.authoritativeState();
    return {
      role: 'guest',
      tick: this.client.tick,
      score: auth ? auth.score : [0, 0],
      checksum: this.client.authoritativeChecksum(),
      hasHostSession: false,
      botPolicyInstalled: false,
      botCalls: this.botCalls,
      applied: this.client.stats.applied,
      checksumMismatches: this.client.stats.checksumMismatches,
      desyncs: this.client.stats.desyncs,
      staleDropped: this.client.stats.staleDropped,
      missingBase: this.client.stats.missingBase,
      inputsSent: this.client.stats.inputsSent,
      predictedTick: this.client.predictedTick,
      frames: this.frames,
      pumps: this.pumps,
    };
  }

  /** Host only: the digest it broadcast for `tick`, or null once it aged out. */
  checksumAt(tick) {
    return this.host ? this.host.checksumAt(tick) : null;
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
