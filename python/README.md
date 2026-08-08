# python/ — NumPy port of the core, and the MARL environment

`haxball3d_sim` is a bit-identical Python port of `packages/core`. Same Q16.16
integers, same tick order, same FNV-1a checksum chain. It exists so Phase 2 can
train against the exact engine the browser runs, and so a replay recorded in one
can be verified in the other.

Parity is not a claim in this README, it is a test:

```bash
python3 python/test_parity.py     # 68 checks, PASS/FAIL, non-zero exit on failure
```

## Layout

```
python/
  haxball3d_sim/
    fx.py            Q16.16 arithmetic (scalar + numpy int64), mirrors fx.js
    checksum.py      FNV-1a over Int32 and over UTF-16 strings
    layout.py        state layout / constants, loaded from layout.json
    matchrules.py    settings normalisation, settingsHash, pitch presets
    world.py         the tick: mirrors world.js section by section
    observation.py   the 100-feature vector, mirrors bots/src/observation.js
    actions.py       the 18-action discrete table, mirrors bots/src/action.js
    env.py           gym-style parallel multi-agent environment
  tools/*.mjs        JS-side generators: layout.json and the fixtures
  layout.json        generated; never edit by hand
  fixtures/          generated; the JS ground truth the tests compare against
  parity.py          replay a JS trace, diff the whole checksum chain
  test_parity.py     the acceptance gate
```

Requires Python 3.10+ and numpy. Nothing else.

## Running

```bash
# full chain parity against the JS trace, scalar and vectorised
python3 python/parity.py
python3 python/parity.py --vectorised

# and the match-rule / pitch-preset traces
python3 python/parity.py --rules

# the gate
python3 python/test_parity.py
```

`parity.py` compares the FULL per-tick checksum chain. On a mismatch it stops at
the first differing tick and prints every state word that differs, named, with
the JS value beside the Python one — the JS side of that report comes from
`tools/dump-state-at.mjs`, which replays the same recorded inputs in node.

## Regenerating the fixtures

Everything under `fixtures/` and `layout.json` is generated. Regenerate after
any change to `packages/core` or `packages/bots`:

```bash
node packages/core/test/run.mjs --dump-trace   > python/fixtures/trace.json
node python/tools/dump-layout.mjs              > python/layout.json
node python/tools/dump-fx-fixtures.mjs         > python/fixtures/fx.json
node python/tools/dump-rules-traces.mjs        > python/fixtures/rules-traces.json
node python/tools/dump-observation-fixture.mjs > python/fixtures/observation.json
python3 python/test_parity.py
```

The generators use an integer PRNG and no clock, so regenerating with unchanged
JS produces byte-identical files: a diff in `fixtures/` means the engine moved.

## The environment

```python
from haxball3d_sim.env import HaxballEnv

env = HaxballEnv(player_count=4, roles=[1, 0, 1, 0])   # roles: 1 = keeper
obs, info = env.reset(seed=0)                # obs float32[n_agents, 100]
obs, rewards, terminated, truncated, info = env.step([1, 9, 3, 0])
```

- Parallel, not turn-taking: every agent acts every decision step.
- One decision every `decision_period` core ticks (default 6 = 10 Hz, the rate
  `onnx-bots.md` specifies for shipped bots); the action is held in between.
- Actions are indices into the 18-entry discrete table, in the ATTACK frame, so
  index 1 is "toward the opponent goal" for both teams.
- `info["checksum"]` is the core checksum, so a training run can be replayed and
  verified like any other match.

Default reward, per agent:

```
r = goal_reward * (goals we scored - goals we conceded this step)
  + shaping_coef * (gamma * PHI(s') - PHI(s))
PHI(s) = -distance(ball, the goal we attack) / pitch diagonal
```

The goal term is the objective and is exactly zero-sum between the teams. The
second term is Ng-Harada-Russell potential-based shaping, so it cannot change
the optimal policy — the property the paper needs to be able to state. Hooks:
`reward_fn` replaces the default outright, `shaping_terms` adds named
potentials that are differenced the same way, and `goal_reward` /
`shaping_coef` / `gamma` scale the defaults.
