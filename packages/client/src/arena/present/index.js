// The presentation layer (feature matrix #38-#41), assembled.
//
//   bus.js         core events + state  ->  football events
//   commentary.js  football events      ->  one spoken line at a time
//   clips.js       a line               ->  a sound
//   tension.js     state                ->  one scalar, plus a subscribe hook
//   stadium.js     a room code          ->  a variant; sky.js paints it
//   stats.js       events               ->  the table; screen.js draws it
//
// ONE rule governs the whole directory: it READS core state and it never
// writes. There is no path from here into packages/core, into the host session
// or into the input pipeline, and there is no value produced here that any of
// them consume. Delete this directory and the match plays identically — that is
// the test of whether something belongs in it.
//
// The atmosphere layer (crowd, cloth, kits) subscribes to `tension` and is
// otherwise a stranger: it does not import anything from present/ except the
// meter it is handed, and nothing here imports anything from atmos/.
//
// MOUNTING, from arena/main.js:
//
//   const present = attachPresentation({
//     view, endHost: dom.end, before: dom.endBack,
//     slots: roster.slots, settings, roomCode: transport?.code, params,
//   });
//   ...per tick :  present.feed(events, state)
//   ...per frame:  present.render(dt, state, nowMs)
//   ...on end   :  present.showEnd(result)
//   ...on leave :  present.dispose()

import { createPresentBus, deriveEvents } from './bus.js';
import { createCommentator } from './commentary.js';
import { createClipPlayer, createNullPlayer } from './clips.js';
import { CLIP_MANIFEST } from './manifest.js';
import { createMatchRecorder } from './stats.js';
import { createStatsScreen } from './screen.js';
import {
  createTensionMeter, tensionInputFromState, commentaryGapMs,
} from './tension.js';
import { detectQuality, variantFromParams } from './stadium.js';
import { PITCH_M, TICK_HZ } from '../units.js';

/** Geometry the recorder and the bus need, in metres. Read-only. */
export function arenaGeometry() {
  return {
    goalHalfX: PITCH_M.goalHalfX,
    halfZ: PITCH_M.halfZ,
    halfX: PITCH_M.halfX,
    playerR: PITCH_M.playerR,
    postR: PITCH_M.postR,
    ballR: PITCH_M.ballR,
  };
}

/**
 * @param {{view?:object, scene?:object, renderer?:object, endHost?:object,
 *          before?:object, slots?:object[], settings?:object,
 *          roomCode?:string|null, params?:object, lang?:string,
 *          audio?:boolean, quality?:string, env?:object,
 *          onDuck?:(amount:number)=>void, applyStadium?:Function}} options
 */
