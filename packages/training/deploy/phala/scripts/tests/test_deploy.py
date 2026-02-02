#!/usr/bin/env python3
"""
Tests for deploy.py - Phala Cloud Deployment CLI
"""

import os
import subprocess
import tempfile
from pathlib import Path
from unittest import mock
import pytest

# Import the module under test
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from deploy import PhalaDeployer, main, load_env_file


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def temp_compose_file(tmp_path):
    """Create a temporary docker-compose.yml."""
    compose_file = tmp_path / "docker-compose.yml"
    compose_file.write_text("""
version: '3.8'
services:
  app:
    image: test-image:latest
    ports:
      - "8080:8080"
""")
    return str(compose_file)


@pytest.fixture
def temp_env_file(tmp_path):
    """Create a temporary .env file."""
    env_file = tmp_path / ".env"
    env_file.write_text("""
DATABASE_URL=postgresql://test
WANDB_API_KEY=test-key
TRAJECTORY_SOURCE=db
""")
    return str(env_file)


@pytest.fixture
def mock_cli_available():
    """Mock CLI availability check."""
    with mock.patch.object(PhalaDeployer, "_check_cli", return_value=True):
        yield


@pytest.fixture
def clean_env():
    """Clean environment for testing."""
    vars_to_clean = [
        "PHALA_API_KEY", "TRAJECTORY_SOURCE", "HF_TRAJECTORY_DATASET",
        "TRAINING_PROFILE", "TRAINING_STEPS", "MIN_AGENTS_PER_WINDOW"
    ]
    original = {}
    for var in vars_to_clean:
        if var in os.environ:
            original[var] = os.environ.pop(var)
    yield
    for var in vars_to_clean:
        if var in os.environ:
            del os.environ[var]
    os.environ.update(original)


# ============================================================================
# load_env_file Tests
# ============================================================================

class TestLoadEnvFile:
    """Tests for load_env_file function."""
    
    def test_load_env_file(self, temp_env_file, clean_env):
        """Test loading environment from file."""
        load_env_file(temp_env_file)
        
        assert os.environ.get("DATABASE_URL") == "postgresql://test"
        assert os.environ.get("WANDB_API_KEY") == "test-key"
    
    def test_load_env_file_missing(self, clean_env):
        """Test loading missing file does not raise."""
        # Should not raise
        load_env_file("/nonexistent/.env")
    
    def test_load_env_file_does_not_override(self, temp_env_file, clean_env):
        """Test load_env_file uses setdefault (doesn't override)."""
        os.environ["DATABASE_URL"] = "existing_value"
        
        load_env_file(temp_env_file)
        
        # Should keep existing value
        assert os.environ.get("DATABASE_URL") == "existing_value"


# ============================================================================
# PhalaDeployer Tests
# ============================================================================

class TestPhalaDeployer:
    """Tests for PhalaDeployer class."""
    
    def test_create_deployer(self, clean_env):
        """Test creating a deployer."""
        with mock.patch.object(PhalaDeployer, "_check_cli", return_value=False):
            deployer = PhalaDeployer()
            
            assert deployer.api_key is None
            assert deployer.cli_available is False
    
    def test_create_deployer_with_api_key(self, clean_env):
        """Test creating with API key."""
        os.environ["PHALA_API_KEY"] = "test-api-key"
        
        with mock.patch.object(PhalaDeployer, "_check_cli", return_value=True):
            deployer = PhalaDeployer()
            
            assert deployer.api_key == "test-api-key"
    
    def test_check_cli_installed(self):
        """Test CLI check when installed."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            assert deployer.cli_available is True
    
    def test_check_cli_not_installed(self):
        """Test CLI check when not installed."""
        with mock.patch("subprocess.run", side_effect=FileNotFoundError):
            deployer = PhalaDeployer()
            assert deployer.cli_available is False
    
    def test_run_cmd_without_cli(self, clean_env):
        """Test running command without CLI installed."""
        with mock.patch.object(PhalaDeployer, "_check_cli", return_value=False):
            deployer = PhalaDeployer()
            
            with pytest.raises(SystemExit):
                deployer._run_phala_cmd(["test"])
    
    def test_run_cmd_with_cli(self, mock_cli_available, clean_env):
        """Test running command with CLI installed."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result) as mock_run:
            deployer = PhalaDeployer()
            deployer._run_phala_cmd(["test", "command"])
            
            mock_run.assert_called_once()
            args = mock_run.call_args[0][0]
            assert args == ["phala", "test", "command"]


