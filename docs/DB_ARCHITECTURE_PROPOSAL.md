# Defect Tracker PostgreSQL Architecture Proposal

This proposal is derived from the current static UI prototype and the Phase 1 product decisions made during UI/UX design. It prepares the database for Flask/PostgreSQL implementation without overbuilding features that belong in later phases.

## Phase 1 Product Scope Reflected In This Schema

- Context-aware data views: `Test`, `Prod`, `All`
- Dashboard and defect listing query only active projects
- Dashboard filters/layout are retained for the user session only, not stored in the database
- Workflow diagram is saved visually, but operational status transitions are queried from a clean transition table
- Defect comments, attachments, inline screenshots, and history remain separate
- Steps to Replicate stores rich HTML and references inline assets
- Release information is normalized through a `releases` table
- Phase 1 users have the same access; no role management yet

## Recommended Table Count

Recommended Phase 1 backend schema: **14 tables**.

This is intentionally leaner than the earlier draft. We removed:

- `project_modules`: module/component stays as free text on the defect for Phase 1
- `workflow_nodes` and `workflow_edges`: replaced by `workflow_definitions` plus `workflow_transitions`
- `dashboard_views` and `dashboard_widgets`: dashboard personalization stays in session/UI state for Phase 1
- broad `app_activity_events`: not needed now; defect-level history and password events are enough

## Design Decisions

- Do not store role management yet. All users share the same Phase 1 access model.
- Do not hardcode statuses as PostgreSQL enums. Workflow statuses are user-configured process labels.
- Store the visual workflow once as JSON, then generate operational allowed transitions from it.
- Store current defect status as a status value, not as a visual canvas node id.
- Store severity and priority as lookup tables because they are ordered and drive UI behavior.
- Store `steps_html` on the defect because the Steps rich editor returns HTML and the field is part of the defect narrative.
- Store inline pasted screenshots in `defect_inline_assets`.
- Store standalone files in `defect_attachments`.
- Store comments in `defect_comments`.
- Store defect audit/timeline in `defect_history_events`.
- Do not store generated event prose in the database. Timeline text can be generated from structured event fields.
- History events are append-only; they do not have `updated_at`.

## Entity Relationship Summary

```text
app_users
  -> app_users.created_by_user_id / updated_by_user_id
  -> user_password_events.user_id / changed_by_user_id
  -> projects.created_by_user_id / updated_by_user_id
  -> defects.created_by_user_id / assigned_to_user_id / updated_by_user_id
  -> defect_inline_assets.created_by_user_id
  -> defect_attachments.uploaded_by_user_id / deleted_by_user_id
  -> defect_comments.created_by_user_id
  -> defect_history_events.actor_user_id

projects
  -> releases
  -> defects

environments
  -> defects

severity_levels
  -> defects

priority_levels
  -> defects

workflow_definitions
  -> workflow_transitions

releases
  -> defects.fixed_in_release_id

defects
  -> defect_inline_assets
  -> defect_attachments
  -> defect_comments
  -> defect_history_events
```

## Tables

### 1. `app_users`

Stores application users. Phase 1 has no roles.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | User identifier |
| `name` | `varchar(120) not null` | Display name |
| `email` | `varchar(255) not null unique` | Profile email |
| `username` | `varchar(80) not null unique` | Login username |
| `password_hash` | `text not null` | Hashed password only |
| `is_active` | `boolean not null default true` | Active/Inactive account state |
| `default_data_context` | `varchar(10) not null default 'Test'` | Default context: `Test`, `Prod`, or `All` |
| `last_login_at` | `timestamptz` | Last successful login |
| `created_at` | `timestamptz not null default now()` | Created timestamp |
| `created_by_user_id` | `uuid references app_users(id)` | Creator, nullable during bootstrap |
| `updated_at` | `timestamptz not null default now()` | Last update timestamp |
| `updated_by_user_id` | `uuid references app_users(id)` | Last updater |

Recommended check:

- `default_data_context in ('Test', 'Prod', 'All')`

### 2. `user_password_events`

