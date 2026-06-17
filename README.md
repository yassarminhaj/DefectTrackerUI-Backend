# Defect Tracker Backend Integration

This repository is the working backend application for the Defect Tracker product.
It now serves both:

- the Flask API under `/api/v1`
- the approved static UI from `app/ui_static`

The frozen standalone UI reference remains in the separate `DefectTrackerUI` repository.

## Current Branch

Active integration branch:

```text
feature/ui-api-integration
```

## Run Locally

From this folder:

```powershell
cd Y:\SoftwareProjects\FlaskProjects\DefectTracking\Tool_SourceCode\defect-tracker
.\.venv\Scripts\python.exe run.py
```

Then open:

```text
http://127.0.0.1:5000/
```

The root URL redirects to:

```text
http://127.0.0.1:5000/login.html
```

## Current Login Behavior

The UI is wired to:

```text
POST /api/v1/auth/login
```

Current seeded username:

```text
qa.user
```

Current seeded password:

```text
Welcome123
```

`admin/admin` does not work because `admin` is not a seeded user.

Older local databases may still contain the previous Phase 1 placeholder hash. For compatibility, the backend accepts `Welcome123` for placeholder users and upgrades the stored value to a real Werkzeug hash after successful login.

## Important Entry Points

| File / Folder | Purpose |
|---|---|
| `run.py` | Preferred local Flask entry point |
| `app.py` | Legacy monolithic API implementation, kept during gradual extraction |
| `app/__init__.py` | App factory bridge that wraps the legacy app |
| `app/routes/ui.py` | Serves the approved UI pages/assets |
| `app/ui_static/` | Backend-owned copy of the approved static UI |
| `database/` | PostgreSQL schema, seed, smoke, and maintenance scripts |
| `api/` | OpenAPI contract and legacy API playground |

## Current UI Routes

```text
/
/login.html
/dashboard.html
/defect_list.html
/defect_create.html
/defect_detail.html
/defect_edit.html
/projects.html
/users.html
/environments.html
/status_workflow.html
```

`reports.html` exists in the copied UI but remains out of Phase 1 navigation/scope.

## Working Rule

We wire the app page by page, control by control, API by API.
After every pass, run a quick check and pause before proceeding.