class TestPhalaDeployerLogin:
    """Tests for login functionality."""
    
    def test_login_without_api_key(self, mock_cli_available, clean_env):
        """Test login without API key (interactive)."""
        with mock.patch("subprocess.run") as mock_run:
            deployer = PhalaDeployer()
            deployer.login()
            
            mock_run.assert_called()
            args = mock_run.call_args[0][0]
            assert "auth" in args
            assert "login" in args
            assert "--api-key" not in args
    
    def test_login_with_api_key(self, mock_cli_available, clean_env):
        """Test login with API key."""
        os.environ["PHALA_API_KEY"] = "my-key"
        
        with mock.patch("subprocess.run") as mock_run:
            deployer = PhalaDeployer()
            deployer.login()
            
            args = mock_run.call_args[0][0]
            assert "--api-key" in args
            assert "my-key" in args


class TestPhalaDeployerDeploy:
    """Tests for deploy functionality."""
    
    def test_deploy_missing_compose(self, mock_cli_available, clean_env):
        """Test deploy with missing compose file."""
        deployer = PhalaDeployer()
        
        with pytest.raises(SystemExit):
            deployer.deploy("/nonexistent/docker-compose.yml")
    
    def test_deploy_success(self, mock_cli_available, temp_compose_file, clean_env):
        """Test successful deployment."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result) as mock_run:
            deployer = PhalaDeployer()
            deployer.deploy(temp_compose_file, name="test-app")
            
            args = mock_run.call_args[0][0]
            assert "cvms" in args
            assert "deploy" in args
            assert "--name" in args
            assert "test-app" in args
    
    def test_deploy_with_env_file(self, mock_cli_available, temp_compose_file, temp_env_file, clean_env):
        """Test deployment with env file."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result) as mock_run:
            deployer = PhalaDeployer()
            deployer.deploy(temp_compose_file, env_file=temp_env_file)
            
            args = mock_run.call_args[0][0]
            assert "--env-file" in args
    
    def test_deploy_with_profile(self, mock_cli_available, temp_compose_file, clean_env):
        """Test deployment with profile option."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            deployer.deploy(temp_compose_file, profile="h100")
            
            assert os.environ.get("TRAINING_PROFILE") == "h100"
    
    def test_deploy_with_steps(self, mock_cli_available, temp_compose_file, clean_env):
        """Test deployment with steps option."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            deployer.deploy(temp_compose_file, steps=5000)
            
            assert os.environ.get("TRAINING_STEPS") == "5000"
    
    def test_deploy_with_hf_dataset(self, mock_cli_available, temp_compose_file, clean_env):
        """Test deployment with HuggingFace dataset."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            deployer.deploy(temp_compose_file, hf_dataset="elizaos/test-dataset")
            
            assert os.environ.get("TRAJECTORY_SOURCE") == "huggingface"
            assert os.environ.get("HF_TRAJECTORY_DATASET") == "elizaos/test-dataset"
    
    def test_deploy_with_min_agents(self, mock_cli_available, temp_compose_file, clean_env):
        """Test deployment with min_agents_per_window option."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            deployer.deploy(temp_compose_file, min_agents_per_window=2)
            
            assert os.environ.get("MIN_AGENTS_PER_WINDOW") == "2"
    
    def test_deploy_failure(self, mock_cli_available, temp_compose_file, clean_env):
        """Test failed deployment."""
        mock_result = mock.Mock()
        mock_result.returncode = 1
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            
            with pytest.raises(SystemExit):
                deployer.deploy(temp_compose_file)