Security-specific password audit. This is intentionally separate from generic app activity.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Event identifier |
| `user_id` | `uuid not null references app_users(id)` | User whose password changed |
| `changed_by_user_id` | `uuid references app_users(id)` | User/admin who performed the change |
| `change_type` | `varchar(40) not null` | `self_change`, `reset`, etc. |
| `changed_at` | `timestamptz not null default now()` | Change timestamp |
| `notes` | `text` | Optional operational note |

### 3. `projects`

Project master and active-project control.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Project identifier |
| `project_name` | `varchar(120) not null unique` | Project name |
| `description` | `varchar(500)` | Short project description |
| `is_active` | `boolean not null default true` | Active projects are included in operational dashboard/listing |
| `created_at` | `timestamptz not null default now()` | Created timestamp |
| `created_by_user_id` | `uuid references app_users(id)` | Creator |
| `updated_at` | `timestamptz not null default now()` | Last update timestamp |
| `updated_by_user_id` | `uuid references app_users(id)` | Last updater |

### 4. `environments`

Environment master and Test/Prod context mapping.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Environment identifier |
| `environment_name` | `varchar(50) not null unique` | DEV, SIT, UAT, Pre-Prod, PROD |
| `environment_scope` | `varchar(10) not null` | `Test` or `Prod` |
| `description` | `varchar(500)` | Short environment description |
| `is_active` | `boolean not null default true` | Available for selection/reporting |
| `sort_order` | `integer not null default 0` | Display order |
| `created_at` | `timestamptz not null default now()` | Created timestamp |
| `created_by_user_id` | `uuid references app_users(id)` | Creator |
| `updated_at` | `timestamptz not null default now()` | Last update timestamp |
| `updated_by_user_id` | `uuid references app_users(id)` | Last updater |

Recommended check:

- `environment_scope in ('Test', 'Prod')`

### 5. `releases`

Release/version master for a future release-management phase. In Phase 1, defect fixing captures typed release details directly on the defect.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Release identifier |
| `project_id` | `uuid references projects(id)` | Project release belongs to; nullable only if global release is needed |
| `release_version` | `varchar(80) not null` | Version number/name |
| `planned_deployment_date` | `date` | Planned rollout date |
| `actual_deployment_date` | `date` | Actual rollout date |
| `is_active` | `boolean not null default true` | Available for fixed-in release selection |
| `created_at` | `timestamptz not null default now()` | Created timestamp |
| `created_by_user_id` | `uuid references app_users(id)` | Creator |
| `updated_at` | `timestamptz not null default now()` | Last update timestamp |
| `updated_by_user_id` | `uuid references app_users(id)` | Last updater |

Recommended unique constraint:

- `(project_id, release_version)`

### 6. `severity_levels`

Ordered severity lookup.

| Column | Type | Purpose |
|---|---|---|
| `id` | `smallserial primary key` | Severity identifier |
| `severity_name` | `varchar(30) not null unique` | Critical, High, Medium, Low |
| `severity_rank` | `integer not null unique` | Higher number means more severe |
| `color_token` | `varchar(60)` | UI token reference, not raw hex |
| `is_active` | `boolean not null default true` | Available in UI |

Seed:

- Critical rank 4
- High rank 3
- Medium rank 2
- Low rank 1

### 7. `priority_levels`

Ordered priority lookup.

| Column | Type | Purpose |
|---|---|---|
| `id` | `smallserial primary key` | Priority identifier |
| `priority_name` | `varchar(20) not null unique` | P1, P2, P3, P4 |
| `priority_rank` | `integer not null unique` | Higher number means higher priority, or choose ascending consistently |
| `is_active` | `boolean not null default true` | Available in UI |

### 8. `workflow_definitions`

Stores the visual workflow editor state. This is how the canvas is restored.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Workflow identifier |
| `workflow_name` | `varchar(120) not null default 'Default Workflow'` | Workflow name |
| `diagram_json` | `jsonb not null` | Full visual canvas JSON: nodes, arrows, positions, pan/zoom if needed |
| `version_no` | `integer not null default 1` | Increment on save |
| `is_active` | `boolean not null default false` | Active workflow used by defect module |
| `created_at` | `timestamptz not null default now()` | Created timestamp |
| `created_by_user_id` | `uuid references app_users(id)` | Creator |
| `updated_at` | `timestamptz not null default now()` | Last update timestamp |
| `updated_by_user_id` | `uuid references app_users(id)` | Last updater |

