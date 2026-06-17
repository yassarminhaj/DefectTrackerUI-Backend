# Local Runbook

## Start The Flask App

```powershell
cd Y:\SoftwareProjects\FlaskProjects\DefectTracking\Tool_SourceCode\defect-tracker
.\.venv\Scripts\python.exe run.py
```

Open:

```text
http://127.0.0.1:5000/
```

Expected result:

```text
/ redirects to /login.html
```

## Login During Current Integration Pass

Use:

```text
Username: qa.user
Password: Welcome123
Context: Test, Prod, or All
```

Older local databases may still contain the previous placeholder password hash. If so, `Welcome123` is accepted once and the stored hash is upgraded automatically.

## Useful Local URLs

| URL | Purpose |
|---|---|
| `http://127.0.0.1:5000/` | Opens login |
| `http://127.0.0.1:5000/login.html` | Login page |
| `http://127.0.0.1:5000/dashboard.html` | Dashboard page |
| `http://127.0.0.1:5000/api/openapi.yaml` | OpenAPI contract |
| `http://127.0.0.1:5000/api/playground` | Legacy API playground |
| `http://127.0.0.1:5000/api/v1/health` | DB-backed health check |

## Quick Smoke Check

```powershell
.\.venv\Scripts\python.exe -c "from app import create_app; c=create_app().test_client(); print(c.get('/').status_code); print(c.get('/login.html').status_code); print(c.get('/api/openapi.yaml').status_code)"
```

Expected:

```text
302
200
200
```

## Notes

- Use `run.py` as the preferred entry point.
- Keep `app.py` until the legacy API is safely extracted.
- Do not edit `app/ui_static` and the standalone UI repo in parallel unless intentionally syncing UI changes.
