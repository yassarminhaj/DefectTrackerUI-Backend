-- Full database reset for the Defect Tracker app schema objects.
--
-- This drops all Phase 1 application tables. After running this file, run:
--   database/schema.sql
--   database/seed.sql
--
-- The table creation source of truth remains database/schema.sql.

BEGIN;

DROP TABLE IF EXISTS defect_history_events CASCADE;
DROP TABLE IF EXISTS defect_comments CASCADE;
DROP TABLE IF EXISTS defect_attachments CASCADE;
DROP TABLE IF EXISTS defect_inline_assets CASCADE;
DROP TABLE IF EXISTS defects CASCADE;
DROP TABLE IF EXISTS workflow_transitions CASCADE;
DROP TABLE IF EXISTS workflow_definitions CASCADE;
DROP TABLE IF EXISTS priority_levels CASCADE;
DROP TABLE IF EXISTS severity_levels CASCADE;
DROP TABLE IF EXISTS releases CASCADE;
DROP TABLE IF EXISTS environments CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_password_events CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;

COMMIT;
