# Defect Edit Module Test Spec

Source of truth: Defect Edit reads and writes through authenticated API calls. Static form values are only the initial shell before API hydration.

## Scope

- Edit page loads the selected defect from `GET /api/v1/defects/{defectId}`.
- Project, environment, assignee, release, severity, and priority controls load from DB-backed APIs.
- Status options are derived from the current defect status plus workflow-allowed next statuses.
- Save uses `PATCH /api/v1/defects/{defectId}`.
- Selected attachment files are submitted as Phase 1 attachment metadata through `POST /api/v1/defects/{defectId}/attachments`.
- Add Comment uses `POST /api/v1/defects/{defectId}/comments`.
- Edit reads and writes respect auth, active-project, and data-context rules.

## Manual UI Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DEFECT-EDIT-UI-001 | Open edit from Defect List | Sign in, open Defects, click the edit icon. | Edit page opens with the selected defect's API-backed values. |
| DEFECT-EDIT-UI-002 | Master dropdowns hydrate | Inspect Project, Environment, Assigned To, Severity, Priority, and Release controls. | Controls show DB-backed active values and selected defect values. |
| DEFECT-EDIT-UI-003 | Status options follow workflow | Open a defect in a known status. | Status dropdown shows the current status plus workflow-allowed next statuses only. |
| DEFECT-EDIT-UI-004 | Save general fields | Change title, description, module, severity, priority, or assignee and save. | API commit succeeds and refreshed values remain visible. |
| DEFECT-EDIT-UI-005 | Save execution fields | Change steps, expected result, and actual result and save. | API commit succeeds and stored values reload. |
| DEFECT-EDIT-UI-006 | Attach file metadata | Choose an accepted file and save. | Attachment table refreshes with the uploaded metadata row. |
| DEFECT-EDIT-UI-007 | Add comment | Enter a comment and click Add Comment. | Comment appears and history refreshes. |
| DEFECT-EDIT-UI-008 | Validation blocks missing required fields | Clear required fields and save. | Existing validation styling appears and no API commit happens. |
| DEFECT-EDIT-UI-009 | Context-hidden edit rejected | Open a direct edit URL for a defect outside the selected context. | Page shows a load error or save returns not found; stale sample values are not committed. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| DEFECT-EDIT-API-001 | Missing auth rejects update | `PATCH /api/v1/defects/{defectId}` without bearer token | `401 unauthorized`. |
| DEFECT-EDIT-API-002 | Update succeeds | `PATCH /api/v1/defects/{defectId}` with valid editable fields | `200`, returned detail reflects changes. |
| DEFECT-EDIT-API-003 | Invalid workflow transition rejected | Patch `currentStatus` to a disallowed status. | `400 invalid_status_transition`. |
| DEFECT-EDIT-API-004 | Context-hidden update rejected | Patch a Test defect with `X-Data-Context: Prod` or reverse. | `404 not_found`. |
| DEFECT-EDIT-API-005 | Attachment metadata succeeds | `POST /api/v1/defects/{defectId}/attachments` with file metadata | `201`, attachment appears in refreshed detail. |
| DEFECT-EDIT-API-006 | Comment add succeeds | `POST /api/v1/defects/{defectId}/comments` with comment text | `201`, comment appears in refreshed detail and history. |
| DEFECT-EDIT-API-007 | Lookups require auth | GET lookup/master endpoints without bearer token | `401 unauthorized`. |

## Regression Notes

- Do not allow edit save to fall back to static sample data.
- Do not show decision nodes as statuses; status options must remain workflow/process-status based.
- Attachment and inline screenshot uploads use Phase 1 JSON base64 `contentDataUrl`; the API writes physical files and stores matching `storage_key` values.
- Release Version is typed and Release Deployment Date is selected on the defect during Phase 1; release master orchestration is future-phase work.
