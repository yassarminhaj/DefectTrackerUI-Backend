# Development Log

This log records implementation changes made during the final UI/API/DB stitching phase. Keep entries short, factual, and tied to the reason for the change.

## 2026-06-02

### Repository Boundary Correction

- Confirmed final application work must happen inside `defect-tracker`, not the parent `Tool_SourceCode` workspace.
- Restored `defect-tracker` as its own Git repository connected to `DefectTrackerUI-Backend.git`.
- Parent `Tool_SourceCode` remains connected to the separate backup/workspace repository.

### Step 3 - Backend Structure Bridge

- Added a minimal app factory bridge under `app/__init__.py`.
- Added placeholder package folders for future extraction: `routes`, `services`, `repositories`, and `validators`.
- Added `run.py` as the preferred local launch entry point.
- Kept legacy `app.py` intact so existing API behavior continues while routes are extracted gradually.

### Step 4 Pass 1 - Serve Approved UI From Backend

- Copied the approved static UI into `app/ui_static`.
- Added `app/routes/ui.py` to serve HTML pages, CSS, JS, icons, and manifest from Flask.
- Preserved the legacy API and OpenAPI routes.

### Step 4 Pass 2 - Login UI Wiring

- Converted the login control from an anchor to a submit button.
- Wired login form submission to `POST /api/v1/auth/login`.
- Stored access token, refresh token, user summary, and data context in browser storage.
- Added a simple client-side auth guard for app pages and logout storage cleanup.

### Step 4 Pass 3 - Launch Clarity

- Changed `/` to redirect to `/login.html`.
- Kept legacy mock playground available at `/api/playground`.
- Added `README.md`, `docs/RUNBOOK.md`, and `docs/INTEGRATION_PLAN.md`.

### Step 4 Pass 4 - Auth Hardening

- Added Werkzeug password hashing and verification.
- Set seeded local dev credential to `qa.user / Welcome123`.
- Added compatibility for old placeholder hashes: `Welcome123` upgrades placeholder users to real hashes after login.
- Hardened self password change and user password reset endpoints.
- Updated seed data and auth test catalog to match real password validation.

### Current Decision

- Complete the login/auth/profile shell before moving to dashboard data wiring.
- Profile modal must call real backend APIs for email and password updates.

### Step 4 Pass 5 - Profile Modal API Wiring

- Wired profile email updates to `PATCH /api/v1/auth/profile`.
- Wired profile password changes to `POST /api/v1/auth/password`.
- Profile modal now prefers the logged-in API user email over older prototype localStorage email values.
- Preserved the existing profile modal UI and validation style.
- Verified wrong current password, password mismatch, password change/revert, and profile email update behavior.

### Step 4 Pass 5 Follow-Up - Password Audit And Session UX

- Replaced old proof-layer audit notes that referenced "API playground" with neutral production wording.
- `self_change` password events now use `Password changed by user`.
- user reset password events now use `Password reset by administrator`.
- Profile password changes now show a short success message, clear browser auth storage, and redirect to login so the user signs in again with the new password.

### Step 4 Pass 5 Follow-Up - Database Source Of Truth

- Anchored `.env` loading to the `defect-tracker` application folder so database configuration is stable regardless of the launch directory.
- Removed the fallback database DSN; missing `DATABASE_URL` now fails loudly instead of silently connecting to another port or instance.
- Removed the old profile email browser-storage fallback from the profile modal flow.
- Profile email is now hydrated from `GET /api/v1/auth/me` and saved only through `PATCH /api/v1/auth/profile`; the UI updates only from the API response.
- Browser storage remains limited to session/display convenience data such as auth tokens, user snapshot, and data context.
- Profile and password endpoints now require a bearer token, preventing unauthenticated requests from updating the default seeded user.

### Step 4 Pass 6 - Complete AUTH UI/API Wiring

