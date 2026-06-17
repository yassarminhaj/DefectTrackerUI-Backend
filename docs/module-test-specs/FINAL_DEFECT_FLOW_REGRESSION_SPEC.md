# Final Defect Flow Regression Spec

## Scope

- End-to-end defect lifecycle across the wired backend/UI API surface.
- Confirms create, child records, list, detail, edit/status workflow, release dates, dashboard, and data context boundaries.
- Uses the active saved workflow dynamically; do not hardcode workflow labels in automation.

## Regression Flow

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| FINAL-FLOW-001 | Login and load masters | Login as `qa.user`; load active projects, Test environments, users, severities, and priorities. | All master data APIs return authenticated DB-backed values. |
| FINAL-FLOW-002 | Create disposable release | Create a same-project release with planned and actual deployment dates. | Release is created and can be selected for the defect. |
| FINAL-FLOW-003 | Create defect | Create a defect with title, description, project, environment, severity, priority, assignee, steps, expected result, and actual result. | Defect is created with server-assigned initial workflow status and `defectKey`. |
| FINAL-FLOW-004 | Add child records | Add standalone attachment metadata, inline asset metadata, and a comment. | Detail payload includes attachments, inline assets, and comments. |
| FINAL-FLOW-005 | Find defect from list | Search defect list by `defectKey`. | Created defect appears in paginated list response. |
| FINAL-FLOW-006 | Verify detail and context | Read defect detail in Test and Prod contexts. | Test returns detail; Prod returns `404` for a Test defect. |
| FINAL-FLOW-007 | Move through workflow | Query allowed statuses dynamically; move to progress, fixed, bridge/test, and closed statuses. | Each move follows active workflow transitions. |
| FINAL-FLOW-008 | Verify release/date rules | Save Fixed with release/fix date; save Closed with closure date. | Release, fix date, and closure date persist and render in detail. |
| FINAL-FLOW-009 | Verify history | Read history after all actions. | History includes defect creation, attachment, inline asset, comment, assignment/status, and release events. |
| FINAL-FLOW-010 | Verify dashboard | Read dashboard summary and charts after creating the defect. | Summary count increases by one during the test; charts response includes chart definitions. |
| FINAL-FLOW-011 | Cleanup | Delete disposable child rows, defect, and release. | Database returns to pre-test state. |

## Playground Coverage Check

| ID | Scenario | Expected Result |
| --- | --- | --- |
| PLAYGROUND-COVERAGE-001 | Compare playground operation list to Flask routes by method/path template. | All 42 playground operations have live Flask route counterparts. |
| PLAYGROUND-COVERAGE-002 | List live routes not exposed in playground. | Utility/alias endpoints may remain outside playground: health, lookup helpers, allowed-statuses, duplicate method aliases. |
