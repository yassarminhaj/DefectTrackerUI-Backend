# Defect Tracker API to Database Mapping

This document maps the live API playground endpoints to the Phase 1 PostgreSQL schema. It also records contract gaps reconciled during the first live backend pass.

## Contract Sources

- Playground: `api/defect-tracker-mock-playground.html`
- Swagger: `api/openapi.yaml`
- Database schema: `database/schema.sql`
- Live backend: `app.py`

## Global Rules

- `Authorization: Bearer ...` is accepted by the live proof backend. This pass uses lightweight demo tokens; production JWT hardening is later.
- `X-Data-Context` controls read scope for dashboard and defect list/detail where applicable: `Test`, `Prod`, `All`.
- Active operational views exclude inactive projects through `projects.is_active = true`.
- Reports are out of scope.
- Deletes are soft deletes where schema supports them.

## Endpoint Mapping

| Endpoint | Main Tables | Notes |
|---|---|---|
| `POST /api/v1/auth/login` | `app_users` | Validates active username and returns demo bearer/refresh token. Password hash is placeholder in seed data. |
| `POST /api/v1/auth/refresh` | `app_users` | Returns a refreshed demo token using default seeded user. |
| `POST /api/v1/auth/logout` | none | Returns 204; token revocation table is future work. |
| `GET /api/v1/auth/me` | `app_users` | Returns current demo user plus active context. |
| `PATCH/POST /api/v1/auth/profile` | `app_users` | Updates current user's email. Playground uses PATCH. |
| `POST /api/v1/auth/password` | `app_users`, `user_password_events` | Records password change event. Does not implement real hash verification yet. |
| `GET /api/v1/users` | `app_users` | Search, status filter, pagination. |
| `POST /api/v1/users` | `app_users`, `user_password_events` | Creates user and initial password event. |
| `PATCH /api/v1/users/{userId}` | `app_users` | Updates user profile/status/context. |
| `POST /api/v1/users/{userId}/password` | `app_users`, `user_password_events` | Admin-style password reset event. |
| `GET /api/v1/projects` | `projects` | Search and active filter. |
| `POST /api/v1/projects` | `projects` | Creates project. |
| `PATCH /api/v1/projects/{projectId}` | `projects` | Updates project. |
| `GET /api/v1/environments` | `environments` | Search, active, and scope filter. |
| `POST /api/v1/environments` | `environments` | Creates environment. `environment_scope` is inferred from `environmentName`: exactly `PROD`, `Production`, or `Live` becomes `Prod`; all other names become `Test`. |
| `PATCH /api/v1/environments/{environmentId}` | `environments` | Updates environment. `environmentScope` remains accepted as the Phase 1 admin/API override path. |
| `GET /api/v1/releases` | `releases`, `projects` | Optional project and active filters. |
| `POST /api/v1/releases` | `releases` | Creates release. |
| `PATCH /api/v1/releases/{releaseId}` | `releases` | Updates release. |
| `GET /api/v1/workflow` | `workflow_definitions`, `workflow_transitions` | Returns active workflow and transitions. |
| `POST /api/v1/workflow` | `workflow_definitions`, `workflow_transitions` | Creates a new active workflow version and regenerates transitions from diagram edges. |
| `GET /api/v1/workflow/transitions` | `workflow_definitions`, `workflow_transitions` | Returns active transitions, optionally filtered by `fromStatus`. |
| `GET /api/v1/defects` | `defects`, `projects`, `environments`, `severity_levels`, `priority_levels`, `app_users`, `releases` | Uses active project and data-context rules. |
| `POST /api/v1/defects` | `defects`, `projects`, `workflow_transitions`, `defect_history_events` | Server assigns initial status from active workflow. Before insert, returns a non-blocking `409 possible_duplicate_defect` advisory when any non-deleted defect in the same project already has the same normalized title, including Closed and Rejected records across modules and environments. Retry with `forceCreate=true` to intentionally create anyway. |
| `GET /api/v1/defects/{defectId}` | `defects` plus lookup tables, `defect_attachments`, `defect_inline_assets`, `defect_comments` | Returns detail DTO and allowed next statuses. |
| `PATCH /api/v1/defects/{defectId}` | `defects`, `workflow_transitions`, `defect_history_events` | Updates fields and writes grouped history events. |
| `DELETE /api/v1/defects/{defectId}` | `defects`, `defect_history_events` | Soft delete. |
| `GET /api/v1/defects/{defectId}/attachments` | `defect_attachments`, `app_users` | Lists non-deleted attachments. |
| `POST /api/v1/defects/{defectId}/attachments` | `defect_attachments`, `defect_history_events` | Playground sends JSON metadata stub; multipart can be added later. |
| `DELETE /api/v1/defects/{defectId}/attachments/{attachmentId}` | `defect_attachments`, `defect_history_events` | Soft delete. |
| `GET /api/v1/defects/{defectId}/attachments/{attachmentId}/content` | `defect_attachments` | Returns metadata placeholder until file storage is wired. |
| `POST /api/v1/defects/{defectId}/inline-assets` | `defect_inline_assets`, `defect_history_events` | Playground sends JSON metadata stub; multipart can be added later. |
| `PATCH /api/v1/defects/{defectId}/inline-assets/{assetId}` | `defect_inline_assets`, `defect_history_events` | Updates display dimensions. |
| `DELETE /api/v1/defects/{defectId}/inline-assets/{assetId}` | `defect_inline_assets`, `defect_history_events` | Soft delete. |
| `GET /api/v1/defects/{defectId}/inline-assets/{assetId}/content` | `defect_inline_assets` | Returns metadata placeholder until file storage is wired. |
| `GET /api/v1/defects/{defectId}/comments` | `defect_comments`, `app_users` | Lists non-deleted comments. |
| `POST /api/v1/defects/{defectId}/comments` | `defect_comments`, `defect_history_events` | Adds comment and history event. |
| `PATCH /api/v1/defects/{defectId}/comments/{commentId}` | `defect_comments`, `defect_history_events` | Updates comment and history event. |
| `DELETE /api/v1/defects/{defectId}/comments/{commentId}` | `defect_comments`, `defect_history_events` | Soft delete. |
| `GET /api/v1/defects/{defectId}/history` | `defect_history_events`, `app_users` | Returns paginated timeline. |
| `GET /api/v1/dashboard/summary` | `defects` plus lookup/master tables | Active projects and `X-Data-Context` scoped. |
| `GET /api/v1/dashboard/charts` | `defects` plus lookup/master tables | Active projects and `X-Data-Context` scoped. |

## Reconciled Gaps

- Playground uses `POST /auth/password`; the live backend and Swagger now use action-style POST.
- Playground uses `POST /users/{userId}/password`; the live backend and Swagger now use action-style POST.
- Playground uses `POST /workflow`; the live backend supports POST because saving creates a new logical workflow version.
- Playground expects create defect status to be server-assigned. The live backend ignores client `currentStatus` on create and selects the first active workflow `from_status`.
- Playground upload endpoints currently send JSON metadata stubs in Live Mode because its `HttpProvider` always sends `application/json`. Real multipart upload can be added without changing DB tables.

## Known Follow-Ups

- Replace demo bearer token logic with signed JWT and optional refresh-token/session table.
- Add real file storage and multipart handling for attachments and inline assets.
- Decide whether optimistic `If-Match`/version support requires a `version` column on mutable tables.
- Replace the compact proof backend with a structured Flask package/API service layer when the contract is approved.
