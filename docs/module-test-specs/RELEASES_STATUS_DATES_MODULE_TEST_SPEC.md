# Releases And Status-Driven Dates Module Test Spec

## Scope

- Release master API validation remains available for future release management work.
- Edit defect typed Release Version and developer-selected deployment date behavior.
- Status-driven required fields for `Fixed` and `Closed`.
- Defect release/date values in detail/list/dashboard-facing payloads.

## UI Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| RELEASE-DATE-UI-001 | Release Version is typed | Open `defect_edit.html?id={defectId}` and view the Release tab. | Release Version is a text field, not a dropdown. |
| RELEASE-DATE-UI-002 | Deployment date is selected by developer | Open the Release tab. | Release Deployment Date is an editable date field, not a readonly value derived from a release record. |
| RELEASE-DATE-UI-003 | Fixed status requires release fields | Set Status to `Fixed`, leave Release Version, Release Deployment Date, or Fix Date blank, click Save. | UI validation blocks save with release/deployment/fix-date messages. |
| RELEASE-DATE-UI-004 | Closed status requires closure date | Set Status to `Closed`, leave Closure Date blank, click Save. | UI validation blocks save with Closure Date message. |
| RELEASE-DATE-UI-005 | Closure date cannot precede fix date | Enter Closure Date before Fix Date and click Save. | UI validation blocks save. |
| RELEASE-DATE-UI-006 | Detail page renders release fields | Save a defect with release/fix/closure data and open detail. | Release Version, Release Deployment Date, Fix Date, and Closure Date render from API data. |
| RELEASE-DATE-UI-007 | Fix date cannot be future dated | Enter tomorrow as Fix Date and click Save. | UI validation blocks save with Fix Date message. |
| RELEASE-DATE-UI-008 | Closure date locked until Closed | Open edit page with any non-Closed status, then inspect Closure Date. | Closure Date is disabled; changing Status to `Closed` enables it. |
| RELEASE-DATE-UI-009 | Release helper is understandable | Open Release tab after project is loaded. | Helper text explains the fields are required when Status is `Fixed` so testers can plan validation. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| RELEASE-DATE-API-001 | Create release succeeds | `POST /api/v1/releases` with valid project/version/dates | `201`, release row is created. |
| RELEASE-DATE-API-002 | Create release rejects missing project | `POST /api/v1/releases` without project | `400 validation_error`. |
| RELEASE-DATE-API-003 | Create release rejects invalid project | `POST /api/v1/releases` with missing project id | `404 not_found`. |
| RELEASE-DATE-API-004 | Create release rejects duplicate version | Same project and release version as existing release | `400 validation_error`. |
| RELEASE-DATE-API-005 | Create release rejects invalid date order | Actual Deployment Date before Planned Deployment Date | `400 validation_error`. |
| RELEASE-DATE-API-006 | Move to Fixed requires release version, deployment date, and fix date | `PATCH /api/v1/defects/{id}` to `Fixed` without `releaseVersion`, `releaseDeploymentDate`, or `fixDate` | `400 validation_error`. |
| RELEASE-DATE-API-007 | Move to Fixed succeeds with typed release details | `PATCH /api/v1/defects/{id}` to `Fixed` with `releaseVersion`, `releaseDeploymentDate`, and valid `fixDate` | `200`, status and defect-level release/date fields are saved. |
| RELEASE-DATE-API-008 | Release Version length is limited | `PATCH /api/v1/defects/{id}` with an over-80-character `releaseVersion` | `400 validation_error`. |
| RELEASE-DATE-API-009 | Move to Closed requires closure date | `PATCH /api/v1/defects/{id}` to `Closed` without closure date | `400 validation_error`. |
| RELEASE-DATE-API-010 | Closure date must follow fix date | `PATCH /api/v1/defects/{id}` with closure before fix date | `400 validation_error`. |
| RELEASE-DATE-API-011 | Future fix date rejected | `PATCH /api/v1/defects/{id}` with tomorrow as `fixDate` | `400 validation_error`. |
| RELEASE-DATE-API-012 | Closure date rejected outside Closed | `PATCH /api/v1/defects/{id}` with `closureDate` while target status is not `Closed` | `400 validation_error`. |

## Notes For Automation

- Use typed `releaseVersion` and `releaseDeploymentDate` values for defect edit tests; do not depend on release master rows for Phase 1 defect fixing.
- Use a disposable defect and move it through the configured workflow before asserting `Fixed` or `Closed`.
- The default workflow currently uses `Assigned -> InProgress -> Fixed -> Test -> Closed`; tests must follow valid transitions.
- Release Deployment Date is stored directly on `defects.release_deployment_date` for Phase 1.
