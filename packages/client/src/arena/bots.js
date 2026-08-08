// Bot wiring for the arena. One policy instance per bot slot, host side only.
//
// @goalnet/bots already owns the brains and the host adapter; this file is the
// thin piece that knows about a *roster*: which slots are bots, which of them is
// a keeper, and what difficulty the lobby picked. It is also where the two
// vocabularies meet — the action object names its buttons `slide`, `catch` and
// `clear`, while the core's quantiseInput() reads `tackle`, `catchBall` and
// `clearBall`. Renaming either side would be a spec change, so the translation
// lives here, in the adapter, where it costs nothing.
//
// There is no client-side counterpart to this module and there must not be:
// createClientSession has no bot hook, and a guest authoring input for a slot it
// does not own is a spoof the host rejects.

import { createScriptedPolicy, makeBotPolicy } from '../../../bots/src/index.js';

/** Action-object button name -> the name packages/core actually reads. */
const BUTTON_ALIASES = Object.freeze({
  slide: 'tackle',
  catch: 'catchBall',
  clear: 'clearBall',
  throw: 'throwBall',
});

/**
 * createArenaBotPolicy(roster) -> the function createHostSession({ botPolicy })
 * calls, or null when the roster has no bots at all.
 *
 * `roster` is what buildRoster() returned.
 */
export function createArenaBotPolicy(roster) {
  if (!roster.botSlots.length) return null;

  const policies = {};
  const roles = {};
  for (const slot of roster.slots) {
    if (slot.kind !== 'bot') continue;
    roles[slot.index] = slot.role === 'keeper' ? 'keeper' : 'field';
    // A factory, not an instance: a BotPolicy owns per-tick state, so two slots
    // sharing one object would share one reaction ring and one random stream.
    policies[slot.index] = (playerIndex) => createScriptedPolicy({
      difficulty: slot.difficulty || roster.difficulty,
      role: roles[playerIndex],
      seed: roster.seed,
      id: `scripted-${slot.difficulty || roster.difficulty}-${playerIndex}`,
    });
  }

  const inner = makeBotPolicy({ policies, roles, seed: roster.seed });
  const adapted = (ctx) => translate(inner(ctx));
  adapted.reset = inner.reset;
  adapted.runners = inner.runners;
  return adapted;
}

/** Rename the action object's buttons into the core's vocabulary. */
function translate(input) {
  if (!input) return input;
  const out = { moveX: input.moveX, moveZ: input.moveZ, kick: !!input.kick };
  if (input.charge) out.charge = true;
  for (const [from, to] of Object.entries(BUTTON_ALIASES)) {
    if (input[from]) out[to] = true;
  }
  return out;
}
