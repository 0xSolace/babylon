#!/usr/bin/env python3
"""
Phala TEE Secure Secrets Management

This module provides utilities for managing secrets in Phala Cloud's TEE environment.
Secrets can be:
1. Loaded from encrypted environment variables
2. Derived from TEE state (deterministic, bound to hardware)
3. Fetched from external secret managers with TEE-bound access

Usage:
    from secrets import SecretManager
    
    secrets = SecretManager()
    
    # Get a secret (checks env, then derives from TEE if not found)
    api_key = secrets.get("WANDB_API_KEY")
    
    # Get a derived secret (same value across container restarts in same CVM)
    db_encryption_key = secrets.derive("database_encryption")
"""

import base64
import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict, Any

# Import TEE utilities from attestation module
try:
    from .attestation import is_tee_environment, derive_key, DerivedKey
except ImportError:
    from attestation import is_tee_environment, derive_key, DerivedKey


@dataclass
class Secret:
    """Represents a secret value with metadata."""
    name: str
    value: str
    source: str  # "env", "derived", "kms", "file"
    is_derived: bool = False
    
    def __str__(self) -> str:
        return self.value
    
    @property
    def bytes(self) -> bytes:
        return self.value.encode()
    
    @property
    def masked(self) -> str:
        """Return masked version for logging."""
        if len(self.value) <= 8:
            return "***"
        return self.value[:4] + "***" + self.value[-4:]


