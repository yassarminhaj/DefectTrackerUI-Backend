"""Application factory bridge for the Defect Tracker backend.

The current Phase 1 backend lives in the root-level ``app.py`` module. This
factory intentionally wraps that legacy module first, so we can move routes into
package modules page by page without breaking the existing API contract.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

from flask import Flask

from app.routes.ui import register_ui_routes


_LEGACY_MODULE_NAME = "defect_tracker_legacy_app"


def _load_legacy_module() -> ModuleType:
    root = Path(__file__).resolve().parent.parent
    legacy_path = root / "app.py"
    spec = importlib.util.spec_from_file_location(_LEGACY_MODULE_NAME, legacy_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load legacy Flask app from {legacy_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def create_app() -> Flask:
    """Return the current Flask application.

    Future integration slices will gradually move routes/services out of
    root-level ``app.py`` and into this package. Until then, this factory keeps
    the existing API behavior intact.
    """

    legacy_module = _load_legacy_module()
    app = legacy_module.app
    register_ui_routes(app)
    return app
