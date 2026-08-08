"""Gym-style multi-agent environment over the bit-identical core.

    from haxball3d_sim.env import HaxballEnv
    env = HaxballEnv(player_count=4, roles=[1, 0, 1, 0])
    obs, info = env.reset(seed=0)              # obs: float32[n_agents, 100]
    obs, rewards, terminated, truncated, info = env.step([1, 9, 3, 0])

Shape of the API
    Parallel, not turn-taking: every agent acts every decision step, which is
    what MAPPO wants. ``obs`` is one row per agent in player order, ``rewards``
    one float per agent, and ``terminated`` / ``truncated`` are single booleans
    because a football match ends for everyone at once. Per-agent dict views
    (PettingZoo's ParallelEnv shape) are one comprehension away and are left to
    the training code so this file has no framework dependency.

Decision rate
    The core runs at 60 Hz; a policy decides at ``decision_period`` tick
    intervals (default 6, i.e. 10 Hz, the rate onnx-bots.md specifies for the
    shipped bots) and the chosen action is held for the intervening ticks. The
    action a browser bot takes at 10 Hz and the action this env trains at are
    therefore the same object held for the same number of ticks.

Reward (default)
    r = GOAL * (goals we scored - goals we conceded this decision step)
        + SHAPE * (gamma * PHI(s') - PHI(s))

    PHI(s) = -(distance from the ball to the opponent goal centre) / diagonal,
    so PHI rises as the ball approaches the goal we attack. Written as
    ``gamma * PHI(s') - PHI(s)`` it is Ng-Harada-Russell potential-based
    shaping: it cannot change the optimal policy, only how quickly the agent
    finds it, which is the property the paper has to be able to claim. The goal
    term is the real objective and is exactly zero-sum between the teams.

    Everything else is a hook rather than a hardcoded choice:
      * ``reward_fn(env, before, after, events)`` replaces the default entirely
      * ``shaping_terms`` adds named potentials (each a callable state -> float
        per agent) that are differenced the same way
      * ``goal_reward`` / ``shaping_coef`` / ``gamma`` scale the defaults

Determinism
    No RNG anywhere in the environment itself: ``seed`` only chooses the
    scripted kickoff jitter (none by default) and seeds ``env.rng`` for callers
    who want one. Two runs with the same actions produce the same checksum
    chain, which ``test_parity.py`` asserts.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .actions import CORE_INPUTS, DISCRETE_SIZE, LABELS
from .layout import (
    BALL_BASE,
    HDR_MATCH_STATE,
    HDR_SCORE_0,
    HDR_SCORE_1,
    MATCH_FINISHED,
    P_TEAM,
    player_offset,
)
from .observation import OBS_SIZE, observe
from .world import checksum, create_world, pitch_of, read_state, step

FX_ONE = 65536.0


class Discrete:
    """The tiny slice of gym.spaces.Discrete this env needs."""

    def __init__(self, n: int):
        self.n = int(n)
        self.shape = ()
        self.dtype = np.int64

    def sample(self, rng=None) -> int:
        rng = rng or np.random.default_rng()
        return int(rng.integers(self.n))

    def contains(self, x) -> bool:
        return isinstance(x, (int, np.integer)) and 0 <= int(x) < self.n

    def __repr__(self) -> str:
        return f"Discrete({self.n})"


class Box:
    """The tiny slice of gym.spaces.Box this env needs."""

    def __init__(self, low, high, shape, dtype=np.float32):
        self.low = np.full(shape, low, dtype=dtype)
        self.high = np.full(shape, high, dtype=dtype)
        self.shape = tuple(shape)
        self.dtype = dtype

    def sample(self, rng=None) -> np.ndarray:
        rng = rng or np.random.default_rng()
        return rng.uniform(self.low, self.high).astype(self.dtype)

    def contains(self, x) -> bool:
        x = np.asarray(x)
        return x.shape == self.shape and bool(
            (x >= self.low).all() and (x <= self.high).all()
        )

    def __repr__(self) -> str:
        return f"Box({self.shape}, [-1, 1])"


@dataclass
class EnvConfig:
    player_count: int = 2
    roles: list | None = None
    teams: list | None = None
    settings: dict | None = None
    decision_period: int = 6  # 60 Hz core / 6 = 10 Hz decisions
    max_ticks: int = 3600  # 60 s at 60 Hz, cut short by the match rules
    goal_reward: float = 1.0
    shaping_coef: float = 0.1
    gamma: float = 0.99
    vectorised: bool = False
    reward_fn: object = None
    shaping_terms: dict = field(default_factory=dict)


class HaxballEnv:
    """Parallel multi-agent environment. One agent per player, in player order."""

    metadata = {"name": "haxball3d-v0", "render_modes": []}

    def __init__(self, **kwargs):
        self.cfg = EnvConfig(**kwargs)
        self.world = None
        self.rng = np.random.default_rng()
        self.n_agents = None
        self.teams = None
        self.action_space = Discrete(DISCRETE_SIZE)
        self.observation_space = Box(-1.0, 1.0, (OBS_SIZE,))
        self.action_labels = LABELS
        self._obs = None
        self._decision = 0
        self.reset()

    # ------------------------------------------------------------- lifecycle

    def reset(self, seed: int | None = None, options: dict | None = None):
        cfg = self.cfg
        if seed is not None:
            self.rng = np.random.default_rng(seed)
        settings = (options or {}).get("settings", cfg.settings)
        self.world = create_world(
            player_count=cfg.player_count,
            teams=cfg.teams,
            roles=cfg.roles,
            settings=settings,
            vectorised=cfg.vectorised,
        )
        self.n_agents = self.world.player_count
        buf = self.world.buf
        self.teams = [buf[player_offset(i) + P_TEAM] for i in range(self.n_agents)]
        self._obs = np.zeros((self.n_agents, OBS_SIZE), dtype=np.float32)
        self._decision = 0
        self._refresh_obs()
        return self._obs.copy(), {"tick": 0, "checksum": checksum(self.world)}

    def _refresh_obs(self) -> None:
        for i in range(self.n_agents):
            observe(self.world, i, out=self._obs[i])

    # ------------------------------------------------------------------ step

    def step(self, actions):
        """Advance one decision (``decision_period`` core ticks)."""
        cfg = self.cfg
        world = self.world
        acts = [int(a) for a in actions]
        if len(acts) != self.n_agents:
            raise ValueError(f"expected {self.n_agents} actions, got {len(acts)}")

        before = self._snapshot()
        inputs = [CORE_INPUTS[self.teams[i]][acts[i]] for i in range(self.n_agents)]

        events = []
        for _ in range(cfg.decision_period):
            events.extend(step(world, inputs))
            if world.buf[HDR_MATCH_STATE] == MATCH_FINISHED:
                break

        after = self._snapshot()
        self._refresh_obs()
        self._decision += 1

        rewards = self._rewards(before, after, events)
        terminated = world.buf[HDR_MATCH_STATE] == MATCH_FINISHED
        truncated = (not terminated) and after["tick"] >= cfg.max_ticks
        info = {
            "tick": after["tick"],
            "score": after["score"],
            "checksum": checksum(world),
            "events": events,
            "actions": acts,
        }
        return self._obs.copy(), rewards, terminated, truncated, info

    # ---------------------------------------------------------------- reward

    def _snapshot(self) -> dict:
        buf = self.world.buf
        return {
            "tick": buf[3],
            "score": (buf[HDR_SCORE_0], buf[HDR_SCORE_1]),
            "ball": (buf[BALL_BASE] / FX_ONE, buf[BALL_BASE + 1] / FX_ONE),
        }

    def _potential(self, state: dict, team: int) -> float:
        """PHI(s) for one team: the closer the ball to their target goal, the higher."""
        P = pitch_of(self.world)
        half_x = P["halfX"] / FX_ONE
        half_z = P["halfZ"] / FX_ONE
        diag = math.sqrt(4 * half_x * half_x + 4 * half_z * half_z)
        goal_z = half_z if team == 0 else -half_z
        bx, bz = state["ball"]
        return -math.sqrt(bx * bx + (goal_z - bz) * (goal_z - bz)) / diag

    def _rewards(self, before: dict, after: dict, events) -> np.ndarray:
        cfg = self.cfg
        if cfg.reward_fn is not None:
            return np.asarray(
                cfg.reward_fn(self, before, after, events), dtype=np.float64
            )

        d0 = after["score"][0] - before["score"][0]
        d1 = after["score"][1] - before["score"][1]
        out = np.zeros(self.n_agents, dtype=np.float64)
        for i in range(self.n_agents):
            team = self.teams[i]
            scored = d0 if team == 0 else d1
            conceded = d1 if team == 0 else d0
            r = cfg.goal_reward * (scored - conceded)
            phi_before = self._potential(before, team)
            phi_after = self._potential(after, team)
            r += cfg.shaping_coef * (cfg.gamma * phi_after - phi_before)
            for fn in cfg.shaping_terms.values():
                r += cfg.shaping_coef * (
                    cfg.gamma * float(fn(self, after, i)) - float(fn(self, before, i))
                )
            out[i] = r
        return out

    # ----------------------------------------------------------------- misc

    def state(self) -> dict:
        """Plain-number view of the whole match, for logging and debugging."""
        return read_state(self.world)

    def checksum(self) -> str:
        return checksum(self.world)

    def clone(self) -> "HaxballEnv":
        """A detached copy sharing the config. Used for tree search and for the
        self-play checkpoint pool's evaluation matches."""
        other = HaxballEnv(**self.cfg.__dict__)
        other.world = self.world.copy()
        other.n_agents = self.n_agents
        other.teams = list(self.teams)
        other._obs = self._obs.copy()
        other._decision = self._decision
        return other

    def __repr__(self) -> str:
        return (
            f"HaxballEnv(agents={self.n_agents}, obs={OBS_SIZE}, actions={DISCRETE_SIZE}, "
            f"decision_period={self.cfg.decision_period})"
        )