class TestPhalaDeployerOperations:
    """Tests for list/status/logs/stop/delete operations."""
    
    def test_list_apps(self, mock_cli_available, clean_env):
        """Test listing apps."""
        with mock.patch("subprocess.run") as mock_run:
            deployer = PhalaDeployer()
            deployer.list_apps()
            
            args = mock_run.call_args[0][0]
            assert "cvms" in args
            assert "list" in args
    
    def test_status(self, mock_cli_available, clean_env):
        """Test getting status."""
        with mock.patch("subprocess.run") as mock_run:
            deployer = PhalaDeployer()
            deployer.status("app-123")
            
            args = mock_run.call_args[0][0]
            assert "cvms" in args
            assert "status" in args
            assert "app-123" in args
    
    def test_logs(self, mock_cli_available, clean_env):
        """Test viewing logs."""
        with mock.patch("subprocess.run") as mock_run:
            deployer = PhalaDeployer()
            deployer.logs("app-123", tail=50)
            
            args = mock_run.call_args[0][0]
            assert "cvms" in args
            assert "logs" in args
            assert "app-123" in args
            assert "--tail" in args
            assert "50" in args
    
    def test_logs_follow(self, mock_cli_available, clean_env):
        """Test following logs."""
        with mock.patch("subprocess.run") as mock_run:
            deployer = PhalaDeployer()
            deployer.logs("app-123", follow=True)
            
            args = mock_run.call_args[0][0]
            assert "--follow" in args
    
    def test_stop(self, mock_cli_available, clean_env):
        """Test stopping a CVM."""
        with mock.patch("subprocess.run") as mock_run:
            deployer = PhalaDeployer()
            deployer.stop("app-123")
            
            args = mock_run.call_args[0][0]
            assert "cvms" in args
            assert "stop" in args
            assert "app-123" in args
    
    def test_delete_with_confirmation(self, mock_cli_available, clean_env):
        """Test delete with user confirmation."""
        with mock.patch("subprocess.run") as mock_run:
            with mock.patch("builtins.input", return_value="y"):
                deployer = PhalaDeployer()
                deployer.delete("app-123")
                
                args = mock_run.call_args[0][0]
                assert "cvms" in args
                assert "delete" in args
    
    def test_delete_cancelled(self, mock_cli_available, clean_env):
        """Test delete cancelled by user."""
        with mock.patch("subprocess.run") as mock_run:
            with mock.patch("builtins.input", return_value="n"):
                deployer = PhalaDeployer()
                deployer.delete("app-123")
                
                # Should not call run
                mock_run.assert_not_called()
    
    def test_delete_force(self, mock_cli_available, clean_env):
        """Test force delete."""
        with mock.patch("subprocess.run") as mock_run:
            deployer = PhalaDeployer()
            deployer.delete("app-123", force=True)
            
            args = mock_run.call_args[0][0]
            assert "delete" in args


