# Comments And History Module Test Spec

## Scope

- Defect comment list/create/update/delete API behavior.
- Edit-page Add Comment UI behavior.
- Defect history read-only timeline behavior.
- Authenticated active-project and data-context boundaries for comments and history.

## UI Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| COMMENT-HISTORY-UI-001 | Detail comments are read-only | Open `defect_detail.html?id={defectId}` and view Comments tab. | Existing comments render; no Add Comment control is shown. |
| COMMENT-HISTORY-UI-002 | Edit page adds a valid comment | Open `defect_edit.html?id={defectId}`, enter a comment, click Add Comment. | Comment appears in the comments tab and history refreshes with a comment event. |
| COMMENT-HISTORY-UI-003 | Empty comment is blocked | Click Add Comment with an empty comment box. | UI validation blocks the request and shows a required-field message. |
| COMMENT-HISTORY-UI-004 | Very long comment is blocked | Enter more than 2000 characters and click Add Comment. | UI validation blocks the request and shows a maximum-length message. |
| COMMENT-HISTORY-UI-005 | History renders latest events | Open History tab after updating a defect/comment. | Timeline shows event title, field/change text, timestamp, and actor where available. |
| COMMENT-HISTORY-UI-006 | Context-hidden defect blocks comments/history | Open a Test defect while current context is Prod. | Detail/edit load fails with the standard defect-not-found state. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| COMMENT-HISTORY-API-001 | List comments requires auth | `GET /api/v1/defects/{id}/comments` without bearer token | `401 unauthorized`. |
| COMMENT-HISTORY-API-002 | Add valid comment | `POST /api/v1/defects/{id}/comments` with `commentText` | `201`, row is created, `comment_added` history event is created. |
| COMMENT-HISTORY-API-003 | Add empty comment rejected | `POST /api/v1/defects/{id}/comments` with empty text | `400 validation_error`, no comment row. |
| COMMENT-HISTORY-API-004 | Add overlong comment rejected | `POST /api/v1/defects/{id}/comments` with more than 2000 characters | `400 validation_error`, no comment row. |
| COMMENT-HISTORY-API-005 | Update valid comment | `PATCH /api/v1/defects/{id}/comments/{commentId}` with text | `200`, row is updated, `comment_updated` history event is created. |
| COMMENT-HISTORY-API-006 | Update empty comment rejected | `PATCH /api/v1/defects/{id}/comments/{commentId}` with empty text | `400 validation_error`, original comment remains unchanged. |
| COMMENT-HISTORY-API-007 | Delete comment soft deletes | `DELETE /api/v1/defects/{id}/comments/{commentId}` | `204`, row remains with `is_deleted=true`, `comment_deleted` history event is created. |
| COMMENT-HISTORY-API-008 | History requires auth | `GET /api/v1/defects/{id}/history` without bearer token | `401 unauthorized`. |
| COMMENT-HISTORY-API-009 | History invalid defect rejected | `GET /api/v1/defects/{missingId}/history` | `404 not_found`. |
| COMMENT-HISTORY-API-010 | Comments/history respect context | Use `X-Data-Context: Prod` against a Test defect | `404 not_found`. |

## Notes For Automation

- Create disposable defects and comments inside the test run.
- Verify `defect_comments` and `defect_history_events` after write operations.
- Use `X-Data-Context` explicitly for positive and negative boundary tests.
- Comment edit/delete UI controls are intentionally not exposed in Phase 1.
