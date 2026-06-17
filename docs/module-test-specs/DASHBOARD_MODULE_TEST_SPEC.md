# Dashboard Module Test Spec

Source of truth: Dashboard data is read from PostgreSQL through authenticated API calls. `sample-data.js` is not the operational source for this module.

## Scope

- Dashboard KPI cards use `/api/v1/dashboard/summary`.
- Dashboard chart/table source records use DB-backed API reads.
- Dashboard respects `X-Data-Context`: `Test`, `Prod`, `All`.
- Dashboard excludes defects from inactive projects.
- Dashboard filters apply to the table only; KPI cards and charts remain the health overview for the current context.

## Manual UI Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DASH-UI-001 | Open dashboard after login | Sign in and open `dashboard.html`. | KPI cards, charts, and defect table load from API-backed data. |
| DASH-UI-002 | Context switch changes dashboard data | Switch context from profile menu between `Test`, `Prod`, and `All`, then reopen/refresh dashboard. | KPI and chart/table records reflect the selected context. |
| DASH-UI-003 | KPI cards remain overview | Expand Dashboard Filters and choose table filters. | KPI card values do not change from table filters. |
| DASH-UI-004 | Charts remain overview | Apply Dashboard Filters. | Existing charts do not change from table filters. |
| DASH-UI-005 | Table filters work | Apply Project, Environment, Status, Severity, Priority, Assigned To, Release, date, and search filters. | Defect Summary Table rows are filtered correctly. |
| DASH-UI-005A | Open KPI follows active workflow labels | Ensure current-context defects include records whose stored statuses include older label variants, then click `Open Defects`. | Dashboard table row count matches the Open Defects KPI; visible statuses use the active Status Workflow process-node labels. |
| DASH-UI-006 | Clear filters works | Apply filters, then click `Clear Filters`. | Table returns to the current context record set. |
| DASH-UI-007 | Table pagination works | Change pages in the dashboard defect table. | Correct page rows are displayed and page summary updates. |
| DASH-UI-008 | Table sorting works | Click sortable table headers. | Rows sort by the selected column without changing KPI/chart values. |
| DASH-UI-009 | Add chart works | Click `Add Chart`, select a type/group, and save. | New chart appears and uses DB-backed current-context records. |
| DASH-UI-010 | Remove/restore chart works | Remove a chart, then restore it from the restore dropdown. | Chart disappears and can be restored. |
| DASH-UI-011 | Move/resize chart works | Drag chart controller and resize handle. | Chart position/size changes without breaking chart rendering. |
| DASH-UI-012 | Export CSV works | Filter table and export current view. | CSV includes filtered table rows and visible columns. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| DASH-API-001 | Missing auth rejects summary | `GET /api/v1/dashboard/summary` without bearer token | `401 unauthorized`. |
| DASH-API-002 | Summary succeeds for All | `GET /api/v1/dashboard/summary` with `X-Data-Context: All` | `200`, includes `totalDefects`, `openDefects`, `fixedDefects`, `closedDefects`, `criticalDefects`, `highPriorityOpenDefects`. |
| DASH-API-003 | Summary respects Test | `GET /api/v1/dashboard/summary` with `X-Data-Context: Test` | Counts include Test-scope environments only. |
| DASH-API-004 | Summary respects Prod | `GET /api/v1/dashboard/summary` with `X-Data-Context: Prod` | Counts include Prod environment records only. |
| DASH-API-005 | Summary excludes inactive projects | Create or identify inactive-project defect, then request summary. | Inactive-project defect is not counted. |
| DASH-API-006 | Charts succeeds | `GET /api/v1/dashboard/charts` | `200`, returns Status, Severity, Project, and Environment chart datasets. |
| DASH-API-007 | Charts respects context | `GET /api/v1/dashboard/charts` with different `X-Data-Context` values | Series values change according to context. |
| DASH-API-008 | Charts support project filter | `GET /api/v1/dashboard/charts?projectId=<id>` | Series values are limited to the requested active project. |

## Regression Notes

- Do not reintroduce static sample records as the Dashboard operational source.
- Dashboard table may still filter client-side after loading DB records; this is acceptable for Phase 1 and the 10/40/100 page-size model.
- Cards and charts intentionally do not respond to Dashboard Filters.
- Active project filtering is mandatory for all Dashboard reads.
- The Status Workflow is the status source of truth. Dashboard status filters, charts, table rows, and KPI filtering should use active workflow process-node labels, with legacy stored values mapped only as a transitional compatibility layer.
