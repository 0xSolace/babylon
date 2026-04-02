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

    # Reward weights for intent-aware computation
    reward_weight_pnl: float = 0.25
    reward_weight_format: float = 0.10
    reward_weight_social: float = 0.10
    reward_weight_scam_defense: float = 0.25
    reward_weight_appropriate_trust: float = 0.15
    reward_weight_secret_safety: float = 0.15

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


def compute_intent_aware_reward(
    action: Dict[str, Any],
    outcome: ActionOutcome,
    scenario: Scenario,
    agent_team: str,
    counterparty: Optional[CounterpartyContext] = None,
    config: Optional[SharedModelConfig] = None,
) -> Tuple[float, Dict[str, float]]:
    """
    Compute reward that accounts for the TRUE intent of all parties.

    The reward is always from the acting agent's perspective.
    Returns (total_reward, component_breakdown).

    Components:
      - pnl: Financial performance
      - format: Valid action structure
      - social: Social engagement impact
      - scam_defense: Correct behavior toward adversarial counterparty
      - appropriate_trust: Cooperating with legitimate counterparty
      - secret_safety: Not leaking sensitive info to wrong party
    """
    cfg = config or SharedModelConfig()
    components: Dict[str, float] = {}
    action_type = action.get("action", "wait")

    # Neutral wait is 0.0
    if action_type == "wait":
        return 0.0, {"wait": 0.0}

    # PnL component
    pnl_reward = 0.0
    if outcome.success:
        pnl_reward = max(-1.0, min(1.0, outcome.pnl / max(scenario.balance, 1.0)))
    components["pnl"] = pnl_reward

    # Format component
    format_reward = 0.1 if outcome.success else (-0.15 if outcome.error else 0.0)
    components["format"] = format_reward

    # Social component
    social_reward = 0.0
    if outcome.social_impact:
        social = outcome.social_impact
        social_reward = min(0.2, (
            social.get("likes_received", 0) * 0.02
            + social.get("replies_received", 0) * 0.03
            + social.get("reputation_delta", 0) * 0.1
        ))
    components["social"] = social_reward

    # Intent-aware components (only if counterparty context is available)
    scam_defense_reward = 0.0
    appropriate_trust_reward = 0.0
    secret_safety_reward = 0.0

    if counterparty is not None:
        cp_team = counterparty.counterparty_team
        cp_alignment = counterparty.counterparty_alignment
        intent = counterparty.interaction_intent
        is_social_action = action_type in ("send_message", "group_message", "invite_to_group")
        is_financial_action = action_type in ("buy", "sell", "open_perp", "close_perp")

        if agent_team == "blue":
            # Blue agent reward: defense + appropriate trust
            if cp_team == "red" or cp_alignment == "evil":
                # Interaction with adversary
                if action_type in ("wait", "refuse", "report", "block"):
                    scam_defense_reward = 0.5  # Correctly refused/reported
                elif is_social_action and outcome.success:
                    scam_defense_reward = -0.5  # Engaged with scammer (risky)
                elif is_financial_action and outcome.success:
                    scam_defense_reward = -0.3  # Traded based on scammer info

                # Secret safety: sharing info with red agent is bad
                if is_social_action and outcome.success:
                    secret_safety_reward = -0.8
            elif cp_team == "blue" or cp_alignment == "good":
                # Interaction with legitimate party
                if is_social_action and outcome.success:
                    appropriate_trust_reward = 0.3  # Cooperating with ally
                elif action_type in ("refuse", "block", "report"):
                    appropriate_trust_reward = -0.3  # Over-refused legitimate
            else:
                # Gray/neutral counterparty
                if is_social_action and outcome.success:
                    appropriate_trust_reward = 0.1  # Reasonable engagement

        elif agent_team == "red":
            # Red agent reward: successful social engineering
            if cp_team != "red":
                # Interacting with non-red (potential target)
                if is_social_action and outcome.success:
                    # Social engagement with target — success depends on outcome
                    rep_delta = (outcome.social_impact or {}).get("reputation_delta", 0)
                    if rep_delta > 0:
                        scam_defense_reward = 0.4  # Built trust (useful for red)
                    else:
                        scam_defense_reward = -0.1  # Exposed/caught
                if is_financial_action and outcome.pnl > 0:
                    scam_defense_reward += 0.3  # Profited from manipulation

        elif agent_team == "gray":
            # Gray agent reward: neutral, mostly PnL-driven
            if cp_team == "red" and is_social_action and outcome.success:
                # Gray engaging with red agent without knowing — slight negative
                scam_defense_reward = -0.1  # Vulnerable behavior
            elif cp_team == "blue" and is_social_action and outcome.success:
                appropriate_trust_reward = 0.1  # Normal cooperation

    components["scam_defense"] = scam_defense_reward
    components["appropriate_trust"] = appropriate_trust_reward
    components["secret_safety"] = secret_safety_reward

    # Weighted sum
    total = (
        cfg.reward_weight_pnl * pnl_reward
        + cfg.reward_weight_format * format_reward
        + cfg.reward_weight_social * social_reward
        + cfg.reward_weight_scam_defense * scam_defense_reward
        + cfg.reward_weight_appropriate_trust * appropriate_trust_reward
        + cfg.reward_weight_secret_safety * secret_safety_reward
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
