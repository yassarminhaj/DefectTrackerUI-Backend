# Defect Tracker Design Decision Log V2

This V2 log captures the matured design direction after the extended UI freeze work. It builds on `DESIGN_DECISION_LOG.md` and uses the later project metadata in `CLAUDE.md`, `README.md`, and `UI_CHANGELOG.md`.

The purpose is not only documentation. This file is a reusable product asset: it can guide future implementation, keep design decisions consistent, support stakeholder explanation, and provide marketing-level language for the product story.

## V2 Positioning

Defect Tracker is a focused QA defect lifecycle management workspace.

It is designed for teams that need to monitor defect health, manage defects with minimal friction, and maintain traceability across projects, environments, releases, owners, workflow states, and reporting views.

The product direction is intentionally opinionated:

- Dashboard is for monitoring.
- Defects page is for management.
- Detail page is for depth.
- Exports are where deeper flexibility belongs.
- The UI should guide users instead of exposing every possible configuration knob.

This keeps the tool calmer than a generic ticketing system while still supporting real QA work.

## Scope Boundary

The project remains a static UI prototype.

Current scope:

- Static HTML, CSS, and JavaScript.
- No backend.
- No API integration.
- No database.
- No authentication logic.
- No build tooling.

The UI is intentionally written so it can later be converted into a Flask and PostgreSQL application without changing the product identity.

## Working Contract

The later project metadata introduced a strong working rule:

Every meaningful UI change should carry its reason.

This is now treated as part of the product discipline. The change log is not just a technical record; it is the memory of the design intent.

The expected shape for future change entries is:

- Change: what changed.
- Why: the user-facing issue or need.
- Intent: the outcome the change is meant to produce.
- Concept / Principle: the larger design rule it reinforces.
- Files touched: where the work landed.

Decisions not to do something are also valuable and should be logged.

Reasoning:

- UI quality comes from consistent intent, not just polished pixels.
- Future threads and future developers should not re-litigate settled decisions.
- Negative decisions are often the strongest design guardrails.

## Guiding Principles

These principles emerged during the UI freeze and should remain the lens for future work.

### 1. Let The Eye Work Passively

Users should understand meaning without consciously decoding the interface.

Examples:

- Status badges use meaningful color.
- Defect IDs remain visually stable.
- Actions sit close to the content they affect.
- Tables avoid unnecessary columns.

### 2. One Cell, One Signal

A table cell should not repeat information already expressed elsewhere.

Example:

- Defect ID stays neutral.
- Status color belongs in the Status column.
- Severity color belongs in the Severity column.

Reasoning:

If every cell tries to communicate state, the table becomes noisy. Each visual element should earn its presence.

### 3. Identifiers Stay Neutral

Defect IDs are stable handles, not status indicators.

Reasoning:

IDs behave like Jira keys, Git hashes, or issue numbers. Their job is identity and traceability. They should not editorialize or shift meaning based on state.

### 4. Use The Lightest Pattern Possible

Prefer native browser behavior or small UI affordances when the need is small.

Examples:

- Use native `title` tooltips for truncated titles instead of opening a modal.
- Use inline controls when editing simple row data.
- Use a modal only when the task needs focused input, such as creating a user with password fields.

### 5. Similar Surfaces Should Behave Similarly

Projects, Users, Environments, Defect tables, and Attachment tables should feel related.

Reasoning:

Users should not pause to relearn behavior from page to page. Differences must be intentional and defensible.

### 6. Be Opinionated; Let Excel Be Flexible

The app should ship a curated, confident view.

Deeper customization belongs in export workflows, not in every table column picker.

Reasoning:

Too much in-app customization causes inconsistent views, harder support, and slower decisions.

### 7. Mental Models Drive Scope

Each page has a job.

- Dashboard: monitoring.
- Defects: management.
- Detail: investigation and action.
- Create: capture and explain.
- Workflow: lifecycle control.
- Reports: review and export.

Features should live where the user naturally expects them.

## Brand And Visual System

The approved product mark remains the `DT` symbol.

The parent brand is Improve Software Labs, but the product keeps its own identity.

Login page branding uses:

`Solution By (c) Improve Software Labs`

Reasoning:

- DT is compact and product-specific.
- Improve Software Labs gives credibility without overwhelming the tool.
- The app should feel like a serious QA product, not an internal throwaway screen.

## Color Direction

The monochrome system remains the foundation.

Neutral palette:

- `#0e1010`
- `#262828`
- `#303635`
- `#e7e7e7`
- `#ffffff`

