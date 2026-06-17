# Status Workflow Module Test Spec

Source of truth: `workflow_definitions.diagram_json` stores the visual canvas and `workflow_transitions` stores the generated operational transitions.

## Scope

- Status Workflow UI loads the active workflow from PostgreSQL through `/api/v1/workflow`.
- `/api/v1/workflow` exposes the canonical `statuses`, `terminalStatuses`, and `initialStatus` used by the rest of the UI.
- Process nodes are real defect statuses.
- Arrows between process nodes define allowed transitions.
- Decision nodes are intentionally excluded from Phase 1.
- Saving the canvas creates a new active workflow version and regenerates `workflow_transitions`.

## Manual Test Cases

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| SWF-UI-001 | Open workflow page | Sign in, open `status_workflow.html`. | Page loads the active database workflow and shows process nodes, arrows, zoom controls, and allowed transition chips. |
| SWF-UI-002 | Add process node | Click `Add Process`. | A selected `New Status` process node appears on the canvas. |
| SWF-UI-003 | Rename process node | Double-click a process label and enter a new label. | Label edits inline on the node; no browser prompt is used. |
| SWF-UI-004 | Drag node | Drag a node to a new position. | Node moves smoothly; connected arrows redraw to the new position. |
| SWF-UI-005 | Connect nodes | Drag from a node handle to another node. | Directed arrow is created and the allowed transitions chips update. |
| SWF-UI-006 | Delete selected node | Select a node and click `Delete Selected`. | Node and its related arrows are removed locally. |
| SWF-UI-007 | Delete selected arrow | Select an arrow and click `Delete Selected`. | Arrow is removed locally and derived transition chip disappears. |
| SWF-UI-008 | Save workflow | Make a valid change and click `Save Workflow`. | UI shows `Workflow saved`; refreshing restores the saved database diagram. |
| SWF-UI-009 | Clear without save | Click `Reset / Clear Canvas`, then refresh without saving. | Previously saved database workflow returns after refresh. |
| SWF-UI-010 | Pan and zoom | Use `+`, `-`, space+drag, and double-click pan mode. | Canvas zooms/pans without changing browser zoom or page layout. |

## API Test Cases

| ID | Scenario | Request | Expected Result |
| --- | --- | --- | --- |
| SWF-API-001 | Missing auth rejects read | `GET /api/v1/workflow` without bearer token | `401 unauthorized`. |
| SWF-API-002 | Authenticated workflow load | `GET /api/v1/workflow` | `200`, active diagram, transitions array, `statuses`, `terminalStatuses`, and `initialStatus`. |
| SWF-API-003 | Valid workflow save | `POST /api/v1/workflow` with process nodes and arrows | `200`, new active version, generated transitions match arrows. |
| SWF-API-004 | Empty workflow rejected | `POST /api/v1/workflow` with no nodes | `400 validation_error`. |
| SWF-API-005 | Blank process label rejected | `POST /api/v1/workflow` with blank label | `400 validation_error`. |
| SWF-API-006 | Duplicate process label rejected | `POST /api/v1/workflow` with duplicate labels | `400 validation_error`. |
| SWF-API-006A | Normalized duplicate process label rejected | `POST /api/v1/workflow` with labels that differ only by spaces, hyphens, underscores, or case, such as `InProgress` and `In-Progress`. | `400 validation_error`; workflow labels remain unique across layers. |
| SWF-API-007 | Missing edge target rejected | `POST /api/v1/workflow` with edge to unknown node | `400 validation_error`. |
| SWF-API-008 | Transition lookup succeeds | `GET /api/v1/workflow/transitions?fromStatus=InProgress` | `200`, `allowedStatuses` contains configured outgoing statuses. |
| SWF-API-009 | Terminal transition lookup succeeds | `GET /api/v1/workflow/transitions?fromStatus=Rejected` | `200`, `allowedStatuses` is empty. |
| SWF-API-010 | Missing transition status rejected | `GET /api/v1/workflow/transitions` | `400 validation_error`. |
| SWF-API-011 | Unknown transition status rejected | `GET /api/v1/workflow/transitions?fromStatus=Unknown` | `400 validation_error`. |
| SWF-API-012 | Standalone process node is valid terminal status | Save a workflow with one process node and no arrows, then lookup that status. | `200`, `allowedStatuses` is empty. |

## Regression Notes

- The UI must not use browser storage as the workflow source of truth.
- `Reset / Clear Canvas` is an unsaved local editing action until `Save Workflow` is clicked.
- Workflow save should not create decision-node statuses because Phase 1 workflow is process-node only.
- A process node with no arrows is still a valid terminal status.
- Defect status movement, status filters, dashboard status charts, and visible defect statuses use active workflow process-node labels.
