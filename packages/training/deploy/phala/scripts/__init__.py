"""
Phala Cloud TEE Deployment Scripts

This package provides utilities for deploying Babylon RL training to Phala Cloud's
Confidential Virtual Machines (CVMs) with TEE protection.

Modules:
    - deploy: CLI wrapper for Phala Cloud operations
    - attestation: Remote attestation and key derivation
    - secrets: TEE-aware secret management
"""

from .attestation import (
    is_tee_environment,
    get_tee_info,
    get_attestation,
    derive_key,
    attest_training_run,
    get_training_encryption_key,
    AttestationReport,
    DerivedKey,
)

from .secrets import (
    SecretManager,
    BabylonSecrets,
    Secret,
)

__all__ = [
    # Attestation
    "is_tee_environment",
    "get_tee_info", 
    "get_attestation",
    "derive_key",
    "attest_training_run",
    "get_training_encryption_key",
    "AttestationReport",
    "DerivedKey",
    # Secrets
    "SecretManager",
    "BabylonSecrets",
    "Secret",
]

