# Defect Tracker Database Scripts

These scripts create and seed the Phase 1 PostgreSQL database foundation for the Defect Tracking Tool.

## Files

- `schema.sql`: creates all Phase 1 tables, constraints, and indexes.
- `seed.sql`: inserts baseline lookup data, users, workflow, and sample defects.
- `smoke_tests.sql`: read-only checks to confirm the schema relationships and core product rules.
- `maintenance/`: cleanup, reset, backup, and restore utilities.

## Prerequisites

- PostgreSQL installed and running.
- A database created for the tool.
- A user with permission to create tables and extensions.

The scripts use `pgcrypto` for `gen_random_uuid()`.

## Quick Start

From the `defect-tracker` folder:

```powershell
createdb defect_tracker
psql -d defect_tracker -f database/schema.sql
psql -d defect_tracker -f database/seed.sql
psql -d defect_tracker -f database/smoke_tests.sql
```

If you want to use the connection from `.env`, create the database and user first:

```sql
CREATE DATABASE defect_tracker;
CREATE USER defect_user WITH PASSWORD 'defect_password';
GRANT ALL PRIVILEGES ON DATABASE defect_tracker TO defect_user;
```

Then run:

```powershell
psql -h localhost -p 5434 -U defect_user -d defect_tracker -f database/schema.sql
psql -h localhost -p 5434 -U defect_user -d defect_tracker -f database/seed.sql
psql -h localhost -p 5434 -U defect_user -d defect_tracker -f database/smoke_tests.sql
```

## What The Smoke Tests Confirm

- Active-project-only operational defect count.
- Inactive project defects remain stored but are excluded from active dashboard queries.
- Test and Prod context filtering.
- Allowed next statuses from `workflow_transitions`.
- Terminal status behavior when no transition exists.
- Phase 1 fixed-defect release details through `defects.release_version` and `defects.release_deployment_date`.
- History grouping through `event_batch_id`.
- Inline assets, standalone attachments, comments, and history remain separate.

## Phase 1 Notes

- Dashboard personalization is not stored in the database.
- Roles and permissions are not included yet.
- Module/component is stored as free text on `defects`.
- Current defect status is stored as text and validated through the active workflow transitions.
- `defect_history_events` is append-only and intentionally has no `updated_at`.

## Maintenance Utilities

Use these for local development backup/restore and cleanup:

```text
database/maintenance
```

Primary scripts:

- `backup_all.ps1`: backs up PostgreSQL plus uploaded files with one shared timestamp.
- `restore_all.ps1`: restores a matching database/file backup set.
- `clean_data.sql`: clears transactional defect data but keeps setup/configuration.
- `rebuild_schema.ps1`: drops and recreates empty app tables.
- `load_test_data.ps1`: safely loads seed data only when tables are empty.
- `reset_database.sql`: low-level table-drop script used by `rebuild_schema.ps1`.

See `database/maintenance/README.md` for detailed usage.
