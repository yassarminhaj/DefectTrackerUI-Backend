# Defect Tracker UI — Change Log

> **⚠ Contract for any thread (or person) editing this project — read first.**
>
> 1. **Read this file before making changes.** It carries the *why* behind decisions; without it, the next change risks re-litigating a settled trade-off.
> 2. **Every UI change is logged here, in the order it lands**, using the same shape:
>    - **Change** — what is different now.
>    - **Why** — the user-facing problem or trigger.
>    - **Intent** — the outcome we're trying to produce.
>    - **Concept / Principle** — which guiding principle (see the section above) the change reinforces.
>    - **Files touched** — encouraged for non-trivial changes.
> 3. **Decisions NOT to do something are also logged** (e.g. *"kept ID color-neutral, decided against tinting by status"*). They save us from re-debating the same point later.
> 4. **The Guiding Principles below are the lens we check changes against.** If a change conflicts with a principle, document the trade-off explicitly inside the entry — don't silently drop the principle.
> 5. **Append, never overwrite.** Re-read the log right before adding your entry so you're appending to the latest version (matters if multiple threads are editing in parallel).
> 6. **The log is updated *as part of* the change, not after.** Treat "append to UI_CHANGELOG.md" as a required step of completing the work, not as documentation that comes later.

A living record of every UI change made during the **UI Freeze** phase. Each entry captures *what* changed, *why* (the user-facing problem), the *intent* behind the choice, and the *concept/principle* it reinforces.

---

## Guiding Principles (the lens we keep coming back to)

1. **Let the eye work passively** — design should let users absorb meaning without consciously decoding it.
2. **One cell, one signal** — avoid duplicating information across columns; each visual element should earn its presence.
3. **Identifiers stay neutral** — IDs are stable handles (like Git hashes / Jira keys); they identify, they do not editorialize.
4. **Lightest pattern possible** — prefer native browser behavior (e.g. `title` attribute) over heavier components (modals) when the job is small.
5. **Two near-identical surfaces should behave identically** — synergy across pages prevents user hesitation; differences must be intentional and defensible.
6. **Be opinionated; let Excel be flexible** — the app should ship a curated, confident view; deeper customization belongs in the export workflow, not the in-app table.
7. **Mental models drive scope** — *Dashboard = monitoring*, *Defects page = management*. Features that don't fit the page's mental model don't belong on it.

---

## Session: Defect Tracker UI Freeze — Phase 1 (active)

### 1. Clickable Defect ID + inline Pencil edit icon — `defect_list.html`

**Change:** The first cell of each row now renders the **Defect ID as a link** (to the detail page) with a **small pencil icon immediately to its right** (link to the create/edit page). The redundant `View | Edit` button column at the far right of every row was removed.

**Why:** A 14-column table previously forced the user's eye to travel from the ID on the left to the action buttons on the far right, often requiring horizontal scroll on smaller viewports.

**Intent:** Place the action where the eye already lands — on the row's identity cell.

**Concept:** Co-locate the *what* (identity) with the *how* (action). Eliminate the cognitive cost of cross-row scanning.

**Implementation notes:**
- ID link → `defect_detail.html?id=<ID>&back=defect_list.html`
- Pencil link → `defect_create.html?id=<ID>&back=defect_list.html`
- The `back=defect_list.html` query param feeds the existing smart back-link logic so the "← Back to Defects" link on the detail page returns the user to the right page.

---

### 2. Vertical alignment fix for ID + Pencil

**Change:** Wrapped both children of the first cell in `<span class="defect-id-cell-inner">` styled `display: inline-flex; align-items: center; gap: 6px`. Removed the obsolete `margin-left` from the pencil icon (gap handles spacing now).

**Why:** Initially the pencil sat ever-so-slightly off-center from the ID text — relying on `vertical-align: middle` makes alignment dependent on text baseline math (cap-height vs descender), which never looks pixel-perfect.

**Intent:** Deterministic vertical centering, independent of typography quirks.

**Concept:** When two inline children must look like one tight unit, flex-align them rather than trusting baseline behavior.

---

### 3. Defect ID stays color-neutral (decision NOT to color-code by status)

**Change:** *No code change.* Decided to keep the Defect ID in plain dark text rather than tinting it by status.

**Why considered:** The user's instinct was that color-coding might help the eye absorb status passively.

**Why rejected:**
- The Status column is already doing that job (colored badges already carry the status signal).
- Identifiers in good systems are stable and neutral (Git hashes, Jira keys, GitHub issue numbers). They identify; they don't editorialize.
- Lighter status colors won't pass body-text contrast thresholds against a white background.
- Multiple tinted IDs would add visual noise without adding information.