- Wired logout UI to `POST /api/v1/auth/logout` before clearing local session and returning to login.
- Added shared API refresh handling: a protected request that receives `401` attempts one `POST /api/v1/auth/refresh`, stores the new token, and retries the original request once.
- Added a minimal session-expired dialog when refresh fails, so users choose when to return to login.
- Hardened refresh tokens to the Phase 1 `live.refresh.<user_id>.<uuid>` format and reject missing or invalid refresh tokens.
- Updated AUTH mapping and test documentation to match password verification, authenticated current-user reads, and strict refresh behavior.

### Step 4 Pass 6 Follow-Up - Profile Save Feedback

- Email-only profile updates now show a centered confirmation dialog after the API commit succeeds.
- Password changes no longer auto-redirect after a short delay; they show a clear confirmation dialog and wait for the user to choose `Go to Login`.
- Product feedback rule established: committed data changes use centered confirmation dialogs; lightweight validation summaries can remain contextual and should not become generic bottom-corner success toasts.
- Confirmation/session dialogs now use compact cards with a softer blurred backdrop, while larger data-entry modals keep their existing structure.

### Step 4 Pass 7 - Default Data Context Wiring

- `app_users.default_data_context` is now honored as the authenticated user's saved starting scope.
- Login can omit `dataContext`; when omitted, the backend uses the saved user default.
- `X-Data-Context` remains the per-request/session override for dashboard, defect list, and similar operational reads.
- `GET /api/v1/auth/me` now returns both `defaultDataContext` and `activeDataContext`.
- Added auth test cases for login default-context fallback and explicit context override so automation can cover both paths.
- Verified with a disposable `Prod` default user: login without context returned `Prod`, login with `All` returned `All` while retaining default `Prod`, and dashboard reads without `X-Data-Context` used `Prod`.

### Step 4 Pass 7 Correction - Login Context UI

- Removed the forced `Test` preselection from the login page so users land in their saved `app_users.default_data_context` unless they explicitly choose a session override.
- Added concise login helper copy: `Uses your saved default unless changed.`
- Login-selected context remains a session/request override only; it does not update `app_users.default_data_context`.
- Added Default Context to the Add User modal only, so new users can be created with `Test`, `Prod`, or `All` as their saved starting scope.
- Kept default context hidden from inline user edit in Phase 1; backend support remains API-ready for future administrator controls.

### Step 4 Pass 8 - Users Module API Wiring

- Protected Users APIs with bearer authentication so list/create/edit/password reset match the OpenAPI contract.
- Added server-side user validation for required profile fields, email format, username format, duplicate email, duplicate username, and valid default context.
- Wired `users.html` to load users from `GET /api/v1/users` instead of relying on hardcoded rows.
- Wired Add User to `POST /api/v1/users`; successful creates now persist to `app_users` and render from the API response.
- Wired inline user edit to `PATCH /api/v1/users/{userId}`; Phase 1 edit intentionally excludes default context.
- Wired Reset Password to `POST /api/v1/users/{userId}/password` and verifies the selected user's previous password before updating the hash.
- Updated Users API test cases and OpenAPI schema so password reset includes `previousPassword` and missing bearer token returns `401`.
- Verified with disposable DB-backed users: protected list, create with `Prod` default context, inline update, wrong previous-password rejection, successful reset event, and login with the reset password.

### Step 4 Pass 8 Follow-Up - Module Test Spec

- Added `docs/module-test-specs/AUTH_USERS_MODULE_TEST_SPEC.md` to capture manual and automation-ready expected results for Auth + Users.
- Updated the integration plan to wire Projects next, because active project persistence is a dependency for dashboard and defect read behavior.

### Phase 1 Security Baseline

- Enforced server-side access-token expiry for the lightweight bearer tokens already used by the app.
- Kept logout as a client-driven session clear path for Phase 1.
- Documented the Phase 2 token-hardening path separately so JWT and server-side revocation can be added later without changing the current Phase 1 contract.

### Step 5 Pass 1 - Projects Master Data Wiring

