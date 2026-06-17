# Defect Tracker Integration Plan

This plan tracks the final stitching work that turns the static UI and mock API foundation into a fully functioning Flask/PostgreSQL application.

## Ground Rules

- Work inside `defect-tracker` only.
- Keep the static UI repository as the frozen design reference.
- Do not redesign UI while wiring.
- Wire one page/control/API slice at a time.
- Test after every pass.
- Keep `app.py` until routes are safely extracted into package modules.

## Completed

### Step 3 - Backend Structure Bridge

- Added `app/__init__.py`.
- Added placeholder package folders:
  - `app/routes`
  - `app/services`
  - `app/repositories`
  - `app/validators`
- Added `run.py`.
- Preserved existing API behavior.

### Step 4 Pass 1 - Serve UI From Backend

- Copied approved static UI into `app/ui_static`.
- Added `app/routes/ui.py`.
- Served UI pages and assets through Flask.
- Confirmed `/login.html`, `/dashboard.html`, CSS, JS, icons, and OpenAPI route load.

### Step 4 Pass 2 - Login UI Wiring

- Converted the login control into a submit button.
- Wired login submit to `POST /api/v1/auth/login`.
- Stored token, refresh token, user summary, and selected data context.
- Added simple page auth guard and logout auth clearing.

### Step 4 Pass 3 - Launch Clarity

- Root URL now redirects to `/login.html`.
- Added project README and runbook documentation.

### Step 4 Pass 4 - Auth Hardening

- Replace placeholder password behavior with Werkzeug password hashing.
- Seed or migrate `qa.user` to a known local dev password.
- Verify:
  - valid username/password succeeds
  - invalid password fails
  - inactive user fails
  - logout clears client session

### Step 4 Pass 5 - Profile Modal API Wiring

- Wire profile email update to `PATCH /api/v1/auth/profile`.
- Wire profile password update to `POST /api/v1/auth/password`.
- Update stored user/email after success.
- Verify:
  - email-only update succeeds
  - password-only update succeeds
  - wrong current password fails
  - mismatched confirmation fails
  - login works with the changed password
  - password can be restored to `Welcome123`

### Step 4 Pass 6-8 - Auth, Context, And Users Module

- Completed auth refresh/logout/me/profile/password wiring.
- Completed default data context behavior:
  - no login context selection uses `app_users.default_data_context`
  - explicit login selection is a session override only
  - Add User captures initial default context
- Completed Users page wiring:
  - list from `GET /api/v1/users`
  - create through `POST /api/v1/users`
  - inline edit through `PATCH /api/v1/users/{userId}`
  - password reset through `POST /api/v1/users/{userId}/password`
- Added module verification spec at `docs/module-test-specs/AUTH_USERS_MODULE_TEST_SPEC.md`.

## Next Recommended Pass

### Step 5 Pass 1 - Projects Master Data Wiring

- Completed Projects page wiring to `/api/v1/projects`.
- Preserved the approved inline add/edit UI.
- Confirmed active/inactive projects persist to PostgreSQL.
- Added module verification spec at `docs/module-test-specs/PROJECTS_MODULE_TEST_SPEC.md`.

### Step 5 Pass 2 - Environments Master Data Wiring

- Completed Environments page wiring to `/api/v1/environments`.
- Preserved the approved inline add/edit UI.
- Confirmed environment scope inference: `PROD`, `Production`, and `Live` become `Prod`; all other names become `Test`.
- Confirmed active/inactive environments persist to PostgreSQL.
- Added module verification spec at `docs/module-test-specs/ENVIRONMENTS_MODULE_TEST_SPEC.md`.

### Step 5 Pass 3 - Status Workflow Wiring

- Completed Status Workflow page wiring to `/api/v1/workflow`.
- Preserved the approved minimal process-node visual workflow editor.
- Confirmed save persists the diagram JSON to PostgreSQL and regenerates `workflow_transitions` from arrows.
- Confirmed workflow transition lookup returns allowed next statuses and terminal statuses return no next status.
- Added module verification spec at `docs/module-test-specs/STATUS_WORKFLOW_MODULE_TEST_SPEC.md`.

### Step 5 Pass 4 - Dashboard Read Model Wiring

- Completed Dashboard summary card wiring to `/api/v1/dashboard/summary`.
- Completed Dashboard chart/table data wiring to DB-backed API reads.
- Preserved active-project and data-context filtering.
- Kept Dashboard filters scoped to the table; KPI cards and charts remain the current context health overview.
- Confirmed Dashboard page no longer relies on static sample records for operational data.
- Added module verification spec at `docs/module-test-specs/DASHBOARD_MODULE_TEST_SPEC.md`.

### Step 6 Pass 1 - Defect List Wiring

- Completed Defect List filters and pagination wiring to `/api/v1/defects`.
- Preserved the approved expandable filter panel and table styling.
- Kept Defect List filters button-driven through `Apply Filters`.
- Confirmed active-project and data-context filtering.
- Confirmed page-size options `10`, `40`, and `100`.
- Confirmed row actions route by backend defect ID into detail/edit pages.
- Added module verification spec at `docs/module-test-specs/DEFECT_LIST_MODULE_TEST_SPEC.md`.

### Step 6 Pass 2 - Defect Detail Read-Only Wiring