**Concept:** *One cell, one signal.* Don't repeat the status signal in the identity cell.

---

### 4. Native `title` tooltip on truncated titles — `defect_list.html`

**Change:** Added a `title="<full title text>"` attribute to every title cell in the four rows.

**Why considered alternative:** A click-to-open modal showing the full title.

**Why rejected:** Modals are heavy UI elements meant for input collection or rich content — using one to show a single text line is overkill, creates inconsistent click patterns on the row, and gives the user *less* context than they'd get from clicking the ID.

**Why the native `title` won:** Zero new components, zero JavaScript, zero new patterns to maintain. Same pattern Slack/Jira/GitHub use for truncation. Touch users still have the click-to-detail path via the ID.

**Concept:** *Lightest pattern possible.* Reach for native browser behavior before reaching for new components.

**Future note:** When `defect_list` becomes JS-rendered, the same `title` attribute should be set programmatically when building each `<td>`.

---

### 5. Dashboard ↔ Defect List behavior synergy

**Change applied:** Added the same native `title` tooltip to truncated titles in the dashboard's defect summary table (inside `renderReportTable` in `js/app.js`).

**Change deliberately NOT applied:** Did **not** add the pencil edit icon to the dashboard table.

**Why the deliberate gap:**
- *Dashboard = monitoring* — users glance, scan trends, drill in if something is off.
- *Defects page = management* — users triage, edit, reassign.
- Adding an inline edit affordance to the dashboard would invite users to act in a context built for observation. If they need to edit, they click the defect to view detail and edit from there.

**Concept:** *Synergize where mental models overlap, diverge where they intentionally don't.* Same UI patterns where the page's purpose calls for them; preserved differences elsewhere.

---

### 6. Defect List trimmed from 14 columns to 11

**Change:** Dropped three workflow-specific date columns from the list view: **Release Deployment Date, Fix Date, Closure Date**.

**Final 11 columns:** Defect ID · Title · Project · Environment · Severity · Priority · Status · Assigned To · Release Version · Created By · Created Date.

**Why:** A 14-column table forces horizontal scroll and slows scanning. The dropped columns are only meaningful when reasoning about a specific defect's lifecycle — exactly the context the *detail page* serves.

**Intent:** Optimize the list for *scanning many rows*, push lifecycle detail to the *detail page* where it belongs.

**Why Created By stayed (user override of the proposed cut):** Identifies originator at a glance, useful for triage conversations ("who logged this?").

**Concept:** *List for scanning, detail for depth.* Don't over-load the list with columns whose value only materializes when looking at one row.

---

### 7. Sortable column headers on defect_list (with smart sorting)

**Change:** Every column header in `defect_list.html` is now sortable. Click once for ascending, click again for descending. The `↕` icon next to each header label toggles to `↑` or `↓` to indicate the active sort direction. Behavior visually mirrors the dashboard's defect summary table (same `report-table` class, same arrow indicators).

**Smart-sort rules:**
- **Severity** — sorts by urgency weight (Critical > High > Medium > Low), not alphabetically.
- **Priority** — sorts by P-rank (P1 > P2 > P3 > P4).
- **Defect ID** — numeric-aware comparison (DF-1018 sorts before DF-1029 reliably).
- **Created Date** — ISO date format (YYYY-MM-DD), so lexical sort is correct.
- All other text columns — locale-aware natural sort.

**Why:** Without sorting, a user with many defects has no way to surface "newest first," "P1 first," or "Critical first." Pure scrolling is not triage.

**Concept:** Sorting is core triage functionality. Smart-sort prevents the alphabetical-trap (Critical < Low alphabetically, which is meaningless to the user).

---

### 8. Dashboard sort logic upgraded to match defect_list

**Change:** Replaced the dashboard's basic alphabetical `sortedReportRows` logic with the same urgency-weighted/P-rank/numeric-aware sort used on `defect_list`.

**Why:** Without this, clicking "Severity" on the dashboard would have given alphabetical order (Critical, High, Low, Medium) — meaningless to the user. The dashboard is also where triage starts.

**Concept:** *Two near-identical surfaces should behave identically.* Cross-page consistency means no surprises when the user moves between dashboard and defect list.

---

### 9. Binary Excel export choice — "Current view" vs "All columns"

**Change shipped (source-level — see Discovered Issue below before testing in browser):**