Important:

- The visual workflow is authored here.
- On save, the backend derives and refreshes rows in `workflow_transitions`.
- Only process labels become defect statuses.

### 9. `workflow_transitions`

Operational allowed-status table generated from the saved workflow diagram.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Transition identifier |
| `workflow_definition_id` | `uuid not null references workflow_definitions(id) on delete cascade` | Parent workflow |
| `from_status` | `varchar(120) not null` | Current defect status |
| `to_status` | `varchar(120) not null` | Allowed next defect status |
| `display_order` | `integer not null default 0` | Dropdown ordering |
| `is_active` | `boolean not null default true` | Active transition |
| `created_at` | `timestamptz not null default now()` | Created timestamp |

Recommended unique constraint:

- `(workflow_definition_id, lower(from_status), lower(to_status))`

Notes:

- Terminal statuses do not need a row with `to_status = null`; they are derived by having no outgoing active transition.
- If the UI displays `Rejected -> No next status`, that is display logic, not a stored transition.
- In Phase 1, statuses are stored as text because the workflow editor creates them visually. If a formal `statuses` table is introduced later, these can become IDs.

### 10. `defects`

Current truth of the defect record.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Defect identifier |
| `defect_key` | `varchar(30) not null unique` | Human-readable key, for example DF-1042 |
| `title` | `varchar(200) not null` | Defect title |
| `description` | `text not null` | Defect description |
| `project_id` | `uuid not null references projects(id)` | Project |
| `module_component` | `varchar(120)` | Free-text module/component for Phase 1 |
| `environment_id` | `uuid not null references environments(id)` | Exact environment where issue was found |
| `severity_id` | `smallint not null references severity_levels(id)` | Severity |
| `priority_id` | `smallint not null references priority_levels(id)` | Priority |
| `current_status` | `varchar(120) not null` | Current workflow process status |
| `assigned_to_user_id` | `uuid not null references app_users(id)` | Current assignee |
| `created_by_user_id` | `uuid not null references app_users(id)` | Original creator, read-only in UI |
| `steps_html` | `text` | Rich Steps to Replicate HTML |
| `expected_result` | `text not null` | Mandatory expected result |
| `actual_result` | `text not null` | Mandatory actual result |
| `fixed_in_release_id` | `uuid references releases(id)` | Future release-management link; not the Phase 1 edit source of truth |
| `release_version` | `varchar(80)` | Typed release version captured when developer marks a defect fixed |
| `release_deployment_date` | `date` | Developer-selected deployment date captured when developer marks a defect fixed |
| `fix_date` | `date` | Date defect was fixed |
| `closure_date` | `date` | Date defect was closed |
| `created_at` | `timestamptz not null default now()` | Created timestamp |
| `updated_at` | `timestamptz not null default now()` | Last update timestamp |
| `updated_by_user_id` | `uuid references app_users(id)` | Last updater |
| `is_deleted` | `boolean not null default false` | Soft delete |

Recommended indexes:

- `defects(project_id)`
- `defects(environment_id)`
- `defects(current_status)`
- `defects(assigned_to_user_id)`
- `defects(created_by_user_id)`
- `defects(created_at)`
- `defects(fixed_in_release_id)`
- `defects(release_version)`
- Composite dashboard index: `(project_id, environment_id, current_status, severity_id, priority_id)`

Important:

- `current_status` must be validated by the service layer against active workflow statuses.
- Allowed next statuses come from `workflow_transitions`.
- Phase 1 Release Version and Release Deployment Date are stored on `defects`; future release management may derive them from `releases`.

### 11. `defect_inline_assets`