class TestPhalaDeployerAttestation:
    """Tests for attestation functionality."""
    
    def test_attestation(self, mock_cli_available, clean_env):
        """Test fetching attestation."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        mock_result.stdout = '{"quote": "test"}'
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            result = deployer.attestation("app-123")
            
            assert result == '{"quote": "test"}'
    
    def test_attestation_with_output(self, mock_cli_available, tmp_path, clean_env):
        """Test saving attestation to file."""
        output_file = tmp_path / "attestation.json"
        
        mock_result = mock.Mock()
        mock_result.returncode = 0
        mock_result.stdout = '{"quote": "test"}'
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            deployer.attestation("app-123", output_file=str(output_file))
            
            assert output_file.exists()
            assert output_file.read_text() == '{"quote": "test"}'
    
    def test_attestation_failure(self, mock_cli_available, clean_env):
        """Test attestation fetch failure."""
        mock_result = mock.Mock()
        mock_result.returncode = 1
        mock_result.stderr = "Error message"
        
        with mock.patch("subprocess.run", return_value=mock_result):
            deployer = PhalaDeployer()
            
            with pytest.raises(SystemExit):
                deployer.attestation("app-123")


# ============================================================================
# CLI Tests
# ============================================================================

class TestCLI:
    """Tests for main CLI."""
    
    def test_cli_no_args(self, mock_cli_available, clean_env):
        """Test CLI with no arguments shows help."""
        with mock.patch("sys.argv", ["deploy.py"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 0
    
    def test_cli_login(self, mock_cli_available, clean_env):
        """Test CLI login command."""
        with mock.patch("subprocess.run") as mock_run:
            with mock.patch("sys.argv", ["deploy.py", "login"]):
                main()
                
                mock_run.assert_called()
    
    def test_cli_deploy(self, mock_cli_available, temp_compose_file, clean_env):
        """Test CLI deploy command."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result):
            with mock.patch("sys.argv", ["deploy.py", "deploy", "--compose", temp_compose_file]):
                main()
    
    def test_cli_deploy_with_profile(self, mock_cli_available, temp_compose_file, clean_env):
        """Test CLI deploy with profile option."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result):
            with mock.patch("sys.argv", [
                "deploy.py", "deploy",
                "--compose", temp_compose_file,
                "--profile", "h100",
                "--steps", "5000"
            ]):
                main()
                
                assert os.environ.get("TRAINING_PROFILE") == "h100"
                assert os.environ.get("TRAINING_STEPS") == "5000"
    
    def test_cli_deploy_with_hf_dataset(self, mock_cli_available, temp_compose_file, clean_env):
        """Test CLI deploy with HuggingFace dataset."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        
        with mock.patch("subprocess.run", return_value=mock_result):
            with mock.patch("sys.argv", [
                "deploy.py", "deploy",
                "--compose", temp_compose_file,
                "--hf-dataset", "elizaos/test-dataset"
            ]):
                main()
                
                assert os.environ.get("TRAJECTORY_SOURCE") == "huggingface"
                assert os.environ.get("HF_TRAJECTORY_DATASET") == "elizaos/test-dataset"
    
    def test_cli_list(self, mock_cli_available, clean_env):
        """Test CLI list command."""
        with mock.patch("subprocess.run"):
            with mock.patch("sys.argv", ["deploy.py", "list"]):
                main()
    
    def test_cli_status(self, mock_cli_available, clean_env):
        """Test CLI status command."""
        with mock.patch("subprocess.run"):
            with mock.patch("sys.argv", ["deploy.py", "status", "app-123"]):
                main()
    
    def test_cli_logs(self, mock_cli_available, clean_env):
        """Test CLI logs command."""
        with mock.patch("subprocess.run"):
            with mock.patch("sys.argv", ["deploy.py", "logs", "app-123"]):
                main()
    
    def test_cli_logs_with_options(self, mock_cli_available, clean_env):
        """Test CLI logs command with options."""
        with mock.patch("subprocess.run"):
            with mock.patch("sys.argv", ["deploy.py", "logs", "app-123", "--follow", "--tail", "50"]):
                main()
    
    def test_cli_stop(self, mock_cli_available, clean_env):
        """Test CLI stop command."""
        with mock.patch("subprocess.run"):
            with mock.patch("sys.argv", ["deploy.py", "stop", "app-123"]):
                main()
    
    def test_cli_delete(self, mock_cli_available, clean_env):
        """Test CLI delete command."""
        with mock.patch("subprocess.run"):
            with mock.patch("builtins.input", return_value="y"):
                with mock.patch("sys.argv", ["deploy.py", "delete", "app-123"]):
                    main()
    
    def test_cli_delete_force(self, mock_cli_available, clean_env):
        """Test CLI delete --force command."""
        with mock.patch("subprocess.run"):
            with mock.patch("sys.argv", ["deploy.py", "delete", "app-123", "--force"]):
                main()
    
    def test_cli_attestation(self, mock_cli_available, clean_env):
        """Test CLI attestation command."""
        mock_result = mock.Mock()
        mock_result.returncode = 0
        mock_result.stdout = '{"quote": "test"}'
        
        with mock.patch("subprocess.run", return_value=mock_result):
            with mock.patch("sys.argv", ["deploy.py", "attestation", "app-123"]):
                main()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
