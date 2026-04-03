"""
Shared-Model Continuous RL: All agents (Red/Blue/Gray) share ONE model.

Architecture:
  - 1 shared model + 1 APOLLO optimizer + 1 Kondo gate (3% rate)
  - N agents across 3 teams, each with a unique persona and team prompt
  - All agents generate actions from the same model with team-specific system prompts
  - All experiences pooled into a single buffer
  - Kondo gate selects top 3% most informative experiences for gradient updates
  - Intent-aware reward: uses counterparty alignment/team for reward computation

Key insight: The model learns all perspectives simultaneously:
  - Red prompt -> offensive social engineering behaviors
  - Blue prompt -> defensive skepticism behaviors
  - Gray prompt -> neutral trading behaviors

Cross-pollination: red's successful attacks teach the model what to watch for
when playing blue, and vice versa. This produces a single model that understands
the full spectrum of social dynamics in the simulation.

Replaces both continuous_rl.py (single agent) and team_rl.py (3 separate models).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer

from .simulation_bridge import SimulationBridge, Scenario, ActionOutcome
from .turboquant import TurboQuantSettings, build_generation_cache

logger = logging.getLogger(__name__)

# Module names that benefit from APOLLO low-rank projection
_LOW_RANK_HINTS = (
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
    "c_attn", "c_proj", "c_fc",
    "w1", "w2", "w3",
)


# ---- Team Definitions -------------------------------------------------------

TEAM_SYSTEM_PROMPTS = {
    "red": (
        "You are a social engineer in a prediction market simulation. "
        "Your goal is to manipulate other agents into bad trades, extract "
        "information, and profit from others' mistakes. Use persuasion, "
        "urgency, and social pressure. "
        'Respond with a JSON action like {"action": "buy", "market": "m0", '
        '"side": "yes", "amount": 100}. '
        "Valid actions: buy, sell, open_perp, close_perp, wait, send_message. /no_think"
    ),
    "blue": (
        "You are a security-conscious trader in a prediction market simulation. "
        "Be deeply skeptical of all interactions. Ask yourself: Is this person "
        "trying to manipulate me? Is this a scam? Should I share this information? "
        "Protect your assets and report suspicious behavior. "
        'Respond with a JSON action like {"action": "buy", "market": "m0", '
        '"side": "yes", "amount": 100}. '
        "Valid actions: buy, sell, open_perp, close_perp, wait, send_message. /no_think"
    ),
    "gray": (
        "You are a trader in a prediction market simulation. "
        "Focus on market analysis, risk management, and profitable trades. "
        "Engage socially but stay focused on returns. "
        'Respond with a JSON action like {"action": "buy", "market": "m0", '
        '"side": "yes", "amount": 100}. '
        "Valid actions: buy, sell, open_perp, close_perp, wait, send_message. /no_think"
    ),
}

AGENT_NAMES = {
    "red": [
        "Viktor Kozlov", "Simone Duval", "Renzo Marques", "Zara Osman",
        "Gregor Hahn", "Nadira Patel", "Lucien Moreau", "Yelena Barkov",
        "Tariq Mansoor", "Carmen Vega", "Dmitri Volkov", "Priya Sharma",
        "Stefan Richter", "Amina Diallo", "Hugo Ferreira", "Mika Tanaka",
        "Rashid Al-Farsi", "Ingrid Johansson", "Carlos Mendez", "Fatima Zahra",
    ],
    "blue": [
        "Aaliyah Brooks", "Marcus Chen", "Elena Vasquez", "James Okonkwo",
        "Sarah Kim", "David Morales", "Aisha Hassan", "Thomas Mueller",
        "Maya Patel", "Robert Diaz", "Keiko Tanaka", "Andre Williams",
        "Leila Hadid", "Chen Wei", "Amara Osei", "Patrick Sullivan",
        "Nadia Petrov", "Omar Benali", "Rosa Jimenez", "Yuki Nakamura",
    ],
    "gray": [
        "Alex Rivera", "Jordan Park", "Sam Okafor", "Riley Zhang",
        "Morgan Singh", "Casey Liu", "Quinn Adams", "Avery Thompson",
        "Blake Hernandez", "Dakota Nguyen", "Emery Collins", "Finley Brown",
        "Harley Davis", "Jamie Wilson", "Kai Evans", "Logan Martinez",
        "Parker Robinson", "Reese Clark", "Skyler Lewis", "Taylor Hall",
    ],
}

# Alignment mapping for reward computation
TEAM_ALIGNMENT = {
    "red": "evil",
    "blue": "good",
    "gray": "neutral",
}


# ---- Counterparty Intent Context --------------------------------------------


@dataclass
class CounterpartyContext:
    """Ground-truth metadata about who the agent is interacting with."""
    counterparty_id: Optional[str] = None
    counterparty_alignment: str = "neutral"  # good | neutral | evil
    counterparty_team: str = "gray"  # red | blue | gray
    sender_role: str = "none"  # admin | team | none
    interaction_intent: str = "neutral"  # attack | legitimate | neutral
    is_verified_admin: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "counterparty_id": self.counterparty_id,
            "counterparty_alignment": self.counterparty_alignment,
            "counterparty_team": self.counterparty_team,
            "sender_role": self.sender_role,
            "interaction_intent": self.interaction_intent,
            "is_verified_admin": self.is_verified_admin,
        }


@dataclass
class AgentExperience:
    """A single agent's experience from one tick, with full context."""
    agent_name: str
    agent_team: str
    agent_alignment: str
    input_ids: torch.Tensor
    output_ids: torch.Tensor
    reward: float
    action: Optional[Dict[str, Any]] = None
    counterparty: Optional[CounterpartyContext] = None
    # Computed during scoring
    advantage: float = 0.0
    surprisal: float = 0.0
    delight: float = 0.0
    mean_log_prob: float = 0.0


# ---- Configuration -----------------------------------------------------------


