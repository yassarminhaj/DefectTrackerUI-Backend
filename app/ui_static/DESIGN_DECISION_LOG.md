# Defect Tracker Design Decision Log

This document captures the design intent, UX reasoning, brand direction, and product decisions behind the current static UI prototype for the Defect Tracking Tool.

It is meant to be reused later for Flask/PostgreSQL implementation, product documentation, design consistency checks, stakeholder walkthroughs, and marketing-level positioning.

## Product Intent

The Defect Tracking Tool is designed as a focused QA defect lifecycle management application. Its purpose is to help QA teams, developers, leads, and project stakeholders see defect health clearly, act on defects quickly, and maintain clean control over projects, users, environments, workflows, and reporting.

The tool is intentionally not styled like a generic admin template. The goal is a calm, professional, readable QA workspace that can grow into a production Flask and PostgreSQL application without losing its visual identity.

Core intent:

- Make defect tracking feel structured and dependable.
- Keep the interface simple enough for daily QA usage.
- Prioritize readability, spacing, and stable controls over decorative effects.
- Give the product a distinct identity through the DT mark, typography, and monochrome system.
- Use color only where it carries meaning.

## Design Philosophy

The design direction is intentionally minimal, restrained, and operational.

The application is not a marketing landing page. It is a work tool. The UI should help users scan, compare, filter, update, and review defect information without visual noise.

Key principles:

- Simple layouts over complex panels.
- Stable table rows and controllers over animated movement.
- Clear hierarchy using spacing, borders, headers, and typography.
- Minimal colors with strong semantic meaning.
- Reusable interaction patterns across pages.
- Professional tone in copy, avoiding temporary or prototype language in the visible UI.
- No unnecessary role, authentication, backend, or database behavior in the static UI phase.

## Visual Identity

The approved product identity is the existing `DT` mark in the sidebar.

Reasoning:

- It is short, recognizable, and suitable for a browser favicon.
- It keeps the Defect Tracker distinct from the parent company brand.
- It works well in the black-and-white product theme.
- It gives the tool a clean internal-product identity without over-branding the workspace.

Improve Software Labs is treated as the parent brand. It appears subtly on the login page only, as:

`Solution By (c) Improve Software Labs`

This keeps the parent company visible without letting it dominate the Defect Tracker product experience.

## Typography

The selected font is `Book Antiqua`.

Reasoning:

- It gives the application a distinctive and premium feel compared with default web fonts.
- It supports the black-and-white visual system well.
- It gives headings, table labels, and controls a more deliberate identity.
- It helps the product avoid looking like a generic Bootstrap/Skeleton admin screen.

Typography guidance:

- Use strong type hierarchy, not oversized text.
- Keep table and form text readable.
- Avoid cramped labels.
- Avoid scaling fonts aggressively by viewport width.
- Keep tab text smaller than section titles.

## Color System

The product uses a strict monochrome base with red and green reserved for status meaning.

### Neutral Palette

| Color | Usage Intent |
| --- | --- |
| `#0e1010` | Deepest product black, sidebar, strongest structure |
| `#262828` | Dark surface, primary buttons, table headers |
| `#303635` | Secondary dark tone, borders, hover structure |
| `#e7e7e7` | Light surface, faint dividers, soft backgrounds |
| `#ffffff` | Main content background and card interiors |

Reasoning:

- Black, grey, and white create a serious QA/productivity workspace.
- The palette reduces distraction and lets defect information carry the emphasis.
- The light grey is used for subtle division without making sections visually heavy.
- Dark headers with white text create clear scanning zones in tables.

### Red Palette

| Color | Usage Intent |
| --- | --- |
| `#5c1c1c` | Most severe negative state |
| `#b83737` | High severity / strong negative state |
| `#c65f5f` | Medium negative state |
| `#dc9b9b` | Low or light negative state |

Reasoning:

- Red is reserved for defects, severity, risk, and negative project health.
- The more severe the issue, the deeper the red.
- This keeps severity badges meaningful and easy to understand.

### Green Palette

| Color | Usage Intent |
| --- | --- |
| `#23402a` | Strong positive or active state |
| `#2a4d32` | Healthy status / strong completion state |
| `#7ea687` | Moderate positive state |
| `#b5ccbb` | Light positive state |

Reasoning:

- Green is reserved for healthy, active, completed, or positive outcomes.
- Positive statuses such as active, closed, or progressing states can use this range.
- Red and green are not decorative; they communicate operational meaning.

