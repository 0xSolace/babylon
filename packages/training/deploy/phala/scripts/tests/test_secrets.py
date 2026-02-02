#!/usr/bin/env python3
"""
Tests for secrets.py - TEE Secure Secrets Management
"""

import hashlib
import os
import tempfile
from pathlib import Path
from unittest import mock
import pytest

# Import the module under test
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from secrets import (
    Secret,
    SecretManager,
    BabylonSecrets,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def temp_env_file(tmp_path):
    """Create a temporary .env file."""
    env_file = tmp_path / ".env"
    env_file.write_text("""
# Comment line
DATABASE_URL=postgresql://user:pass@localhost/db
WANDB_API_KEY="my-wandb-key"
HF_TOKEN='hf-token-value'
EMPTY_VALUE=
SPACED_KEY = value_with_spaces
TRAJECTORY_SOURCE=db
""")
    return str(env_file)


@pytest.fixture
def temp_env_file_hf(tmp_path):
    """Create a temporary .env file with HuggingFace source."""
    env_file = tmp_path / ".env.hf"
    env_file.write_text("""
TRAJECTORY_SOURCE=huggingface
HF_TRAJECTORY_DATASET=elizaos/test-dataset
HF_TOKEN='hf-token-value'
""")
    return str(env_file)


@pytest.fixture
def clean_env():
    """Ensure clean environment for tests."""
    # Save original env
    original = {}
    test_vars = [
        "DATABASE_URL", "WANDB_API_KEY", "HF_TOKEN", "PHALA_API_KEY", 
        "TEST_SECRET", "TRAJECTORY_SOURCE", "HF_TRAJECTORY_DATASET",
        "HF_PUSH_REPO", "BABYLON_KEY1", "BABYLON_KEY2", "OTHER_KEY",
        "KEY1", "KEY2", "TEST_KEY"
    ]
    for var in test_vars:
        if var in os.environ:
            original[var] = os.environ.pop(var)
    
    yield
    
    # Restore original env
    for var in test_vars:
        if var in os.environ:
            del os.environ[var]
    os.environ.update(original)


# ============================================================================
# Secret Tests
# ============================================================================

class TestSecret:
    """Tests for Secret dataclass."""
    
    def test_create_secret(self):
        """Test creating a secret."""
        secret = Secret(
            name="TEST_KEY",
            value="secret_value",
            source="env"
        )
        
        assert secret.name == "TEST_KEY"
        assert secret.value == "secret_value"
        assert secret.source == "env"
        assert secret.is_derived is False
    
    def test_secret_str(self):
        """Test string representation."""
        secret = Secret(name="KEY", value="myvalue", source="env")
        
        assert str(secret) == "myvalue"
    
    def test_secret_bytes(self):
        """Test bytes property."""
        secret = Secret(name="KEY", value="test", source="env")
        
        assert secret.bytes == b"test"
    
    def test_masked_short_value(self):
        """Test masking short values."""
        secret = Secret(name="KEY", value="short", source="env")
        
        assert secret.masked == "***"
    
    def test_masked_long_value(self):
        """Test masking long values."""
        secret = Secret(name="KEY", value="this-is-a-long-secret-value", source="env")
        
        assert secret.masked == "this***alue"
        assert "long-secret" not in secret.masked


# ============================================================================
# SecretManager Tests
# ============================================================================

class TestSecretManager:
    """Tests for SecretManager class."""
    
    def test_create_manager(self):
        """Test creating a secret manager."""
        manager = SecretManager()
        
        assert manager.derive_missing is False
        assert manager.app_prefix == "babylon"
    
    def test_create_manager_with_options(self):
        """Test creating with custom options."""
        manager = SecretManager(
            derive_missing=True,
            app_prefix="custom"
        )
        
        assert manager.derive_missing is True
        assert manager.app_prefix == "custom"
    
    def test_get_from_environment(self, clean_env):
        """Test getting secret from environment."""
        os.environ["TEST_SECRET"] = "env_value"
        
        manager = SecretManager()
        value = manager.get("TEST_SECRET")
        
        assert value == "env_value"
    
    def test_get_with_default(self, clean_env):
        """Test getting secret with default."""
        manager = SecretManager()
        value = manager.get("NONEXISTENT", default="default_value")
        
        assert value == "default_value"
    
    def test_get_required_missing(self, clean_env):
        """Test required secret raises error when missing."""
        manager = SecretManager()
        
        with pytest.raises(ValueError, match="Required secret not found"):
            manager.get("NONEXISTENT", required=True)
    
    def test_get_caching(self, clean_env):
        """Test that secrets are cached."""
        os.environ["TEST_SECRET"] = "original"
        
        manager = SecretManager()
        value1 = manager.get("TEST_SECRET")
        
        # Change env (shouldn't affect cached value)
        os.environ["TEST_SECRET"] = "changed"
        value2 = manager.get("TEST_SECRET")
        
        assert value1 == value2 == "original"
    
    def test_load_env_file(self, temp_env_file, clean_env):
        """Test loading from .env file."""
        manager = SecretManager(env_file=temp_env_file)
        
        assert manager.get("DATABASE_URL") == "postgresql://user:pass@localhost/db"
        assert manager.get("WANDB_API_KEY") == "my-wandb-key"  # Quotes stripped
        assert manager.get("HF_TOKEN") == "hf-token-value"  # Quotes stripped
    
    def test_env_file_not_found(self, clean_env):
        """Test missing env file is handled."""
        manager = SecretManager(env_file="/nonexistent/.env")
        # Should not raise
        assert manager.get("TEST") is None
    
    def test_env_overrides_file(self, temp_env_file, clean_env):
        """Test environment overrides .env file."""
        os.environ["DATABASE_URL"] = "env_override"
        
        manager = SecretManager(env_file=temp_env_file)
        
        # Env should take precedence
        assert manager.get("DATABASE_URL") == "env_override"
    
    def test_derive_in_non_tee(self, clean_env):
        """Test derive returns dev fallback outside TEE."""
        with mock.patch("secrets.is_tee_environment", return_value=False):
            manager = SecretManager()
            
            value1 = manager.derive("test_key")
            value2 = manager.derive("test_key")
            
            # Should be consistent
            assert value1 == value2
            # Should be hex string of expected length
            assert len(value1) == 64  # 32 bytes = 64 hex chars
    
    def test_derive_different_keys(self, clean_env):
        """Test different names produce different keys."""
        with mock.patch("secrets.is_tee_environment", return_value=False):
            manager = SecretManager()
            
            key1 = manager.derive("key1")
            key2 = manager.derive("key2")
            
            assert key1 != key2
    
    def test_derive_with_subject(self, clean_env):
        """Test subject affects derivation."""
        with mock.patch("secrets.is_tee_environment", return_value=False):
            manager = SecretManager()
            
            key1 = manager.derive("key", subject="v1")
            key2 = manager.derive("key", subject="v2")
            
            assert key1 != key2
    
    def test_get_all(self, clean_env):
        """Test getting all secrets with prefix."""
        os.environ["BABYLON_KEY1"] = "value1"
        os.environ["BABYLON_KEY2"] = "value2"
        os.environ["OTHER_KEY"] = "other"
        
        manager = SecretManager()
        secrets = manager.get_all("BABYLON_")
        
        assert "BABYLON_KEY1" in secrets
        assert "BABYLON_KEY2" in secrets
        assert "OTHER_KEY" not in secrets
    
    def test_require_all(self, clean_env):
        """Test requiring multiple secrets."""
        os.environ["KEY1"] = "val1"
        os.environ["KEY2"] = "val2"
        
        manager = SecretManager()
        result = manager.require_all("KEY1", "KEY2")
        
        assert result == {"KEY1": "val1", "KEY2": "val2"}
    
    def test_require_all_missing(self, clean_env):
        """Test require_all with missing secrets."""
        os.environ["KEY1"] = "val1"
        
        manager = SecretManager()
        
        with pytest.raises(ValueError, match="Missing required secrets"):
            manager.require_all("KEY1", "MISSING_KEY")
    
    def test_export_to_env(self, temp_env_file, clean_env):
        """Test exporting to environment."""
        manager = SecretManager(env_file=temp_env_file)
        
        # Load a secret
        manager.get("DATABASE_URL")
        
        # Export
        manager.export_to_env()
        
        assert os.environ.get("DATABASE_URL") == "postgresql://user:pass@localhost/db"
    
    def test_summary(self, clean_env):
        """Test summary output."""
        os.environ["TEST_KEY"] = "secret_value_here"
        
        manager = SecretManager()
        manager.get("TEST_KEY")
        
        summary = manager.summary()
        
        assert "TEST_KEY" in summary
        assert "secret_value_here" not in summary  # Should be masked
        assert "secr***here" in summary


# ============================================================================
# BabylonSecrets Tests
# ============================================================================

class TestBabylonSecrets:
    """Tests for BabylonSecrets class."""
    
    def test_create_babylon_secrets(self, clean_env):
        """Test creating BabylonSecrets."""
        secrets = BabylonSecrets()
        
        assert secrets.app_prefix == "babylon"
        # REQUIRED is now empty - validation is source-aware
        assert secrets.REQUIRED == []
    
    def test_trajectory_source_default(self, clean_env):
        """Test trajectory_source defaults to 'db'."""
        secrets = BabylonSecrets()
        
        assert secrets.trajectory_source == "db"
    
    def test_trajectory_source_huggingface(self, clean_env):
        """Test trajectory_source can be set to huggingface."""
        os.environ["TRAJECTORY_SOURCE"] = "huggingface"
        
        secrets = BabylonSecrets()
        
        assert secrets.trajectory_source == "huggingface"
    
    def test_database_url_property(self, clean_env):
        """Test database_url property."""
        os.environ["DATABASE_URL"] = "postgresql://test"
        
        secrets = BabylonSecrets()
        
        assert secrets.database_url == "postgresql://test"
    
    def test_database_url_optional(self, clean_env):
        """Test database_url is optional (returns None when missing)."""
        secrets = BabylonSecrets()
        
        # Should NOT raise - database_url is now optional
        assert secrets.database_url is None
    
    def test_hf_trajectory_dataset_property(self, clean_env):
        """Test hf_trajectory_dataset property."""
        os.environ["HF_TRAJECTORY_DATASET"] = "elizaos/test-dataset"
        
        secrets = BabylonSecrets()
        
        assert secrets.hf_trajectory_dataset == "elizaos/test-dataset"
    
    def test_hf_push_repo_property(self, clean_env):
        """Test hf_push_repo property."""
        os.environ["HF_PUSH_REPO"] = "elizaos/my-model"
        
        secrets = BabylonSecrets()
        
        assert secrets.hf_push_repo == "elizaos/my-model"
    
    def test_optional_properties(self, clean_env):
        """Test optional properties return None when missing."""
        secrets = BabylonSecrets()
        
        assert secrets.wandb_api_key is None
        assert secrets.hf_token is None
        assert secrets.phala_api_key is None
        assert secrets.hf_push_repo is None
    
    def test_optional_properties_set(self, clean_env):
        """Test optional properties when set."""
        os.environ["WANDB_API_KEY"] = "wandb-key"
        os.environ["HF_TOKEN"] = "hf-token"
        
        secrets = BabylonSecrets()
        
        assert secrets.wandb_api_key == "wandb-key"
        assert secrets.hf_token == "hf-token"
    
    def test_validate_db_source_success(self, clean_env):
        """Test validation succeeds with db source and DATABASE_URL."""
        os.environ["TRAJECTORY_SOURCE"] = "db"
        os.environ["DATABASE_URL"] = "postgresql://test"
        
        secrets = BabylonSecrets()
        
        assert secrets.validate() is True
    
    def test_validate_db_source_failure(self, clean_env, capsys):
        """Test validation fails when db source missing DATABASE_URL."""
        os.environ["TRAJECTORY_SOURCE"] = "db"
        # No DATABASE_URL
        
        secrets = BabylonSecrets()
        
        result = secrets.validate()
        
        assert result is False
        captured = capsys.readouterr()
        assert "DATABASE_URL required" in captured.out
    
    def test_validate_hf_source_success(self, clean_env):
        """Test validation succeeds with huggingface source and dataset."""
        os.environ["TRAJECTORY_SOURCE"] = "huggingface"
        os.environ["HF_TRAJECTORY_DATASET"] = "elizaos/test-dataset"
        
        secrets = BabylonSecrets()
        
        assert secrets.validate() is True
    
    def test_validate_hf_source_failure(self, clean_env, capsys):
        """Test validation fails when huggingface source missing dataset."""
        os.environ["TRAJECTORY_SOURCE"] = "huggingface"
        # No HF_TRAJECTORY_DATASET
        
        secrets = BabylonSecrets()
        
        result = secrets.validate()
        
        assert result is False
        captured = capsys.readouterr()
        assert "HF_TRAJECTORY_DATASET required" in captured.out
    
    def test_validate_unknown_source(self, clean_env, capsys):
        """Test validation fails with unknown source."""
        os.environ["TRAJECTORY_SOURCE"] = "unknown"
        
        secrets = BabylonSecrets()
        
        result = secrets.validate()
        
        assert result is False
        captured = capsys.readouterr()
        assert "Unknown TRAJECTORY_SOURCE" in captured.out
    
    def test_get_model_encryption_key(self, clean_env):
        """Test model encryption key derivation."""
        with mock.patch("secrets.is_tee_environment", return_value=False):
            secrets = BabylonSecrets()
            
            key1 = secrets.get_model_encryption_key("qwen-7b")
            key2 = secrets.get_model_encryption_key("llama-8b")
            
            assert key1 != key2
            assert len(key1) == 64
    
    def test_get_checkpoint_encryption_key(self, clean_env):
        """Test checkpoint encryption key derivation."""
        with mock.patch("secrets.is_tee_environment", return_value=False):
            secrets = BabylonSecrets()
            
            key1 = secrets.get_checkpoint_encryption_key("run-1")
            key2 = secrets.get_checkpoint_encryption_key("run-2")
            
            assert key1 != key2
    
    def test_with_env_file_db(self, temp_env_file, clean_env):
        """Test BabylonSecrets with env file (db source)."""
        secrets = BabylonSecrets(env_file=temp_env_file)
        
        assert secrets.trajectory_source == "db"
        assert secrets.database_url == "postgresql://user:pass@localhost/db"
        assert secrets.wandb_api_key == "my-wandb-key"
        assert secrets.validate() is True
    
    def test_with_env_file_hf(self, temp_env_file_hf, clean_env):
        """Test BabylonSecrets with env file (huggingface source)."""
        secrets = BabylonSecrets(env_file=temp_env_file_hf)
        
        assert secrets.trajectory_source == "huggingface"
        assert secrets.hf_trajectory_dataset == "elizaos/test-dataset"
        assert secrets.validate() is True


# ============================================================================
# CLI Tests
# ============================================================================

class TestSecretsUI:
    """Tests for secrets CLI."""
    
    def test_cli_get_existing(self, clean_env):
        """Test CLI get command with existing secret."""
        os.environ["TEST_SECRET"] = "test_value"
        
        with mock.patch("sys.argv", ["secrets.py", "get", "TEST_SECRET"]):
            from secrets import main
            # Should print the value (captured by pytest)
            main()
    
    def test_cli_get_missing(self, clean_env):
        """Test CLI get command with missing secret."""
        with mock.patch("sys.argv", ["secrets.py", "get", "NONEXISTENT"]):
            from secrets import main
            with pytest.raises(SystemExit):
                main()
    
    def test_cli_derive(self, clean_env):
        """Test CLI derive command."""
        with mock.patch("secrets.is_tee_environment", return_value=False):
            with mock.patch("sys.argv", ["secrets.py", "derive", "test_key"]):
                from secrets import main
                main()
    
    def test_cli_validate_db(self, temp_env_file, clean_env):
        """Test CLI validate command with db source."""
        with mock.patch("sys.argv", ["secrets.py", "validate", "--env-file", temp_env_file]):
            from secrets import main
            main()
    
    def test_cli_validate_hf(self, temp_env_file_hf, clean_env):
        """Test CLI validate command with huggingface source."""
        with mock.patch("sys.argv", ["secrets.py", "validate", "--env-file", temp_env_file_hf]):
            from secrets import main
            main()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