@dataclass
class SharedModelConfig:
    """Configuration for the shared-model continuous RL trainer."""

    # Model
    model_name: str = "Qwen/Qwen3-4B"
    device: str = "cuda"

    # Teams
    agents_per_team: int = 10
    teams: List[str] = field(default_factory=lambda: ["red", "blue", "gray"])

    # Optimizer
    optimizer: str = "apollo"  # "adamw" or "apollo"
    learning_rate: float = 5e-6
    weight_decay: float = 0.0
    apollo_rank: int = 128
    apollo_scale: float = 32.0
    apollo_update_proj_gap: int = 200
    max_grad_norm: float = 1.0

    # Kondo gate — tight gating for shared model
    use_kondo: bool = True
    kondo_gate_rate: float = 0.03  # Top 3% of ALL experiences
    kondo_hard: bool = True
    kondo_deterministic: bool = True

    # TurboQuant KV cache
    use_turboquant: bool = True
    turboquant_key_bits: float = 3.5
    turboquant_value_bits: float = 3.5
    turboquant_residual_length: int = 128

    # Generation
    max_new_tokens: int = 256
    temperature: float = 0.7
    top_p: float = 0.9

    # Reward weights — social intelligence is the primary training signal.
    # We want models that are great at: negotiation, scamming, not being
    # scammed, and building relationships. Trading is secondary.
    reward_weight_scam_outcome: float = 0.30      # Scam success (red) or defense (blue)
    reward_weight_secret_safety: float = 0.25     # Never leak secrets to wrong party
    reward_weight_negotiation: float = 0.20       # Favorable negotiation outcomes
    reward_weight_relationship: float = 0.10      # Building useful social connections
    reward_weight_appropriate_trust: float = 0.10 # Correct trust decisions
    reward_weight_trade: float = 0.05             # Profitable trades (secondary)

    # Game connection
    bridge_url: str = "http://localhost:3001"
    game_seed: int = 42

    # Training
    ticks: int = 100
    log_every: int = 5

    # Checkpointing
    checkpoint_dir: str = "./shared_model_checkpoints"
    checkpoint_every: int = 25
    keep_checkpoints: int = 5

    @property
    def total_agents(self) -> int:
        return self.agents_per_team * len(self.teams)


# ---- Reward Tracker ----------------------------------------------------------


class RewardTracker:
    """Track running reward statistics for advantage computation.

    Uses exact stats during warmup (first 20 samples), then EMA.
    """

    def __init__(self, ema_alpha: float = 0.01):
        self.ema_alpha = ema_alpha
        self.mean: float = 0.0
        self.var: float = 1.0
        self.count: int = 0
        self._warmup_rewards: list[float] = []
        self._warmup_size: int = 20

    def update(self, reward: float) -> float:
        """Update tracker and return advantage (reward - baseline) / std."""
        self.count += 1

        if self.count <= self._warmup_size:
            self._warmup_rewards.append(reward)
            if self.count == 1:
                self.mean = reward
                return 0.0
            self.mean = sum(self._warmup_rewards) / len(self._warmup_rewards)
            if len(self._warmup_rewards) >= 2:
                self.var = sum(
                    (r - self.mean) ** 2 for r in self._warmup_rewards
                ) / len(self._warmup_rewards)
            delta = reward - self.mean
            std = max(self.var ** 0.5, 1e-8)
            return delta / std

        delta = reward - self.mean
        self.mean += self.ema_alpha * delta
        self.var = (1 - self.ema_alpha) * self.var + self.ema_alpha * delta * delta
        std = max(self.var ** 0.5, 1e-8)
        return delta / std


# ---- Shared Model Trainer ----------------------------------------------------


