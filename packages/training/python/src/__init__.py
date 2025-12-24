"""
Babylon RL Training System - Atropos + Tinker Framework

This package provides training infrastructure for Babylon trading agents
with Babylon-specific Tinker integration.

Shared components (from Jeju - src package):
1. **Atropos Training** (Local GPU)
   - `atropos_trainer.py` - Local GRPO trainer with vLLM
   - `babylon_env.py` - RLAIF environment with LLM-as-judge

2. **Data & Utilities**
   - `rollout_generator.py` - Fast rollout generation
   - `rewards.py` - Reward functions
   - `quality_utils.py` - Trajectory quality scoring

Babylon-specific:
3. **Tinker Training** (RECOMMENDED - Cloud-based)
   - `tinker_client.py` - Unified Tinker API wrapper
   - `tinker_trainer.py` - GRPO trainer using Tinker cloud
   - No local GPU required, access to large models
"""

__version__ = "3.0.0"  # Major version bump for Tinker integration

import sys
from pathlib import Path

# Add Jeju's training package to sys.path
_JEJU_TRAINING_ROOT = Path(__file__).resolve().parents[6] / "packages" / "training" / "python"
if str(_JEJU_TRAINING_ROOT) not in sys.path:
    sys.path.insert(0, str(_JEJU_TRAINING_ROOT))

# Import models and data_bridge from Jeju
from src.data_bridge import (
    BabylonToAtroposConverter,
    PostgresTrajectoryReader,
    ScoredGroupResult,
    calculate_dropout_rate,
)
from src.models import (
    Action,
    AtroposScoredGroup,
    BabylonTrajectory,
    EnvironmentState,
    JudgeResponse,
    TrajectoryStep,
)

# Import non-torch training components from the training subpackage
from .training import (
    CallPurpose,
    # Multi-prompt dataset
    MultiPromptDatasetBuilder,
    PromptDataset,
    PromptSample,
    RewardNormalizer,
    # Tick reward attribution
    TickRewardAttributor,
    calculate_detailed_tick_quality,
    # Quality utilities
    calculate_tick_quality_score,
    calculate_trajectory_quality_score,
    composite_reward,
    get_available_archetypes,
    # Archetype utilities (no torch)
    get_rubric,
    # Reward functions
    pnl_reward,
)


# Lazy imports for torch/tinker-dependent modules
def __getattr__(name: str):
    """Lazy import for torch/tinker-dependent modules."""
    # Atropos trainer (requires torch) - from Jeju
    if name in (
        "BabylonAtroposTrainer",
        "AtroposTrainingConfig",
    ):
        from .training import AtroposTrainingConfig, BabylonAtroposTrainer

        return locals()[name]

    if name in (
        "BabylonRLAIFEnv",
        "BabylonEnvConfig",
    ):
        from .training import BabylonEnvConfig, BabylonRLAIFEnv

        return locals()[name]

    # Tinker trainer (requires tinker) - Babylon-specific
    # Use importlib to load from the correct path
    if name in (
        "BabylonTinkerClient",
        "TinkerConfig",
        "TinkerDatum",
        "TrainStepResult",
        "SampleResult",
        "TINKER_AVAILABLE",
    ):
        import importlib.util

        tinker_client_path = Path(__file__).parent / "training" / "tinker_client.py"
        spec = importlib.util.spec_from_file_location("babylon_tinker_client", tinker_client_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load tinker_client module for {name}")
        tinker_client = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tinker_client)
        return getattr(tinker_client, name)

    if name in (
        "BabylonTinkerTrainer",
        "TinkerTrainingConfig",
    ):
        import importlib.util

        tinker_trainer_path = Path(__file__).parent / "training" / "tinker_trainer.py"
        spec = importlib.util.spec_from_file_location("babylon_tinker_trainer", tinker_trainer_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load tinker_trainer module for {name}")
        tinker_trainer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tinker_trainer)
        return getattr(tinker_trainer, name)

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "TINKER_AVAILABLE",
    "Action",
    "AtroposScoredGroup",
    "AtroposTrainingConfig",
    # Atropos Training (lazy - requires torch) - Local fallback - from Jeju
    "BabylonAtroposTrainer",
    "BabylonEnvConfig",
    "BabylonRLAIFEnv",
    # Tinker Training (lazy - requires tinker) - RECOMMENDED - Babylon-specific
    "BabylonTinkerClient",
    "BabylonTinkerTrainer",
    "BabylonToAtroposConverter",
    # Models (from Jeju)
    "BabylonTrajectory",
    "CallPurpose",
    "EnvironmentState",
    "JudgeResponse",
    # Multi-prompt dataset (no torch) - from Jeju
    "MultiPromptDatasetBuilder",
    # Data Bridge (from Jeju)
    "PostgresTrajectoryReader",
    "PromptDataset",
    "PromptSample",
    "RewardNormalizer",
    "SampleResult",
    "ScoredGroupResult",
    # Tick reward (no torch) - from Jeju
    "TickRewardAttributor",
    "TinkerConfig",
    "TinkerDatum",
    "TinkerTrainingConfig",
    "TrainStepResult",
    "TrajectoryStep",
    "calculate_detailed_tick_quality",
    "calculate_dropout_rate",
    # Quality utilities (no torch) - from Jeju
    "calculate_tick_quality_score",
    "calculate_trajectory_quality_score",
    "composite_reward",
    "get_available_archetypes",
    # Archetype utilities (no torch) - from Jeju
    "get_rubric",
    # Rewards (no torch) - from Jeju
    "pnl_reward",
]
