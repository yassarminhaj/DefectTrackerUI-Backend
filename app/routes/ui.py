"""Static UI routes for the Phase 1 integration pass."""

from __future__ import annotations

from pathlib import Path

from flask import Flask, abort, redirect, send_from_directory


UI_ROOT = Path(__file__).resolve().parents[1] / "ui_static"
HTML_PAGES = {
    "index.html",
    "login.html",
    "dashboard.html",
    "defect_list.html",
    "defect_create.html",
    "defect_detail.html",
    "defect_edit.html",
    "projects.html",
    "users.html",
    "environments.html",
    "status_workflow.html",
    "reports.html",
}


def register_ui_routes(app: Flask) -> None:
    """Serve the approved static UI from the backend application."""

    @app.get("/ui")
    def ui_home():
        return redirect("/login.html")

    @app.get("/<path:page_name>")
    def ui_page(page_name: str):
        if page_name not in HTML_PAGES:
            abort(404)
        return send_from_directory(UI_ROOT, page_name)

    @app.get("/css/<path:filename>")
    def ui_css(filename: str):
        return send_from_directory(UI_ROOT / "css", filename)

    @app.get("/js/<path:filename>")
    def ui_js(filename: str):
        return send_from_directory(UI_ROOT / "js", filename)

    @app.get("/assets/<path:filename>")
    def ui_assets(filename: str):
        return send_from_directory(UI_ROOT / "assets", filename)

    @app.get("/site.webmanifest")
    def ui_manifest():
        return send_from_directory(UI_ROOT, "site.webmanifest")
