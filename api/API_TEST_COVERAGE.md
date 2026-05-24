# API Test Coverage Tracker

This document tracks the current live API contract coverage for the Defect Tracking Tool backend and the test-case catalog that will feed the API automation framework.

It is intentionally separate from generated execution results. Test cases are stable catalog artifacts; execution results will be produced per run by the automation framework.

## Current Baseline

- API baseline source: `api/openapi.yaml` and `api/defect-tracker-mock-playground.html`
- Backend baseline source: `app.py`
- Database baseline source: `database/schema.sql`
- Reports: out of scope for Phase 1
- Test catalog format: module-wise JSON files
- Execution result storage: separate from test catalog
- DB validation style in test catalog: logical assertions only, no raw SQL

## Live API Contract Coverage

The current playground/live API exposes 42 endpoints across 12 modules.

| Module | Endpoints | Planned Phase 1 Test Cases | Coverage Intent |
|---|---:|---:|---|
| Auth | 6 | 12 | Login, refresh, logout, profile read/update, password change, auth failures |
| Users | 4 | 12 | List/create/update/reset password, duplicate username/email, validation, actor attribution |
| Projects | 3 | 9 | List/create/update, duplicate project name, active/inactive behavior |
| Environments | 3 | 11 | List/create/update, inferred Test/Prod scope, duplicate environment name, invalid scope override |
| Releases | 3 | 9 | List/create/update, project linkage, duplicate release per project |
| Workflow | 3 | 11 | Load/save workflow, transition lookup, invalid status, regenerated transitions |
| Defects | 5 | 15 | List/create/detail/update/delete, context filtering, duplicate advisory, workflow transition validation, history |
| Attachments | 4 | 10 | List/upload/delete/content placeholder, invalid defect, unsupported files, soft delete |
| Inline Assets | 4 | 9 | Upload/update/delete/content placeholder, invalid dimensions, soft delete |
| Comments | 4 | 10 | List/add/update/delete, invalid comment, soft delete, history |
| History | 1 | 5 | Timeline read, invalid defect, event visibility after defect actions |
| Dashboard | 2 | 8 | Summary/chart context filtering, active project filtering, query stability |
| **Total** | **42** | **121** | Practical Phase 1 coverage, expandable later |

The generated case count is the initial catalog baseline. It can be expanded later if risk, defects, or automation results justify deeper coverage.

## Database Coverage

The Phase 1 schema currently has 14 tables.

| DB Area | Tables | API Coverage Level | Notes |
|---|---|---|---|
| Users and security | `app_users`, `user_password_events` | High | Covered through auth, user management, profile, and password APIs |
| Project scope | `projects`, `environments`, `releases` | High | Covered through master APIs and defect/dashboard filtering |
| Lookup levels | `severity_levels`, `priority_levels` | Medium | Read indirectly through defects/dashboard; direct maintenance APIs are not present in Phase 1 |
| Workflow | `workflow_definitions`, `workflow_transitions` | High | Covered through workflow save/load and transition lookup |
| Defects | `defects` | High | Covered through defect CRUD, filters, context, and duplicate advisory |
| Defect supporting records | `defect_inline_assets`, `defect_attachments`, `defect_comments`, `defect_history_events` | High | Covered through respective APIs and logical DB assertions |

DB checks in the JSON test catalog should remain logical, for example:

- `record_created`
- `record_updated`
- `soft_deleted`
- `history_event_created`
- `workflow_transition_regenerated`
- `context_filter_applied`

Raw SQL verification belongs to the separate DB test activity.

## Test Case File Structure

Planned files:

```text
api/test-cases/
  global.setup.json
  auth.testcases.json
  users.testcases.json
  projects.testcases.json
  environments.testcases.json
  releases.testcases.json
  workflow.testcases.json
  defects.testcases.json
  attachments.testcases.json
  inline-assets.testcases.json
  comments.testcases.json
  history.testcases.json
  dashboard.testcases.json
```

Each module file should contain only test definitions. Execution results will be stored in a separate run-output artifact by the automation framework.

## Automation Scope

| Coverage Type | Phase 1 Handling |
|---|---|
| Positive API behavior | Automated |
| Expected validation errors | Automated |
| Auth/security negative checks | Automated |
| Crash-resistance negative checks | Automated where deterministic |
| Logical DB side effects | Captured as logical assertions in JSON |
| Raw DB validation | Separate DB testing activity |
| UI validation | Separate UI testing activity |
| Reports | Not covered in Phase 1 |

## Closure Metrics To Report Later

At Phase 1 closure, update this section with actual counts:

| Area | Total Scope | Automated | Manual | Not Covered | Notes |
|---|---:|---:|---:|---:|---|
| API endpoints | 42 | TBD | TBD | TBD | Based on generated JSON catalog and execution results |
| API test cases | 121 generated | 121 planned for automation | TBD | 0 | Execution results will decide pass/fail and any manual carry-forward |
| DB tables | 14 | Logical coverage TBD | Raw DB testing TBD | TBD | DB assertions are logical in API catalog |
| UI pages | TBD | TBD | TBD | TBD | To be updated from UI test coverage activity |

## Current Decisions

- Use module-wise JSON test catalogs.
- Use `global.setup.json` for shared login and baseline variables.
- Use dynamic variables such as `{{global.accessToken}}`, `{{global.activeProjectId}}`, and `{{createdDefectId}}`.
- Use current live API behavior, not ideal future behavior.
- Keep execution results separate from test definitions.
- Keep DB assertions logical in API tests.
- Target 8-15 practical cases per major module for Phase 1, then expand only if risk or defects justify deeper coverage.

## Generated Catalog Summary

| File | Test Cases |
|---|---:|
| `auth.testcases.json` | 12 |
| `users.testcases.json` | 12 |
| `projects.testcases.json` | 9 |
| `environments.testcases.json` | 11 |
| `releases.testcases.json` | 9 |
| `workflow.testcases.json` | 11 |
| `defects.testcases.json` | 15 |
| `attachments.testcases.json` | 10 |
| `inline-assets.testcases.json` | 9 |
| `comments.testcases.json` | 10 |
| `history.testcases.json` | 5 |
| `dashboard.testcases.json` | 8 |
| **Total** | **121** |

Current-live security and validation gaps are documented as test cases where the proof-layer API accepts behavior that should later be hardened, such as missing bearer tokens, username-only login, empty comment text, and permissive inline asset metadata.
