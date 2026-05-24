-- Light development cleanup.
-- Removes transactional defect data while keeping master/configuration data.
--
-- Keeps:
-- app_users, projects, environments, releases, severity_levels,
-- priority_levels, workflow_definitions, workflow_transitions
--
-- Removes:
-- defects and defect child records, plus password event audit rows.

BEGIN;

TRUNCATE TABLE
    defect_history_events,
    defect_comments,
    defect_attachments,
    defect_inline_assets,
    defects,
    user_password_events
RESTART IDENTITY CASCADE;

COMMIT;