- Completed Defect Detail read model wiring to `GET /api/v1/defects/{defectId}`.
- Loaded hero metadata, tabs, attachments, comments, and history from API-backed records.
- Preserved the approved tabbed detail layout and product theme.
- Confirmed detail reads respect auth, active-project, and data-context rules.
- Kept editing behavior out of scope until the next edit pass.
- Added module verification spec at `docs/module-test-specs/DEFECT_DETAIL_MODULE_TEST_SPEC.md`.

### Step 6 Pass 3 - Defect Edit Wiring

- Completed `defect_edit.html` wiring to load editable defect data from `GET /api/v1/defects/{defectId}`.
- Loaded dropdown options from DB-backed APIs and workflow-derived allowed statuses.
- Added DB-backed severity and priority lookup endpoints.
- Wired save to `PATCH /api/v1/defects/{defectId}`.
- Wired edit-page attachment metadata upload and comment creation.
- Preserved approved rich steps behavior and attachment controls.
- Confirmed edit writes respect auth, active-project, and data-context rules.
- Added module verification spec at `docs/module-test-specs/DEFECT_EDIT_MODULE_TEST_SPEC.md`.

### Step 6 Pass 4 - Defect Create Wiring

- Completed `defect_create.html` lookup wiring for project, environment, severity, priority, assignee, and workflow initial status.
- Environment options now follow the selected data context.
- New defects submit through `POST /api/v1/defects`.
- Duplicate advisory behavior remains visible and user-controlled through the Create Anyway dialog.
- Rich steps HTML and attachment metadata are submitted through API-backed fields.
- Preserved the approved one-page create form layout.
- Added module verification spec at `docs/module-test-specs/DEFECT_CREATE_MODULE_TEST_SPEC.md`.

### Step 7 Pass 1 - Attachments And Inline Assets Hardening

- Completed Phase 1 JSON file storage for standalone attachments and inline screenshots: uploads include base64 `contentDataUrl`, the API writes physical files under `FILE_STORAGE_ROOT`, and database `storage_key` values point to those files.
- Hardened attachment and inline-asset API payload validation.
- Scoped attachment, inline asset, comments, allowed-status, and history child routes to authenticated active-project/data-context access.
- Registered pasted inline screenshot metadata from create/edit saves while preserving `stepsHtml` as the rendered source for the rich editor.
- Updated API test cases for protected attachment, inline asset, comments, and history endpoints.
- Added module verification spec at `docs/module-test-specs/ATTACHMENTS_INLINE_ASSETS_MODULE_TEST_SPEC.md`.

### Step 7 Pass 2 - Comments And History Hardening

- Completed comment create/update validation for required text and maximum length.
- Kept comment edit/delete UI controls out of Phase 1; comment add remains available only on the edit page.
- Kept history read-only and scoped to authenticated active-project/data-context access.
- Aligned edit-page Add Comment validation with API comment length rules.
- Updated API test cases for empty-comment rejection.
- Added module verification spec at `docs/module-test-specs/COMMENTS_HISTORY_MODULE_TEST_SPEC.md`.

### Step 8 Pass 1 - Releases And Status-Driven Date Fields

- Completed release master validation for create/update.
- Edit defect now uses a typed Release Version and developer-selected Release Deployment Date; release master orchestration is reserved for a future phase.
- Moving a defect to `Fixed` now requires Release Version, Release Deployment Date, and Fix Date.
- Moving a defect to `Closed` now requires Closure Date.
- Closure Date is validated to be on or after Fix Date in UI and API.
- Added module verification spec at `docs/module-test-specs/RELEASES_STATUS_DATES_MODULE_TEST_SPEC.md`.

### Step 8 Pass 2 - Final Defect Flow Regression

- Completed end-to-end defect create -> edit -> fixed -> closed -> list/detail/dashboard verification.
- Verified attachments, inline assets, comments, history, release dates, data context, list search, detail read, and dashboard summary/chart reads in one DB-backed smoke.
- Verified the API playground operation list has live Flask route counterparts for all 42 playground operations.
- Documented live utility/alias endpoints retained for Phase 2: health, severity/priority lookups, defect allowed-statuses AJAX helper, and duplicate POST/PATCH/PUT method aliases.

### Step 9 Pass 1 - OpenAPI And Playground Contract Cleanup

- Normalize OpenAPI descriptions and playground notes against the finalized live behavior.
- Keep utility endpoints documented as Phase 2 helpers; decide later whether any should be exposed in the playground UI.
- Remove mock-era wording where it conflicts with the final DB-backed baseline.

## Page Wiring Order

1. Login and auth session
2. Users CRUD and password reset
3. Projects CRUD
4. Environments CRUD
5. Status workflow save/load
6. Dashboard read-only data
7. Defect list filters/pagination/table
8. Defect detail read-only view
9. Defect edit status/reassign/save
10. Defect create with rich steps and attachments
11. Final cross-page polish and regression testing

## Test Checkpoints

After each pass:

- Run Python compile check.
- Run route smoke checks with Flask test client.
- For API slices, test success and failure responses.
- For UI slices, open the page in browser and verify the control manually.
- Keep `apiAT++` and `dbAT++` as larger milestone checks, not every tiny pass.