Screenshots/images embedded inside Steps to Replicate.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Inline asset identifier |
| `defect_id` | `uuid not null references defects(id) on delete cascade` | Parent defect |
| `asset_kind` | `varchar(30) not null default 'steps_image'` | Asset purpose |
| `original_filename` | `varchar(255)` | Clipboard images may not have one |
| `storage_key` | `text not null` | File/object storage key |
| `content_type` | `varchar(120) not null` | image/png, image/jpeg |
| `file_size_bytes` | `bigint` | Size |
| `width_px` | `integer` | Display width captured from editor resize |
| `height_px` | `integer` | Optional display height |
| `created_by_user_id` | `uuid references app_users(id)` | Uploader |
| `created_at` | `timestamptz not null default now()` | Created timestamp |
| `is_deleted` | `boolean not null default false` | Soft delete when removed from Steps to Replicate |
| `deleted_at` | `timestamptz` | Delete timestamp |
| `deleted_by_user_id` | `uuid references app_users(id)` | Deleter |

How it works:

- `defects.steps_html` stores the narrative HTML.
- Images inside that HTML reference assets from this table.
- This keeps screenshots in the flow of the steps without treating them as standalone attachments.

### 12. `defect_attachments`

Standalone files attached to the defect.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Attachment identifier |
| `defect_id` | `uuid not null references defects(id) on delete cascade` | Parent defect |
| `original_filename` | `varchar(255) not null` | Uploaded filename |
| `storage_key` | `text not null` | File/object storage key |
| `content_type` | `varchar(120)` | MIME type |
| `file_extension` | `varchar(20)` | Validated allowed extension |
| `file_size_bytes` | `bigint not null` | File size |
| `uploaded_by_user_id` | `uuid references app_users(id)` | Uploader |
| `uploaded_at` | `timestamptz not null default now()` | Upload timestamp |
| `is_deleted` | `boolean not null default false` | Soft delete |
| `deleted_at` | `timestamptz` | Delete timestamp |
| `deleted_by_user_id` | `uuid references app_users(id)` | Deleter |

### 13. `defect_comments`

User discussion on a defect. Phase 1 comments are plain text only.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Comment identifier |
| `defect_id` | `uuid not null references defects(id) on delete cascade` | Parent defect |
| `comment_text` | `text not null` | Comment body |
| `created_by_user_id` | `uuid not null references app_users(id)` | Comment author |
| `created_at` | `timestamptz not null default now()` | Created timestamp |
| `updated_at` | `timestamptz` | Edited timestamp, if comment editing is enabled |
| `is_deleted` | `boolean not null default false` | Soft delete |
| `deleted_at` | `timestamptz` | Delete timestamp |
| `deleted_by_user_id` | `uuid references app_users(id)` | Deleter |

Comment attachments are not included in Phase 1. If needed later, add `defect_comment_attachments`.

### 14. `defect_history_events`

Append-only defect timeline and audit trail.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | History event identifier |
| `defect_id` | `uuid not null references defects(id) on delete cascade` | Parent defect |
| `event_batch_id` | `uuid not null` | Groups multiple events from one save action |
| `event_type` | `varchar(60) not null` | Controlled app value such as `status_changed`, `field_updated`, `attachment_uploaded` |
| `field_name` | `varchar(80)` | Field affected, if applicable |
| `old_value` | `text` | Previous display value snapshot |
| `new_value` | `text` | New display value snapshot |
| `metadata_json` | `jsonb not null default '{}'::jsonb` | Extra structured context when needed |
| `actor_user_id` | `uuid references app_users(id)` | User who performed the action |
| `created_at` | `timestamptz not null default now()` | Event timestamp |

Recommended indexes:

- `(defect_id, created_at desc)`
- `(event_batch_id)`
- `(event_type)`

Important:

- No `event_summary` is stored. Timeline wording can be generated from `event_type`, `field_name`, `old_value`, and `new_value`.
- No `updated_at` is stored because history is immutable.
- If a user changes status, priority, and assignee in one save, insert multiple rows with the same `event_batch_id` and same `created_at`.

Suggested controlled `event_type` values:

