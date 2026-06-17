# Defect Tracker Style System Mapping

Canonical source of truth: `C:/Users/yassa/OneDrive/Documents/Claude/Projects/DefectTracker/Static_UI/DefectTrackerUI/UI_STYLE_GUIDE.md`.

This file maps that contract to this static UI project. It intentionally does not restate the full contract; when a rule is needed, read the canonical guide first.

## Local Files

| File | Role |
|---|---|
| `css/app.css` | Token block, layout, component styles, workflow/editor styling |
| `js/app.js` | Chart color/token reads, chart datalabel behavior, dynamic badges |
| `js/sample-data.js` | Static data only; no styling decisions |
| `*.html` | Static page structure using shared class patterns |

## Token Mapping

| Contract area | Local implementation |
|---|---|
| Font stack | `--font-sans` in `:root`; applied by `body`, form controls, Chart.js defaults, workflow controls |
| Brand neutrals | `--bg`, `--surface`, `--surface-soft`, `--border`, `--text`, `--muted`, `--primary`, `--primary-dark`, `--sidebar`, `--sidebar-muted` |
| Severity ramp | `--sev-critical`, `--sev-high`, `--sev-medium`, `--sev-low` |
| Status palette | `--status-new`, `--status-assigned`, `--status-in-progress`, `--status-fixed`, `--status-retest`, `--status-closed`, `--status-reopened` |
| Focus ring | `--control-focus-ring` plus token-based `color-mix()` variants for compact controls |

## Component Mapping

| Contract pattern | Local selectors |
|---|---|
| Brand identity marks | `.dt-loader-mark`, `.login-card-mark`, `.brand` |
| Buttons | `.button-primary`, `.create-defect-cta`, `.header-action`, `.export-split-main`, `.export-split-caret` |
| Cards | `.card`, `.card-header`, `.card-pad`, `.detail-card`, `.report-chart-card` |
| Tables | `.report-table`, `.management-table`, shared `table`, `thead th`, `td` |
| Badges | `.badge-*`, generated badge classes in `js/app.js` |
| KPI cards | `.dashboard-kpi`, `.summary-card`, dashboard KPI stripe selectors |
| Filter panels | `.dashboard-filter-panel`, `.defect-filter-panel`, `.filter-actions` |
| Charts | `.report-chart-card`, `.canvas-wrap`, Chart.js config in `js/app.js` |
| Icon-only controls | `.sidebar-toggle`, `.sidebar-restore-tab`, `.chart-drag-handle`, `.chart-remove-button`, `.workflow-zoom-controls button`, `.export-split-caret`, `.profile-icon-button` |
| Tabs | `.tab-button`, `.tab-panels`, `.tab-panel` |
| Workflow editor | `.workflow-*` selectors and workflow rendering logic in `js/app.js` |
| Account/context menu | `.sidebar-profile-*`, `.profile-icon-button`, `.profile-context-*`, `.profile-menu-action`, `.profile-logout-link` |
| Account profile modal | `.profile-modal`, `.profile-modal-card`, `.profile-form-grid` |

## Local Decisions And Exceptions

| Item | Decision |
|---|---|
| Intermediate dark nav shade from the guide narrative | Not added as a token. Local active/dark UI surfaces map to `--primary` or `--primary-dark` to honor the no-new-token and no-raw-hex requirements. |
| Manifest theme colors | Removed from `site.webmanifest` because a web manifest cannot reference CSS custom properties and raw hex outside `:root` is disallowed. |
| Compatibility tokens | Existing non-color structural tokens such as `--control-height`, `--control-compact-height`, `--control-radius`, and `--shadow` remain for layout compatibility. |
| Shadows | Standard `.card` remains flat through `--shadow: none`. Non-card overlays/loaders retain token-based shadows using `color-mix()` where needed. |
| Non-standard workflow statuses | `Developer Rejected` maps to the alarm status color and `Not a Defect` maps to the closed status color in generated charts/badges. Decision labels remain separate from real status labels in the workflow editor. |

## Audit Notes

- Raw hex values are allowed only in `:root`.
- Chart colors are read from CSS custom properties in `js/app.js`.
- Weight `800` is reserved for the DT identity moments used in this project.
- The sister guide remains canonical; this file only maps local class names and records local exceptions.
