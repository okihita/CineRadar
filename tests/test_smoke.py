import os
import sys

# Add project root to path to ensure imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def test_project_structure():
    """Verify critical directories exist."""
    assert os.path.exists("backend"), "Backend directory missing"
    assert os.path.exists("admin"), "Admin directory missing"
    assert os.path.exists("web"), "Web directory missing"

def test_imports():
    """Verify backend modules can be imported."""
    try:
        from backend.config import API_BASE
        assert API_BASE is not None
    except ImportError as e:
        assert False, f"Failed to import backend config: {e}"