## Interaction And UX Decisions

## Sidebar Navigation

The sidebar is consistent across the application and includes all major modules:

- Dashboard
- Defects
- Create Defect
- Projects
- Users
- Environments
- Status Workflow
- Reports

The sidebar supports collapse/hide behavior to give users more working space when needed.

Reasoning:

- QA users often work with wide tables.
- Collapsing the menu improves visibility without removing navigation permanently.
- The DT mark remains the identity anchor.

## Buttons And Controls

The red action style is intentionally reserved for the `Create Defect` button on the defect list page.

Reasoning:

- Creating a defect is the most defect-specific action in the product.
- Applying the same red style everywhere would reduce its meaning.
- Other buttons stay neutral so the UI remains calm.

Controller consistency was improved across text fields, dropdowns, date inputs, segmented controls, and inline edit states.

Reasoning:

- Users should not feel that each page behaves differently.
- Hover, focus, click, edit, save, and cancel states should feel predictable.
- Static UI should already model production-quality UX behavior.

## Tables

Tables use consistent borders, dark headers, stable row heights, and clear left/right boundaries.

Reasoning:

- Defect tracking is table-heavy.
- Stable row dimensions prevent visual shaking during inline edit.
- Borders should help scanning without becoming visually harsh.
- Attachment tables should match the same visual language as project, user, environment, and defect tables.

The `Created By` field was added wherever defect table/detail context needs it.

Reasoning:

- In production, this value should come from the logged-in user.
- It should be system-owned and non-editable.
- It improves traceability and audit readiness.

## Filters

Dashboard filters and defect filters use expandable/collapsible sections.

Defect filters apply only when the user clicks the apply action.

Reasoning:

- Dashboard filtering can feel exploratory.
- Defect table filtering should feel deliberate because table data is operational.
- Collapsing filters gives more vertical space to charts and tables.

Filter header actions use plain text with pipe separators.

Reasoning:

- Icons were visually noisy and alignment-sensitive.
- Text links are clearer, calmer, and easier to keep consistent.
- Pipe separators create a predictable pattern for future filter areas.

## Dashboard

The dashboard is the QA health entry point.

Current intent:

- Cards summarize key defect health indicators.
- Charts visualize defect distribution and trends.
- A table supports detailed review after visual inspection.

The agreed direction is:

- Keep cards first.
- Place charts second.
- Place filters above the table.
- Keep the dashboard interactive but not cluttered.
- Allow charts to be added, moved, resized, removed, and restored.

Future dashboard refinement ideas:

- Move the dashboard subtitle into the header or remove it to save vertical space.
- Reduce KPI card height so charts appear sooner.
- Consider 5 or 7 KPI cards, not too many.
- Start with 5 or 7 useful default charts.
- Add chart types such as pie and stacked bar where they add real analysis value.

## Defect List

The defect list is the operational defect table.

Key decisions:

- Expandable defect filters.
- Apply-based filtering.
- Created By column included.
- Create Defect button has the intentional red style.
- View and Edit actions remain visually neutral.

Reasoning:

- Defect list should support structured lookup, not just passive display.
- Filters should not unexpectedly alter results until the user applies them.
- The table needs enough columns for real QA traceability.

## Create Defect

The create defect page includes a rich `Steps to Replicate` editor rather than a plain textarea.

Key decisions:

- Users can type steps and paste screenshots inline.
- Pasted images become part of the steps flow, not separate attachments.
- Images can be resized with a simple drag handle.
- A separate attachment area remains available for formal files.
- Created By is treated as system-owned and non-editable.

Reasoning:

- QA users often explain defects through screenshots.
- Inline screenshots make reproduction steps easier to understand.
- Separate attachments are still needed for logs, PDFs, documents, JSON, and other supporting files.
- The editor should not require a toolbar unless users need it.

## Defect Detail

The defect detail page was refined into a more structured review workspace.

Key decisions:

- Summary header shows the defect identity, assignment, project, environment, creator, badges, and key actions.
- Defect details are grouped into tabs:
  - General
  - Execution Details
  - Attachments
  - Release
- Comments and history are grouped as a separate collaboration/audit area.
- Tabs use a refined underline treatment aligned with the card header border.
- Internal lines were softened using the lightest grey shade.

Reasoning:

- Defect detail pages can become crowded.
- Tabs reduce scrolling and improve navigation.
- Summary controls should stay prominent but not overpower the content.
- Comments and history belong together because both explain collaboration and audit trail.

## Projects

The projects page uses one table with an add record action.

Key decisions:

- Avoid separate form/table split.
- Add record from the table header.
- Inline edit preserves row height and column width.
- Active/Inactive uses a segmented control rather than a dropdown.

Reasoning:

- Project data is simple enough for inline management.
- A separate form wasted space.
- For two states, a dropdown is heavier than necessary.
- Stable inline edit prevents the UI from feeling jumpy.

## Users

The users page uses a modal for adding users and a separate password reset modal.

Key decisions:

- Add User opens a modal.
- New user form includes password and confirm password.
- Password is never shown in the table.
- Reset Password requires previous password, new password, and confirmation.
- Role management is intentionally excluded for now.

Reasoning:

- User creation has more fields than projects or environments.
- Password setup is sensitive enough to deserve a focused modal.
- Showing password-related fields inline would clutter the table.
- Roles, OTP, email confirmation, and advanced policy can come later.

## Login Context And Data Scope

The login experience should introduce a clear working context for the user:

- `Test`
- `Prod`
- `All`

Test represents all non-production environments such as DEV, SIT, UAT, Pre-Prod, and any future non-production environment. Prod represents only PROD. All represents a merged cross-context view for users who need a broader management or review picture.

Reasoning:

- Production defects should not be diluted by test-cycle defects.
- Test defect health and production defect health answer different operational questions.
- The dashboard total defect count, charts, reports, defect list, and filters should respect the active user context.
- The current context should feel like part of the signed-in user profile, not just a temporary filter.
- Context awareness keeps the product ready for backend authorization and reporting rules later.

Static UI implementation direction:

- Add a minimal, distinct Test / Prod / All context selector to the login page.
- Default direct-page access to `Test` until real authentication exists.
- Show the selected context inside a `qa.user` profile component in the sidebar area.
- Keep the visible profile component compact: `qa.user` plus a small context badge.
- Allow context switching from the profile component:
  - `Test`
  - `Prod`
  - `All`
- Include `Logout` in the same profile menu, routing back to the login page in the static prototype.
- Restrict environment choices in Create Defect based on context:
  - Test shows non-production environments.
  - Prod shows only PROD.
  - All allows the full environment list because the user still chooses the exact environment where the defect was found.
- Read static sample data from `js/sample-data.js` so the prototype can filter consistently by context.
- Dashboard, Defect List, Reports, and Create Defect should respect the active context from the shared data layer.
- In the static UI, context switching refreshes the current page so the visible tables, cards, filters, charts, and environment dropdowns rehydrate from the selected scope.

Backend implementation note:

- In the Flask/PostgreSQL phase, the selected context should influence dashboard aggregates, defect list queries, reports, filters, and create/edit environment options.
- The context should not be treated as a cosmetic filter only; it should become part of the data access and reporting model.

## Environments

The environments page mirrors the simplified project management pattern.

Key decisions:

- One table.
- Add record from the table header.
- Inline edit.
- Active/Inactive segmented control.
- Default examples include DEV, SIT, UAT, Pre-Prod, and PROD.

Reasoning:

- Environment management is simple reference data.
- It should feel consistent with project management.
- QA teams need environment visibility throughout defects, reports, and filters.

## Status Workflow

The status workflow page evolved into a simplified visual workflow editor.

Current direction:

- Process nodes represent actual defect statuses.
- Decision node functionality was removed after review.
- Connections represent allowed transitions.
- Arrows show direction clearly.
- Users can pan, zoom, connect, move, and edit workflow nodes.
- Transition chips summarize allowed status movements.

Reasoning:

- The workflow should feel visual and direct, inspired by simple Drawflow-style editors.
- The editor should not become a complex BPM tool.
- Process nodes are easier for QA users to understand.
- The diagram should eventually become the source of truth for allowed status movement.

Future implementation note:

- In the Flask/PostgreSQL phase, workflow data should be persisted as structured JSON or normalized transitions.
- Defect status dropdown values should be derived from the workflow transitions.
- No hardcoded status lifecycle should remain once backend integration begins.

## Reports

The reports page supports filter-driven reporting with export actions.

Key decisions:

- Keep report filters clear and familiar.
- Show summary cards before detailed tables.
- Export actions remain simple.

Reasoning:

