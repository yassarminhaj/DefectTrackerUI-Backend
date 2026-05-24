# Defect Tracker Database User Stories

These stories describe the database-level product intent used by dbAT++.

## Context And Project Scope

- As a QA user, I can view defect health by data context: Test, Prod, or All.
- Test context includes DEV, SIT, UAT, and Pre-Prod.
- Prod context includes PROD.
- Operational dashboard and defect listing should include only active projects.
- Inactive project defects remain stored but should not contribute to active operational views.

## Workflow

- As a QA user, I can move a defect only through allowed workflow transitions.
- The visual workflow is saved in `workflow_definitions`.
- Runtime allowed transitions are queried from `workflow_transitions`.
- If a status has no outgoing transition, it behaves as terminal.
- Current defect status must exist in the active workflow status set.

## Defects

- A defect belongs to one project and one exact environment.
- A defect has severity, priority, current status, assignee, creator, expected result, and actual result.
- Created By is the original creator and should remain separate from the latest updater.
- Fixed defects can be linked to a release through `fixed_in_release_id`.
- Release rollout contents are derived by querying defects linked to that release.

## Evidence And Discussion

- Steps to Replicate content is stored as HTML on the defect.
- Screenshots pasted into Steps to Replicate are tracked in `defect_inline_assets`.
- Standalone files are tracked in `defect_attachments`.
- Comments are tracked in `defect_comments`.
- Inline assets, attachments, comments, and history should not be merged into one table.

## History

- Defect history is append-only.
- Meaningful defect actions are stored in `defect_history_events`.
- Multiple changes made in one save action share the same `event_batch_id`.
- History events should not store generated prose; timeline wording can be generated from structured fields.
