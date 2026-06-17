# Projects Module Test Spec

Purpose: capture expected behavior for the wired Projects master-data slice so manual QA and later automation can verify persistence, validation, and active/inactive behavior.

Scope:

- Projects page load.
- Inline Add Project.
- Inline Edit Project.
- Project active/inactive status.
- PostgreSQL persistence through `projects`.

Out of scope:

- Dashboard and defect filtering by active projects. This is asserted later when those modules are wired.
- Project modules/components. Module/component remains free text on defects in Phase 1.
- Delete/archive project behavior.

## Preconditions

- User is authenticated.
- Application is running from `defect-tracker`.
- `.env` points to the intended PostgreSQL database through `DATABASE_URL`.
- UI is opened through Flask, not direct file open.

## Test Cases

| ID | Scenario | Steps | Expected UI/API Result | Expected DB Result |
|---|---|---|---|---|
| PROJECTS-UI-001 | Projects list requires auth | Request `/api/v1/projects` without bearer token. | API returns `401 Authentication is required.` | No DB change. |
| PROJECTS-UI-002 | Projects page loads from DB | Login and open Projects page. | Table rows are loaded from `GET /api/v1/projects`; hardcoded static rows are not the source of truth. | No DB change. |
| PROJECTS-UI-003 | Empty projects result | Query returns no projects in a controlled test DB. | Table shows `No projects found.` | No DB change. |
| PROJECTS-UI-004 | Create active project | Click Add Project, enter valid name/description, keep Active, save. | Row appears only after API returns `201`; confirmation dialog appears. | `projects` row is inserted with `is_active = true`, `created_by_user_id`, and `updated_by_user_id`. |
| PROJECTS-UI-005 | Create inactive project | Click Add Project, choose Inactive, save. | Row appears with inactive badge. | `projects.is_active = false`. |
| PROJECTS-UI-006 | Create duplicate project | Add a project using an existing project name. | UI duplicate check or API error blocks save with readable message. | No new `projects` row. |
| PROJECTS-UI-007 | Create missing name | Click Add Project and save without name. | Field-level validation blocks save. | No DB change. |
| PROJECTS-UI-008 | Create long description | Enter description over 180 characters. | Field-level validation blocks save. | No DB change. |
| PROJECTS-UI-009 | Inline edit project text | Click Edit, change Project Name and Description, save. | Row remains stable and renders the API response after save. | `projects.project_name`, `description`, `updated_at`, and `updated_by_user_id` update. |
| PROJECTS-UI-010 | Inline edit active status | Click Edit, switch Active/Inactive, save. | Badge updates after API success. | `projects.is_active` updates. |
| PROJECTS-UI-011 | Inline edit duplicate project name | Edit a project to an existing project name. | Save is rejected with readable validation; row remains in edit mode. | DB row remains unchanged. |
| PROJECTS-UI-012 | Inline edit missing row ID | Force a row without `data-project-id` and save. | UI shows `Project record is missing its database id.` | No API write. |
| PROJECTS-API-013 | Update missing project | PATCH a random UUID. | API returns `404 Project not found.` | No DB change. |

## Cross-Cutting Checks

- All Projects API calls include bearer auth.
- Add/edit controls keep the same table row rhythm as the approved UI.
- Browser/localStorage is not used as the source of truth for project rows.
- Active/inactive project state is persisted for later dashboard/defect filtering rules.

## Automation Notes

- Use disposable project names with a unique `runId`.
- Delete disposable projects after cleaning dependent releases/defects if any are created in broader integration tests.
- Assert both API status and direct `projects` table state for create/update cases.