Red palette:

- `#5c1c1c`
- `#b83737`
- `#c65f5f`
- `#dc9b9b`

Green palette:

- `#23402a`
- `#2a4d32`
- `#7ea687`
- `#b5ccbb`

Usage rule:

- Red means defect risk, severity, negative health, or attention needed.
- Green means active, healthy, positive, or completed state.
- Neutral colors carry structure, typography, borders, surfaces, and layout.

This keeps color meaningful rather than decorative.

## Typography Direction

The project continues to use `Book Antiqua`.

Reasoning:

- It gives the UI a distinct visual character.
- It supports the premium monochrome style.
- It avoids the generic look of standard admin templates.

Guardrail:

Use typography carefully. The font has personality, so spacing and sizing must remain disciplined.

## Navigation Decisions

The sidebar remains the main navigation pattern.

It supports showing, collapsing, and hiding to give wider content areas more room.

Reasoning:

- QA workflows often depend on wide tables.
- Users need more horizontal space without losing orientation.
- The DT mark acts as the visual anchor.

The menu should not visually shake or resize when moving between pages.

Guardrail:

Shared navigation must be structurally consistent across every page.

## Dashboard Decisions

Dashboard is a monitoring surface.

Key direction:

- Cards summarize health.
- Charts explain distribution and movement.
- Tables provide drill-down context.
- Filters support focused review, but should not dominate the page.

Important V2 idea:

Dashboard should not become a full defect management screen. It should help the user notice where attention is needed, then drill into the right operational page.

Future refinement:

- Keep KPI cards compact.
- Keep default chart count curated.
- Add chart types only when they improve interpretation.
- Avoid making every chart endlessly configurable.

Marketing value:

This allows the product to be described as a QA health command center, not just a list of bugs.

## Defect List Decisions

The Defects page is the management surface.

Important decisions:

- Defect ID is clickable.
- Pencil edit action sits beside the ID.
- Redundant far-right View/Edit actions were removed.
- Columns were reduced to improve scanning.
- Lifecycle-specific dates moved out of the list and belong in detail.
- Created By stays because originator visibility matters.
- Headers are sortable with smart severity, priority, ID, and date sorting.
- Filters are applied deliberately, not instantly.

Reasoning:

The user should be able to triage quickly without dragging their eye across an overloaded 14-column table.

Marketing value:

The list is designed around triage efficiency, not just data dumping.

## Defect ID And Pencil Edit Pattern

The Defect ID cell now combines identity and action.

Reasoning:

The eye already lands on the ID. Placing edit nearby removes the need to scan horizontally to the far-right action column.

Rejected alternative:

Keep View/Edit buttons at the far right.

Why rejected:

It creates unnecessary horizontal travel and gets worse on smaller screens or wide tables.

## Tooltip Decision

Truncated titles use native `title` tooltips.

Reasoning:

Showing one text value does not justify a modal. Native browser behavior is lighter, faster, and familiar.

Rejected alternative:

Open a modal for full title preview.

Why rejected:

It adds a heavier interaction for a small need.

## Export Decisions

The later UI direction introduced a split export idea:

- Current view.
- All columns.

Reasoning:

Users need two main export paths:

- Share what they are currently seeing.
- Export the full data set for deeper offline analysis.

This supports the principle:

Be opinionated in the app; let Excel be flexible.

Future backend note:

When data becomes dynamic, export should respect current filters and sorting for current-view export.

## Create Defect Decisions

The create page supports rich defect capture.

Important decisions:

- Steps to Replicate uses a rich editor.
- Users can type steps and paste screenshots inline.
- Images appear in document flow, not only as attachments.
- Images can be resized.
- A separate attachment area remains available.
- Created By should be system-owned and not editable.

Reasoning:

QA reproduction steps often need screenshots in sequence. Inline images make defects easier for developers to understand.

Marketing value:

The product supports evidence-rich defect reporting, not just plain text tickets.

## Defect Detail Decisions

The detail page is for investigation, review, and action.

Important decisions:

- Header summary shows defect identity, project, environment, assignment, creator, and badges.
- Status and reassignment controls stay in the summary area.
- Main content is grouped into tabs.
- Comments and history are separated into a collaboration/audit area.
- Internal lines were softened to reduce visual irritation.
- Attachment table styling was aligned with other app tables.

Reasoning:

Detail pages can become dense. Tabs and grouping let the user navigate without losing context.

Marketing value:

The detail view supports traceability: what happened, who owns it, what evidence exists, and how the defect moved.