- Protected Projects APIs with bearer authentication.
- Added server-side project validation for required name, max lengths, duplicate project name, and missing project handling.
- Wired `projects.html` to load rows from `GET /api/v1/projects`.
- Wired inline Add Project to `POST /api/v1/projects`.
- Wired inline Edit Project to `PATCH /api/v1/projects/{projectId}`.
- Added visible loading, empty, and error table states for the Projects page.
- Added `docs/module-test-specs/PROJECTS_MODULE_TEST_SPEC.md`.
- Updated Projects API test cases so missing bearer token returns `401`.
- Verified with disposable DB-backed data: protected list, list success, create, duplicate create rejection, missing-name rejection, update, duplicate update rejection, and missing-project `404`.

### Step 5 Pass 2 - Environments Master Data Wiring

- Protected Environments APIs with bearer authentication.
- Added server-side environment validation for required name, max lengths, duplicate environment name, invalid scope override, and missing environment handling.
- Wired `environments.html` to load rows from `GET /api/v1/environments`.
- Wired inline Add Environment to `POST /api/v1/environments`.
- Wired inline Edit Environment to `PATCH /api/v1/environments/{environmentId}`.
- Added visible loading, empty, and error table states through the shared inline table manager.
- Kept environment scope inferred from submitted names: exactly `PROD`, `Production`, or `Live` becomes `Prod`; all other names become `Test`.
- Added `docs/module-test-specs/ENVIRONMENTS_MODULE_TEST_SPEC.md`.
- Updated Environments API test cases so missing bearer token returns `401`.
- Verified with disposable DB-backed data: protected list, list success, create with `Test` scope, duplicate create rejection, missing-name rejection, `Production` inferred as `Prod`, update, duplicate update rejection, invalid scope rejection, and missing-environment `404`.

### Step 5 Pass 3 - Status Workflow Wiring

- Protected Workflow APIs with bearer authentication.
- Added server-side workflow validation for empty diagrams, missing process nodes, blank labels, duplicate process status labels, missing edge endpoints, invalid edge references, and self-connections.
- Preserved the approved process-node-only visual workflow editor; decision nodes remain excluded from Phase 1.
- Replaced workflow `localStorage` persistence with `GET /api/v1/workflow` and `POST /api/v1/workflow`.
- Kept `Reset / Clear Canvas` as an unsaved local canvas action until the user clicks `Save Workflow`.
- Workflow save now stores the visual diagram in `workflow_definitions.diagram_json` and regenerates `workflow_transitions` from arrows.
- `GET /api/v1/workflow/transitions` now requires `fromStatus`, validates it against the active workflow status set, and returns `allowedStatuses`.
- Transition lookup now validates against process-node labels from `diagram_json`, so a process node with no arrows remains a valid terminal status.
- Added `docs/module-test-specs/STATUS_WORKFLOW_MODULE_TEST_SPEC.md`.
- Updated Workflow API test cases so missing bearer token returns `401` and invalid diagrams return `400`.
- Verified with disposable DB-backed data: protected load, authenticated load, save, transition lookup, terminal status lookup, standalone process-node terminal lookup, missing `fromStatus`, unknown status, empty diagram rejection, duplicate label rejection, and original workflow restoration.

### Step 5 Pass 4 - Dashboard Read Model Wiring

- Protected Dashboard summary and chart APIs with bearer authentication.
- Added `highPriorityOpenDefects` to the dashboard summary response so the existing High Priority Open KPI is database-backed.
- Dashboard UI now loads KPI cards from `GET /api/v1/dashboard/summary`.
- Dashboard UI now loads chart/table source data from DB-backed API reads instead of `sample-data.js`.
- Kept Dashboard filters scoped to the table only; cards and charts remain the current context health view.
- Dashboard charts still support the approved add/remove/move/resize behavior while using DB-backed defect records.
- Dashboard table still supports client-side filters, sort, pagination, export, and KPI tile filtering on top of DB-backed records.
- Dashboard APIs continue to enforce active-project and data-context rules.
- Added `docs/module-test-specs/DASHBOARD_MODULE_TEST_SPEC.md`.
- Updated Dashboard API test cases so missing bearer token returns `401`.
- Verified with disposable DB-backed data: protected summary, All/Test/Prod context counts, chart response, project-filtered chart response, defect table read, and inactive-project defect exclusion.

