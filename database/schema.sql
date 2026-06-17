-- Defect Tracker Phase 1 PostgreSQL schema
-- Source: static UI DB architecture markdown, finalized for backend foundation.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(120) NOT NULL,
    email varchar(255) NOT NULL UNIQUE,
    username varchar(80) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    default_data_context varchar(10) NOT NULL DEFAULT 'Test',
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id uuid REFERENCES app_users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id uuid REFERENCES app_users(id),
    CONSTRAINT app_users_default_data_context_chk
        CHECK (default_data_context IN ('Test', 'Prod', 'All'))
);

CREATE TABLE IF NOT EXISTS user_password_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    changed_by_user_id uuid REFERENCES app_users(id),
    change_type varchar(40) NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    notes text,
    CONSTRAINT user_password_events_change_type_chk
        CHECK (change_type IN ('self_change', 'reset'))
);

CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name varchar(120) NOT NULL UNIQUE,
    description varchar(500),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id uuid REFERENCES app_users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id uuid REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS environments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_name varchar(50) NOT NULL UNIQUE,
    environment_scope varchar(10) NOT NULL,
    description varchar(500),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id uuid REFERENCES app_users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id uuid REFERENCES app_users(id),
    CONSTRAINT environments_scope_chk
        CHECK (environment_scope IN ('Test', 'Prod'))
);

CREATE TABLE IF NOT EXISTS releases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id),
    release_version varchar(80) NOT NULL,
    planned_deployment_date date,
    actual_deployment_date date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id uuid REFERENCES app_users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id uuid REFERENCES app_users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS releases_project_version_uq
    ON releases (project_id, release_version);

CREATE TABLE IF NOT EXISTS severity_levels (
    id smallserial PRIMARY KEY,
    severity_name varchar(30) NOT NULL UNIQUE,
    severity_rank integer NOT NULL UNIQUE,
    color_token varchar(60),
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS priority_levels (
    id smallserial PRIMARY KEY,
    priority_name varchar(20) NOT NULL UNIQUE,
    priority_rank integer NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS workflow_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name varchar(120) NOT NULL DEFAULT 'Default Workflow',
    diagram_json jsonb NOT NULL,
    version_no integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id uuid REFERENCES app_users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id uuid REFERENCES app_users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_definitions_one_active_uq
    ON workflow_definitions (is_active)
    WHERE is_active = true;

CREATE TABLE IF NOT EXISTS workflow_transitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_definition_id uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    from_status varchar(120) NOT NULL,
    to_status varchar(120) NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_transitions_from_to_uq
    ON workflow_transitions (
        workflow_definition_id,
        lower(from_status),
        lower(to_status)
    );

CREATE TABLE IF NOT EXISTS defects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    defect_key varchar(30) NOT NULL UNIQUE,
    title varchar(200) NOT NULL,
    description text NOT NULL,
    project_id uuid NOT NULL REFERENCES projects(id),
    module_component varchar(120),
    environment_id uuid NOT NULL REFERENCES environments(id),
    severity_id smallint NOT NULL REFERENCES severity_levels(id),
    priority_id smallint NOT NULL REFERENCES priority_levels(id),
    current_status varchar(120) NOT NULL,
    assigned_to_user_id uuid NOT NULL REFERENCES app_users(id),
    created_by_user_id uuid NOT NULL REFERENCES app_users(id),
    steps_html text,
    expected_result text NOT NULL,
    actual_result text NOT NULL,
    fixed_in_release_id uuid REFERENCES releases(id),
    release_version varchar(80),
    release_deployment_date date,
    fix_date date,
    closure_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id uuid REFERENCES app_users(id),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS defects_project_idx ON defects(project_id);
CREATE INDEX IF NOT EXISTS defects_environment_idx ON defects(environment_id);
CREATE INDEX IF NOT EXISTS defects_current_status_idx ON defects(current_status);
CREATE INDEX IF NOT EXISTS defects_assigned_to_idx ON defects(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS defects_created_by_idx ON defects(created_by_user_id);
CREATE INDEX IF NOT EXISTS defects_created_at_idx ON defects(created_at);
CREATE INDEX IF NOT EXISTS defects_fixed_in_release_idx ON defects(fixed_in_release_id);
CREATE INDEX IF NOT EXISTS defects_release_version_idx ON defects(release_version);
CREATE INDEX IF NOT EXISTS defects_dashboard_idx
    ON defects(project_id, environment_id, current_status, severity_id, priority_id);

CREATE TABLE IF NOT EXISTS defect_inline_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    defect_id uuid NOT NULL REFERENCES defects(id) ON DELETE CASCADE,
    asset_kind varchar(30) NOT NULL DEFAULT 'steps_image',
    original_filename varchar(255),
    storage_key text NOT NULL,
    content_type varchar(120) NOT NULL,
    file_size_bytes bigint,
    width_px integer,
    height_px integer,
    created_by_user_id uuid REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    deleted_by_user_id uuid REFERENCES app_users(id),
    CONSTRAINT defect_inline_assets_kind_chk
        CHECK (asset_kind IN ('steps_image'))
);

CREATE INDEX IF NOT EXISTS defect_inline_assets_defect_idx
    ON defect_inline_assets(defect_id);

CREATE TABLE IF NOT EXISTS defect_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    defect_id uuid NOT NULL REFERENCES defects(id) ON DELETE CASCADE,
    original_filename varchar(255) NOT NULL,
    storage_key text NOT NULL,
    content_type varchar(120),
    file_extension varchar(20),
    file_size_bytes bigint NOT NULL,
    uploaded_by_user_id uuid REFERENCES app_users(id),
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    deleted_by_user_id uuid REFERENCES app_users(id)
);

CREATE INDEX IF NOT EXISTS defect_attachments_defect_idx
    ON defect_attachments(defect_id);

CREATE TABLE IF NOT EXISTS defect_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    defect_id uuid NOT NULL REFERENCES defects(id) ON DELETE CASCADE,
    comment_text text NOT NULL,
    created_by_user_id uuid NOT NULL REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    deleted_by_user_id uuid REFERENCES app_users(id)
);

CREATE INDEX IF NOT EXISTS defect_comments_defect_idx
    ON defect_comments(defect_id);

CREATE TABLE IF NOT EXISTS defect_history_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    defect_id uuid NOT NULL REFERENCES defects(id) ON DELETE CASCADE,
    event_batch_id uuid NOT NULL,
    event_type varchar(60) NOT NULL,
    field_name varchar(80),
    old_value text,
    new_value text,
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_user_id uuid REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT defect_history_events_type_chk
        CHECK (event_type IN (
            'defect_created',
            'field_updated',
            'status_changed',
            'assignment_changed',
            'severity_changed',
            'priority_changed',
            'release_updated',
            'comment_added',
            'comment_updated',
            'comment_deleted',
            'attachment_uploaded',
            'attachment_deleted',
            'inline_asset_added',
            'inline_asset_deleted'
        ))
);

CREATE INDEX IF NOT EXISTS defect_history_events_defect_created_idx
    ON defect_history_events(defect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS defect_history_events_batch_idx
    ON defect_history_events(event_batch_id);
CREATE INDEX IF NOT EXISTS defect_history_events_type_idx
    ON defect_history_events(event_type);

COMMIT;
