# Defect List Module Test Spec

Source of truth: Defect List data is read from PostgreSQL through authenticated API calls. `sample-data.js` is not the operational source for this module.

## Scope

- Defect List rows use `GET /api/v1/defects`.
- Defect List respects `X-Data-Context`: `Test`, `Prod`, `All`.
- Defect List excludes defects from inactive projects.
- Filters are expanded/collapsed in the UI and apply only when the user clicks `Apply Filters`.
- Status filter options come from active Status Workflow process-node labels.
- Pagination supports the approved page sizes: `10`, `40`, and `100`.
- Row actions route by backend defect ID while displaying the friendly defect key.

## Manual UI Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DEFECT-LIST-UI-001 | Open defect list after login | Sign in and open `defect_list.html`. | Table rows load from API-backed data and result count appears. |
| DEFECT-LIST-UI-002 | Filters start collapsed/expandable | Open Defects page and expand Defect Filters. | Filters expand without shifting the table awkwardly. |
| DEFECT-LIST-UI-003 | Filters apply on button click | Change Project, Environment, Status, Severity, Priority, Assigned To, Release, or Search, then click `Apply Filters`. | Rows update only after clicking `Apply Filters`. |
| DEFECT-LIST-UI-003A | Status filter uses workflow labels | Open Defect Filters and inspect Status options. | Options match the active Status Workflow process-node labels, not arbitrary stored row spellings. |
| DEFECT-LIST-UI-004 | Reset filters works | Apply filters, then click `Clear Filters`. | Filters reset and rows reload for the active context. |
| DEFECT-LIST-UI-005 | Pagination works | Change page size to `10`, `40`, and `100`, then move between pages. | Table reloads the selected page size and page summary remains accurate. |
| DEFECT-LIST-UI-006 | Sorting works | Click sortable headers. | The currently loaded rows sort without losing pagination state. |
| DEFECT-LIST-UI-007 | Context switch changes list | Switch context from profile menu and refresh/open Defects. | Rows reflect `Test`, `Prod`, or `All` context. |
| DEFECT-LIST-UI-008 | View action routes correctly | Click a defect key. | User lands on the defect detail page for the selected backend defect. |
| DEFECT-LIST-UI-009 | Edit action routes correctly | Click the edit icon beside a defect key. | User lands on the edit page for the selected backend defect. |
| DEFECT-LIST-UI-010 | Export current rows | Filter the table and export CSV. | CSV contains the DB-backed rows currently loaded on the page. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| DEFECT-LIST-API-001 | Missing auth rejects list | `GET /api/v1/defects` without bearer token | `401 unauthorized`. |
| DEFECT-LIST-API-002 | List succeeds | `GET /api/v1/defects?page=1&pageSize=10` | `200`, includes `items` and `pagination`. |
| DEFECT-LIST-API-003 | Page sizes work | `GET /api/v1/defects?pageSize=10`, `40`, and `100` | `pagination.pageSize` matches requested allowed size. |
| DEFECT-LIST-API-004 | Test context works | `GET /api/v1/defects` with `X-Data-Context: Test` | Returned defects belong to Test-scope environments. |
| DEFECT-LIST-API-005 | Prod context works | `GET /api/v1/defects` with `X-Data-Context: Prod` | Returned defects belong to Prod-scope environments. |
| DEFECT-LIST-API-006 | Project filter works | `GET /api/v1/defects?projectId=<projectId>` | Every returned row belongs to the requested project. |
| DEFECT-LIST-API-007 | Search works | `GET /api/v1/defects?search=<defectKeyOrTitle>` | Matching rows are returned. |
| DEFECT-LIST-API-008 | Inactive project exclusion works | Create or identify an inactive-project defect, then request the list. | Inactive-project defect is not returned or counted. |
| DEFECT-LIST-API-009 | Status filter uses workflow canonicalization | Request `GET /api/v1/defects?status=<activeWorkflowStatus>`. | Returned `currentStatus` values use the active workflow label even if older stored rows used spacing or legacy variants. |

## Regression Notes

- Do not reintroduce static sample records as the Defect List operational source.
- Defect List filtering must remain button-driven, not onchange-driven.
- Active project filtering is mandatory for Defect List reads.
- Row routing must use backend defect IDs; display can continue using `DF-####` keys.
- Status labels shown by the Defect List must be active workflow process-node labels.