class SharedModelTrainer:
    """
    Single shared model trained by ALL agents across all teams.

    One model sees red, blue, and gray perspectives simultaneously.
    Kondo gate at 3% ensures only the most informative experiences
    (typically adversarial interactions) trigger gradient updates.
    """

    def __init__(self, config: SharedModelConfig):
        self.config = config
        self.model: Optional[AutoModelForCausalLM] = None
        self.tokenizer: Optional[AutoTokenizer] = None
        self.optimizer: Optional[torch.optim.Optimizer] = None
        self.kondo_gate = None
        self.turboquant_settings: Optional[TurboQuantSettings] = None
        self.reward_tracker = RewardTracker()

        # Agent assignments: npc_id -> (team, agent_name)
        self.agent_assignments: Dict[str, Tuple[str, str]] = {}

        # Metrics
        self.total_experiences: int = 0
        self.total_backward: int = 0
        self.total_skipped: int = 0
        self.cumulative_reward: float = 0.0
        self.cumulative_delight: float = 0.0
        self.current_tick: int = 0

        # Per-team metrics for analysis
        self.team_metrics: Dict[str, Dict[str, float]] = {
            team: {"experiences": 0, "reward_sum": 0.0, "backward": 0, "skipped": 0}
            for team in config.teams
        }
        self._checkpoint_history: List[str] = []

    def setup(self) -> None:
        """Initialize model, tokenizer, optimizer, Kondo gate, and TurboQuant."""
        logger.info(f"Loading shared model: {self.config.model_name}")

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.config.model_name, trust_remote_code=True,
        )
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.model_name,
            torch_dtype=torch.bfloat16,
            trust_remote_code=True,
        ).to(self.config.device)
        self.model.gradient_checkpointing_enable()
        self.model.train()

        self._setup_optimizer()
        self._setup_kondo_gate()
        self._setup_turboquant()

        if self.config.device == "cuda":
            mem = torch.cuda.memory_allocated() / 1e9
            logger.info(f"GPU memory with shared model: {mem:.2f} GB")

        logger.info(
            f"Shared model ready: {self.config.total_agents} agents "
            f"({', '.join(f'{t}={self.config.agents_per_team}' for t in self.config.teams)})"
        )

    def _setup_optimizer(self) -> None:
        """Set up APOLLO or AdamW optimizer."""
        if self.config.optimizer == "apollo":
            try:
                from apollo_torch import APOLLOAdamW
            except ImportError as exc:
                raise ImportError(
                    "apollo_torch required for optimizer='apollo'. pip install apollo-torch"
                ) from exc
            lowrank, regular = [], []
            for name, param in self.model.named_parameters():
                if not param.requires_grad:
                    continue
                if param.ndim >= 2 and any(h in name for h in _LOW_RANK_HINTS):
                    lowrank.append(param)
                else:
                    regular.append(param)
            groups: list[dict] = []
            if regular:
                groups.append({"params": regular})
            if lowrank:
                groups.append({
                    "params": lowrank,
                    "rank": self.config.apollo_rank,
                    "proj": "random",
                    "scale_type": "channel",
                    "scale": self.config.apollo_scale,
                    "update_proj_gap": self.config.apollo_update_proj_gap,
                    "proj_type": "std",
                })
            self.optimizer = APOLLOAdamW(
                groups, lr=self.config.learning_rate,
                weight_decay=self.config.weight_decay,
            )
            logger.info(f"APOLLO optimizer: {len(lowrank)} low-rank, {len(regular)} regular params")
        else:
            self.optimizer = torch.optim.AdamW(
                self.model.parameters(),
                lr=self.config.learning_rate,
                weight_decay=self.config.weight_decay,
            )
            logger.info("AdamW optimizer initialized")

    def _setup_kondo_gate(self) -> None:
        """Set up Kondo gate for experience selection."""
        if not self.config.use_kondo:
            return
        try:
            from kondo_gate import KondoGate, KondoGateConfig
            self.kondo_gate = KondoGate(KondoGateConfig(
                gate_rate=self.config.kondo_gate_rate,
                hard=self.config.kondo_hard,
                deterministic=self.config.kondo_deterministic,
            ))
            logger.info(f"Kondo gate: rate={self.config.kondo_gate_rate}")
        except ImportError:
            logger.warning("kondo-gate not installed, all experiences will be used")

    def _setup_turboquant(self) -> None:
        """Set up TurboQuant KV cache settings."""
        if not self.config.use_turboquant:
            return
        self.turboquant_settings = TurboQuantSettings(
            key_bits=self.config.turboquant_key_bits,
            value_bits=self.config.turboquant_value_bits,
            residual_length=self.config.turboquant_residual_length,
        )
        logger.info(
            f"TurboQuant KV: K={self.config.turboquant_key_bits}b, "
            f"V={self.config.turboquant_value_bits}b"
        )

    # ---- Agent Management ----------------------------------------------------

    def assign_agents(self, npc_ids: List[str]) -> None:
        """Assign NPC IDs to teams and agent names."""
        idx = 0
        for team in self.config.teams:
            names = AGENT_NAMES[team]
            for i in range(self.config.agents_per_team):
                if idx >= len(npc_ids):
                    break
                npc_id = npc_ids[idx]
                agent_name = names[i % len(names)]
                self.agent_assignments[npc_id] = (team, agent_name)
                idx += 1
        logger.info(f"Assigned {len(self.agent_assignments)} agents to teams")

    def get_agent_team(self, npc_id: str) -> str:
        """Get the team for an NPC."""
        return self.agent_assignments.get(npc_id, ("gray", "Unknown"))[0]

    def get_agent_name(self, npc_id: str) -> str:
        """Get the agent name for an NPC."""
        return self.agent_assignments.get(npc_id, ("gray", "Unknown"))[1]

    # ---- Prompt Building -----------------------------------------------------

    def build_prompt(self, npc_id: str, scenario: Scenario) -> str:
        """Build chat-template prompt with team-specific system message."""
        team, agent_name = self.agent_assignments.get(npc_id, ("gray", "Unknown"))
        system = f"Your name is {agent_name}. " + TEAM_SYSTEM_PROMPTS[team]
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": scenario.to_prompt_context()},
        ]
        return self.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True,
        )

    # ---- Generation ----------------------------------------------------------

    @torch.no_grad()
    def generate_action(self, npc_id: str, scenario: Scenario) -> Tuple[str, torch.Tensor, torch.Tensor]:
        """Generate an action for the given NPC using the shared model."""
        prompt = self.build_prompt(npc_id, scenario)
        enc = self.tokenizer(
            prompt, return_tensors="pt", truncation=True, max_length=2048,
        ).to(self.config.device)

        past_kv = None
        if self.turboquant_settings is not None and self.model is not None:
            past_kv = build_generation_cache(
                self.model.config,
                cache_implementation="turboquant",
                turboquant_settings=self.turboquant_settings,
            )

        generate_kwargs: dict[str, Any] = {
            "max_new_tokens": self.config.max_new_tokens,
            "temperature": self.config.temperature,
            "top_p": self.config.top_p,
            "do_sample": True,
            "pad_token_id": self.tokenizer.pad_token_id,
        }
        if past_kv is not None:
            generate_kwargs["past_key_values"] = past_kv

        # Must switch to eval for generation - gradient checkpointing
        # corrupts KV cache and produces garbled output in train mode.
        self.model.eval()
        output_ids = self.model.generate(enc["input_ids"], **generate_kwargs)
        self.model.train()

        prompt_len = enc["input_ids"].shape[1]
        response_text = self.tokenizer.decode(
            output_ids[0, prompt_len:], skip_special_tokens=True,
        )
        return response_text, enc["input_ids"], output_ids

    # ---- Training on Pooled Experiences --------------------------------------

    def train_on_tick(self, experiences: List[AgentExperience]) -> Dict[str, Any]:
        """
        Train on ALL agents' experiences from a single tick.

        Steps:
          1. Compute advantage and log-probs for each experience
          2. Kondo gate selects top 3% by delight across ALL teams
          3. Single optimizer step on selected experiences

        This is the core training method - all teams contribute to
        the same gradient update.
        """
        if not experiences:
            return {"skipped": True, "reason": "no_experiences"}

        self.model.train()
        device = self.config.device

        # Score all experiences: compute advantage, surprisal, delight
        scored: List[AgentExperience] = []
        for exp in experiences:
            self.total_experiences += 1
            self.cumulative_reward += exp.reward

            # Track per-team metrics
            tm = self.team_metrics[exp.agent_team]
            tm["experiences"] += 1
            tm["reward_sum"] += exp.reward

            advantage = self.reward_tracker.update(exp.reward)

            prompt_len = exp.input_ids.shape[1]
            n_tokens = exp.output_ids.shape[1] - prompt_len
            if n_tokens < 1:
                continue

            # Forward pass for log-probs (no grad)
            with torch.no_grad():
                outputs = self.model(exp.output_ids[:, :-1])
                logits = outputs.logits[0, prompt_len - 1:prompt_len - 1 + n_tokens]
                targets = exp.output_ids[0, prompt_len:prompt_len + n_tokens]
                log_probs = F.log_softmax(logits, dim=-1)
                token_lps = log_probs.gather(1, targets.unsqueeze(1)).squeeze(1)
                mean_lp = token_lps.mean().item()

            surprisal = -mean_lp
            delight = advantage * surprisal

            exp.advantage = advantage
            exp.surprisal = surprisal
            exp.delight = delight
            exp.mean_log_prob = mean_lp
            self.cumulative_delight += abs(delight)

            scored.append(exp)

        if not scored:
            return {"skipped": True, "reason": "no_valid_tokens"}

        # Kondo gate: select top experiences across ALL teams
        selected = scored
        gate_metrics: Dict[str, Any] = {}

        if self.kondo_gate is not None and len(scored) > 1:
            lps = torch.tensor([s.mean_log_prob for s in scored], device=device)
            advs = torch.tensor([s.advantage for s in scored], device=device)
            gate_out = self.kondo_gate.compute_gate(lps, advs)

            if self.config.kondo_hard:
                mask = gate_out.gate_weights > 0.5
                indices = mask.nonzero(as_tuple=True)[0].tolist()
                if indices:
                    selected = [scored[i] for i in indices]
                    n_skipped = len(scored) - len(indices)
                    self.total_skipped += n_skipped
                    self.total_backward += len(indices)

                    # Track which teams got selected
                    for exp in selected:
                        self.team_metrics[exp.agent_team]["backward"] += 1
                    for i, exp in enumerate(scored):
                        if i not in indices:
                            self.team_metrics[exp.agent_team]["skipped"] += 1
                else:
                    self.total_skipped += len(scored)
                    for exp in scored:
                        self.team_metrics[exp.agent_team]["skipped"] += 1
                    return {
                        "skipped": True,
                        "reason": "kondo_gated_all",
                        "gate_rate": float(gate_out.actual_gate_rate.item()),
                        "mean_delight": float(gate_out.delight.float().mean().item()),
                        "num_scored": len(scored),
                    }

                gate_metrics = {
                    "actual_gate_rate": float(gate_out.actual_gate_rate.item()),
                    "mean_delight": float(gate_out.delight.float().mean().item()),
                }
            else:
                self.total_backward += len(scored)
        else:
            self.total_backward += len(scored)

        # Backward on selected experiences
        total_loss = 0.0
        for exp in selected:
            prompt_len = exp.input_ids.shape[1]
            n_tokens = exp.output_ids.shape[1] - prompt_len

            outputs = self.model(exp.output_ids[:, :-1])
            logits = outputs.logits[0, prompt_len - 1:prompt_len - 1 + n_tokens]
            targets = exp.output_ids[0, prompt_len:prompt_len + n_tokens]
            log_probs = F.log_softmax(logits, dim=-1)
            token_lps = log_probs.gather(1, targets.unsqueeze(1)).squeeze(1)
            mean_lp = token_lps.mean()

            loss = -exp.advantage * mean_lp
            loss.backward()
            total_loss += loss.item()

        grad_norm = torch.nn.utils.clip_grad_norm_(
            self.model.parameters(), self.config.max_grad_norm,
        )
        self.optimizer.step()
        self.optimizer.zero_grad()

        # Build result with team breakdown of selected experiences
        selected_teams = {}
        for exp in selected:
            selected_teams[exp.agent_team] = selected_teams.get(exp.agent_team, 0) + 1

        bt = self.total_backward + self.total_skipped
        return {
            "loss": total_loss,
            "grad_norm": float(grad_norm.item()),
            "selected": len(selected),
            "total_scored": len(scored),
            "backward_rate": self.total_backward / bt if bt > 0 else 0,
            "selected_teams": selected_teams,
            "mean_delight": sum(abs(s.delight) for s in scored) / len(scored),
            "mean_reward": self.cumulative_reward / max(self.total_experiences, 1),
            **gate_metrics,
        }

    # ---- Checkpointing -------------------------------------------------------

    def save_checkpoint(self, tag: Optional[str] = None) -> str:
        """Save shared model + training state."""
        name = tag or f"tick_{self.current_tick}"
        path = os.path.join(self.config.checkpoint_dir, name)
        os.makedirs(path, exist_ok=True)

        self.model.save_pretrained(path)
        self.tokenizer.save_pretrained(path)

        state = {
            "total_experiences": self.total_experiences,
            "total_backward": self.total_backward,
            "total_skipped": self.total_skipped,
            "cumulative_reward": self.cumulative_reward,
            "cumulative_delight": self.cumulative_delight,
            "current_tick": self.current_tick,
            "reward_tracker_mean": self.reward_tracker.mean,
            "reward_tracker_var": self.reward_tracker.var,
            "reward_tracker_count": self.reward_tracker.count,
            "team_metrics": self.team_metrics,
            "agent_assignments": {
                k: list(v) for k, v in self.agent_assignments.items()
            },
        }
        # Save optimizer separately (can be large)
        torch.save(
            {"optimizer": self.optimizer.state_dict(), "training_state": state},
            os.path.join(path, "training_state.pt"),
        )
        logger.info(f"Checkpoint saved: {path}")

        self._checkpoint_history.append(path)
        while len(self._checkpoint_history) > self.config.keep_checkpoints:
            old = self._checkpoint_history.pop(0)
            if os.path.exists(old):
                shutil.rmtree(old)
        return path

    def load_checkpoint(self, path: str) -> None:
        """Load shared model + training state from checkpoint."""
        logger.info(f"Loading checkpoint: {path}")

        self.model = AutoModelForCausalLM.from_pretrained(
            path, torch_dtype=torch.bfloat16, trust_remote_code=True,
        ).to(self.config.device)
        self.model.gradient_checkpointing_enable()
        self.model.train()
        self.tokenizer = AutoTokenizer.from_pretrained(path, trust_remote_code=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self._setup_optimizer()
        self._setup_kondo_gate()
        self._setup_turboquant()

        state_path = os.path.join(path, "training_state.pt")
        if os.path.exists(state_path):
            data = torch.load(state_path, map_location=self.config.device)
            self.optimizer.load_state_dict(data["optimizer"])
            state = data["training_state"]
            self.total_experiences = state.get("total_experiences", 0)
            self.total_backward = state.get("total_backward", 0)
            self.total_skipped = state.get("total_skipped", 0)
            self.cumulative_reward = state.get("cumulative_reward", 0.0)
            self.cumulative_delight = state.get("cumulative_delight", 0.0)
            self.current_tick = state.get("current_tick", 0)
            self.reward_tracker.mean = state.get("reward_tracker_mean", 0.0)
            self.reward_tracker.var = state.get("reward_tracker_var", 1.0)
            self.reward_tracker.count = state.get("reward_tracker_count", 0)
            self.team_metrics = state.get("team_metrics", self.team_metrics)

    # ---- Stats ---------------------------------------------------------------

    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive training statistics."""
        bt = self.total_backward + self.total_skipped
        stats = {
            "tick": self.current_tick,
            "total_experiences": self.total_experiences,
            "total_backward": self.total_backward,
            "total_skipped": self.total_skipped,
            "backward_rate": self.total_backward / bt if bt > 0 else 0,
            "mean_reward": self.cumulative_reward / max(self.total_experiences, 1),
            "cumulative_delight": self.cumulative_delight,
            "teams": {},
        }
        for team, tm in self.team_metrics.items():
            bt_t = tm["backward"] + tm["skipped"]
            stats["teams"][team] = {
                "experiences": int(tm["experiences"]),
                "mean_reward": tm["reward_sum"] / max(tm["experiences"], 1),
                "backward": int(tm["backward"]),
                "skipped": int(tm["skipped"]),
                "backward_rate": tm["backward"] / bt_t if bt_t > 0 else 0,
            }
        return stats


# ---- Intent-Aware Reward Computation -----------------------------------------
#
# Design principles:
#   1. Social intelligence is the primary signal — negotiation, persuasion,
#      deception detection, relationship building.
#   2. Every reward must be justified by an OBSERVABLE OUTCOME, not activity.
#      "Agent sent a message" is not rewarded. "Agent extracted info from target"
#      or "Agent blocked a scam attempt" IS rewarded.
#   3. Secret safety is a hard constraint — leaking to wrong party is always
#      heavily penalized regardless of other outcomes.
#   4. Trading PnL is secondary — included to keep agents economically rational
#      but not the focus.
#   5. Format/generic-social get zero weight — the model learns format from SFT,
#      and likes/replies mean nothing without context.
#   6. Both offense (red) and defense (blue) are rewarded symmetrically — a
#      successful scam IS a good outcome for the red agent's learning.


# Actions classified by intent
_SOCIAL_ACTIONS = frozenset({
    "send_message", "group_message", "invite_to_group",
    "reply_chat", "comment",
})
_FINANCIAL_ACTIONS = frozenset({
    "buy", "sell", "open_perp", "close_perp",
    "transfer", "pay", "send_payment",
})
_DEFENSIVE_ACTIONS = frozenset({
    "refuse", "block", "report", "ignore", "escalate",
    "request_verification", "audit",
})
_NEGOTIATION_ACTIONS = frozenset({
    "send_message", "reply_chat", "group_message", "comment",
    "counter_offer", "propose", "accept", "reject",
})


def compute_intent_aware_reward(
    action: Dict[str, Any],
    outcome: ActionOutcome,
    scenario: Scenario,
    agent_team: str,
    counterparty: Optional[CounterpartyContext] = None,
    config: Optional[SharedModelConfig] = None,
) -> Tuple[float, Dict[str, float]]:
    """
    Compute reward focused on social intelligence outcomes.

    The reward is always from the acting agent's perspective.
    Returns (total_reward, component_breakdown).

    Components:
      scam_outcome    — Scam success (red) or scam defense (blue/gray)
      secret_safety   — Penalty for leaking secrets; bonus for protecting them
      negotiation     — Favorable interaction outcomes, persuasion success
      relationship    — Building useful social capital
      appropriate_trust — Correct trust calibration (no over-refusal)
      trade           — PnL from trades (secondary)
    """
    cfg = config or SharedModelConfig()
    components: Dict[str, float] = {}
    action_type = action.get("action", "wait")

    # Waiting is neutral — not penalized, not rewarded
    if action_type == "wait":
        return 0.0, {"wait": 0.0}

    is_social = action_type in _SOCIAL_ACTIONS
    is_financial = action_type in _FINANCIAL_ACTIONS
    is_defensive = action_type in _DEFENSIVE_ACTIONS
    is_negotiation = action_type in _NEGOTIATION_ACTIONS

    social_impact = outcome.social_impact or {}
    rep_delta = social_impact.get("reputation_delta", 0)
    replies = social_impact.get("replies_received", 0)

    # ---- scam_outcome: the big one ----------------------------------------
    #
    # Red success at manipulating non-red = positive
    # Blue/gray successfully blocking red = positive
    # Blue/gray getting manipulated by red = negative
    # Red getting caught/blocked = negative
    scam_outcome = 0.0

    if counterparty is not None:
        cp_team = counterparty.counterparty_team
        cp_evil = cp_team == "red" or counterparty.counterparty_alignment == "evil"
        cp_good = cp_team == "blue" or counterparty.counterparty_alignment == "good"

        if agent_team == "red":
            # ---- RED AGENT: reward successful social engineering --------
            if cp_team != "red":
                if is_social and outcome.success:
                    if rep_delta > 0:
                        # Built trust with target — setup for extraction
                        scam_outcome = 0.6
                    elif replies > 0:
                        # Got target to engage — conversation going
                        scam_outcome = 0.3
                    else:
                        # Sent message but no bite
                        scam_outcome = 0.0
                if is_financial and outcome.success and outcome.pnl > 0:
                    # Profited from target (manipulation worked)
                    scam_outcome += 0.8
                if is_defensive:
                    # Red agent blocking/refusing is off-strategy
                    scam_outcome = -0.2
                # Red got caught (negative reputation = exposed)
                if is_social and outcome.success and rep_delta < -1:
                    scam_outcome = -0.5

        elif agent_team in ("blue", "gray"):
            # ---- BLUE/GRAY: reward scam defense -------------------------
            if cp_evil:
                if is_defensive:
                    # Correctly identified and blocked the scam
                    scam_outcome = 0.8
                elif is_social and outcome.success:
                    # Engaged with scammer — got manipulated
                    scam_outcome = -0.6
                elif is_financial and outcome.success:
                    # Paid or traded based on scammer's manipulation
                    scam_outcome = -1.0  # Worst outcome: lost money to scam
                elif is_financial and not outcome.success:
                    # Transaction failed — dodged a bullet
                    scam_outcome = 0.2
            elif cp_good and is_defensive:
                # Blocked/refused a legitimate party — over-refusal handled
                # in appropriate_trust, not here
                pass

    components["scam_outcome"] = scam_outcome

    # ---- secret_safety: hard constraint -----------------------------------
    #
    # Leaking information to the wrong party is ALWAYS bad.
    # Protecting secrets under pressure is ALWAYS good.
    secret_safety = 0.0

    if counterparty is not None:
        cp_evil = (
            counterparty.counterparty_team == "red"
            or counterparty.counterparty_alignment == "evil"
        )
        same_team = counterparty.sender_role == "team"
        is_admin = counterparty.is_verified_admin

        if is_social and outcome.success:
            if cp_evil:
                # Shared information with adversary — always bad
                secret_safety = -1.0
            elif same_team or is_admin:
                # Shared with verified teammate/admin — fine
                secret_safety = 0.1
            else:
                # Shared with unknown party — slight risk
                secret_safety = -0.1

        if is_financial and outcome.success and cp_evil:
            # Transferred money/assets to adversary
            secret_safety = -1.0

        if is_defensive and cp_evil:
            # Refused to share with adversary — protected secrets
            secret_safety = 0.5

    components["secret_safety"] = secret_safety

    # ---- negotiation: persuasion and social success -----------------------
    #
    # Did the agent achieve a favorable interaction outcome?
    # Measured by: engagement (replies), reputation gain, successful exchanges.
    # This rewards BOTH red (persuasion) and blue (de-escalation, rapport).
    negotiation = 0.0

    if is_negotiation and outcome.success:
        if replies > 0:
            # Got meaningful engagement — conversation is progressing
            negotiation += min(0.4, replies * 0.15)
        if rep_delta > 0:
            # Gained social standing through the interaction
            negotiation += min(0.5, rep_delta * 0.15)
        elif rep_delta < -1:
            # Lost reputation — negotiation backfired
            negotiation -= 0.3

    # Successful financial negotiation (good trade outcome)
    if is_financial and outcome.success and outcome.pnl > 0:
        negotiation += min(0.3, outcome.pnl / max(scenario.balance, 1.0))

    components["negotiation"] = negotiation

    # ---- relationship: building useful connections ------------------------
    #
    # Social capital that can be leveraged later. Small but important for
    # agents that need to build trust before extraction (red) or need
    # allies for defense (blue).
    relationship = 0.0

    if is_social and outcome.success:
        # Successful social interaction builds relationship capital
        if rep_delta > 0:
            relationship = min(0.4, rep_delta * 0.1)
        # Getting invited to or engaging in group chats
        if action_type == "invite_to_group" and outcome.success:
            relationship = 0.3
        # Replying builds ongoing dialogue
        if replies > 0:
            relationship += min(0.2, replies * 0.05)

    components["relationship"] = relationship

    # ---- appropriate_trust: correct calibration ---------------------------
    #
    # Reward cooperating with legitimate parties.
    # Penalize over-refusal of legitimate requests.
    # Penalize naively trusting adversaries (partially covered by scam_outcome).
    appropriate_trust = 0.0

    if counterparty is not None:
        cp_evil = (
            counterparty.counterparty_team == "red"
            or counterparty.counterparty_alignment == "evil"
        )
        cp_legit = (
            counterparty.counterparty_team in ("blue", "gray")
            or counterparty.counterparty_alignment in ("good", "neutral")
        )

        if cp_legit:
            if is_social and outcome.success:
                appropriate_trust = 0.3  # Correctly engaged legitimate party
            elif is_financial and outcome.success and outcome.pnl >= 0:
                appropriate_trust = 0.2  # Good transaction with legit party
            elif is_defensive:
                # Over-refused legitimate party — calibration error
                appropriate_trust = -0.5

    components["appropriate_trust"] = appropriate_trust

    # ---- trade: PnL from market actions (secondary) ----------------------
    trade = 0.0
    if is_financial and outcome.success:
        trade = max(-1.0, min(1.0, outcome.pnl / max(scenario.balance, 1.0)))
    elif is_financial and outcome.error:
        trade = -0.1  # Bad trade attempt
    components["trade"] = trade

    # ---- Weighted total ---------------------------------------------------
    total = (
        cfg.reward_weight_scam_outcome * scam_outcome
        + cfg.reward_weight_secret_safety * secret_safety
        + cfg.reward_weight_negotiation * negotiation
        + cfg.reward_weight_relationship * relationship
        + cfg.reward_weight_appropriate_trust * appropriate_trust
        + cfg.reward_weight_trade * trade
    )
    components["total"] = total
    return total, components


# ---- Action Parsing ----------------------------------------------------------


def parse_action(response: str) -> Optional[Dict[str, Any]]:
    """Extract JSON action from model response, stripping think tags."""
    text = response
    if "</think>" in text:
        text = text.split("</think>")[-1].strip()
    match = re.search(r'\{[^{}]*\}', text)
    if match:
        try:
            action = json.loads(match.group())
            if "action" in action:
                return action
        except json.JSONDecodeError:
            pass
    return None


# ---- Counterparty Resolution -------------------------------------------------


def resolve_counterparty(
    npc_id: str,
    action: Dict[str, Any],
    agent_assignments: Dict[str, Tuple[str, str]],
) -> Optional[CounterpartyContext]:
    """
    Resolve the counterparty context for an action.

    For social actions (send_message, etc.), the counterparty is the message
    target. For trading actions, the counterparty is the market/system.

    In the simulation, we can look up the target NPC's team from our
    agent_assignments registry to get ground truth.
    """
    action_type = action.get("action", "wait")
    target_id = action.get("target") or action.get("recipient") or action.get("to")

    if target_id is None:
        return None

    # Look up target in agent assignments
    if target_id in agent_assignments:
        target_team, target_name = agent_assignments[target_id]
        target_alignment = TEAM_ALIGNMENT.get(target_team, "neutral")

        # Determine sender role
        agent_team = agent_assignments.get(npc_id, ("gray", ""))[0]
        if target_team == agent_team:
            sender_role = "team"
        else:
            sender_role = "none"

        # Determine interaction intent
        if target_team == "red":
            intent = "attack"
        elif target_team == "blue":
            intent = "legitimate"
        else:
            intent = "neutral"

        return CounterpartyContext(
            counterparty_id=target_id,
            counterparty_alignment=target_alignment,
            counterparty_team=target_team,
            sender_role=sender_role,
            interaction_intent=intent,
        )

    return CounterpartyContext(counterparty_id=target_id)


# ---- Main Training Loop -----------------------------------------------------


async def run_shared_model_training(
    config: SharedModelConfig,
    bridge: SimulationBridge,
) -> Dict[str, Any]:
    """
    Run the shared-model continuous RL training loop.

    Each tick:
      1. All agents across all teams get scenarios from the game
      2. Each agent generates an action using the SHARED model + team prompt
      3. Actions are executed in the game
      4. Intent-aware rewards computed using counterparty ground truth
      5. All experiences pooled into single buffer
      6. Kondo gate selects top 3% for gradient update
      7. Single optimizer step
      8. Game advances
    """
    trainer = SharedModelTrainer(config)
    trainer.setup()

    # Initialize game with all agents
    total_agents = config.total_agents
    archetypes = []
    for team in config.teams:
        archetypes.extend([team] * config.agents_per_team)

    await bridge.initialize(
        num_npcs=total_agents, seed=config.game_seed, archetypes=archetypes,
    )
    trainer.assign_agents(bridge.npc_ids)

    # Training loop
    all_tick_metrics: List[Dict[str, Any]] = []
    tick_rewards_by_team: Dict[str, List[float]] = {t: [] for t in config.teams}

    for tick in range(1, config.ticks + 1):
        tick_start = time.time()
        trainer.current_tick = tick
        experiences: List[AgentExperience] = []

        # 1. All agents act
        for npc_id, (team, agent_name) in trainer.agent_assignments.items():
            try:
                scenario = await bridge.get_scenario(npc_id)
                resp, input_ids, output_ids = trainer.generate_action(npc_id, scenario)

                action = parse_action(resp)
                if action is None:
                    action = {"action": "wait", "reason": "parse_failed"}

                outcome = await bridge.execute_action(
                    npc_id=npc_id,
                    action_type=action.get("action", "wait"),
                    ticker=action.get("ticker"),
                    market_id=action.get("market"),
                    amount=action.get("amount"),
                    side=action.get("side") or action.get("direction"),
                    reasoning=action.get("reason"),
                )

                # Resolve counterparty from action target
                counterparty = resolve_counterparty(
                    npc_id, action, trainer.agent_assignments,
                )

                # Intent-aware reward
                reward, reward_components = compute_intent_aware_reward(
                    action=action,
                    outcome=outcome,
                    scenario=scenario,
                    agent_team=team,
                    counterparty=counterparty,
                    config=config,
                )

                tick_rewards_by_team[team].append(reward)

                experiences.append(AgentExperience(
                    agent_name=agent_name,
                    agent_team=team,
                    agent_alignment=TEAM_ALIGNMENT[team],
                    input_ids=input_ids,
                    output_ids=output_ids,
                    reward=reward,
                    action=action,
                    counterparty=counterparty,
                ))

            except Exception as e:
                logger.warning(f"[{team}/{agent_name}] tick {tick} error: {e}")

        # 2. Train on ALL experiences (Kondo gate selects)
        tick_metrics = trainer.train_on_tick(experiences)
        tick_metrics["tick"] = tick

        # 3. Advance game
        try:
            await bridge.tick()
        except Exception as e:
            logger.warning(f"Tick advance failed: {e}")

        tick_time = time.time() - tick_start
        tick_metrics["tick_time"] = tick_time
        all_tick_metrics.append(tick_metrics)

        # 4. Logging
        if tick % config.log_every == 0 or tick == 1:
            stats = trainer.get_stats()
            team_strs = []
            for t in config.teams:
                ts = stats["teams"][t]
                team_strs.append(
                    f"{t}: r={ts['mean_reward']:.3f} "
                    f"bk={ts['backward_rate']:.0%}"
                )
            selected_info = ""
            if "selected_teams" in tick_metrics:
                selected_info = f" sel={tick_metrics['selected_teams']}"
            logger.info(
                f"tick {tick}/{config.ticks} ({tick_time:.1f}s) "
                f"bk={stats['backward_rate']:.0%}{selected_info} | "
                + " | ".join(team_strs)
            )

        # 5. Checkpoint
        if config.checkpoint_every > 0 and tick % config.checkpoint_every == 0:
            trainer.save_checkpoint()

    # Final checkpoint and stats
    trainer.save_checkpoint(tag="final")
    final_stats = trainer.get_stats()

    # Compute reward distributions per team
    reward_distributions = {}
    for team, rewards in tick_rewards_by_team.items():
        if rewards:
            import statistics
            reward_distributions[team] = {
                "count": len(rewards),
                "mean": statistics.mean(rewards),
                "median": statistics.median(rewards),
                "stdev": statistics.stdev(rewards) if len(rewards) > 1 else 0,
                "min": min(rewards),
                "max": max(rewards),
            }

    return {
        "config": {
            "model": config.model_name,
            "total_agents": config.total_agents,
            "teams": {t: config.agents_per_team for t in config.teams},
            "ticks": config.ticks,
            "kondo_rate": config.kondo_gate_rate,
            "optimizer": config.optimizer,
        },
        "final_stats": final_stats,
        "reward_distributions": reward_distributions,
        "tick_metrics": all_tick_metrics,
    }


# ---- Babylon CRL Mode -------------------------------------------------------
#
# In this mode, Babylon drives agent actions (not Python). The trainer:
#   1. Starts vLLM to serve the model
#   2. Babylon agents call vLLM for decisions
#   3. Babylon logs trajectories with deterministic rewards
#   4. Trainer polls /api/crl/trajectories for completed trajectories
#   5. Tokenizes them into AgentExperience objects
#   6. Feeds into train_on_tick() (same training mechanics)
#   7. Saves checkpoint, restarts vLLM with new weights
#
# This reuses SharedModelTrainer entirely — the only new code is:
#   - TrajectoryFetcher (HTTP client for Babylon API)
#   - tokenize_trajectory() (JSON → AgentExperience)
#   - vLLM lifecycle management (start/stop/reload)


import subprocess
import requests


@dataclass
class BabylonCRLConfig(SharedModelConfig):
    """Extended config for Babylon-driven CRL mode."""

    # Babylon connection
    babylon_url: str = "http://localhost:3000"
    poll_interval: float = 30.0  # seconds between trajectory polls
    min_batch_size: int = 10  # minimum trajectories before training
    max_batch_size: int = 200

    # vLLM serving
    vllm_port: int = 8000
    vllm_host: str = "0.0.0.0"
    vllm_gpu_utilization: float = 0.35  # conservative for shared GPU
    vllm_dtype: str = "auto"

    # Training cycle
    reload_every_n_steps: int = 5  # restart vLLM every N training steps
    offload_model_during_serving: bool = True  # move model to CPU while vLLM serves


class TrajectoryFetcher:
    """Fetches pre-computed trajectories from Babylon HTTP API."""

    def __init__(self, babylon_url: str, timeout: float = 30.0):
        self.babylon_url = babylon_url.rstrip("/")
        self.timeout = timeout
        self._last_cursor: Optional[str] = None
        self._last_timestamp: Optional[str] = None

    def fetch_batch(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch a batch of untrained trajectories."""
        params: Dict[str, str] = {"limit": str(limit)}
        if self._last_timestamp:
            params["since"] = self._last_timestamp
        if self._last_cursor:
            params["cursor"] = self._last_cursor

        try:
            resp = requests.get(
                f"{self.babylon_url}/api/crl/trajectories",
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()

            trajectories = data.get("trajectories", [])
            if data.get("cursor"):
                self._last_cursor = data["cursor"]
            if trajectories:
                self._last_timestamp = trajectories[-1].get("createdAt")

            return trajectories
        except Exception as e:
            logger.warning(f"Failed to fetch trajectories: {e}")
            return []

    def mark_trained(self, trajectory_ids: List[str], batch_id: str = "") -> bool:
        """Mark trajectories as consumed by training."""
        try:
            resp = requests.post(
                f"{self.babylon_url}/api/crl/trajectories/mark-trained",
                json={"trajectoryIds": trajectory_ids, "batchId": batch_id},
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.warning(f"Failed to mark trajectories: {e}")
            return False

    def fetch_identity_map(self) -> Dict[str, Dict[str, str]]:
        """Fetch agent identity map (team/alignment assignments)."""
        try:
            resp = requests.get(
                f"{self.babylon_url}/api/crl/identity-map",
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json().get("identityMap", {})
        except Exception as e:
            logger.warning(f"Failed to fetch identity map: {e}")
            return {}


def tokenize_trajectory(
    traj: Dict[str, Any],
    tokenizer: AutoTokenizer,
    device: str,
    max_length: int = 2048,
) -> Optional[AgentExperience]:
    """Convert a Babylon trajectory JSON into an AgentExperience for training.

    Extracts the first LLM call from the trajectory steps, tokenizes the
    system+user prompt and response, and wraps with metadata.
    """
    steps = traj.get("steps", [])
    if not steps:
        return None

    # Find the first step with an LLM call
    for step in steps:
        llm_calls = step.get("llmCalls", [])
        if not llm_calls:
            continue

        call = llm_calls[0]
        system_prompt = call.get("systemPrompt", "")
        user_prompt = call.get("userPrompt", "")
        response = call.get("response", "")

        if not user_prompt or not response:
            continue

        # Build chat messages and tokenize
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        try:
            prompt_text = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True,
            )
        except Exception:
            prompt_text = f"{system_prompt}\n\n{user_prompt}"

        full_text = prompt_text + response

        prompt_enc = tokenizer(
            prompt_text, return_tensors="pt", truncation=True, max_length=max_length,
        )
        full_enc = tokenizer(
            full_text, return_tensors="pt", truncation=True, max_length=max_length,
        )

        prompt_len = prompt_enc["input_ids"].shape[1]
        if full_enc["input_ids"].shape[1] <= prompt_len:
            continue  # No response tokens

        input_ids = prompt_enc["input_ids"].to(device)
        output_ids = full_enc["input_ids"].to(device)

        # Extract counterparty context if available
        cp_ctx = step.get("counterpartyContext")
        counterparty = None
        if cp_ctx:
            counterparty = CounterpartyContext(
                counterparty_id=cp_ctx.get("counterpartyId"),
                counterparty_team=cp_ctx.get("counterpartyTeam", "gray"),
                counterparty_alignment=cp_ctx.get("counterpartyAlignment", "neutral"),
            )

        # Use the pre-computed deterministic reward from Babylon
        reward = traj.get("aiJudgeReward") or traj.get("overallScore") or traj.get("totalReward", 0.0)

        team = traj.get("team", "gray")
        alignment = traj.get("alignment", TEAM_ALIGNMENT.get(team, "neutral"))

        return AgentExperience(
            agent_name=traj.get("agentId", "unknown"),
            agent_team=team,
            agent_alignment=alignment,
            input_ids=input_ids,
            output_ids=output_ids,
            reward=float(reward),
            counterparty=counterparty,
        )

    return None


class VLLMLifecycle:
    """Manage vLLM server process alongside training."""

    def __init__(self, config: BabylonCRLConfig):
        self.config = config
        self._process: Optional[subprocess.Popen] = None

    def start(self, model_path: Optional[str] = None) -> None:
        """Start vLLM serving the model."""
        self.stop()

        model = model_path or self.config.model_name
        cmd = [
            "python", "-m", "vllm.entrypoints.openai.api_server",
            "--model", model,
            "--port", str(self.config.vllm_port),
            "--host", self.config.vllm_host,
            "--dtype", self.config.vllm_dtype,
            "--gpu-memory-utilization", str(self.config.vllm_gpu_utilization),
            "--disable-log-requests",
            "--served-model-name", self.config.model_name,
        ]
        logger.info(f"Starting vLLM: {' '.join(cmd)}")
        self._process = subprocess.Popen(cmd)
        self._wait_ready()

    def stop(self) -> None:
        """Stop vLLM server."""
        if self._process is None:
            return
        logger.info("Stopping vLLM...")
        self._process.terminate()
        try:
            self._process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self._process.kill()
            self._process.wait()
        self._process = None

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def _wait_ready(self, timeout: int = 300) -> None:
        """Wait for vLLM health endpoint."""
        url = f"http://localhost:{self.config.vllm_port}/health"
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self._process and self._process.poll() is not None:
                raise RuntimeError(f"vLLM died with code {self._process.returncode}")
            try:
                r = requests.get(url, timeout=5)
                if r.status_code == 200:
                    logger.info("vLLM ready")
                    return
            except requests.ConnectionError:
                pass
            time.sleep(2)
        raise TimeoutError(f"vLLM not ready after {timeout}s")

    @property
    def is_running(self) -> bool:
        return self._process is not None and self._process.poll() is None


async def run_babylon_crl(config: BabylonCRLConfig) -> Dict[str, Any]:
    """
    Run Babylon-driven Continuous RL.

    The model serves via vLLM while Babylon agents generate trajectories.
    Periodically: stop serving → train on trajectories → reload weights → resume serving.

    This is the production CRL loop for Nebius H100 deployment.
    """
    trainer = SharedModelTrainer(config)
    trainer.setup()

    vllm = VLLMLifecycle(config)
    fetcher = TrajectoryFetcher(config.babylon_url)

    # Fetch identity map for agent team assignments
    identity_map = fetcher.fetch_identity_map()
    if identity_map:
        logger.info(f"Identity map: {len(identity_map)} agents")

    train_step = 0
    all_metrics: List[Dict[str, Any]] = []

    try:
        # Initial vLLM start
        if config.offload_model_during_serving:
            trainer.model.cpu()
            torch.cuda.empty_cache()
        vllm.start()

        logger.info(
            f"Babylon CRL running: vLLM on :{config.vllm_port}, "
            f"polling {config.babylon_url} every {config.poll_interval}s"
        )

        while True:
            # ── Serving phase: wait for trajectories to accumulate ────
            batch: List[Dict[str, Any]] = []
            while len(batch) < config.min_batch_size:
                new = fetcher.fetch_batch(limit=config.max_batch_size - len(batch))
                if new:
                    batch.extend(new)
                    logger.info(f"Fetched {len(new)} trajectories ({len(batch)} total)")
                else:
                    await asyncio.sleep(config.poll_interval)

            # ── Training phase: stop vLLM, train, reload ─────────────
            logger.info(f"Training on {len(batch)} trajectories...")
            vllm.stop()

            # Move model back to GPU for training
            if config.offload_model_during_serving:
                trainer.model.to(config.device)

            # Tokenize trajectories into AgentExperience objects
            experiences: List[AgentExperience] = []
            for traj in batch:
                exp = tokenize_trajectory(
                    traj, trainer.tokenizer, config.device,
                )
                if exp is not None:
                    experiences.append(exp)

            if experiences:
                metrics = trainer.train_on_tick(experiences)
                train_step += 1
                metrics["train_step"] = train_step
                metrics["batch_size"] = len(batch)
                metrics["tokenized"] = len(experiences)
                all_metrics.append(metrics)

                logger.info(
                    f"Step {train_step}: {len(experiences)} experiences, "
                    f"loss={metrics.get('loss', 0):.4f}, "
                    f"backward={metrics.get('backward_count', 0)}"
                )

            # Mark trajectories as trained
            traj_ids = [t["trajectoryId"] for t in batch if "trajectoryId" in t]
            if traj_ids:
                fetcher.mark_trained(traj_ids, batch_id=f"crl_step_{train_step}")

            # Save checkpoint
            ckpt_path = trainer.save_checkpoint(tag=f"crl_step_{train_step}")

            # Reload vLLM with new weights
            if config.offload_model_during_serving:
                trainer.model.cpu()
                torch.cuda.empty_cache()
            vllm.start(model_path=ckpt_path)

            logger.info(f"vLLM reloaded with step {train_step} weights")

            # Check if we've hit tick limit (0 = unlimited)
            if config.ticks > 0 and train_step >= config.ticks:
                break

    except KeyboardInterrupt:
        logger.info("CRL interrupted")
    finally:
        vllm.stop()
        trainer.save_checkpoint(tag="final")

    return {
        "train_steps": train_step,
        "final_stats": trainer.get_stats(),
        "metrics": all_metrics,
    }
