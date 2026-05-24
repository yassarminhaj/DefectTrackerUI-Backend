# Defect Tracker API Contract

This folder contains the Phase 1 OpenAPI/Swagger contract for the Defect Tracking Tool.

## File

- `openapi.yaml`
- `defect-tracker-mock-playground.html`

## Decisions Captured

- API prefix: `/api/v1`
- Authentication: JWT bearer token
- Data context: `X-Data-Context` header with `Test`, `Prod`, or `All`
- Uploads: `multipart/form-data`
- Attachments allowed extensions: `png`, `jpg`, `jpeg`, `pdf`, `doc`, `docx`, `txt`, `log`, `json`, `csv`
- Inline Steps to Replicate images: `png`, `jpg`, `jpeg`
- Delete behavior: soft-delete endpoints are included, but the current UI does not expose defect delete
- Reports: excluded from Phase 1

## Suggested Review Flow

1. Review `openapi.yaml`.
2. Open `defect-tracker-mock-playground.html` in a browser to exercise the contract with mock data.
3. Confirm endpoint naming and payload shapes.
4. Baseline this contract.
5. Implement Flask routes/services against the contract.
6. Add route tests from the contract examples and current smoke-test behavior.

## Mock API Playground

`defect-tracker-mock-playground.html` is the review playground for the Phase 1 API contract. It supports mock mode now and is structured so the provider can later switch to live `/api/v1` backend calls.

Keep `openapi.yaml` as the contract source of truth and use the playground to manually exercise request/response behavior before Flask route implementation.

## Important Service-Layer Rules

- JWT identifies the user only.
- `X-Data-Context` controls Test/Prod/All data scope per request.
- Defect list and dashboard must exclude inactive projects.
- Allowed next statuses must come from `workflow_transitions`.
- Updating a defect should create `defect_history_events` rows.
- Multiple history rows from one save action should share one `event_batch_id`.
- History events are append-only.
- Reports are intentionally not part of this contract.
