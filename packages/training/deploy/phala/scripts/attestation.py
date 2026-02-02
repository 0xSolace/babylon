#!/usr/bin/env python3
"""
Phala TEE Remote Attestation Utilities

This module provides utilities for working with remote attestation in Phala Cloud's
TEE environment. It uses the dstack.sock socket for communication with the TEE
attestation service.

Remote attestation proves:
1. Code integrity - the exact code running in the TEE
2. Hardware authenticity - genuine Intel TDX/SGX or AMD SEV hardware
3. Data isolation - memory is encrypted and isolated

Usage:
    # Inside a Phala CVM container
    from attestation import get_attestation, verify_attestation, derive_key
    
    # Get attestation report
    report = get_attestation(user_data=b"custom_data")
    
    # Derive a key from TEE state
    key = derive_key(path="/babylon/training/key1", subject="training-run-1")
"""

import hashlib
import json
import os
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union

# dstack socket path (mounted in Phala CVMs)
DSTACK_SOCKET = "/var/run/dstack.sock"

# Alternative socket paths
ALT_SOCKET_PATHS = [
    "/var/run/dstack.sock",
    "/run/dstack.sock",
    "/tmp/dstack.sock"
]


@dataclass
class AttestationReport:
    """Represents a TEE attestation report."""
    quote: bytes
    user_data: bytes
    timestamp: int
    tee_type: str  # "TDX", "SGX", or "SEV"
    measurement: str  # MRTD/MRENCLAVE - hash of code
    report_data: dict
    raw: dict
    
    def to_json(self) -> str:
        """Serialize to JSON (base64 encode bytes)."""
        import base64
        return json.dumps({
            "quote": base64.b64encode(self.quote).decode(),
            "user_data": base64.b64encode(self.user_data).decode(),
            "timestamp": self.timestamp,
            "tee_type": self.tee_type,
            "measurement": self.measurement,
            "report_data": self.report_data
        }, indent=2)
    
    def verify(self) -> bool:
        """
        Verify the attestation report.
        
        For full verification, use external attestation verification services
        or Phala's verification endpoints.
        """
        # Basic sanity checks
        if not self.quote or len(self.quote) < 100:
            return False
        if not self.measurement or len(self.measurement) != 64:
            return False
        return True


@dataclass
class DerivedKey:
    """Represents a key derived from TEE state."""
    key: bytes
    path: str
    subject: str
    algorithm: str
    
    @property
    def hex(self) -> str:
        return self.key.hex()
    
    @property
    def bytes(self) -> bytes:
        return self.key


def _find_dstack_socket() -> Optional[str]:
    """Find the dstack socket path."""
    for path in ALT_SOCKET_PATHS:
        if os.path.exists(path):
            return path
    return None


def _call_dstack(method: str, params: dict = None) -> dict:
    """
    Make a JSON-RPC call to dstack socket.
    
    The dstack socket provides TEE services like attestation and key derivation.
    """
    socket_path = _find_dstack_socket()
    
    if not socket_path:
        raise RuntimeError(
            f"dstack socket not found. Checked paths: {ALT_SOCKET_PATHS}. "
            "Make sure you're running inside a Phala CVM with dstack.sock mounted."
        )
    
    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params or {}
    }
    
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        sock.connect(socket_path)
        sock.sendall(json.dumps(request).encode() + b"\n")
        
        response_data = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response_data += chunk
            if b"\n" in response_data:
                break
        
        response = json.loads(response_data.decode())
        
        if "error" in response:
            raise RuntimeError(f"dstack error: {response['error']}")
        
        return response.get("result", {})
    finally:
        sock.close()


def is_tee_environment() -> bool:
    """Check if we're running in a TEE environment."""
    return _find_dstack_socket() is not None


def get_tee_info() -> dict:
    """Get information about the TEE environment."""
    if not is_tee_environment():
        return {
            "in_tee": False,
            "message": "Not running in a Phala CVM. TEE features unavailable."
        }
    
    try:
        info = _call_dstack("getInfo")
        return {
            "in_tee": True,
            "tee_type": info.get("tee_type", "unknown"),
            "version": info.get("version", "unknown"),
            "app_id": info.get("app_id"),
            "instance_id": info.get("instance_id")
        }
    except Exception as e:
        return {
            "in_tee": True,
            "error": str(e)
        }


def get_attestation(user_data: bytes = b"") -> AttestationReport:
    """
    Get a remote attestation report from the TEE.
    
    Args:
        user_data: Custom data to include in the attestation (max 64 bytes).
                   Typically a hash of data you want to bind to the attestation.
    
    Returns:
        AttestationReport with the TEE attestation quote.
    
    Example:
        # Attest a training run
        run_id = "training-run-123"
        user_data = hashlib.sha256(run_id.encode()).digest()[:64]
        report = get_attestation(user_data)
        
        # Save for verification
        with open("attestation.json", "w") as f:
            f.write(report.to_json())
    """
    if not is_tee_environment():
        raise RuntimeError("Not in TEE environment. Cannot generate attestation.")
    
    import base64
    
    # Ensure user_data is <= 64 bytes
    if len(user_data) > 64:
        user_data = hashlib.sha256(user_data).digest()[:64]
    
    result = _call_dstack("getAttestation", {
        "user_data": base64.b64encode(user_data).decode()
    })
    
    return AttestationReport(
        quote=base64.b64decode(result.get("quote", "")),
        user_data=user_data,
        timestamp=result.get("timestamp", 0),
        tee_type=result.get("tee_type", "unknown"),
        measurement=result.get("measurement", ""),
        report_data=result.get("report_data", {}),
        raw=result
    )


