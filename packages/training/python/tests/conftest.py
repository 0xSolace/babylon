"""
Root Test Configuration

Adds the project root to sys.path so imports like 'from src.training...' work correctly.
This is needed because the tests use 'from src.training...' pattern.
"""

import sys
from pathlib import Path

# Add project root to path for imports (packages/training/python)
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