- Replaced the single `Export CSV` button on `dashboard.html` with an **export split-button**: a primary `Export CSV` button bonded to a small caret (`▾`). The caret opens a popover menu with two items:
  - **Current view** (primary) — exports exactly what is on-screen: visible columns × filtered rows. Filename: `defect_dashboard_current_view.csv`.
  - **All columns** (secondary) — exports every available field defined in `REPORT_ALL_COLUMNS`, including fields the table hides today (description, deployment date, fix date, closure date). Filename: `defect_dashboard_all_columns.csv`.
- The same export split-button was added to `defect_list.html` for visual/behavioral parity. Because the page is currently static-rendered, both modes return the same CSV today; the dropdown is in place so it grows with the data layer (when descriptions / fix dates / closure dates land, the All-columns export will start including them automatically without needing a UI change).
- Both menus close on outside-click and on `Esc`; `aria-haspopup`, `aria-expanded`, and `role="menu"` are wired for screen-reader behavior.
- A shared helper `initExportSplit(root, exportFn)` was added near the top of `js/app.js` so both pages reuse the same open/close/keyboard logic — single source of truth for menu behavior.
- The CSV export now uses **human-readable column labels** in the header row (e.g. "Defect ID" instead of `id`, "Created Date" instead of `createdDate`) — the file is meant to be opened in Excel, not parsed by code.

**Why this and not column show/hide in the table:** Per-column pickers create a *consistency tax* (every user sees a different version of the page, support questions get harder). A binary export choice serves the two real workflows — share-what's-on-screen vs. dump-everything — without introducing per-user view drift.

**Why "Current view" is primary (default):** The most common export use case is "share what I'm looking at right now" — typically after applying filters. Putting "All columns" behind one extra click keeps the common path one-click.

**Concept:** *Be opinionated in the app; let the export be the flexibility valve.*

**Files touched:**
- `dashboard.html` — Export button replaced with `.export-split` block.
- `defect_list.html` — Same `.export-split` block added next to filter actions.
- `js/app.js` — Added `initExportSplit` helper; added `REPORT_VISIBLE_COLUMNS`, `REPORT_ALL_COLUMNS`, `REPORT_COLUMN_LABELS`; refactored `exportReportCsv(mode)`; added `exportDefectListCsv(mode)` for the defect_list page.
- `css/app.css` — Added `.export-split`, `.export-split-main`, `.export-split-caret`, `.export-split-menu`, `.export-split-menu-item`, `.export-split-menu-label`, `.export-split-menu-hint` styles. Suppressed the `|` separator between main and caret so they read as one bonded control.

---

## ⚠ Discovered Issue (blocking verification of #9)

**Date:** 2026-05-05 (this session)

**Finding:** `js/app.js` is truncated mid-statement and fails to parse. The file's last line is:

```
          workflowState = JSON.parse(savedWorkflow);
```

…with no closing braces, no completion of `loadWorkflow`, no rest of the workflow-editor block, and no closing `})();` for the outer IIFE. `node -c js/app.js` reports `SyntaxError: Unexpected end of input`.

**When introduced:** Pre-existing — the file's modify time (2026-05-05 12:01) is before this session began. Comparing to `HEAD`, the diff hunk `@@ -3070,175 +3591,4 @@` shows that **175 lines** of working `loadWorkflow` body and subsequent workflow-editor functions (plus the IIFE close) were replaced by just 4 lines that end mid-statement. None of today's export-dropdown changes are in or near that block; my edits are at lines ~152, ~1525, ~1612, ~2716 — all well above the truncation point.

**Impact:** Because a JS syntax error halts the entire script at parse time, **no JavaScript runs on any page** in the current working tree — no filters, no sort, no defect-row clicks, no export, no workflow editor. Today's dropdown is correctly written in source but cannot execute until the file parses.

**Decision needed from user before proceeding:**
1. **Restore the missing block from `HEAD`** — safest, brings the workflow editor back to its last committed state. We then re-apply any intended workflow-editor edits intentionally and consciously.
2. **Reconstruct the intended new logic** — only viable if the user remembers what was being written when the truncation happened.
3. **Other** — user-defined approach.

**Once unblocked:** The export-split dropdown will be verified end-to-end (open menu, both modes export correctly, filtered rows respected, click-outside-to-close, Esc-to-close), and the entry above will be moved out of "shipped pending verification" into the regular log.

---

### 10. SVG icon-only controls for optical centering

**Change:** Replaced font/text glyphs in icon-only controls with SVG icons:

- Sidebar collapse and restore chevrons.
- Dashboard chart move grip.
- Dashboard chart remove action.
- Export split caret.
- Workflow zoom controls.

**Why:** Text glyphs such as `x`, `::`, and chevrons have uneven font metrics. Even when CSS centers them mathematically, they can look visually off center inside small controls.

**Concept:** *Operational controls should feel precise.* SVG icons preserve the minimal design language while improving optical centering and perceived product quality.

**Files touched:**
- `*.html` sidebar toggle and export caret markup.
- `status_workflow.html` workflow zoom icon markup.
- `js/app.js` dynamic chart and sidebar icon rendering.
- `css/app.css` shared icon-only alignment rules.
- `DESIGN_DECISION_LOG_V2.md` and `STYLE_SYSTEM_MAPPING.md` decision tracking.

---

## Open / Future Considerations (deferred)

- **Server-side pagination after backend migration** — current pagination is client-side over the static sample data. Flask/PostgreSQL should preserve the same UX while moving sort/filter/page size into query parameters.
- **Column show/hide UI** — explicitly *deferred*, not roadmapped. Only revisit if real users repeatedly request it.

---

*Maintained by Claude during the UI Freeze phase. Every change to the UI must be appended here with the same shape: change, why, intent, concept.*

---

## Active Project Scoping For Defect Data

**Change:** Added shared project records to `js/sample-data.js`, including active/inactive status. Added two `Legacy CRM` dummy defect records to prove the rule, then updated the shared defect data getter so inactive-project defects are excluded from scoped operational data.

**Why:** Dashboard and defect-list views should reflect only active QA project scope. Inactive project defects may exist historically, but they should not inflate current health metrics or active work queues.

**Intent:** Prepare the static UI for the backend rule we will need in Flask/PostgreSQL: project activity belongs in the data/query layer, not as a cosmetic filter on one page.

**Concept:** *Active portfolio first; archived project data stays available without polluting operational health.*

---

## UI Closure Pass: Tables, Chart Spectrum, Pagination

**Change:** Standardized operational table row height, reduced visual row drift between data and management tables, added pagination to the dashboard summary table and defect list, and made dashboard chart colors dimension-aware.

**Why:** The final polish concerns were table density, occasional repeated chart colors between unrelated units, and long operational tables growing without page control.

**Intent:** Make the last Phase 1 surfaces feel controlled and production-ready before backend work begins.

**Concept:** *Stable density, distinct signals, controlled volume.*

**Files touched:**
- `dashboard.html` — pagination footer anchor for the dashboard table.
- `defect_list.html` — pagination footer anchor and client-rendered table marker.
- `js/app.js` — shared pagination renderer, dashboard table paging, defect-list data paging/sorting/export alignment, dimension-aware chart palettes.
- `css/app.css` — table density tokens, stable row heights, pagination control styling.

---

## Final Controller Consistency Pass

**Change:** Added 10/40/100 page-size selectors to dashboard and defect-list pagination, restored view-defect hover tooltips, removed the extra Add Chart header close button, enabled edit-page inline screenshot steps and document attachments, and aligned project/user/environment tables with the operational table rhythm.

**Why:** The last visible inconsistencies were small but high-friction: page volume control, missing link affordances, mismatched management-table density, and edit-page controls that did not support the same attachment and reproduction-step behavior as create.

**Intent:** Keep the static UI prototype coherent before backend work starts, with shared behavior where the same control pattern appears in multiple pages.

**Concept:** *One control language across the product.*

**Files touched:**
- `dashboard.html` - removed the redundant chart-modal close button.
- `defect_edit.html` - added the rich Steps to Replicate editor and a real attachment file input.
- `js/app.js` - shared page-size selector support and view-defect tooltip metadata.
- `js/steps-editor.js` - reusable Tiptap editor module for edit-page inline screenshots and image resizing.
- `css/app.css` - management-table density, status-toggle fit, and pagination-selector styling.

---

## Management Row Edit Stability

**Change:** Fixed management-table action button dimensions so `Edit` and `Save / Cancel` occupy stable button footprints.

**Why:** Clicking edit on Projects, Users, or Environments could make the row feel animated or unstable because the action controls were changing height/width.

**Intent:** Make inline editing feel seamless: the row content changes, but the row breadth and height stay visually steady.

**Concept:** *Stable controls, quiet state changes.*

**Files touched:**
- `css/app.css` - normalized management-table action button height, width, margin, and row-action alignment.

---

## Frontend Validation Layer

**Change:** Added shared UI validation helpers, consistent invalid-field styling, page-specific validation wiring, and a dedicated validation rules markdown.

