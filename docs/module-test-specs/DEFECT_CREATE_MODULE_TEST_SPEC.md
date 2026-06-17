# Defect Create Module Test Spec

Source of truth: Defect Create reads lookup data and writes defects through authenticated API calls. Static values are only the initial shell before API hydration.

## Scope

- Create page loads Project, Environment, Assigned To, Severity, Priority, and workflow initial status from APIs.
- Environment dropdown respects the selected data context: `Test`, `Prod`, or `All`.
- Status is displayed from the active workflow initial status; server assignment remains the source of truth.
- Save uses `POST /api/v1/defects`.
- Duplicate same-project/same-title advisory is shown before creation is forced.
- Selected files are submitted as Phase 1 attachment metadata after successful defect creation.
- Rich Steps to Replicate HTML is submitted through `stepsHtml`.

## Manual UI Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DEFECT-CREATE-UI-001 | Open create page | Sign in and open `defect_create.html`. | Form controls load DB-backed lookup values. |
| DEFECT-CREATE-UI-002 | Context controls environments | Switch context to Test, Prod, and All, then reopen Create Defect. | Environment options match the selected context. |
| DEFECT-CREATE-UI-003 | Initial status loads from workflow | Open Create Defect. | Status field shows the active workflow initial status. |
| DEFECT-CREATE-UI-004 | Create defect succeeds | Enter valid required fields and save. | Defect is created, confirmation dialog appears, and View Defect routes to detail. |
| DEFECT-CREATE-UI-005 | Duplicate advisory appears | Create a defect with the same title in the same project. | Possible duplicate dialog appears with candidates and does not create automatically. |
| DEFECT-CREATE-UI-006 | Force create duplicate | In duplicate dialog, choose Create Anyway. | Defect is created with a new defect key. |
| DEFECT-CREATE-UI-007 | Attachment metadata saves | Select accepted files and save defect. | Created defect detail includes uploaded attachment metadata. |
| DEFECT-CREATE-UI-008 | Steps HTML saves | Type/paste rich steps content and save. | Created defect detail returns stored `stepsHtml`. |
| DEFECT-CREATE-UI-009 | Validation blocks incomplete form | Clear required fields and save. | Existing validation styling appears and no API commit happens. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| DEFECT-CREATE-API-001 | Missing auth rejects create | `POST /api/v1/defects` without bearer token | `401 unauthorized`. |
| DEFECT-CREATE-API-002 | Create succeeds | `POST /api/v1/defects` with valid payload | `201`, returns `id`, `defectKey`, and server-assigned `currentStatus`. |
| DEFECT-CREATE-API-003 | Duplicate advisory appears | Create same title in same project with `forceCreate=false` | `409 possible_duplicate_defect`, includes `duplicateCandidates`. |
| DEFECT-CREATE-API-004 | Force create succeeds | Retry same payload with `forceCreate=true` | `201`, creates intentional duplicate record. |
| DEFECT-CREATE-API-005 | Attachment metadata after create | `POST /api/v1/defects/{defectId}/attachments` after create | `201`, attachment appears in detail. |
| DEFECT-CREATE-API-006 | Context-scoped detail after create | Create in Test, then read detail with Prod context or reverse. | Out-of-context read returns `404`. |

## Regression Notes

- Do not allow create to fall back to static sample records.
- Do not let the UI choose arbitrary starting statuses; active workflow/server assignment controls the initial status.
- Duplicate advisory must remain user-controlled rather than silently force-creating.
- Attachment and inline screenshot uploads use Phase 1 JSON base64 `contentDataUrl`; the API writes physical files and stores matching `storage_key` values.
