# Defect Tracker API to Database Mapping

This document maps the live API playground endpoints to the Phase 1 PostgreSQL schema. It also records contract gaps reconciled during the first live backend pass.

## Contract Sources

- Playground: `api/defect-tracker-mock-playground.html`
- Swagger: `api/openapi.yaml`
- Database schema: `database/schema.sql`
- Live backend: `app.py`

## Global Rules

- `Authorization: Bearer ...` is accepted by the live proof backend. This pass uses lightweight demo tokens with server-side access-token expiry; production JWT hardening is later.
- `X-Data-Context` controls read scope for dashboard and defect list/detail where applicable: `Test`, `Prod`, `All`. When it is omitted, authenticated reads use `app_users.default_data_context`.
- Active operational views exclude inactive projects through `projects.is_active = true`.
- Reports are out of scope.
- Deletes are soft deletes where schema supports them.

## Endpoint Mapping

| Endpoint | Main Tables | Notes |
|---|---|---|
| `POST /api/v1/auth/login` | `app_users` | Validates active username/password and returns lightweight Phase 1 bearer/refresh tokens. Access tokens expire server-side after 30 minutes. Optional `dataContext` overrides the user's saved default for the session. |
| `POST /api/v1/auth/refresh` | `app_users` | Validates the lightweight refresh token and returns a new access/refresh token pair for that user. |
| `POST /api/v1/auth/logout` | none | Returns 204; UI calls this before clearing local session. Refresh-token revocation table is future work. |
| `GET /api/v1/auth/me` | `app_users` | Requires bearer token and returns current user plus default and active contexts. |
| `PATCH/POST /api/v1/auth/profile` | `app_users` | Updates current user's email. Playground uses PATCH. |
| `POST /api/v1/auth/password` | `app_users`, `user_password_events` | Verifies current password, updates password hash, and records password change event. |
| `GET /api/v1/users` | `app_users` | Search, status filter, pagination. |
| `POST /api/v1/users` | `app_users`, `user_password_events` | Creates user and initial password event. |
| `PATCH /api/v1/users/{userId}` | `app_users` | Updates user profile/status/context. |
| `POST /api/v1/users/{userId}/password` | `app_users`, `user_password_events` | Verifies previous password, updates the selected user's hash, and records a reset event. |
| `GET /api/v1/projects` | `projects` | Search and active filter. |
| `POST /api/v1/projects` | `projects` | Creates project. |
| `PATCH /api/v1/projects/{projectId}` | `projects` | Updates project. |
| `GET /api/v1/environments` | `environments` | Search, active, and scope filter. |
| `POST /api/v1/environments` | `environments` | Creates environment. `environment_scope` is inferred from `environmentName`: exactly `PROD`, `Production`, or `Live` becomes `Prod`; all other names become `Test`. |
| `PATCH /api/v1/environments/{environmentId}` | `environments` | Updates environment. Submitted names infer scope the same way as create; `environmentScope` remains accepted as the Phase 1 admin/API override path. |
| `GET /api/v1/releases` | `releases`, `projects` | Authenticated read. Optional project and active filters. |
| `POST /api/v1/releases` | `releases` | Authenticated create. Validates active project, version, duplicate project/version, and deployment date order. |
| `PATCH /api/v1/releases/{releaseId}` | `releases` | Authenticated update. Validates active project, version, duplicate project/version, and deployment date order. |
| `GET /api/v1/lookups/severities` | `severity_levels` | Authenticated read of active severity lookup values. |
| `GET /api/v1/lookups/priorities` | `priority_levels` | Authenticated read of active priority lookup values. |
| `GET /api/v1/workflow` | `workflow_definitions`, `workflow_transitions` | Authenticated read of the active workflow diagram and generated transitions. |
| `POST /api/v1/workflow` | `workflow_definitions`, `workflow_transitions` | Authenticated save. Validates process-node labels and edges, creates a new active workflow version, and regenerates transitions from diagram arrows. |
| `GET /api/v1/workflow/transitions` | `workflow_definitions`, `workflow_transitions` | Authenticated lookup of allowed next statuses for required `fromStatus`. Terminal statuses return an empty allowed list. |
| `GET /api/v1/defects` | `defects`, `projects`, `environments`, `severity_levels`, `priority_levels`, `app_users`, `releases` | Authenticated read. Uses active project and data-context rules. Supports project, environment, status, severity, priority, assignee, release, search, and `10/40/100` page-size filters. |
| `POST /api/v1/defects` | `defects`, `projects`, `workflow_transitions`, `defect_history_events` | Authenticated create. Server assigns initial status from active workflow. Before insert, returns a non-blocking `409 possible_duplicate_defect` advisory when any non-deleted defect in the same project already has the same normalized title, including Closed and Rejected records across modules and environments. Retry with `forceCreate=true` to intentionally create anyway. |
| `GET /api/v1/defects/{defectId}` | `defects` plus lookup tables, `defect_attachments`, `defect_inline_assets`, `defect_comments` | Authenticated read. Returns detail DTO and allowed next statuses. Uses active project and data-context rules. |
| `GET /api/v1/defects/{defectId}/allowed-statuses` | `defects`, `workflow_transitions` | Authenticated, active-project, data-context-scoped utility read. Returns only current status and allowed next statuses for AJAX refresh use. Phase 1 UI gets `allowedNextStatuses` from defect detail; this endpoint is intentionally retained for Phase 2 partial refresh flows. |
| `PATCH /api/v1/defects/{defectId}` | `defects`, `workflow_transitions`, `releases`, `defect_history_events` | Authenticated update. Uses active project and data-context rules, validates workflow transitions, validates status-driven release/date fields, and writes grouped history events. |
| `DELETE /api/v1/defects/{defectId}` | `defects`, `defect_history_events` | Soft delete. |
| `GET /api/v1/defects/{defectId}/attachments` | `defect_attachments`, `app_users` | Authenticated, active-project, data-context-scoped read. Lists non-deleted attachments. |
| `POST /api/v1/defects/{defectId}/attachments` | `defect_attachments`, `defect_history_events`, filesystem storage | Authenticated, scoped JSON upload. Requires base64 file content through `contentDataUrl`, validates filename, approved extension, and 5 MB maximum size, writes the physical file under `FILE_STORAGE_ROOT`, and stores the matching `storage_key` in the database. |
| `DELETE /api/v1/defects/{defectId}/attachments/{attachmentId}` | `defect_attachments`, `defect_history_events` | Authenticated, scoped soft delete. |
| `GET /api/v1/defects/{defectId}/attachments/{attachmentId}/content` | `defect_attachments`, filesystem storage | Authenticated, scoped read. Streams the stored file from `storage_key` as a download and returns `file_missing` if the database key no longer points to a physical file. |
| `POST /api/v1/defects/{defectId}/inline-assets` | `defect_inline_assets`, `defect_history_events`, filesystem storage | Authenticated, scoped JSON upload for pasted Steps screenshots. Requires base64 image content through `contentDataUrl`, validates png/jpg/jpeg type and size/dimension limits, writes the physical file under `FILE_STORAGE_ROOT`, and stores the matching `storage_key` in the database. |
| `PATCH /api/v1/defects/{defectId}/inline-assets/{assetId}` | `defect_inline_assets`, `defect_history_events` | Authenticated, scoped update of positive display dimensions. |
| `DELETE /api/v1/defects/{defectId}/inline-assets/{assetId}` | `defect_inline_assets`, `defect_history_events` | Authenticated, scoped soft delete. |
| `GET /api/v1/defects/{defectId}/inline-assets/{assetId}/content` | `defect_inline_assets`, filesystem storage | Authenticated, scoped read. Streams the stored inline image from `storage_key` with its image content type and returns `file_missing` if the database key no longer points to a physical file. |
| `GET /api/v1/defects/{defectId}/comments` | `defect_comments`, `app_users` | Authenticated, active-project, data-context-scoped read. Lists non-deleted comments. |
| `POST /api/v1/defects/{defectId}/comments` | `defect_comments`, `defect_history_events` | Authenticated, scoped create. Validates required text and 2000-character maximum. |
| `PATCH /api/v1/defects/{defectId}/comments/{commentId}` | `defect_comments`, `defect_history_events` | Authenticated, scoped update. Validates required text and 2000-character maximum. |
| `DELETE /api/v1/defects/{defectId}/comments/{commentId}` | `defect_comments`, `defect_history_events` | Authenticated, scoped soft delete. |
| `GET /api/v1/defects/{defectId}/history` | `defect_history_events`, `app_users` | Authenticated, active-project, data-context-scoped read. Returns paginated timeline. |
| `GET /api/v1/dashboard/summary` | `defects`, `projects`, `environments`, `severity_levels`, `priority_levels` | Authenticated read. Active projects and `X-Data-Context` scoped. Returns KPI counts including high-priority open defects. |
| `GET /api/v1/dashboard/charts` | `defects`, `projects`, `environments`, `severity_levels` | Authenticated read. Active projects and `X-Data-Context` scoped. Optional query filters can narrow chart datasets for API/test use. |