class SecretManager:
    """
    Manage secrets in Phala TEE environment.
    
    Secrets are resolved in order:
    1. Environment variables
    2. .env file (if provided)
    3. TEE-derived secrets (for missing required secrets)
    4. KMS/Vault (if configured)
    """
    
    def __init__(
        self,
        env_file: Optional[str] = None,
        derive_missing: bool = False,
        app_prefix: str = "babylon"
    ):
        """
        Initialize the SecretManager.
        
        Args:
            env_file: Optional path to .env file
            derive_missing: If True, derive missing secrets from TEE state
            app_prefix: Prefix for derived key paths
        """
        self.env_file = env_file
        self.derive_missing = derive_missing
        self.app_prefix = app_prefix
        self._cache: Dict[str, Secret] = {}
        self._env_overrides: Dict[str, str] = {}
        
        if env_file:
            self._load_env_file(env_file)
    
    def _load_env_file(self, env_file: str):
        """Load environment variables from file."""
        path = Path(env_file)
        if not path.exists():
            return
        
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                # Remove quotes if present
                value = value.strip().strip('"\'')
                self._env_overrides[key.strip()] = value
    
    def get(
        self,
        name: str,
        default: Optional[str] = None,
        required: bool = False
    ) -> Optional[str]:
        """
        Get a secret value.
        
        Args:
            name: Secret name (environment variable name)
            default: Default value if not found
            required: Raise error if not found and no default
        
        Returns:
            Secret value or None
        """
        # Check cache first
        if name in self._cache:
            return self._cache[name].value
        
        value = None
        source = None
        
        # 1. Check environment
        if name in os.environ:
            value = os.environ[name]
            source = "env"
        
        # 2. Check .env overrides
        elif name in self._env_overrides:
            value = self._env_overrides[name]
            source = "env_file"
        
        # 3. Try to derive from TEE if configured
        elif self.derive_missing and is_tee_environment():
            derived = self._derive_secret(name)
            if derived:
                value = derived.hex
                source = "tee_derived"
        
        # 4. Use default
        if value is None:
            if required:
                raise ValueError(f"Required secret not found: {name}")
            value = default
            source = "default"
        
        # Cache and return
        if value is not None:
            self._cache[name] = Secret(
                name=name,
                value=value,
                source=source,
                is_derived=(source == "tee_derived")
            )
        
        return value
    
    def _derive_secret(self, name: str) -> Optional[DerivedKey]:
        """Derive a secret from TEE state."""
        try:
            return derive_key(
                path=f"/{self.app_prefix}/secrets/{name}",
                subject="default",
                size=32
            )
        except Exception:
            return None
    
    def derive(self, name: str, subject: str = "", size: int = 32) -> str:
        """
        Derive a deterministic secret from TEE state.
        
        This returns the same value across container restarts within the same CVM.
        Different CVMs (different code/hardware) will produce different values.
        
        Args:
            name: Secret name/identifier
            subject: Additional context for derivation
            size: Size in bytes
        
        Returns:
            Hex-encoded derived secret
        """
        cache_key = f"_derived_{name}_{subject}_{size}"
        
        if cache_key in self._cache:
            return self._cache[cache_key].value
        
        if not is_tee_environment():
            # In non-TEE, derive from a fixed seed for testing
            # WARNING: This is NOT secure, only for development
            seed = f"{name}:{subject}:DEV_SEED_NOT_FOR_PRODUCTION"
            value = hashlib.sha256(seed.encode()).hexdigest()[:size*2]
            source = "dev_fallback"
        else:
            key = derive_key(
                path=f"/{self.app_prefix}/derived/{name}",
                subject=subject,
                size=size
            )
            value = key.hex
            source = "tee_derived"
        
        self._cache[cache_key] = Secret(
            name=cache_key,
            value=value,
            source=source,
            is_derived=True
        )
        
        return value
    
    def get_all(self, prefix: str = "") -> Dict[str, str]:
        """
        Get all secrets matching a prefix.
        
        Args:
            prefix: Environment variable prefix to filter
        
        Returns:
            Dict of matching secrets
        """
        result = {}
        
        for key, value in os.environ.items():
            if prefix and not key.startswith(prefix):
                continue
            result[key] = value
        
        for key, value in self._env_overrides.items():
            if prefix and not key.startswith(prefix):
                continue
            result[key] = value
        
        return result
    
    def require_all(self, *names: str) -> Dict[str, str]:
        """
        Get multiple required secrets.
        
        Args:
            *names: Secret names to retrieve
        
        Returns:
            Dict of secret values
        
        Raises:
            ValueError if any secret is missing
        """
        result = {}
        missing = []
        
        for name in names:
            value = self.get(name)
            if value is None:
                missing.append(name)
            else:
                result[name] = value
        
        if missing:
            raise ValueError(f"Missing required secrets: {', '.join(missing)}")
        
        return result
    
    def export_to_env(self):
        """Export all loaded secrets to environment variables."""
        for name, secret in self._cache.items():
            if not name.startswith("_derived_"):
                os.environ[name] = secret.value
    
    def summary(self) -> str:
        """Get a summary of loaded secrets (with masked values)."""
        lines = ["Loaded Secrets:"]
        for name, secret in self._cache.items():
            if name.startswith("_derived_"):
                continue
            lines.append(f"  {name}: {secret.masked} (source: {secret.source})")
        return "\n".join(lines)


# ============================================================================
# Pre-configured Babylon Training Secrets
# ============================================================================