### Step 6 Pass 1 - Defect List Wiring

- Protected `GET /api/v1/defects` and `POST /api/v1/defects` with bearer authentication.
- Wired `defect_list.html` to load table rows from `GET /api/v1/defects`.
- Preserved the approved expandable Defect Filters panel.
- Kept Defect List filters button-driven; dropdown changes do not reload the table until `Apply Filters` is clicked.
- Wired server pagination and approved page sizes `10`, `40`, and `100`.
- Mapped UI filters to API parameters: `projectId`, `environmentId`, `status`, `severityId`, `priorityId`, `assignedToUserId`, `releaseId`, and `search`.
- Row actions now display the user-friendly defect key while routing to detail/edit pages by backend defect ID.
- CSV export now uses the DB-backed rows currently loaded on the page.
- Added `docs/module-test-specs/DEFECT_LIST_MODULE_TEST_SPEC.md`.
- Updated Defect API test cases so missing bearer token returns `401`.
- Verified with disposable DB-backed data: protected list, All/Test/Prod context reads, page sizes, project filter, search, and inactive-project defect exclusion.

### Step 6 Pass 2 - Defect Detail Read-Only Wiring

- Protected `GET /api/v1/defects/{defectId}` with bearer authentication.
- Scoped detail reads to active projects and the current `X-Data-Context`.
- Protected `GET /api/v1/defects/{defectId}/history` with bearer authentication.
- Added stable detail-page data hooks without changing the approved layout.
- Wired `defect_detail.html` to hydrate hero metadata, badges, general information, execution details, release fields, attachments, comments, and history from API responses.
- Preserved existing Back to Defects and conditional edit-icon behavior.
- Added `docs/module-test-specs/DEFECT_DETAIL_MODULE_TEST_SPEC.md`.
- Verified with disposable DB-backed data: protected detail, detail payload shape, history read, context-hidden detail, inactive-project detail exclusion, and UI route shell.

### Step 6 Pass 3 - Defect Edit Wiring

- Added authenticated severity and priority lookup endpoints for DB-backed edit dropdowns.
- Protected Release, attachment, inline asset, allowed-status, and comment supporting endpoints with bearer authentication.
- Scoped `PATCH /api/v1/defects/{defectId}` to active projects and current `X-Data-Context`.
- Added stable edit-page data hooks without changing the approved layout direction.
- Added editable Title, Severity, and Priority controls to close gaps in the existing edit form.
- Wired `defect_edit.html` to hydrate defect fields, hero badges, attachments, comments, history, and master dropdowns from API responses.
- Status dropdown now uses the current status plus workflow-allowed next statuses.
- Wired Save Changes to `PATCH /api/v1/defects/{defectId}`.
- Wired selected edit attachments to Phase 1 attachment metadata uploads.
- Wired edit-page Add Comment to the comments API and refreshed comments/history after commit.
- Kept defect save and comment save separate on the edit page; `Save Changes` updates defect fields only, while `Add Comment` persists the draft comment explicitly.
- Removed the auto-advance from the edit-page success dialog so the user stays on the edit screen until `View Defect` is chosen.
- Added `docs/module-test-specs/DEFECT_EDIT_MODULE_TEST_SPEC.md`.
- Verified with disposable DB-backed data: authenticated lookups, detail load, valid patch, attachment metadata upload, comment add, history read, and context-hidden update rejection.

### Step 6 Pass 4 - Defect Create Wiring

