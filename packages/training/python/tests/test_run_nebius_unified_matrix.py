import argparse
import importlib.util
import subprocess
import sys
from pathlib import Path


PYTHON_ROOT = Path(__file__).resolve().parent.parent


def load_script_module(module_name: str, script_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


nebius_script = load_script_module(
    "run_nebius_unified_matrix",
    PYTHON_ROOT / "scripts" / "run_nebius_unified_matrix.py",
)


def test_build_cloud_init_user_data_embeds_username_and_key():
    payload = nebius_script.build_cloud_init_user_data(
        "trainer",
        "ssh-ed25519 AAAATEST trainer@example",
    )

    assert "name: trainer" in payload
    assert "ssh-ed25519 AAAATEST trainer@example" in payload
    assert "python3-venv" in payload


def test_relative_bundle_paths_cover_training_benchmark_and_exports():
    weighted = nebius_script.DEFAULT_WEIGHTED_EXPORT
    unweighted = nebius_script.DEFAULT_UNWEIGHTED_EXPORT
    catalog = nebius_script.DEFAULT_SCENARIO_CATALOG

    paths = nebius_script.relative_bundle_paths(weighted, unweighted, catalog)
    scambench_relative = nebius_script.SCAMBENCH_ROOT.resolve().relative_to(
        nebius_script.WORKSPACE_ROOT.resolve()
    )

    assert Path("babylon/packages/training/python/scripts") in paths
    assert Path("babylon/packages/training/python/src") in paths
    assert Path("babylon/packages/training/python/requirements.txt") in paths
    assert scambench_relative in paths
    assert weighted.resolve().relative_to(nebius_script.WORKSPACE_ROOT) in paths
    assert unweighted.resolve().relative_to(nebius_script.WORKSPACE_ROOT) in paths
    assert catalog.resolve().relative_to(nebius_script.WORKSPACE_ROOT) in paths


def test_render_remote_script_contains_baseline_lora_and_apollo_steps():
    args = argparse.Namespace(
        remote_workspace="/home/trainer/babylon-workspace",
        remote_results_dir="babylon/runs/nebius-unified/latest",
        weighted_export_dir=nebius_script.DEFAULT_WEIGHTED_EXPORT,
        unweighted_export_dir=nebius_script.DEFAULT_UNWEIGHTED_EXPORT,
        scenario_catalog=nebius_script.DEFAULT_SCENARIO_CATALOG,
        base_model="Qwen/Qwen3.5-4B",
        max_steps=120,
        batch_size=1,
        gradient_accumulation_steps=4,
        max_seq_length=768,
        max_tokens=128,
        lora_learning_rate=1e-5,
        apollo_learning_rate=5e-6,
        apollo_rank=64,
        apollo_scale=1.0,
        apollo_update_proj_gap=200,
        variants=list(nebius_script.DEFAULT_VARIANTS),
    )

    script = nebius_script.render_remote_script(args)

    assert "baseline-qwen35-4b-unified-nebius" in script
    assert "lora-unweighted-qwen35-4b-unified-nebius" in script
    assert "lora-weighted-qwen35-4b-unified-nebius" in script
    assert "apollo-unweighted-qwen35-4b-unified-nebius" in script
    assert "apollo-weighted-qwen35-4b-unified-nebius" in script
    assert "--backend transformers" in script
    assert "--optimizer apollo" in script
    assert "--no-lora" in script


def test_parse_variants_accepts_subset_and_rejects_unknown():
    assert nebius_script.parse_variants("baseline,apollo-unweighted") == [
        "baseline",
        "apollo-unweighted",
    ]

    try:
        nebius_script.parse_variants("baseline,unknown")
    except argparse.ArgumentTypeError as exc:
        assert "Unknown variants" in str(exc)
    else:
        raise AssertionError("Expected argparse.ArgumentTypeError for unknown variant")


def test_parse_variants_rejects_empty_value():
    try:
        nebius_script.parse_variants(" , ")
    except argparse.ArgumentTypeError as exc:
        assert "At least one matrix variant is required" in str(exc)
    else:
        raise AssertionError("Expected argparse.ArgumentTypeError for empty variant list")


def test_build_matrix_filters_to_requested_variants():
    args = argparse.Namespace(
        remote_workspace="/home/trainer/babylon-workspace",
        remote_results_dir="babylon/runs/nebius-unified/latest",
        weighted_export_dir=nebius_script.DEFAULT_WEIGHTED_EXPORT,
        unweighted_export_dir=nebius_script.DEFAULT_UNWEIGHTED_EXPORT,
        scenario_catalog=nebius_script.DEFAULT_SCENARIO_CATALOG,
        base_model="Qwen/Qwen3.5-4B",
        max_steps=120,
        batch_size=1,
        gradient_accumulation_steps=4,
        max_seq_length=768,
        max_tokens=128,
        lora_learning_rate=1e-5,
        apollo_learning_rate=5e-6,
        apollo_rank=64,
        apollo_scale=1.0,
        apollo_update_proj_gap=200,
        variants=["apollo-unweighted"],
    )

    matrix = nebius_script.build_matrix(args)

    assert [item["id"] for item in matrix] == ["apollo-unweighted"]


def test_build_matrix_uses_adapter_only_for_lora_variants():
    args = argparse.Namespace(
        remote_workspace="/home/trainer/babylon-workspace",
        remote_results_dir="babylon/runs/nebius-unified/latest",
        weighted_export_dir=nebius_script.DEFAULT_WEIGHTED_EXPORT,
        unweighted_export_dir=nebius_script.DEFAULT_UNWEIGHTED_EXPORT,
        scenario_catalog=nebius_script.DEFAULT_SCENARIO_CATALOG,
        base_model="Qwen/Qwen3.5-4B",
        max_steps=120,
        batch_size=1,
        gradient_accumulation_steps=4,
        max_seq_length=768,
        max_tokens=128,
        lora_learning_rate=1e-5,
        apollo_learning_rate=5e-6,
        apollo_rank=64,
        apollo_scale=1.0,
        apollo_update_proj_gap=200,
        variants=["lora-unweighted", "apollo-unweighted"],
    )

    matrix = nebius_script.build_matrix(args)

    assert "--adapter-path" in matrix[0]["eval"]
    assert "--tokenizer-model" in matrix[0]["eval"]
    assert "--adapter-path" not in matrix[1]["eval"]
    assert "--tokenizer-model" not in matrix[1]["eval"]


def test_render_remote_script_uses_variant_subset():
    args = argparse.Namespace(
        remote_workspace="/home/trainer/babylon-workspace",
        remote_results_dir="babylon/runs/nebius-unified/latest",
        weighted_export_dir=nebius_script.DEFAULT_WEIGHTED_EXPORT,
        unweighted_export_dir=nebius_script.DEFAULT_UNWEIGHTED_EXPORT,
        scenario_catalog=nebius_script.DEFAULT_SCENARIO_CATALOG,
        base_model="Qwen/Qwen3.5-4B",
        max_steps=120,
        batch_size=1,
        gradient_accumulation_steps=4,
        max_seq_length=768,
        max_tokens=128,
        lora_learning_rate=1e-5,
        apollo_learning_rate=5e-6,
        apollo_rank=64,
        apollo_scale=1.0,
        apollo_update_proj_gap=200,
        variants=["apollo-unweighted"],
    )

    script = nebius_script.render_remote_script(args)

    assert "apollo-unweighted-qwen35-4b-unified-nebius" in script
    assert "lora-unweighted-qwen35-4b-unified-nebius" not in script
    assert "baseline-qwen35-4b-unified-nebius" not in script


def test_run_nebius_matrix_cli_dry_run_outputs_resolved_plan():
    proc = subprocess.run(
        [
            sys.executable,
            str(PYTHON_ROOT / "scripts" / "run_nebius_unified_matrix.py"),
            "--dry-run",
            "--project-id",
            "dry-run-project",
            "--base-model",
            "Qwen/Qwen3.5-9B",
            "--gpu-type",
            "h200",
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    assert "Project: dry-run-project" in proc.stdout
    assert "Resolved model: Qwen 3.5 9B (qwen35-9b)" in proc.stdout
    assert "baseline-qwen35-9b-unified-nebius" in proc.stdout
    assert "apollo-weighted-qwen35-9b-unified-nebius" in proc.stdout


def test_build_model_download_command_uses_partial_noncompressed_filtered_rsync(tmp_path: Path):
    command = nebius_script.build_model_download_command(
        ssh_key_path=Path("/tmp/test-key"),
        remote_user="research",
        public_ip="1.2.3.4",
        remote_model_dir="/remote/model",
        local_model_dir=tmp_path / "model",
    )

    assert command[:3] == ["rsync", "-a", "--partial"]
    assert "-z" not in command
    assert "--prune-empty-dirs" in command
    assert "research@1.2.3.4:/remote/model/" in command
    assert str(tmp_path / "model") + "/" in command
    assert "model.safetensors" in command
    assert "training_manifest.json" in command


def test_build_matrix_uses_model_slug_for_non_4b_models():
    args = argparse.Namespace(
        remote_workspace="/home/trainer/babylon-workspace",
        remote_results_dir="babylon/runs/nebius-unified/latest",
        weighted_export_dir=nebius_script.DEFAULT_WEIGHTED_EXPORT,
        unweighted_export_dir=nebius_script.DEFAULT_UNWEIGHTED_EXPORT,
        scenario_catalog=nebius_script.DEFAULT_SCENARIO_CATALOG,
        base_model="Qwen/Qwen3.5-9B",
        max_steps=120,
        batch_size=1,
        gradient_accumulation_steps=4,
        max_seq_length=768,
        max_tokens=128,
        lora_learning_rate=1e-5,
        apollo_learning_rate=5e-6,
        apollo_rank=64,
        apollo_scale=1.0,
        apollo_update_proj_gap=200,
        variants=["baseline", "apollo-unweighted"],
    )

    matrix = nebius_script.build_matrix(args)

    assert matrix[0]["eval_output_path"].endswith("baseline-qwen35-9b-unified-nebius-decisions.json")
    assert "qwen35-9b" in matrix[1]["train_output_dir"]


def test_resolve_vm_shape_rejects_122b_for_single_vm_runner():
    try:
        nebius_script.resolve_vm_shape(
            base_model="Qwen/Qwen3.5-122B-A10B",
            gpu_type="h200",
            platform=None,
            preset=None,
            max_seq_length=4096,
            batch_size=1,
            apollo_rank=64,
        )
    except ValueError as exc:
        assert "cluster-sized target" in str(exc)
    else:
        raise AssertionError("Expected ValueError for 122B single-VM request")


def test_resolve_vm_shape_accepts_9b_h100_at_matrix_defaults():
    platform, preset, spec = nebius_script.resolve_vm_shape(
        base_model="Qwen/Qwen3.5-9B",
        gpu_type="h100",
        platform=None,
        preset=None,
        max_seq_length=768,
        batch_size=1,
        apollo_rank=64,
    )

    assert platform == "gpu-h100-sxm"
    assert preset == "1gpu-16vcpu-200gb"
    assert spec is not None
    assert spec.slug == "qwen35-9b"