class BabylonSecrets(SecretManager):
    """
    Pre-configured secret manager for Babylon training.
    
    Data source secrets (one required):
    - DATABASE_URL: PostgreSQL connection string (for TRAJECTORY_SOURCE=db)
    - HF_TRAJECTORY_DATASET: HuggingFace dataset ID (for TRAJECTORY_SOURCE=huggingface)
    
    Optional secrets:
    - WANDB_API_KEY: Weights & Biases API key
    - HF_TOKEN: HuggingFace token (for private models/datasets)
    - PHALA_API_KEY: Phala Cloud API key
    """
    
    # No hard requirements - depends on TRAJECTORY_SOURCE
    REQUIRED: list[str] = []
    OPTIONAL = [
        "DATABASE_URL",
        "HF_TRAJECTORY_DATASET",
        "WANDB_API_KEY",
        "HF_TOKEN",
        "PHALA_API_KEY",
        "HF_PUSH_REPO",
    ]
    
    def __init__(self, env_file: Optional[str] = None):
        super().__init__(env_file=env_file, app_prefix="babylon")
    
    @property
    def trajectory_source(self) -> str:
        """Get trajectory source: 'db' or 'huggingface'."""
        return self.get("TRAJECTORY_SOURCE", default="db")
    
    @property
    def database_url(self) -> Optional[str]:
        """Get database URL (required when TRAJECTORY_SOURCE=db)."""
        return self.get("DATABASE_URL")
    
    @property
    def hf_trajectory_dataset(self) -> Optional[str]:
        """Get HuggingFace dataset ID (required when TRAJECTORY_SOURCE=huggingface)."""
        return self.get("HF_TRAJECTORY_DATASET")
    
    @property
    def wandb_api_key(self) -> Optional[str]:
        return self.get("WANDB_API_KEY")
    
    @property
    def hf_token(self) -> Optional[str]:
        return self.get("HF_TOKEN")
    
    @property
    def phala_api_key(self) -> Optional[str]:
        return self.get("PHALA_API_KEY")
    
    @property
    def hf_push_repo(self) -> Optional[str]:
        """Get HuggingFace repo for model push."""
        return self.get("HF_PUSH_REPO")
    
    def validate(self) -> bool:
        """
        Validate that required secrets are present based on trajectory source.
        
        - TRAJECTORY_SOURCE=db requires DATABASE_URL
        - TRAJECTORY_SOURCE=huggingface requires HF_TRAJECTORY_DATASET
        """
        source = self.trajectory_source
        
        if source == "db":
            if not self.database_url:
                print("Secret validation failed: DATABASE_URL required when TRAJECTORY_SOURCE=db")
                return False
        elif source == "huggingface":
            if not self.hf_trajectory_dataset:
                print("Secret validation failed: HF_TRAJECTORY_DATASET required when TRAJECTORY_SOURCE=huggingface")
                return False
        else:
            print(f"Secret validation failed: Unknown TRAJECTORY_SOURCE: {source}")
            return False
        
        return True
    
    def get_model_encryption_key(self, model_name: str) -> str:
        """Get an encryption key for model artifacts."""
        return self.derive(f"model_encryption_{model_name}")
    
    def get_checkpoint_encryption_key(self, run_id: str) -> str:
        """Get an encryption key for training checkpoints."""
        return self.derive(f"checkpoint_{run_id}")


# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """CLI for secrets management."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Phala TEE Secrets Management")
    subparsers = parser.add_subparsers(dest="command")
    
    # Get command
    get_parser = subparsers.add_parser("get", help="Get a secret")
    get_parser.add_argument("name", help="Secret name")
    get_parser.add_argument("--default", help="Default value")
    
    # Derive command
    derive_parser = subparsers.add_parser("derive", help="Derive a secret from TEE")
    derive_parser.add_argument("name", help="Secret identifier")
    derive_parser.add_argument("--subject", "-s", default="", help="Derivation subject")
    derive_parser.add_argument("--size", type=int, default=32, help="Size in bytes")
    
    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate Babylon secrets")
    validate_parser.add_argument("--env-file", "-e", help=".env file path")
    
    # Summary command
    summary_parser = subparsers.add_parser("summary", help="Show loaded secrets summary")
    summary_parser.add_argument("--env-file", "-e", help=".env file path")
    
    args = parser.parse_args()
    
    if args.command == "get":
        secrets = SecretManager()
        value = secrets.get(args.name, args.default)
        if value:
            print(value)
        else:
            print(f"Secret '{args.name}' not found", file=__import__('sys').stderr)
            exit(1)
    
    elif args.command == "derive":
        secrets = SecretManager()
        value = secrets.derive(args.name, args.subject, args.size)
        print(value)
    
    elif args.command == "validate":
        secrets = BabylonSecrets(env_file=args.env_file)
        if secrets.validate():
            print("✓ All required secrets present")
            print(secrets.summary())
        else:
            exit(1)
    
    elif args.command == "summary":
        secrets = BabylonSecrets(env_file=args.env_file)
        # Load all known secrets
        for name in secrets.REQUIRED + secrets.OPTIONAL:
            secrets.get(name)
        print(secrets.summary())
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

