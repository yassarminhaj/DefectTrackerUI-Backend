# Defect Detail Module Test Spec

Source of truth: Defect Detail reads from PostgreSQL through authenticated API calls. Static sample markup is only the initial shell before API hydration.

## Scope

- Defect Detail uses `GET /api/v1/defects/{defectId}` for the main read model.
- History uses `GET /api/v1/defects/{defectId}/history`.
- The page renders hero metadata, badges, general information, execution details, release fields, attachments, comments, and history from API-backed data.
- Detail reads respect `X-Data-Context`: `Test`, `Prod`, `All`.
- Detail reads exclude defects from inactive projects.
- Edit/save behavior remains out of scope for this pass.

## Manual UI Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DEFECT-DETAIL-UI-001 | Open detail from Defect List | Sign in, open Defects, click a defect key. | Detail page opens and displays the selected defect's API-backed values. |
| DEFECT-DETAIL-UI-002 | Hero fields hydrate | Compare hero defect key, project, environment, assigned user, created by, title, and badges with the API data. | Hero values match the selected defect. |
| DEFECT-DETAIL-UI-003 | General tab hydrates | Open `General`. | Defect ID, project, environment, module, assignee, creator, and description render from API data. |
| DEFECT-DETAIL-UI-004 | Execution tab hydrates | Open `Execution Details`. | Steps, Expected Result, and Actual Result render from API data; steps can include stored HTML. |
| DEFECT-DETAIL-UI-005 | Attachments tab hydrates | Open `Attachments`. | API attachments render in the table, or the empty state appears. |
| DEFECT-DETAIL-UI-006 | Release tab hydrates | Open `Release`. | Release version, deployment date, fix date, and closure date render from API data or `-`. |
| DEFECT-DETAIL-UI-007 | Comments tab hydrates | Open `Comments`. | API comments render, or the empty state appears. |
| DEFECT-DETAIL-UI-008 | History tab hydrates | Open `History`. | API history timeline renders, or the empty state appears. |
| DEFECT-DETAIL-UI-009 | Context hides out-of-scope defect | Open a Test defect, switch to Prod, then reload the direct detail URL. | Page shows a clear unable/not found state rather than stale sample data. |
| DEFECT-DETAIL-UI-010 | Back/Edit links remain source-aware | Open detail from Defects and from Dashboard. | Defects-sourced visits show `Back to Defects`; Dashboard-sourced visits show `Back to Dashboard`; edit icon remains hidden for Dashboard-sourced visits and visible for Defects-sourced visits. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| DEFECT-DETAIL-API-001 | Missing auth rejects detail | `GET /api/v1/defects/{defectId}` without bearer token | `401 unauthorized`. |
| DEFECT-DETAIL-API-002 | Detail succeeds | `GET /api/v1/defects/{defectId}` with bearer token | `200`, includes detail fields, allowed statuses, attachments, inline assets, and comments. |
| DEFECT-DETAIL-API-003 | Detail respects context | Request a Test defect using `X-Data-Context: Prod` or the reverse. | `404 not_found`. |
| DEFECT-DETAIL-API-004 | Detail excludes inactive project | Request a defect from an inactive project. | `404 not_found`. |
| DEFECT-DETAIL-API-005 | History requires auth | `GET /api/v1/defects/{defectId}/history` without bearer token | `401 unauthorized`. |
| DEFECT-DETAIL-API-006 | History succeeds | `GET /api/v1/defects/{defectId}/history?page=1&pageSize=100` | `200`, includes `items` and `pagination`. |

## Regression Notes

- Do not render stale static sample values after API failure.
- Do not make the detail page mutate defect data in this pass.
- Detail page routing must continue to accept backend UUIDs from Defect List row actions.
- Context and active-project rules must match Defect List and Dashboard reads.