## Projects Decisions

Projects use a single table with row-level add and edit behavior.

Important decisions:

- No separate form/table split.
- Add Project action belongs near the table.
- Inline editing should not resize the row or columns.
- Active/Inactive is a segmented control, not a dropdown.

Reasoning:

Project records are simple. A large separate form wastes space and makes the page feel heavier than the task.

## Users Decisions

Users use a modal for creation and password management.

Important decisions:

- Add User opens a modal.
- Password and Confirm Password are collected during creation.
- Password is never displayed in the table.
- Reset password uses a focused modal.
- Role management is excluded for now.

Reasoning:

User creation is more sensitive and denser than project or environment editing. A modal gives it the right focus without cluttering the table.

Future note:

Roles, OTP, email confirmation, and password policy belong in a later phase.

## Environments Decisions

Environments follow the same simple table pattern as Projects.

Important decisions:

- One table.
- Add and edit behavior aligned with Projects.
- Active/Inactive segmented state.
- Default examples remain DEV, SIT, UAT, Pre-Prod, PROD.

Reasoning:

Environment management is reference data. It should feel quick and consistent.

## Status Workflow Decisions

The workflow editor is a visual lifecycle surface.

The latest direction removed the Add Decision feature and decision-node functionality.

Important decisions:

- Process nodes represent statuses.
- Arrows represent valid transitions.
- Nodes can be moved.
- Connections show direction.
- Zoom and pan support canvas-style interaction.
- Transition chips summarize status movement.

Reasoning:

The workflow should be understandable to QA users without becoming a BPM system.

Future backend note:

When converted to Flask/PostgreSQL, the workflow should become the source of truth for allowed next statuses.

Marketing value:

The product can offer visual workflow governance without requiring a heavy enterprise workflow designer.

## Reports Decisions

Reports remain filter-driven and export-friendly.

Important decisions:

- Filters focus on project, environment, status, severity, assignee, release, and date range.
- Summary cards come before detailed tables.
- Export remains simple.

Reasoning:

Reports serve leads and stakeholders. They should support review, comparison, and offline sharing.

## UI Copy Decisions

Visible copy should sound product-ready.

Approved examples:

- `QA Defect Lifecycle Management`
- `Monitor defect health across projects, releases, environments, and assignees`
- `Manage project coverage`
- `Add and maintain project records`
- `Manage application users`
- `Add users, update account status, and reset passwords`
- `Manage testing and release environments`
- `Defect saved for review`

Avoid:

- `Phase 1`
- `static prototype`
- `sample UI only`
- `sample records`
- `no data was submitted`

Reasoning:

The UI should feel real even while it is static.

## Product Story For Marketing

This tool can be described as:

Defect Tracker is a focused QA lifecycle workspace that helps teams monitor defect health, manage defect movement, capture evidence-rich reproduction steps, and keep project, release, environment, and workflow context visible in one clean interface.

Strong positioning phrases:

- A focused QA defect lifecycle management workspace.
- Built for defect clarity, ownership, and traceability.
- Monitor defect health across projects, releases, environments, and assignees.
- Capture reproduction steps with inline visual evidence.
- Manage defect workflow visually without heavyweight process tooling.
- A calmer, more deliberate defect management experience.

Good audience framing:

- QA leads.
- QA engineers.
- Development leads.
- Delivery managers.
- Product teams working across releases and environments.

Safe marketing claims at this stage:

- The UI is designed around QA defect lifecycle management.
- The prototype includes dashboard, defect list, create defect, detail, project, user, environment, workflow, and report surfaces.
- The design system uses semantic status colors and a restrained monochrome foundation.
- The workflow direction supports visual transition thinking.
- Icon-only controls use SVG glyphs instead of font characters so menu, chart, export, and workflow controls remain optically centered and precise.
- The UI is prepared for future Flask/PostgreSQL implementation.

Claims to avoid until backend exists:

- Real-time analytics.
- Database-backed workflows.
- Secure authentication.
- Live multi-user collaboration.
- Automated notifications.
- Production-ready audit enforcement.

## Implementation Handoff Notes

When backend work starts, preserve these concepts:

- Process status values should not be hardcoded across templates.
- Defect status dropdowns should eventually derive allowed movement from workflow configuration.
- Created By should come from the logged-in user.
- Password values should never be displayed after creation.
- Exports should support current view and all columns.
- Dashboard should remain monitoring-focused.
- Defects page should remain management-focused.
- UI visible copy should remain product-ready.

## Future Documents To Create

Recommended next documents:

- `PRODUCT_REQUIREMENTS.md`
- `BACKEND_IMPLEMENTATION_PLAN.md`
- `DATABASE_MODEL_NOTES.md`
- `UI_ACCEPTANCE_CRITERIA.md`
- `MARKETING_COPY_BANK.md`
- `FLASK_MIGRATION_PLAN.md`

## V2 Summary

V2 makes the design discipline sharper.

The UI is no longer just a static collection of pages. It has a product point of view:

- Defect tracking should be clear.
- Defect health should be visible.
- Workflow should be governed visually.
- Tables should scan well.
- Details should be traceable.
- Exports should carry deeper flexibility.
- The UI should feel calm, premium, and deliberate.

That is the design story worth preserving as the product moves toward implementation.

## Icon Craft Decision

Tiny controls carry a lot of perceived quality in this interface.

We replaced text glyphs such as chevrons, close marks, grip marks, and small carets with SVG icons where the control is icon-only. This keeps the design minimal while avoiding font-metric drift that can make symbols look slightly off center.

The rule going forward:

- Use SVG for icon-only actions.
- Keep the same monochrome theme.
- Do not introduce decorative icon libraries.
- Prefer simple line icons that center reliably inside fixed-size controls.

Marketing value:

- This supports the product story of a calm, deliberate QA workspace.
- It gives us a defensible detail to mention when speaking about design quality: even small operational controls were treated with precision.

## Active Project Data Rule

Operational defect views should report only active project scope.

The shared static data now carries project status beside project names. Defect records can exist for inactive projects as archived/sample records, but dashboard and defect listing data are scoped through the shared data source so inactive-project defects do not affect current QA health counts, charts, filters, or tables.

Why this matters for backend migration:

- Project status becomes a data rule, not a visual-only badge.
- Dashboard totals stay aligned with the active delivery portfolio.
- Inactive project records can remain in storage for history without polluting active operational views.
- The Flask/PostgreSQL implementation should preserve the same rule in query helpers or service-layer filters.

## UI Closure Controls

The last Phase 1 polish pass formalized three operational rules:

- Tables use predictable row heights so scanning does not feel different from one module to another.
- Dashboard charts choose colors by data dimension. Severity and priority keep the red scale, statuses keep semantic red/green assignments, and neutral business dimensions use distinct token-based variations so unrelated units do not accidentally share the same visual identity.
- Operational tables use simple pagination once the result set exceeds the default page size. Exports remain based on the filtered result set, not only the currently visible page.

Backend handoff note:

- Pagination can later move to server-side query parameters, but the UX contract should remain the same: filters and sort reset to page one, counts describe the filtered result set, and export is not limited to the current page unless a future requirement explicitly says so.

## Shared Controller Finish

The last static UI cleanup keeps the product language consistent in small controls:

- Dashboard and defect-list tables expose the same compact page-size selector: 10, 40, or 100 rows.
- View-defect links now carry explicit tooltip/accessible labels, matching the existing edit affordance.
- The edit defect page uses the same inline screenshot reproduction-step pattern and attachment file input as the create flow.
- Project, user, and environment tables follow the same table density and row rhythm as the operational defect tables.

Marketing value:

- We can describe the Phase 1 UI as intentionally consistent down to table controls, not only at the page-layout level.
- The prototype now demonstrates that create and edit workflows were treated as equal citizens before backend implementation.

## Validation UX Contract

Validation is now treated as a shared UI behavior rather than a page-by-page afterthought.

The static prototype uses field-close validation messages, subtle invalid borders, and one reusable compact summary when a user attempts to submit or apply invalid input. Table edit rows intentionally avoid inline error blocks so row height and column rhythm remain stable during editing. Committed data changes should use centered confirmation dialogs; lightweight feedback should move toward contextual message rails rather than generic bottom-corner success toasts.

Validation message copy is parameterized in the static UI rather than scattered across individual handlers. This is enough for Phase 1 and keeps Phase 2 clean: the backend should reuse the same message patterns through server-side constants or a validation module, not a database table unless validation wording needs to become admin-configurable.

Why this matters for backend migration:

- The UI already defines what each controller accepts before Flask form validation is introduced.
- Backend validation can reuse the same rule names and messages, keeping client and server behavior aligned.
- The validation markdown gives QA and developers a single handoff reference for Phase 1 controller expectations.

Marketing value:

- We can describe the tool as disciplined and operationally ready, not just visually polished.
- The validation behavior reinforces the product promise: users are corrected exactly where the issue is, without noisy page movement.