## Reconciled Gaps

- Playground uses `POST /auth/password`; the live backend and Swagger now use action-style POST.
- Playground uses `POST /users/{userId}/password`; the live backend and Swagger now use action-style POST.
- Playground uses `POST /workflow`; the live backend supports POST because saving creates a new logical workflow version.
- Playground expects create defect status to be server-assigned. The live backend ignores client `currentStatus` on create and selects the first active workflow `from_status`.
- UI upload endpoints use JSON with base64 `contentDataUrl` in Phase 1 because the current static UI/API layer posts `application/json`. The backend treats metadata-only upload requests as invalid so `defect_attachments.storage_key` and `defect_inline_assets.storage_key` remain synchronized with real files on disk. Real multipart upload can be added later without changing DB tables.

## Phase 2 Utility And Alias Endpoints

These live routes are intentionally not all exposed as separate playground operations in Phase 1:

- `GET /api/v1/health`: deployment and smoke-test health check.
- `GET /api/v1/lookups/severities` and `GET /api/v1/lookups/priorities`: lightweight dropdown lookups used by the UI.
- `GET /api/v1/defects/{defectId}/allowed-statuses`: partial-refresh/AJAX helper for status controls. Current Phase 1 screens use `allowedNextStatuses` from `GET /api/v1/defects/{defectId}`, but this helper is retained for future UI flows that should refresh only the status options without reloading the full defect payload.
- Method aliases such as `PATCH /api/v1/auth/password`, `POST /api/v1/auth/profile`, `PATCH /api/v1/users/{userId}/password`, and `PUT /api/v1/workflow`: compatibility aliases around the preferred action endpoints. Phase 1 playground shows the preferred method, while aliases remain available for client compatibility.

## Known Follow-Ups

- Replace demo bearer token logic with signed JWT and a server-side refresh-token/session revocation table.
- Add multipart upload support if/when the UI moves away from JSON base64 uploads.
- Decide whether optimistic `If-Match`/version support requires a `version` column on mutable tables.
- Replace the compact proof backend with a structured Flask package/API service layer when the contract is approved.