def derive_key(
    path: str,
    subject: str = "",
    size: int = 32,
    algorithm: str = "HKDF-SHA256"
) -> DerivedKey:
    """
    Derive a cryptographic key from the TEE's root of trust.
    
    Keys derived with the same path and subject will be identical within the
    same TEE instance. Different TEE instances (different code or hardware)
    will produce different keys.
    
    This is useful for:
    - Encrypting sensitive training data
    - Signing model outputs
    - Generating deterministic secrets
    
    Args:
        path: Hierarchical key path (e.g., "/babylon/training/encryption")
        subject: Additional context for key derivation
        size: Key size in bytes (default: 32 = 256 bits)
        algorithm: Key derivation algorithm
    
    Returns:
        DerivedKey with the derived cryptographic key.
    
    Example:
        # Derive encryption key for model weights
        key = derive_key(
            path="/babylon/model/weights",
            subject="qwen-2.5-7b-v1"
        )
        
        # Use key for encryption
        from cryptography.fernet import Fernet
        import base64
        fernet_key = base64.urlsafe_b64encode(key.bytes)
        cipher = Fernet(fernet_key)
    """
    if not is_tee_environment():
        raise RuntimeError("Not in TEE environment. Cannot derive keys.")
    
    import base64
    
    result = _call_dstack("deriveKey", {
        "path": path,
        "subject": subject,
        "size": size,
        "algorithm": algorithm
    })
    
    return DerivedKey(
        key=base64.b64decode(result.get("key", "")),
        path=path,
        subject=subject,
        algorithm=algorithm
    )


def hash_for_attestation(data: Union[str, bytes, dict]) -> bytes:
    """
    Create a hash suitable for attestation user_data.
    
    This ensures consistent hashing for binding data to attestations.
    
    Args:
        data: String, bytes, or dict to hash
    
    Returns:
        64-byte hash suitable for attestation
    """
    if isinstance(data, dict):
        data = json.dumps(data, sort_keys=True).encode()
    elif isinstance(data, str):
        data = data.encode()
    
    return hashlib.sha256(data).digest()


# ============================================================================
# High-Level Training Utilities
# ============================================================================

def attest_training_run(
    run_id: str,
    model_name: str,
    config: dict,
    output_file: str = None
) -> Optional[AttestationReport]:
    """
    Generate an attestation report for a training run.
    
    This creates a cryptographic proof that the training ran in a genuine TEE
    with the specified configuration.
    
    Args:
        run_id: Unique identifier for the training run
        model_name: Name of the model being trained
        config: Training configuration dict
        output_file: Optional file to save attestation JSON
    
    Returns:
        AttestationReport or None if not in TEE
    """
    if not is_tee_environment():
        print("Warning: Not in TEE environment. Skipping attestation.")
        return None
    
    # Create binding data
    binding = {
        "run_id": run_id,
        "model": model_name,
        "config_hash": hashlib.sha256(
            json.dumps(config, sort_keys=True).encode()
        ).hexdigest()
    }
    
    user_data = hash_for_attestation(binding)
    report = get_attestation(user_data)
    
    if output_file:
        Path(output_file).write_text(report.to_json())
        print(f"Attestation saved to: {output_file}")
    
    return report


def get_training_encryption_key(model_name: str, version: str = "v1") -> Optional[DerivedKey]:
    """
    Get an encryption key for protecting training artifacts.
    
    The key is deterministically derived from TEE state, so the same key
    can be retrieved across container restarts within the same CVM.
    
    Args:
        model_name: Name of the model
        version: Key version for rotation
    
    Returns:
        DerivedKey or None if not in TEE
    """
    if not is_tee_environment():
        print("Warning: Not in TEE environment. Cannot derive encryption key.")
        return None
    
    return derive_key(
        path=f"/babylon/training/{model_name}/encryption",
        subject=version,
        size=32
    )


# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """CLI for attestation utilities."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Phala TEE Attestation Utilities")
    subparsers = parser.add_subparsers(dest="command")
    
    # Info command
    info_parser = subparsers.add_parser("info", help="Get TEE environment info")
    
    # Attest command
    attest_parser = subparsers.add_parser("attest", help="Generate attestation")
    attest_parser.add_argument("--data", "-d", help="Custom user data (string)")
    attest_parser.add_argument("--output", "-o", help="Output file for attestation JSON")
    
    # Derive key command
    key_parser = subparsers.add_parser("derive-key", help="Derive a key")
    key_parser.add_argument("--path", "-p", required=True, help="Key path")
    key_parser.add_argument("--subject", "-s", default="", help="Key subject")
    key_parser.add_argument("--size", type=int, default=32, help="Key size in bytes")
    
    args = parser.parse_args()
    
    if args.command == "info":
        info = get_tee_info()
        print(json.dumps(info, indent=2))
    
    elif args.command == "attest":
        user_data = args.data.encode() if args.data else b""
        report = get_attestation(user_data)
        
        if args.output:
            Path(args.output).write_text(report.to_json())
            print(f"Attestation saved to: {args.output}")
        else:
            print(report.to_json())
    
    elif args.command == "derive-key":
        key = derive_key(args.path, args.subject, args.size)
        print(f"Path: {key.path}")
        print(f"Subject: {key.subject}")
        print(f"Algorithm: {key.algorithm}")
        print(f"Key (hex): {key.hex}")
    
    else:
        # Default: show info
        info = get_tee_info()
        print(json.dumps(info, indent=2))


if __name__ == "__main__":
    main()