- `defect_created`
- `field_updated`
- `status_changed`
- `assignment_changed`
- `severity_changed`
- `priority_changed`
- `release_updated`
- `comment_added`
- `comment_updated`
- `comment_deleted`
- `attachment_uploaded`
- `attachment_deleted`
- `inline_asset_added`
- `inline_asset_deleted`

## Derived Rules

### Active Project Scope

Operational dashboard and defect-list queries should filter:

```sql
projects.is_active = true
```

Inactive project defects remain stored but should not affect active operational health.

### Login Data Context

The user chooses or defaults to:

- `Test`: all active environments where `environment_scope = 'Test'`
- `Prod`: all active environments where `environment_scope = 'Prod'`
- `All`: both scopes

This context applies to dashboard, defect list, filters, and later reports.

### Dashboard State

Dashboard data is queried dynamically from defects and related lookup tables.

Dashboard filters/layout should be retained only for the current user session:

- Static UI: browser `sessionStorage`
- Flask later: browser session or Flask session

Do not create dashboard persistence tables in Phase 1.

Phase 2 can introduce per-user dashboard preference persistence so custom charts, removed charts, and chart order survive logout/login without relying on browser storage.

### Allowed Next Statuses

For a defect with `current_status = X`:

```sql
select to_status
from workflow_transitions transition
join workflow_definitions workflow
  on workflow.id = transition.workflow_definition_id
where workflow.is_active = true
  and transition.is_active = true
  and transition.from_status = :current_status
order by transition.display_order, transition.to_status;
```

If no rows are returned, the status is terminal for the active workflow.

### Saving Workflow

When the user saves the visual workflow:

1. Save/update `workflow_definitions.diagram_json`.
2. Parse arrows from the diagram.
3. Replace generated rows in `workflow_transitions` for that workflow.
4. Keep only process labels as status values.
5. Do not insert terminal/no-next-status rows.

### Fixed Status Rule

When a defect moves to `Fixed`, require:

- `release_version`
- `release_deployment_date`
- `fix_date`

The release deployment date is selected by the developer and stored on the defect in Phase 1.

### Closed Status Rule

When a defect moves to `Closed`, require:

- `closure_date`

Also enforce:

- `closure_date >= fix_date` when both exist

## What Not To Store Yet

Do not create these tables in Phase 1 unless backend scope expands:

- `roles`
- `permissions`
- `user_roles`
- `project_modules`
- `dashboard_views`
- `dashboard_widgets`
- `app_activity_events`
- `notifications`
- `email_otp`
- `report_snapshots`
- `validation_message_templates`
- `defect_comment_attachments`

Validation messages should live in application constants/config first. Move them to the database only if admins need to edit wording from the UI.

## Suggested Seed Data

Seed these tables before first run:

- `severity_levels`: Critical, High, Medium, Low
- `priority_levels`: P1, P2, P3, P4
- `environments`: DEV, SIT, UAT, Pre-Prod, PROD
- `projects`: Claims Portal, Billing Core, Mobile QA, Legacy CRM
- `app_users`: qa.user plus sample QA users
- `workflow_definitions`: default workflow diagram JSON
- `workflow_transitions`: generated allowed transitions from default workflow

Default workflow statuses:

- Assigned
- InProgress
- Fixed
- Test
- Closed
- Rejected

Default transitions:

- Assigned -> InProgress
- InProgress -> Fixed
- InProgress -> Rejected
- Fixed -> Test
- Test -> Closed
- Test -> InProgress

## API Planning Implication

The schema naturally groups into these API modules:

- Auth/Profile
- Users
- Projects
- Environments
- Releases
- Workflow
- Defects
- Inline Assets
- Attachments
- Comments
- History
- Dashboard

The defect service layer should own workflow validation, history event creation, and active-project/context filtering. Routes should stay thin and should not duplicate those rules.

## Implemented SQL Scripts

Initial Phase 1 SQL scripts are placed in the backend project:

```text
Y:\SoftwareProjects\FlaskProjects\DefectTracking\Tool_SourceCode\defect-tracker\database
```

Files:

- `schema.sql`
- `seed.sql`
- `smoke_tests.sql`
- `README.md`

These scripts are the reviewable database foundation before SQLAlchemy models and API routes are created.
