#!/usr/bin/env python3
"""
Shared pytest fixtures for Phala scripts tests.
"""

import base64
import os
import sys
from pathlib import Path
from unittest import mock

import pytest

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


# ============================================================================
# Mock dstack Responses
# ============================================================================

@pytest.fixture
def mock_dstack_info():
    """Standard info response from dstack."""
    return {
        "tee_type": "TDX",
        "version": "1.0.0",
        "app_id": "test-app-12345",
        "instance_id": "instance-67890"
    }


@pytest.fixture
def mock_dstack_attestation():
    """Standard attestation response from dstack."""
    fake_quote = b"TDX_QUOTE_" + b"x" * 150
    return {
        "quote": base64.b64encode(fake_quote).decode(),
        "timestamp": 1700000000,
        "tee_type": "TDX",
        "measurement": "abcd1234" * 8,  # 64 hex chars
        "report_data": {
            "app_id": "test-app",
            "instance_id": "instance-123"
        }
    }


@pytest.fixture
def mock_dstack_key():
    """Standard key derivation response from dstack."""
    fake_key = os.urandom(32)
    return {
        "key": base64.b64encode(fake_key).decode()
    }


# ============================================================================
# TEE Environment Mocking
# ============================================================================

@pytest.fixture
def mock_tee_available():
    """Mock being inside a TEE environment."""
    with mock.patch("os.path.exists", return_value=True):
        yield


@pytest.fixture
def mock_tee_unavailable():
    """Mock being outside a TEE environment."""
    def no_socket(path):
        if "dstack" in path:
            return False
        return os.path.exists.__wrapped__(path) if hasattr(os.path.exists, '__wrapped__') else True
    
    with mock.patch("os.path.exists", side_effect=no_socket):
        yield


# ============================================================================
# Environment Variable Fixtures
# ============================================================================

@pytest.fixture
def clean_babylon_env():
    """Clean Babylon-related environment variables."""
    babylon_vars = [
        "DATABASE_URL",
        "WANDB_API_KEY", 
        "HF_TOKEN",
        "PHALA_API_KEY",
        "PHALA_CLOUD_API_KEY",
    ]
    
    # Save and remove
    saved = {}
    for var in babylon_vars:
        if var in os.environ:
            saved[var] = os.environ.pop(var)
    
    yield
    
    # Restore
    for var in babylon_vars:
        if var in os.environ:
            del os.environ[var]
    os.environ.update(saved)


@pytest.fixture
def sample_babylon_env(clean_babylon_env):
    """Set up sample Babylon environment variables."""
    os.environ["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/babylon"
    os.environ["WANDB_API_KEY"] = "wandb_test_key_12345"
    os.environ["HF_TOKEN"] = "hf_test_token_abcde"
    yield


# ============================================================================
# File Fixtures
# ============================================================================

@pytest.fixture
def temp_docker_compose(tmp_path):
    """Create a temporary docker-compose.yml file."""
    compose_content = """
version: '3.8'

services:
  babylon-training:
    image: babylon-training:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    volumes:
      - /var/run/dstack.sock:/var/run/dstack.sock
"""
    compose_file = tmp_path / "docker-compose.yml"
    compose_file.write_text(compose_content)
    return str(compose_file)


@pytest.fixture
def temp_env_file(tmp_path):
    """Create a temporary .env file with Babylon secrets."""
    env_content = """
# Babylon Training Secrets
DATABASE_URL=postgresql://user:password@db:5432/babylon
WANDB_API_KEY=wandb_key_from_file
HF_TOKEN=hf_token_from_file
# Comments are ignored
EMPTY_VAR=
QUOTED_VAR="quoted_value"
SINGLE_QUOTED='single_quoted'
"""
    env_file = tmp_path / ".env"
    env_file.write_text(env_content)
    return str(env_file)


# ============================================================================
# Mock Subprocess for CLI Tests
# ============================================================================

@pytest.fixture
def mock_phala_cli():
    """Mock the Phala CLI being available and working."""
    def run_mock(args, *a, **kw):
        result = mock.Mock()
        result.returncode = 0
        result.stdout = "{}"
        result.stderr = ""
        return result
    
    with mock.patch("subprocess.run", side_effect=run_mock) as m:
        yield m


@pytest.fixture
def mock_phala_cli_unavailable():
    """Mock the Phala CLI not being installed."""
    with mock.patch("subprocess.run", side_effect=FileNotFoundError):
        yield