**Why:** The UI needed one final contract for required fields, date ranges, attachment limits, passwords, duplicate management records, and how validation messages should appear before backend work starts.

**Intent:** Make every controller feel deliberate and ready for Flask/PostgreSQL validation parity later.

**Concept:** *Validate close to the field, explain once, keep the layout stable.*

**Follow-up refinement:** Validation message copy now uses a parameterized frontend message catalog so common wording stays consistent across fields, modals, filters, and inline table edits.

**Follow-up correction:** Profile modal validation is bound directly to its save action, no-change profile saves are blocked, and Expected Result / Actual Result are now mandatory on both create and edit defect forms.

**Files touched:**
- `js/app.js` - shared validation helpers and page-specific validation wiring.
- `css/app.css` - invalid field and inline error styles.
- `UI_VALIDATION_RULES.md` - validation rules and message placement contract.

---

## Steps And File Storage Sync

**Change:** Shared the same Tiptap `Steps to Replicate` editor between create and edit, changed pasted screenshots to insert as base64 image nodes at the captured cursor position, added an additive multi-file attachment queue, and changed attachment/inline uploads to send actual file content instead of metadata-only stubs.

**Why:** The create/edit pages needed identical reproduction-step behavior, multiple attachment selections needed to accumulate instead of replacing earlier choices, and database `storage_key` values must point to real physical files.

**Intent:** Keep inline screenshots inside the steps flow, keep standalone attachments separate, and make the final Flask/PostgreSQL baseline strict enough that file metadata cannot drift away from file storage.

**Concept:** *If the database says a file exists, the file exists.*

**Guardrail:** Upload writes now remove the newly written file if the corresponding database insert fails, preventing fresh orphan files.

**Follow-up correction:** Inline screenshots can now be resized in both the Tiptap editor path and the fallback contenteditable path. The resize handle appears on hover/selection and writes the adjusted width back into the saved steps HTML.

**Stability correction:** Replaced the remote Tiptap/module implementation with a single local contenteditable editor dedicated to this product workflow. The editor now owns image paste, insertion position, resize handles, delete behavior, and clean hidden HTML output without relying on CDN-loaded editor code or duplicate fallback handlers.

**Clipboard correction:** Inline screenshot paste now reads image content only from `clipboardData.items`. The editor no longer combines `clipboardData.items` with `clipboardData.files`, preventing Chrome/Edge from inserting the same pasted screenshot twice. Pasted screenshots stack vertically, and Backspace/Delete only removes a screenshot after the user explicitly selects that screenshot.

**Keyboard correction:** Added `beforeinput` and `keydown` guards for `deleteContentBackward` and `deleteContentForward` so Chrome/Edge cannot delete a screenshot just because the caret is in an empty paragraph beside it. Keyboard deletion remains supported for explicitly selected screenshots, while cursor-based Delete/Backspace now preserves screenshots and normalizes only the adjacent empty spacer.

**Selection correction:** Typing, pressing Enter, moving through text with non-delete keys, or saving a text caret now clears screenshot keyboard-delete state. A screenshot is removable by keyboard only after the user explicitly clicks that screenshot, preventing Backspace in later text from deleting an earlier pasted image.

**Attachment action correction:** Download and Preview buttons now fetch protected attachment content through the authenticated API layer instead of using plain browser links. Image attachments preview inside the existing modal from a temporary blob URL; non-image files show a simple preview-unavailable message and remain downloadable.

## Release Date UX Refinement

**Change:** Made Release Version a typed Phase 1 defect field, made Release Deployment Date selectable by the developer when fixing a defect, capped Fix Date at today, and locked Closure Date until the defect Status is `Closed`.

**Why:** Release/date fields are lifecycle fields, not general defect-entry fields. The UI now guides the developer to state the target release and deployment date when marking a fix ready for testers.

**Concept:** *Lifecycle dates unlock when the lifecycle makes them meaningful.*

**Files touched:**
- `defect_create.html` - switched to the shared steps editor module.
- `js/steps-editor.js` - stabilized pasted image placement and base64 image insertion.
- `js/app.js` - added queued multi-file selection plus base64 upload payloads for create/edit, authenticated blob download, and image preview handling.
- `css/app.css` - added image preview fit/message styling.
- `app.py` - decodes upload content, writes files under `FILE_STORAGE_ROOT`, and stores matching `storage_key` values.
- `api/API_DB_MAPPING.md` - records the stricter upload contract and content-backed storage behavior.