- Reports should support QA leads and project stakeholders.
- Filters must match core defect dimensions such as project, environment, status, severity, assignee, and release.
- Export is expected in QA workflows.

## Copy And Language Direction

Visible UI copy should be polished and product-ready.

Approved copy examples:

- `QA Defect Lifecycle Management`
- `Monitor defect health across projects, releases, environments, and assignees`
- `Manage project coverage`
- `Add and maintain project records`
- `Add users, update account status, and reset passwords`
- `Manage testing and release environments`
- `Defect saved for review`

Avoid visible UI phrases such as:

- `static prototype`
- `sample UI only`
- `Phase 1`
- `sample records`
- `no data was submitted`

Reasoning:

- The UI should feel like a real product even when the implementation is static.
- Temporary language weakens the perceived quality.
- Product copy should be short, direct, and reusable.

## Marketing Positioning

This product can be positioned as a premium, focused QA command center rather than a generic bug tracker.

Potential marketing angles:

- A clean QA defect lifecycle management tool built for structured teams.
- A defect workspace that connects defects, releases, environments, ownership, workflow, and reporting.
- A calmer alternative to cluttered issue-tracking screens.
- Designed around QA visibility, not just ticket storage.
- Visual workflow-driven status control for clearer lifecycle governance.
- Inline screenshot-based reproduction steps for faster developer understanding.
- Purpose-built dashboards for defect health across projects, releases, environments, and assignees.

Short positioning statements:

- `A focused QA defect lifecycle management workspace.`
- `Track defect health across projects, releases, environments, and assignees.`
- `Designed for QA teams that need clarity, control, and traceability.`
- `A clean operational layer for defects, workflows, and release quality.`

Marketing-safe claims for the current UI stage:

- The interface is designed around QA defect lifecycle workflows.
- The UI includes dashboards, defect tables, rich defect creation, workflow editing, and reporting screens.
- The design system uses semantic red and green status language.
- The product identity is intentionally minimal and professional.

Claims to avoid until backend implementation exists:

- Real-time defect analytics.
- Production-ready authentication.
- Database-backed workflow enforcement.
- Live team collaboration.
- Automated notifications.

## Future Leverage

This document can be reused for:

- Flask/PostgreSQL implementation handoff.
- Backend model planning.
- UI acceptance criteria.
- Product requirement documents.
- Pitch decks and sales material.
- Website copy.
- Developer onboarding.
- QA test cases.
- Design system governance.
- Future AI prompts for consistent implementation.

Recommended future artifacts:

- `PRODUCT_REQUIREMENTS.md`
- `BACKEND_IMPLEMENTATION_PLAN.md`
- `DATABASE_MODEL_NOTES.md`
- `UI_ACCEPTANCE_CRITERIA.md`
- `MARKETING_COPY_BANK.md`

## Design Guardrails

Future changes should follow these guardrails:

- Preserve the DT identity.
- Preserve the black, grey, and white base.
- Use red only for negative/severity/risk meaning.
- Use green only for positive/healthy/status meaning.
- Keep layouts stable during edit states.
- Keep tables visually consistent.
- Keep controls consistent across pages.
- Avoid unnecessary animations.
- Avoid prototype language in visible UI.
- Use modals when inline editing would make a table crowded.
- Use inline editing when data is simple and row-level.
- Keep the product work-focused, not decorative.

## Navigation And Account Pattern

- The DT mark doubles as the product identity and the home action; clicking it routes users back to the dashboard.
- The sidebar keeps context switching inside the user profile area so the main navigation remains focused on modules.
- The profile menu exposes only the Phase 1 essentials: current user, data context, context switching, and logout.
- Full menu restore uses the same arrow language, size, and rounded control treatment as the half-collapse control instead of showing a large text tab.
- Spacing between the user profile and hide-menu control is intentionally preserved so the lower sidebar actions do not feel crowded.
- When the sidebar is fully hidden, only the restore control is visible; the half-collapse control is suppressed to avoid duplicate arrows.
- Context switching in the profile menu uses a compact account card with three calm sections: username, Context choices, and Logout. Sections are separated with the light grey brand divider; active context is indicated by text weight, not extra rails or underlines.

## Summary

The current UI direction is a deliberately minimal QA defect management workspace with a premium monochrome identity, semantic red/green status language, stable operational controls, and enough structure to grow into a production Flask/PostgreSQL product.

The strongest design idea is restraint: the interface should help users understand defect health and act on defects without distraction.
