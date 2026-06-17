# Environments Module Test Spec

Purpose: capture expected behavior for the wired Environments master-data slice so manual QA and later automation can verify persistence, validation, context scope inference, and active/inactive behavior.

Scope:

- Environments page load.
- Inline Add Environment.
- Inline Edit Environment.
- Environment active/inactive status.
- Test/Prod scope inference through `environment_scope`.
- PostgreSQL persistence through `environments`.

Out of scope:

- Create/Edit Defect environment dropdown filtering. This is asserted later when the defect forms are wired.
- Reports and dashboard environment charts.
- Delete/archive environment behavior.

## Preconditions

- User is authenticated.
- Application is running from `defect-tracker`.
- `.env` points to the intended PostgreSQL database through `DATABASE_URL`.
- UI is opened through Flask, not direct file open.

## Test Cases

| ID | Scenario | Steps | Expected UI/API Result | Expected DB Result |
|---|---|---|---|---|
| ENV-UI-001 | Environments list requires auth | Request `/api/v1/environments` without bearer token. | API returns `401 Authentication is required.` | No DB change. |
| ENV-UI-002 | Environments page loads from DB | Login and open Environments page. | Table rows are loaded from `GET /api/v1/environments`; hardcoded static rows are not the source of truth. | No DB change. |
| ENV-UI-003 | Empty environments result | Query returns no environments in a controlled test DB. | Table shows `No environments found.` | No DB change. |
| ENV-UI-004 | Create active Test environment | Add a uniquely named environment such as `QA-SANDBOX-<runId>`, keep Active, save. | Row appears only after API returns `201`; confirmation dialog appears. | `environments` row is inserted with `environment_scope = Test`, `is_active = true`, `created_by_user_id`, and `updated_by_user_id`. |
| ENV-UI-005 | Create inactive environment | Add Environment, choose Inactive, save. | Row appears with inactive badge. | `environments.is_active = false`. |
| ENV-UI-006 | Create Prod environment by inference | Add environment named exactly `PROD`, `Production`, or `Live` when available. | Save succeeds and API response has `environmentScope = Prod`. | `environments.environment_scope = Prod`. |
| ENV-UI-007 | Create duplicate environment | Add an environment using an existing name such as `UAT`. | UI duplicate check or API error blocks save with readable message. | No new `environments` row. |
| ENV-UI-008 | Create missing name | Click Add Environment and save without name. | Field-level validation blocks save. | No DB change. |
| ENV-UI-009 | Create long description | Enter description over 180 characters. | Field-level validation blocks save. | No DB change. |
| ENV-UI-010 | Inline edit environment text | Click Edit, change Environment Name and Description, save. | Row remains stable and renders the API response after save. | `environments.environment_name`, `description`, `environment_scope`, `updated_at`, and `updated_by_user_id` update. |
| ENV-UI-011 | Inline edit active status | Click Edit, switch Active/Inactive, save. | Badge updates after API success. | `environments.is_active` updates. |
| ENV-UI-012 | Inline edit duplicate environment name | Edit an environment to an existing environment name. | Save is rejected with readable validation; row remains in edit mode. | DB row remains unchanged. |
| ENV-UI-013 | Inline edit missing row ID | Force a row without `data-environment-id` and save. | UI shows `Environment record is missing its database id.` | No API write. |
| ENV-API-014 | Invalid API scope override | PATCH with `environmentScope = Sandbox`. | API returns `400 Environment scope must be Test or Prod.` | DB row remains unchanged. |
| ENV-API-015 | Update missing environment | PATCH a random UUID. | API returns `404 Environment not found.` | No DB change. |

## Cross-Cutting Checks

- All Environments API calls include bearer auth.
- Add/edit controls keep the same table row rhythm as the approved UI.
- Browser/localStorage is not used as the source of truth for environment rows.
- `Test` means all non-production environments; `Prod` means production only.
- Scope is inferred from submitted names unless the API explicitly receives a valid `environmentScope` override.

## Automation Notes

- Use disposable environment names with a unique `runId`.
- Delete disposable environments after cleaning dependent defects if broader integration tests create them.
- Assert both API status and direct `environments` table state for create/update cases.
