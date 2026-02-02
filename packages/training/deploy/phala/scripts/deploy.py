#!/usr/bin/env python3
"""
Phala Cloud Deployment CLI for Babylon Training

This script provides a simplified interface for deploying Babylon RL training
to Phala Cloud's TEE-enabled infrastructure.

Usage:
    python deploy.py deploy --compose docker-compose.yml
    python deploy.py status <app-id>
    python deploy.py logs <app-id>
    python deploy.py stop <app-id>
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Try to load dotenv if available
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def load_env_file(env_file: str):
    """Load environment variables from a file."""
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
            os.environ.setdefault(key.strip(), value)


class PhalaDeployer:
    """Wrapper for Phala Cloud CLI operations."""
    
    def __init__(self):
        self.api_key = os.getenv("PHALA_API_KEY")
        self.cli_available = self._check_cli()
    
    def _check_cli(self) -> bool:
        """Check if Phala CLI is installed."""
        try:
            result = subprocess.run(
                ["phala", "--version"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False
    
    def _run_phala_cmd(self, args: list[str], capture: bool = False) -> subprocess.CompletedProcess:
        """Run a Phala CLI command."""
        if not self.cli_available:
            print("Error: Phala CLI not found. Install with: npm install -g @aspect/phala-cloud-cli")
            print("Or visit: https://docs.phala.cloud/cli")
            sys.exit(1)
        
        cmd = ["phala"] + args
        
        if capture:
            return subprocess.run(cmd, capture_output=True, text=True)
        else:
            return subprocess.run(cmd)
    
    def login(self):
        """Login to Phala Cloud."""
        print("Logging into Phala Cloud...")
        if self.api_key:
            self._run_phala_cmd(["auth", "login", "--api-key", self.api_key])
        else:
            self._run_phala_cmd(["auth", "login"])
    
    def deploy(
        self,
        compose_file: str,
        name: str = None,
        env_file: str = None,
        profile: str = None,
        steps: int = None,
        hf_dataset: str = None,
        min_agents_per_window: int = None
    ):
        """Deploy using docker-compose.yml."""
        compose_path = Path(compose_file)
        if not compose_path.exists():
            print(f"Error: Compose file not found: {compose_file}")
            sys.exit(1)
        
        print(f"Deploying from {compose_file}...")
        
        # Set environment variables for docker-compose
        if profile:
            os.environ["TRAINING_PROFILE"] = profile
        if steps:
            os.environ["TRAINING_STEPS"] = str(steps)
        if hf_dataset:
            os.environ["TRAJECTORY_SOURCE"] = "huggingface"
            os.environ["HF_TRAJECTORY_DATASET"] = hf_dataset
        if min_agents_per_window:
            os.environ["MIN_AGENTS_PER_WINDOW"] = str(min_agents_per_window)
        
        args = ["cvms", "deploy", str(compose_path)]
        
        if name:
            args.extend(["--name", name])
        
        if env_file:
            env_path = Path(env_file)
            if env_path.exists():
                args.extend(["--env-file", str(env_path)])
            else:
                print(f"Warning: Env file not found: {env_file}")
        
        # Print configuration summary
        print("\n" + "=" * 60)
        print("Deployment Configuration:")
        print("=" * 60)
        print(f"  Compose File:    {compose_file}")
        print(f"  Name:            {name or 'auto'}")
        print(f"  Profile:         {os.getenv('TRAINING_PROFILE', 'auto')}")
        print(f"  Steps:           {os.getenv('TRAINING_STEPS', '1000')}")
        print(f"  Data Source:     {os.getenv('TRAJECTORY_SOURCE', 'db')}")
        if hf_dataset:
            print(f"  HF Dataset:      {hf_dataset}")
        print("=" * 60 + "\n")
        
        result = self._run_phala_cmd(args)
        
        if result.returncode == 0:
            print("\n✓ Deployment successful!")
            print("Use 'python deploy.py list' to see your deployments")
        else:
            print("\n✗ Deployment failed")
            sys.exit(1)
    
    def list_apps(self):
        """List all deployed CVMs."""
        print("Listing Phala Cloud CVMs...\n")
        self._run_phala_cmd(["cvms", "list"])
    
    def status(self, app_id: str):
        """Get status of a specific CVM."""
        print(f"Getting status for CVM: {app_id}\n")
        self._run_phala_cmd(["cvms", "status", app_id])
    
    def logs(self, app_id: str, follow: bool = False, tail: int = 100):
        """View logs from a CVM."""
        args = ["cvms", "logs", app_id, "--tail", str(tail)]
        if follow:
            args.append("--follow")
        self._run_phala_cmd(args)
    
    def stop(self, app_id: str):
        """Stop a running CVM."""
        print(f"Stopping CVM: {app_id}")
        self._run_phala_cmd(["cvms", "stop", app_id])
        print("✓ CVM stopped")
    
    def delete(self, app_id: str, force: bool = False):
        """Delete a CVM."""
        if not force:
            confirm = input(f"Are you sure you want to delete CVM {app_id}? [y/N]: ")
            if confirm.lower() != 'y':
                print("Aborted.")
                return
        
        print(f"Deleting CVM: {app_id}")
        self._run_phala_cmd(["cvms", "delete", app_id])
        print("✓ CVM deleted")
    
    def attestation(self, app_id: str, output_file: str = None):
        """Get remote attestation report for a CVM."""
        print(f"Fetching attestation report for CVM: {app_id}\n")
        
        result = self._run_phala_cmd(
            ["cvms", "attestation", app_id, "--format", "json"],
            capture=True
        )
        
        if result.returncode != 0:
            print(f"Error fetching attestation: {result.stderr}")
            sys.exit(1)
        
        attestation = result.stdout
        
        if output_file:
            Path(output_file).write_text(attestation)
            print(f"Attestation saved to: {output_file}")
        else:
            print(attestation)
        
        return attestation


# GPU type to profile mapping
GPU_PROFILES = {
    "4090": "24gb",
    "rtx4090": "24gb",
    "l40s": "l40",
    "l40": "l40",
    "a100": "a100",
    "h100": "h100",
    "h200": "h100",  # Use h100 profile for h200
}


def main():
    parser = argparse.ArgumentParser(
        description="Babylon Training - Phala Cloud Deployment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Deploy training with database source (live data)
  python deploy.py deploy --compose docker-compose.yml --name babylon-train-1
  
  # Deploy with HuggingFace dataset
  python deploy.py deploy --compose docker-compose.yml \\
    --hf-dataset elizaos/enkidu-trajectories-raw --profile h100 --steps 5000
  
  # List all deployments
  python deploy.py list
  
  # View logs
  python deploy.py logs <app-id> --follow
  
  # Get attestation proof
  python deploy.py attestation <app-id> --output attestation.json
  
  # Stop and delete
  python deploy.py stop <app-id>
  python deploy.py delete <app-id>

Environment:
  PHALA_API_KEY    Your Phala Cloud API key (optional, can login interactively)
"""
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Login command
    subparsers.add_parser("login", help="Login to Phala Cloud")
    
    # Deploy command
    deploy_parser = subparsers.add_parser("deploy", help="Deploy to Phala Cloud")
    deploy_parser.add_argument(
        "--compose", "-c",
        default="docker-compose.yml",
        help="Path to docker-compose.yml (default: docker-compose.yml)"
    )
    deploy_parser.add_argument(
        "--name", "-n",
        help="Name for the deployment"
    )
    deploy_parser.add_argument(
        "--env-file", "-e",
        help="Path to .env file with secrets"
    )
    deploy_parser.add_argument(
        "--profile", "-p",
        choices=["12gb", "24gb", "l40", "a100", "h100", "auto"],
        default="auto",
        help="GPU profile (default: auto)"
    )
    deploy_parser.add_argument(
        "--steps", "-s",
        type=int,
        help="Number of training steps (default: from env or 1000)"
    )
    deploy_parser.add_argument(
        "--hf-dataset",
        help="HuggingFace dataset ID (alternative to DATABASE_URL)"
    )
    deploy_parser.add_argument(
        "--min-agents-per-window",
        type=int,
        default=1,
        help="Minimum trajectories per window (default: 1)"
    )
    
    # List command
    subparsers.add_parser("list", help="List all CVMs")
    
    # Status command
    status_parser = subparsers.add_parser("status", help="Get CVM status")
    status_parser.add_argument("app_id", help="CVM/App ID")
    
    # Logs command
    logs_parser = subparsers.add_parser("logs", help="View CVM logs")
    logs_parser.add_argument("app_id", help="CVM/App ID")
    logs_parser.add_argument("--follow", "-f", action="store_true", help="Follow log output")
    logs_parser.add_argument("--tail", "-t", type=int, default=100, help="Number of lines (default: 100)")
    
    # Stop command
    stop_parser = subparsers.add_parser("stop", help="Stop a CVM")
    stop_parser.add_argument("app_id", help="CVM/App ID")
    
    # Delete command
    delete_parser = subparsers.add_parser("delete", help="Delete a CVM")
    delete_parser.add_argument("app_id", help="CVM/App ID")
    delete_parser.add_argument("--force", "-f", action="store_true", help="Skip confirmation")
    
    # Attestation command
    attest_parser = subparsers.add_parser("attestation", help="Get attestation report")
    attest_parser.add_argument("app_id", help="CVM/App ID")
    attest_parser.add_argument("--output", "-o", help="Save attestation to file")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
    
    # Load .env file if specified or default exists
    if hasattr(args, 'env_file') and args.env_file:
        load_env_file(args.env_file)
    elif Path("../.env").exists():
        load_env_file("../.env")
    elif load_dotenv:
        load_dotenv()
    
    deployer = PhalaDeployer()
    
    if args.command == "login":
        deployer.login()
    elif args.command == "deploy":
        deployer.deploy(
            args.compose,
            args.name,
            args.env_file,
            profile=args.profile,
            steps=args.steps,
            hf_dataset=args.hf_dataset,
            min_agents_per_window=args.min_agents_per_window
        )
    elif args.command == "list":
        deployer.list_apps()
    elif args.command == "status":
        deployer.status(args.app_id)
    elif args.command == "logs":
        deployer.logs(args.app_id, args.follow, args.tail)
    elif args.command == "stop":
        deployer.stop(args.app_id)
    elif args.command == "delete":
        deployer.delete(args.app_id, args.force)
    elif args.command == "attestation":
        deployer.attestation(args.app_id, args.output)


if __name__ == "__main__":
    main()
