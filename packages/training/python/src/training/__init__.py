"""
RL Training orchestration for Babylon

Training infrastructure with Babylon-specific Tinker integration.

Shared components (from Jeju - src package):
- GRPO trainer (`BabylonAtroposTrainer`)
- RLAIF environment (`BabylonRLAIFEnv`)
- Reward functions
- Quality utilities
- Rollout generation

Babylon-specific:
- Tinker client (`BabylonTinkerClient`)
- Tinker trainer (`BabylonTinkerTrainer`)

See README.md for usage instructions.
"""

import sys
from pathlib import Path

# Add Jeju's training package to sys.path
_JEJU_TRAINING_ROOT = Path(__file__).resolve().parents[7] / "packages" / "training" / "python"
if str(_JEJU_TRAINING_ROOT) not in sys.path:
    sys.path.insert(0, str(_JEJU_TRAINING_ROOT))

# Import from Jeju's training package (src)
from src.training import (
    DEFAULT_RUBRIC,
    # Archetype training
    ArchetypeTrainer,
    ArchetypeTrainingConfig,
    ArchetypeTrainingResult,
    CallPurpose,
    LLMCallRecord,
    # Multi-prompt dataset
    MultiPromptDatasetBuilder,
    PromptDataset,
    PromptSample,
    PromptTypeAnalyzer,
    RewardNormalizer,
    TickData,
    TickOutcome,
    # Tick reward attribution
    TickRewardAttributor,
    ValidationResult,
    action_quality_reward,
    build_training_samples_from_tick,
    build_trajectory_from_ticks,
    calculate_detailed_tick_quality,
    # Quality utilities
    calculate_tick_quality_score,
    calculate_trajectory_quality_score,
    composite_reward,
    efficiency_reward,
    get_available_archetypes,
    get_priority_metrics,
    # Rubric loader
    get_rubric,
    group_samples_for_grpo,
    pairwise_preferences_to_scores,
    # Reward functions
    pnl_reward,
    prepare_multi_prompt_training_data,
    ranking_to_scores,
    relative_scores,
    reload_rubrics,
    risk_adjusted_reward,
    state_to_env_state,
    state_to_observation,
    validate_training_sample,
    validate_trajectory_for_training,
    validate_trajectory_quality,
)


# Lazy imports for torch-dependent modules
def __getattr__(name: str):
    """Lazy import for torch-dependent modules."""
    # Jeju torch-dependent modules
    if name in ("BabylonAtroposTrainer", "AtroposTrainingConfig"):
        from src.training import AtroposTrainingConfig, BabylonAtroposTrainer

        return locals()[name]

    if name in ("BabylonRLAIFEnv", "BabylonEnvConfig"):
        from src.training import BabylonEnvConfig, BabylonRLAIFEnv

        return locals()[name]

    if name in (
        "FastRolloutGenerator",
        "RolloutConfig",
        "RolloutResult",
        "AgentTickData",
        "RolloutQualityValidator",
        "AgentRunner",
    ):
        from src.training import (
            AgentRunner,
            AgentTickData,
            FastRolloutGenerator,
            RolloutConfig,
            RolloutQualityValidator,
            RolloutResult,
        )

        return locals()[name]

    if name in ("FastSimulator", "SimulatorConfig", "SimulatorMetrics", "GameState"):
        from src.training import FastSimulator, GameState, SimulatorConfig, SimulatorMetrics

        return locals()[name]

    # Tinker integration (lazy - requires tinker package) - Babylon-specific
    # Use importlib to load from the correct path since relative imports
    # are resolved against Jeju's training package due to sys.path ordering
    if name in (
        "BabylonTinkerClient",
        "TinkerConfig",
        "TinkerDatum",
        "TrainStepResult",
        "SampleResult",
        "TINKER_AVAILABLE",
    ):
        import importlib.util

        tinker_client_path = Path(__file__).parent / "tinker_client.py"
        spec = importlib.util.spec_from_file_location("babylon_tinker_client", tinker_client_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load tinker_client module for {name}")
        tinker_client = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tinker_client)
        return getattr(tinker_client, name)

    if name in (
        "BabylonTinkerTrainer",
        "TinkerTrainingConfig",
        "TrainingMetrics",
    ):
        import importlib.util

        tinker_trainer_path = Path(__file__).parent / "tinker_trainer.py"
        spec = importlib.util.spec_from_file_location("babylon_tinker_trainer", tinker_trainer_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load tinker_trainer module for {name}")
        tinker_trainer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tinker_trainer)
        return getattr(tinker_trainer, name)

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "DEFAULT_RUBRIC",
    "TINKER_AVAILABLE",
    "AgentRunner",
    "AgentTickData",
    # Archetype training - from Jeju
    "ArchetypeTrainer",
    "ArchetypeTrainingConfig",
    "ArchetypeTrainingResult",
    "AtroposTrainingConfig",
    # Atropos trainer (lazy - requires torch) - from Jeju
    "BabylonAtroposTrainer",
    "BabylonEnvConfig",
    "BabylonRLAIFEnv",
    # Tinker trainer (lazy - requires tinker) - Babylon-specific
    "BabylonTinkerClient",
    "BabylonTinkerTrainer",
    "CallPurpose",
    # Fast rollout generation (lazy) - from Jeju
    "FastRolloutGenerator",
    "FastSimulator",
    "GameState",
    "LLMCallRecord",
    "MultiPromptDatasetBuilder",
    "PromptDataset",
    "PromptSample",
    "PromptTypeAnalyzer",
    "RewardNormalizer",
    "RolloutConfig",
    "RolloutQualityValidator",
    "RolloutResult",
    "SampleResult",
    "SimulatorConfig",
    "SimulatorMetrics",
    "TickData",
    "TickOutcome",
    # Tick reward attribution - from Jeju
    "TickRewardAttributor",
    "TinkerConfig",
    "TinkerDatum",
    "TinkerTrainingConfig",
    "TrainStepResult",
    "TrainingMetrics",
    "ValidationResult",
    "action_quality_reward",
    "build_training_samples_from_tick",
    "build_trajectory_from_ticks",
    "calculate_detailed_tick_quality",
    # Quality utilities - from Jeju
    "calculate_tick_quality_score",
    "calculate_trajectory_quality_score",
    "composite_reward",
    "efficiency_reward",
    "get_available_archetypes",
    "get_priority_metrics",
    "get_rubric",
    "group_samples_for_grpo",
    "pairwise_preferences_to_scores",
    # Reward functions - from Jeju
    "pnl_reward",
    "prepare_multi_prompt_training_data",
    "ranking_to_scores",
    "relative_scores",
    "reload_rubrics",
    "risk_adjusted_reward",
    "state_to_env_state",
    "state_to_observation",
    "validate_training_sample",
    "validate_trajectory_for_training",
    "validate_trajectory_quality",
]
