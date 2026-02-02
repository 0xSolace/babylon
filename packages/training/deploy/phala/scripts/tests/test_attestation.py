#!/usr/bin/env python3
"""
Tests for attestation.py - TEE Remote Attestation Utilities
"""

import base64
import hashlib
import json
import os
import tempfile
from pathlib import Path
from unittest import mock
import pytest

# Import the module under test
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from attestation import (
    AttestationReport,
    DerivedKey,
    is_tee_environment,
    get_tee_info,
    get_attestation,
    derive_key,
    hash_for_attestation,
    attest_training_run,
    get_training_encryption_key,
    _find_dstack_socket,
    _call_dstack,
    DSTACK_SOCKET,
    ALT_SOCKET_PATHS,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def mock_attestation_response():
    """Sample attestation response from dstack."""
    return {
        "quote": base64.b64encode(b"mock_quote_data_" + b"x" * 100).decode(),
        "timestamp": 1700000000,
        "tee_type": "TDX",
        "measurement": "a" * 64,
        "report_data": {"app_id": "test-app"}
    }


@pytest.fixture
def mock_key_response():
    """Sample key derivation response from dstack."""
    return {
        "key": base64.b64encode(b"derived_key_32bytes_padding_here").decode()
    }


@pytest.fixture
def mock_info_response():
    """Sample info response from dstack."""
    return {
        "tee_type": "TDX",
        "version": "1.0.0",
        "app_id": "app-12345",
        "instance_id": "instance-67890"
    }


# ============================================================================
# AttestationReport Tests
# ============================================================================

class TestAttestationReport:
    """Tests for AttestationReport dataclass."""
    
    def test_create_report(self):
        """Test creating an attestation report."""
        report = AttestationReport(
            quote=b"test_quote",
            user_data=b"test_data",
            timestamp=1700000000,
            tee_type="TDX",
            measurement="a" * 64,
            report_data={"key": "value"},
            raw={}
        )
        
        assert report.quote == b"test_quote"
        assert report.user_data == b"test_data"
        assert report.tee_type == "TDX"
        assert report.measurement == "a" * 64
    
    def test_to_json(self):
        """Test JSON serialization."""
        report = AttestationReport(
            quote=b"test_quote",
            user_data=b"user_data",
            timestamp=1700000000,
            tee_type="TDX",
            measurement="b" * 64,
            report_data={"test": True},
            raw={}
        )
        
        json_str = report.to_json()
        parsed = json.loads(json_str)
        
        assert parsed["tee_type"] == "TDX"
        assert parsed["timestamp"] == 1700000000
        assert parsed["measurement"] == "b" * 64
        assert base64.b64decode(parsed["quote"]) == b"test_quote"
        assert base64.b64decode(parsed["user_data"]) == b"user_data"
    
    def test_verify_valid_report(self):
        """Test verification of valid report."""
        report = AttestationReport(
            quote=b"x" * 200,  # > 100 bytes
            user_data=b"data",
            timestamp=1700000000,
            tee_type="TDX",
            measurement="c" * 64,  # exactly 64 hex chars
            report_data={},
            raw={}
        )
        
        assert report.verify() is True
    
    def test_verify_invalid_short_quote(self):
        """Test verification fails for short quote."""
        report = AttestationReport(
            quote=b"short",  # < 100 bytes
            user_data=b"data",
            timestamp=1700000000,
            tee_type="TDX",
            measurement="c" * 64,
            report_data={},
            raw={}
        )
        
        assert report.verify() is False
    
    def test_verify_invalid_measurement(self):
        """Test verification fails for wrong measurement length."""
        report = AttestationReport(
            quote=b"x" * 200,
            user_data=b"data",
            timestamp=1700000000,
            tee_type="TDX",
            measurement="short",  # not 64 chars
            report_data={},
            raw={}
        )
        
        assert report.verify() is False


# ============================================================================
# DerivedKey Tests
# ============================================================================

class TestDerivedKey:
    """Tests for DerivedKey dataclass."""
    
    def test_create_key(self):
        """Test creating a derived key."""
        key = DerivedKey(
            key=b"0123456789abcdef0123456789abcdef",
            path="/test/path",
            subject="test-subject",
            algorithm="HKDF-SHA256"
        )
        
        assert len(key.key) == 32
        assert key.path == "/test/path"
        assert key.subject == "test-subject"
    
    def test_hex_property(self):
        """Test hex conversion."""
        key = DerivedKey(
            key=bytes([0, 1, 2, 3, 255]),
            path="/test",
            subject="",
            algorithm="HKDF-SHA256"
        )
        
        assert key.hex == "00010203ff"
    
    def test_bytes_property(self):
        """Test bytes property returns raw key."""
        raw_bytes = b"test_key_bytes"
        key = DerivedKey(
            key=raw_bytes,
            path="/test",
            subject="",
            algorithm="HKDF-SHA256"
        )
        
        assert key.bytes == raw_bytes


# ============================================================================
# Socket Discovery Tests
# ============================================================================

class TestSocketDiscovery:
    """Tests for dstack socket discovery."""
    
    def test_find_socket_not_found(self):
        """Test socket not found when none exist."""
        with mock.patch("os.path.exists", return_value=False):
            result = _find_dstack_socket()
            assert result is None
    
    def test_find_socket_found(self):
        """Test socket found at first path."""
        def mock_exists(path):
            return path == ALT_SOCKET_PATHS[0]
        
        with mock.patch("os.path.exists", side_effect=mock_exists):
            result = _find_dstack_socket()
            assert result == ALT_SOCKET_PATHS[0]
    
    def test_find_socket_second_path(self):
        """Test socket found at second path."""
        def mock_exists(path):
            return path == ALT_SOCKET_PATHS[1]
        
        with mock.patch("os.path.exists", side_effect=mock_exists):
            result = _find_dstack_socket()
            assert result == ALT_SOCKET_PATHS[1]


# ============================================================================
# TEE Environment Detection Tests
# ============================================================================

class TestTeeEnvironment:
    """Tests for TEE environment detection."""
    
    def test_is_tee_environment_true(self):
        """Test TEE detection when socket exists."""
        with mock.patch("attestation._find_dstack_socket", return_value="/var/run/dstack.sock"):
            assert is_tee_environment() is True
    
    def test_is_tee_environment_false(self):
        """Test TEE detection when socket missing."""
        with mock.patch("attestation._find_dstack_socket", return_value=None):
            assert is_tee_environment() is False
    
    def test_get_tee_info_not_in_tee(self):
        """Test get_tee_info outside TEE."""
        with mock.patch("attestation.is_tee_environment", return_value=False):
            info = get_tee_info()
            
            assert info["in_tee"] is False
            assert "message" in info
    
    def test_get_tee_info_in_tee(self, mock_info_response):
        """Test get_tee_info inside TEE."""
        with mock.patch("attestation.is_tee_environment", return_value=True):
            with mock.patch("attestation._call_dstack", return_value=mock_info_response):
                info = get_tee_info()
                
                assert info["in_tee"] is True
                assert info["tee_type"] == "TDX"
                assert info["app_id"] == "app-12345"
    
    def test_get_tee_info_error(self):
        """Test get_tee_info when dstack call fails."""
        with mock.patch("attestation.is_tee_environment", return_value=True):
            with mock.patch("attestation._call_dstack", side_effect=Exception("Connection failed")):
                info = get_tee_info()
                
                assert info["in_tee"] is True
                assert "error" in info


# ============================================================================
# Attestation Tests
# ============================================================================

class TestGetAttestation:
    """Tests for get_attestation function."""
    
    def test_get_attestation_not_in_tee(self):
        """Test attestation fails outside TEE."""
        with mock.patch("attestation.is_tee_environment", return_value=False):
            with pytest.raises(RuntimeError, match="Not in TEE environment"):
                get_attestation()
    
    def test_get_attestation_success(self, mock_attestation_response):
        """Test successful attestation."""
        with mock.patch("attestation.is_tee_environment", return_value=True):
            with mock.patch("attestation._call_dstack", return_value=mock_attestation_response):
                report = get_attestation(user_data=b"test")
                
                assert isinstance(report, AttestationReport)
                assert report.tee_type == "TDX"
                assert report.measurement == "a" * 64
    
    def test_get_attestation_long_user_data(self, mock_attestation_response):
        """Test attestation truncates long user_data."""
        long_data = b"x" * 100  # > 64 bytes
        
        with mock.patch("attestation.is_tee_environment", return_value=True):
            with mock.patch("attestation._call_dstack", return_value=mock_attestation_response) as mock_call:
                report = get_attestation(user_data=long_data)
                
                # Check that user_data was hashed (should be 32 bytes from SHA256)
                assert len(report.user_data) == 32


# ============================================================================
# Key Derivation Tests
# ============================================================================

class TestDeriveKey:
    """Tests for derive_key function."""
    
    def test_derive_key_not_in_tee(self):
        """Test key derivation fails outside TEE."""
        with mock.patch("attestation.is_tee_environment", return_value=False):
            with pytest.raises(RuntimeError, match="Not in TEE environment"):
                derive_key(path="/test")
    
    def test_derive_key_success(self, mock_key_response):
        """Test successful key derivation."""
        with mock.patch("attestation.is_tee_environment", return_value=True):
            with mock.patch("attestation._call_dstack", return_value=mock_key_response):
                key = derive_key(
                    path="/babylon/test",
                    subject="test-subject",
                    size=32
                )
                
                assert isinstance(key, DerivedKey)
                assert key.path == "/babylon/test"
                assert key.subject == "test-subject"
                assert key.algorithm == "HKDF-SHA256"


# ============================================================================
# Hash Utility Tests
# ============================================================================

class TestHashForAttestation:
    """Tests for hash_for_attestation function."""
    
    def test_hash_string(self):
        """Test hashing a string."""
        result = hash_for_attestation("test string")
        
        assert isinstance(result, bytes)
        assert len(result) == 32  # SHA256 output
    
    def test_hash_bytes(self):
        """Test hashing bytes."""
        result = hash_for_attestation(b"test bytes")
        
        assert isinstance(result, bytes)
        assert len(result) == 32
    
    def test_hash_dict(self):
        """Test hashing a dict."""
        result = hash_for_attestation({"key": "value", "number": 42})
        
        assert isinstance(result, bytes)
        assert len(result) == 32
    
    def test_hash_dict_deterministic(self):
        """Test dict hashing is deterministic (key order independent)."""
        result1 = hash_for_attestation({"a": 1, "b": 2})
        result2 = hash_for_attestation({"b": 2, "a": 1})
        
        assert result1 == result2


# ============================================================================
# High-Level Training Utilities Tests
# ============================================================================

class TestTrainingUtilities:
    """Tests for high-level training utilities."""
    
    def test_attest_training_run_not_in_tee(self, capsys):
        """Test attest_training_run outside TEE."""
        with mock.patch("attestation.is_tee_environment", return_value=False):
            result = attest_training_run(
                run_id="run-1",
                model_name="test-model",
                config={"learning_rate": 0.001}
            )
            
            assert result is None
            captured = capsys.readouterr()
            assert "Warning" in captured.out
    
    def test_attest_training_run_success(self, mock_attestation_response):
        """Test successful training run attestation."""
        with mock.patch("attestation.is_tee_environment", return_value=True):
            with mock.patch("attestation._call_dstack", return_value=mock_attestation_response):
                result = attest_training_run(
                    run_id="run-123",
                    model_name="qwen-7b",
                    config={"epochs": 10}
                )
                
                assert isinstance(result, AttestationReport)
    
    def test_attest_training_run_with_output_file(self, mock_attestation_response, tmp_path):
        """Test saving attestation to file."""
        output_file = tmp_path / "attestation.json"
        
        with mock.patch("attestation.is_tee_environment", return_value=True):
            with mock.patch("attestation._call_dstack", return_value=mock_attestation_response):
                result = attest_training_run(
                    run_id="run-123",
                    model_name="qwen-7b",
                    config={},
                    output_file=str(output_file)
                )
                
                assert output_file.exists()
                saved = json.loads(output_file.read_text())
                assert "tee_type" in saved
    
    def test_get_training_encryption_key_not_in_tee(self, capsys):
        """Test get_training_encryption_key outside TEE."""
        with mock.patch("attestation.is_tee_environment", return_value=False):
            result = get_training_encryption_key("test-model")
            
            assert result is None
    
    def test_get_training_encryption_key_success(self, mock_key_response):
        """Test successful encryption key derivation."""
        with mock.patch("attestation.is_tee_environment", return_value=True):
            with mock.patch("attestation._call_dstack", return_value=mock_key_response):
                key = get_training_encryption_key("qwen-7b", version="v2")
                
                assert isinstance(key, DerivedKey)
                assert "qwen-7b" in key.path
                assert key.subject == "v2"


# ============================================================================
# CLI Tests
# ============================================================================

class TestCLI:
    """Tests for CLI interface."""
    
    def test_cli_info_command(self):
        """Test CLI info command."""
        with mock.patch("attestation.is_tee_environment", return_value=False):
            with mock.patch("sys.argv", ["attestation.py", "info"]):
                from attestation import main
                # Should not raise
                main()
    
    def test_cli_no_args_shows_info(self):
        """Test CLI with no args shows info."""
        with mock.patch("attestation.is_tee_environment", return_value=False):
            with mock.patch("sys.argv", ["attestation.py"]):
                from attestation import main
                main()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