- Wired `defect_create.html` lookup controls to authenticated APIs for projects, environments, users, severities, priorities, and workflow.
- Environment options now respect the active data context: `Test`, `Prod`, or `All`.
- Create page status now displays the active workflow initial status while the server remains the source of truth for assignment.
- Replaced the old demo-form create behavior with `POST /api/v1/defects`.
- Preserved the same-project/same-title duplicate advisory and added a user-controlled `Create Anyway` confirmation path.
- Wired selected create-page attachments to Phase 1 attachment metadata uploads after defect creation.
- Rich Steps to Replicate HTML is included in the create payload through `stepsHtml`.
- Removed fake preselected attachment rows from the initial create form shell.
- Added `docs/module-test-specs/DEFECT_CREATE_MODULE_TEST_SPEC.md`.
- Verified with disposable DB-backed data: protected lookup reads, context-scoped environments, create success, attachment metadata upload, duplicate `409`, forced duplicate create, context-hidden detail, and UI route shell.

### Step 7 Pass 1 - Attachments And Inline Assets Hardening

- Added server-side attachment validation for filename, allowed extension, and 5 MB maximum size.
- Added server-side inline image validation for image content type, supported image extension, file size, and positive display dimensions.
- Scoped attachment, inline asset, allowed-status, comments, and history child routes through the same active-project and data-context visibility rule used by defect detail.
- Wired create/edit saves to register metadata for pasted inline screenshots found in `stepsHtml`; the pasted image still renders inline from the rich text HTML.
- Updated generated API test definitions for protected child routes and stricter attachment/inline validation.
- Added `docs/module-test-specs/ATTACHMENTS_INLINE_ASSETS_MODULE_TEST_SPEC.md`.

### Step 7 Pass 1B - Attachment And Inline File Storage Sync

- Finalized Phase 1 JSON file storage for standalone attachments and inline screenshots.
- Upload requests now require base64 file content in `contentDataUrl`; metadata-only upload attempts are rejected.
- The API writes physical files under `FILE_STORAGE_ROOT` before inserting `defect_attachments` or `defect_inline_assets` rows, and rolls back the newly written file if the database insert fails.
- Attachment and inline content endpoints now stream the stored physical file from `storage_key`; missing files return `file_missing` so DB/filesystem drift is visible.
- Verified with a disposable DB-backed smoke: create defect, upload attachment, upload inline image, confirm both `storage_key` paths exist on disk, confirm content endpoints return exact bytes, confirm metadata-only upload is rejected, then clean up the disposable record/files.

### Step 7 Pass 1C - Attachment Download And Preview UI

- Replaced plain attachment content links with authenticated blob fetch actions so protected content endpoints receive the bearer token and active data context.
- Detail and edit attachment tables now share the same Download and Preview button behavior.
- Image attachments preview in the existing modal from a temporary blob URL; non-image attachments show a preview-unavailable message and stay downloadable.
- Verified with a disposable DB-backed defect and PNG attachment: detail page rendered one Download and one Preview control, the Attachments tab preview opened a real blob-backed image, and the disposable DB row/storage folder were cleaned up.

### Step 7 Pass 2 - Comments And History Hardening

- Added server-side comment validation for required text and a 2000-character maximum.
- Applied the same validation to comment create and comment update so empty comments cannot be stored.
- Kept comment add as an edit-page-only control for Phase 1; the view page remains read-only for comments.
- Kept history as a read-only timeline and retained active-project/data-context scoping from the previous child-route hardening pass.
- Aligned edit-page comment textbox validation with the API limit.
- Updated generated API test definitions for empty-comment rejection.
- Added `docs/module-test-specs/COMMENTS_HISTORY_MODULE_TEST_SPEC.md`.

### Step 8 Pass 1 - Releases And Status-Driven Date Fields

- Added server-side release validation for project, version, duplicate project/version pairs, and planned/actual deployment date order.
- Updated release create/update routes to use the validated payload instead of accepting loose request bodies.
- Added defect edit business validation: `Fixed` requires Release Version, release deployment date, and Fix Date.
- Added defect edit business validation: `Closed` requires Closure Date.
- Added API-side Closure Date after Fix Date validation to match the UI.
- Made Release Version a typed Phase 1 field and Release Deployment Date a developer-selected date when a defect is marked `Fixed`.
- Updated generated API test definitions for status-driven date requirements.
- Added `docs/module-test-specs/RELEASES_STATUS_DATES_MODULE_TEST_SPEC.md`.