export function attachPresentation(options = {}) {
  const geo = arenaGeometry();
  const slots = options.slots || [];
  const settings = options.settings || {};
  const totalSeconds = Number(settings.matchSeconds) || 180;
  const params = options.params || null;

  const recorder = createMatchRecorder({ slots, geo });
  const bus = createPresentBus({ geo, totalSeconds });
  const meter = createTensionMeter({ smoothing: 0.6 });

  const player = options.audio === false
    ? createNullPlayer({ onDuck: options.onDuck })
    : createClipPlayer({ onDuck: options.onDuck });
  const commentator = createCommentator({
    manifest: CLIP_MANIFEST,
    player,
    lang: options.lang || readLang(params),
  });

  const screen = options.endHost
    ? createStatsScreen(options.endHost, { before: options.before })
    : null;

  // ------------------------------------------------------------- stadium
  const variant = variantFromParams(params, options.roomCode);
  const quality = detectQuality({
    ...(options.env || readEnv()),
    override: options.quality || readParam(params, 'quality'),
  });
  let stadium = null;
  const scene = options.scene || options.view?.scene || null;
  const renderer = options.renderer || options.view?.renderer || null;
  if (scene && typeof options.applyStadium === 'function') {
    stadium = options.applyStadium({ scene, renderer, variant, quality });
  }

  let prevState = null;
  let ended = false;
  let secondsLeft = totalSeconds;

  const api = {
    recorder,
    bus,
    commentator,
    player,
    meter,
    variant,
    quality,
    get stadium() { return stadium; },
    get tension() { return meter.value; },

    /** The hook the atmosphere layer uses. It needs nothing else from here. */
    subscribeTension(fn) { return meter.subscribe(fn); },

    /** Attach the stadium after the fact (sky.js is imported lazily by main). */
    useStadium(handle) { stadium = handle; return handle; },

    /**
     * One simulated tick.
     *
     * @param {object[]|null} coreEvents step()'s events, or null on a guest
     * @param {object} state readState(world) or a guest sample
     * @param {{secondsLeft?:number, golden?:boolean, nowMs?:number}} ctx
     */
    feed(coreEvents, state, ctx = {}) {
      if (!state) return [];
      const events = coreEvents || deriveEvents(prevState, state);
      const statEvents = recorder.feed(events, state);
      if (Number.isFinite(ctx.secondsLeft)) secondsLeft = ctx.secondsLeft;

      const possession = recorder.possessionShare();
      const golden = !!ctx.golden || state.match?.phase === 'golden-goal';
      const tension = meter.set(
        tensionInputFromState(state, {
          halfZ: geo.halfZ, totalSeconds, possession, golden, secondsLeft,
        }),
        1 / TICK_HZ,
      );
      commentator.setTension(tension);

      const lastTouch = recorder.lastTouch;
      const out = bus.feed(statEvents, state, {
        tension,
        lastTouchTeam: lastTouch >= 0 ? recorder.players[lastTouch].team : -1,
        possession,
        secondsLeft,
        golden,
      });
      const nowMs = ctx.nowMs != null ? ctx.nowMs : (recorder.ticks * 1000) / TICK_HZ;
      for (const e of out) commentator.feed(e, nowMs);
      prevState = state;
      return out;
    },

    /** One drawn frame. Advances the commentary clock and the rain. */
    render(dt, state, nowMs) {
      const t = nowMs != null ? nowMs : (recorder.ticks * 1000) / TICK_HZ;
      commentator.update(t);
      if (stadium) stadium.update(dt);
      void state;
      return commentator.playing;
    },

    /** Push an event the core does not produce (half time, a mode's foul). */
    push(event, nowMs) {
      const out = bus.push(event);
      const t = nowMs != null ? nowMs : (recorder.ticks * 1000) / TICK_HZ;
      for (const e of out) commentator.feed(e, t);
      return out;
    },

    setLanguage(lang) { return commentator.setLanguage(lang); },

    /** Draw the end screen. `result` is ArenaMatch's onEnd payload. */
    showEnd(result, extra = {}) {
      ended = true;
      const summary = recorder.summary();
      if (screen) {
        screen.render(summary, {
          fouls: summary.teams[0].fouls + summary.teams[1].fouls > 0,
          rating: extra.rating || null,
        });
      }
      void result;
      return summary;
    },

    summary() { return recorder.summary(); },
    get ended() { return ended; },

    /** Everything a headless probe wants. Mirrors window.__arena's shape. */
    diag() {
      const s = recorder.summary();
      return {
        tension: meter.value,
        band: meter.band,
        gapMs: commentaryGapMs(meter.value),
        spoken: commentator.spoken(),
        playing: commentator.playing,
        variant,
        quality,
        stadium: stadium ? stadium.id : null,
        drawCallDelta: stadium ? stadium.drawCallDelta : 0,
        teams: s.teams,
        mvp: s.mvp ? { name: s.mvp.name, score: s.mvp.mvp } : null,
      };
    },

    dispose() {
      commentator.reset();
      player.dispose?.();
      screen?.clear();
      stadium?.dispose();
      stadium = null;
      prevState = null;
    },
  };

  return api;
}

function readParam(params, key) {
  if (!params) return null;
  return typeof params.get === 'function' ? params.get(key) : params[key];
}

function readLang(params) {
  const p = readParam(params, 'lang');
  if (p === 'en' || p === 'tr') return p;
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  }
  return 'tr';
}

function readEnv() {
  if (typeof navigator === 'undefined') return {};
  return {
    userAgent: navigator.userAgent,
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
    devicePixelRatio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
  };
}

export { createPresentBus, deriveEvents } from './bus.js';
export { createCommentator } from './commentary.js';
export { createMatchRecorder } from './stats.js';
export { createTensionMeter, tensionOf, tensionBand, commentaryGapMs } from './tension.js';
export { xgOf, xgFromFeatures } from './xg.js';
export { CLIP_MANIFEST, validateManifest, recordingSheet } from './manifest.js';
export { LINES, validateLines } from './lines.js';
export {
  DEFAULT_VARIANT, allVariants, detectQuality, resolveVariant, validateTables,
  validateVariant, variantForRoom,
} from './stadium.js';
