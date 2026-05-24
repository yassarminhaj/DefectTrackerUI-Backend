# Database And File Maintenance

This folder contains development maintenance utilities for the Defect Tracker database and upload files.

Use the `*_all.ps1` scripts for normal work. They keep database data and uploaded files aligned with the same backup stamp.

## Primary Workflow

### Back Up Everything

From the `defect-tracker` project root:

```powershell
.\database\maintenance\backup_all.ps1
```

This creates:

```text
database/backups/database/defect_tracker_<stamp>.dump
database/backups/files/uploads_<stamp>.zip
```

The stamp is shared so the database and file backup belong to the same point in time.

### Restore Everything

Use the stamp from the backup filenames:

```powershell
.\database\maintenance\restore_all.ps1 -BackupStamp 20260522_183000
```

The restore scripts are intentionally guarded. Type `YES` when prompted.

To skip prompts for local development automation:

```powershell
.\database\maintenance\restore_all.ps1 -BackupStamp 20260522_183000 -Force
```

## SQL Cleanup

### Clean Transactional Data Only

Run this in pgAdmin Query Tool or with `psql`:

```text
database/maintenance/clean_data.sql
```

This removes:

- `defects`
- `defect_inline_assets`
- `defect_attachments`
- `defect_comments`
- `defect_history_events`
- `user_password_events`

It keeps:

- users
- projects
- environments
- releases
- severity
- priority
- workflow definitions
- workflow transitions

Use this when you want a fresh defect dataset but want to keep setup/configuration.

### Full Schema Reset

From the desktop console, use `Reset Database`. It drops and recreates empty tables without loading seed data.

From PowerShell:

```powershell
.\database\maintenance\rebuild_schema.ps1
```

The low-level SQL reset script is:

```text
database/maintenance/reset_database.sql
```

Then run:

```text
database/schema.sql
```

`reset_database.sql` does not recreate tables. `schema.sql` remains the single source of truth for table creation.

### Load Test Data

From the desktop console, use `Load Test Data`.

From PowerShell:

```powershell
.\database\maintenance\load_test_data.ps1
```

This first checks that app tables are empty. If data already exists, it stops and asks you to reset the database first. This avoids accidental seed overwrite or mixed test data.

## Advanced Separate Scripts

Use these only when you intentionally need to handle database or files separately.

### Database Only

```powershell
.\database\maintenance\backup_database.ps1
.\database\maintenance\restore_database.ps1 -BackupFile .\database\backups\database\defect_tracker_20260522_183000.dump
```

### Files Only

```powershell
.\database\maintenance\backup_files.ps1
.\database\maintenance\restore_files.ps1 -BackupFile .\database\backups\files\uploads_20260522_183000.zip
.\database\maintenance\clean_files.ps1
```

## Configuration

The scripts read defaults from the project `.env` file:

```text
DATABASE_URL
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_PORT
UPLOAD_FOLDER
```

You can override values with parameters where needed.

If PostgreSQL tools are not on PATH, the scripts look in common install locations such as:

```text
C:\Program Files\PostgreSQL\18\bin
```

You can also pass:

```powershell
-PgBin "C:\Program Files\PostgreSQL\18\bin"
```

## Important Notes

- Database backups use `pg_dump -Fc`.
- Database restores use `pg_restore --clean --if-exists --no-owner`.
- File backups zip the configured upload folder.
- If the upload folder is empty, the file backup still creates a valid zip.
- `backup_all.ps1` and `restore_all.ps1` are preferred because they reduce database/file mismatch.
- `rebuild_schema.ps1` recreates clean empty tables.
- `load_test_data.ps1` loads seed data only when app tables are empty.