### Step 8 Pass 1B - Release Date UX Refinement

- Corrected the Phase 1 release/date model: defect fixing stores typed `release_version` and selected `release_deployment_date` on the defect; release master orchestration is reserved for a future phase.
- Added client-side and API-side validation that Fix Date cannot be greater than today.
- Locked Closure Date unless the selected Status is `Closed`; the edit payload omits Closure Date outside `Closed` so historical closure dates are preserved without accidental edits.
- Reserved space in the release/date control grid so field-level date validation does not disturb alignment.

### Step 8 Pass 1C - Release Source Correction

- Removed the defect edit dependency on release master dropdowns for Phase 1.
- Added `defects.release_version` and `defects.release_deployment_date` as the saved source for developer-entered fixed-release details.
- Kept legacy `fixedInRelease` response shape as a compatibility wrapper so existing detail/list/dashboard rendering continues to work while the saved source is defect-level data.
- Verified the corrected validation behavior: missing Fixed release data returns validation error, valid typed release/deployment/fix data passes, and a future Fix Date is rejected.

### Step 8 Pass 2 - Final Defect Flow Regression

- Ran a DB-backed end-to-end defect flow: create defect, upload attachment metadata, register inline asset metadata, add comment, find through list search, read detail, move through saved workflow to fixed and closed, verify history, verify dashboard summary/charts, and verify context boundaries.
- Confirmed the regression uses the active saved workflow labels dynamically instead of assuming seed labels, because the database can contain `In-Progress` while seed examples may use `InProgress`.
- Confirmed all 42 API operations listed in the mock playground have live Flask route counterparts.
- Documented live endpoints not exposed in the playground as intentional Phase 2 utility/alias endpoints: `/health`, severity/priority lookup helpers, defect allowed-statuses AJAX helper, and duplicate method aliases for profile/password/workflow.
- Regenerated API test cases; total is now 125 after status/date cases were added.

### Step 8 Pass 3 - Dashboard Open Status And Back-Link Regression

- Aligned the Dashboard Open KPI table filter with the backend summary rule: open defects are every active-project/current-context defect except `Closed` and `Rejected`.
- Centralized UI status normalization so workflow labels such as `InProgress`, `Testing`, and `Re-Open` render and filter consistently without requiring exact legacy label spelling.
- Restored source-aware detail navigation: dashboard-sourced detail pages return to Dashboard, while defect-list-sourced detail pages return to Defects.
- Added dashboard/detail module regression expectations for Open KPI row parity and contextual back links.

### Step 8 Pass 4 - Status Workflow As Label Source Of Truth

- Made active Status Workflow process-node labels the canonical status vocabulary returned by defect, dashboard, chart, and transition APIs.
- Added backend workflow-status canonicalization so existing prewritten rows with older spellings continue to load while responses expose the active workflow label.
- Added workflow `statuses`, `terminalStatuses`, and `initialStatus` to `/api/v1/workflow` so UI controls can stop deriving status options from arbitrary defect rows.
- Updated Dashboard and Defects page status filters to use workflow labels instead of row-derived status lists.
- Kept a narrow legacy alias layer for current seed drift such as `Testing`/`Test` and spacing differences; this is transitional until seed data and stored defect rows are cleaned.

### Step 8 Pass 5 - Dashboard Chart Drilldown

- Added dashboard-only chart drilldown: clicking a chart bar, slice, point, or stacked segment applies a visible table filter without mutating dashboard dropdown values.
- Kept KPI cards and chart cards as context health views; the drilldown narrows only the Defect Summary Table and can be cleared independently.
- Persisted the chart drilldown in the dashboard URL so source-aware detail navigation can return to the same table scope.
- Updated the Dashboard module test spec to capture chart-click table filtering and clear behavior.

### Step 8 Pass 6 - Dashboard Scope Alignment

