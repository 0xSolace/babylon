from __future__ import annotations

from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass(frozen=True)
class KondoGateConfig:
    gate_rate: float | None = 0.3
    price: float | None = None
    temperature: float = 0.1
    hard: bool = True
    deterministic: bool = True

    def validate(self) -> None:
        if self.gate_rate is not None and self.price is not None:
            raise ValueError("Specify either gate_rate or price, not both.")
        if self.gate_rate is not None and not 0.0 < self.gate_rate <= 1.0:
            raise ValueError("gate_rate must be in (0, 1].")
        if self.temperature <= 0:
            raise ValueError("temperature must be > 0.")


@dataclass
class KondoGateOutput:
    gate_weights: torch.Tensor
    gate_probs: torch.Tensor
    delight: torch.Tensor
    price: torch.Tensor
    actual_gate_rate: torch.Tensor
    gate_samples: torch.Tensor | None = None
    gated_policy_loss: torch.Tensor | None = None
    action_log_probs: torch.Tensor | None = None


class KondoGate(nn.Module):
    def __init__(self, config: KondoGateConfig | None = None):
        super().__init__()
        self.config = config or KondoGateConfig()
        self.config.validate()

    @torch.no_grad()
    def _compute_price(self, delight: torch.Tensor) -> torch.Tensor:
        if self.config.gate_rate is not None:
            quantile = 1.0 - self.config.gate_rate
            return torch.quantile(delight.float().reshape(-1), quantile)
        assert self.config.price is not None
        return torch.tensor(
            self.config.price,
            device=delight.device,
            dtype=delight.dtype,
        )

    def compute_delight(
        self,
        log_probs: torch.Tensor,
        advantages: torch.Tensor,
    ) -> torch.Tensor:
        surprisal = -log_probs.detach()
        return advantages.detach() * surprisal

    def compute_gate(
        self,
        log_probs: torch.Tensor,
        advantages: torch.Tensor,
        *,
        delight: torch.Tensor | None = None,
    ) -> KondoGateOutput:
        if delight is None:
            delight = self.compute_delight(log_probs, advantages)

        price = self._compute_price(delight)
        gate_logits = (delight - price) / self.config.temperature
        gate_probs = torch.sigmoid(gate_logits)

        gate_samples: torch.Tensor | None = None
        if self.config.hard:
            if self.config.deterministic:
                gate_samples = (delight >= price).to(dtype=gate_probs.dtype)
                gate_weights = gate_samples
            else:
                gate_samples = torch.bernoulli(gate_probs.detach())
                gate_weights = gate_samples
            actual_gate_rate = gate_samples.mean()
        else:
            gate_weights = gate_probs
            actual_gate_rate = gate_probs.mean()

        return KondoGateOutput(
            gate_weights=gate_weights,
            gate_probs=gate_probs,
            delight=delight,
            price=price,
            actual_gate_rate=actual_gate_rate,
            gate_samples=gate_samples,
        )

    def forward(
        self,
        logits: torch.Tensor,
        actions: torch.Tensor,
        advantages: torch.Tensor,
        attention_mask: torch.Tensor | None = None,
    ) -> KondoGateOutput:
        if logits.dim() not in (2, 3):
            raise ValueError(f"Expected logits of dim 2 or 3, got {logits.dim()}")

        log_probs = F.log_softmax(logits, dim=-1)
        action_log_probs = log_probs.gather(-1, actions.unsqueeze(-1)).squeeze(-1)

        if attention_mask is not None and action_log_probs.dim() == 2:
            mask = attention_mask.float()
            masked_log_probs = (action_log_probs * mask).sum(dim=-1) / mask.sum(dim=-1).clamp(min=1)
            masked_advantages = (advantages * mask).sum(dim=-1) / mask.sum(dim=-1).clamp(min=1)
            result = self.compute_gate(masked_log_probs, masked_advantages)
            gated_policy_loss = -(
                result.gate_weights.unsqueeze(-1) * advantages * action_log_probs * mask
            ).sum() / mask.sum().clamp(min=1)
        elif action_log_probs.dim() == 2:
            result = self.compute_gate(action_log_probs, advantages)
            gated_policy_loss = -(result.gate_weights * advantages * action_log_probs).mean()
        else:
            result = self.compute_gate(action_log_probs, advantages)
            gated_policy_loss = -(result.gate_weights * advantages * action_log_probs).mean()

        result.gated_policy_loss = gated_policy_loss
        result.action_log_probs = action_log_probs
        return result