- Made dashboard charts redraw from the same active dashboard scope as the table baseline: dropdown filters plus active KPI tile.
- Kept chart drilldown as a table-only refinement inside the current dashboard scope, avoiding stacked tile/chart click ambiguity.
- Added automatic scroll and a short focus cue on the Defect Summary Table after a chart component is clicked.
- Updated the Dashboard module test spec for KPI-scoped charts and chart-click table focus.

### Step 8 Pass 7 - Dashboard Not Set Drilldown

- Normalized chart drilldown comparisons so chart labels such as `Not set` match blank/null record values.
- Added a Dashboard module regression case for `Not set` chart drilldowns, including Defects by Release.

### Step 8 Pass 8 - Table Header Seam Cleanup

- Removed accidental white hairline seams in dark table headers by switching shared tables to a separate border model with zero spacing.
- Added defensive header-cell seam painting with the approved primary token so sortable headers remain one continuous dark band across zoom levels and horizontal scroll positions.

### Step 8 Pass 9 - Attachment Preview Scope

- Added PDF support to the existing attachment preview modal.
- Kept Phase 1 preview scope intentionally narrow: images and PDFs can preview; DOC/DOCX/TXT/LOG/JSON remain download-only so the UI does not imply unsupported document rendering.
- Constrained the attachment preview card so the browser PDF viewer fills the modal instead of overflowing outside the white container.
- Reused the same preview modal for inline Steps screenshots on the defect detail page, added an editor-side screenshot preview control, and added image zoom controls for screenshot/image inspection.
- Hardened detail/edit history rendering so known event types show user-readable audit text instead of raw field names, HTML, JSON, or oversized comment/image payloads.

### Step 8 Pass 10 - Created Defect Trend Clarity

- Kept the chart title `Created Defect Trend`.
- Defined the chart as monthly defect intake based on each defect's Created Date / `created_at`.
- Added chart-local hover/help text and a clearer line-point tooltip so users know it respects the current dashboard context, active projects, filters, and selected KPI tile.
- Refined the dashboard chart-help pattern into a subtle click-to-open translucent overlay. Help no longer participates in chart layout, so opening it does not push the chart down; the shared chart configuration still generates help text for user-added charts, and the panel closes on click-away or `Escape`.

### Step 8 Pass 11 - UAT Validation And Browser Suggestion Cleanup

- Removed duplicate bottom-corner validation toasts for ordinary field-level validation. Field-level messages now carry the correction guidance without an extra transient message.
- Prevented form/modal summaries from mirroring field-level errors when inline field messages are already visible.
- Added shared red/success styling for generic form messages so API/server errors such as invalid login credentials use the same visual language as field validation.
- Cleared stale browser custom validity when a user edits an invalid field.
- Added a shared autocomplete policy: login keeps `username` / `current-password`, password-change controls keep `current-password` / `new-password`, and operational application fields default to `autocomplete="off"` to reduce browser cache suggestion popups.
- Disabled native browser validation on app forms so date/range/email errors are displayed through the branded field-level validation system instead of inconsistent browser bubbles.
- Regression-checked real DB detail pages with inline steps and image/PDF attachments, protected attachment content fetches, image/PDF previews, release/date validation, and source-aware Defects/Dashboard detail navigation.
- Deferred dashboard chart help-copy refinement and any KPI split such as open-for-fixing/open-for-testing as a later product wording/metric decision.

### Step 8 Pass 12 - Create Defect Guidance Cleanup

- Replaced prefilled sample values on Create Defect with non-destructive placeholders so users can start typing without deleting example content.
- Kept the Steps to Replicate rich editor empty on load and allowed its existing placeholder to communicate guidance.
- Preserved validation expectations: required fields are still truly empty until the user enters data.

### Step 9 Pass 2 - Dashboard Personalization Deferred To Phase 2

- Kept custom dashboard charts and chart removal as current-session UI behavior for Phase 1.
- Deferred per-user dashboard layout persistence to Phase 2 so a logged-in user's added charts, removed charts, and ordering can survive logout/login.
- Documented the Phase 2 storage path in the architecture notes instead of introducing a new persistence table before the core app ships.
