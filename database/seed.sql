-- Defect Tracker Phase 1 seed data
-- Safe to rerun after schema.sql. Uses stable IDs for review and smoke tests.

BEGIN;

INSERT INTO app_users (
    id,
    name,
    email,
    username,
    password_hash,
    is_active,
    default_data_context
) VALUES
    ('10000000-0000-0000-0000-000000000001', 'QA User', 'qa.user@example.com', 'qa.user', 'phase1-placeholder-hash', true, 'Test'),
    ('10000000-0000-0000-0000-000000000002', 'Aisha Khan', 'aisha.khan@example.com', 'aisha.khan', 'phase1-placeholder-hash', true, 'Test'),
    ('10000000-0000-0000-0000-000000000003', 'Omar Farooq', 'omar.farooq@example.com', 'omar.farooq', 'phase1-placeholder-hash', true, 'Prod'),
    ('10000000-0000-0000-0000-000000000004', 'Sara Mathew', 'sara.mathew@example.com', 'sara.mathew', 'phase1-placeholder-hash', true, 'All')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    is_active = EXCLUDED.is_active,
    default_data_context = EXCLUDED.default_data_context,
    updated_at = now();

INSERT INTO user_password_events (
    id,
    user_id,
    changed_by_user_id,
    change_type,
    notes
) VALUES
    (
        '11000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'reset',
        'Initial seeded password placeholder.'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (
    id,
    project_name,
    description,
    is_active,
    created_by_user_id,
    updated_by_user_id
) VALUES
    ('20000000-0000-0000-0000-000000000001', 'Claims Portal', 'Customer claim intake and processing workflow.', true, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('20000000-0000-0000-0000-000000000002', 'Billing Core', 'Invoice, tax, and payment calculation services.', true, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('20000000-0000-0000-0000-000000000003', 'Mobile QA', 'Mobile application regression and release testing.', true, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('20000000-0000-0000-0000-000000000004', 'Legacy CRM', 'Legacy support and controlled maintenance.', false, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET
    project_name = EXCLUDED.project_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = now();

INSERT INTO environments (
    id,
    environment_name,
    environment_scope,
    description,
    is_active,
    sort_order,
    created_by_user_id,
    updated_by_user_id
) VALUES
    ('30000000-0000-0000-0000-000000000001', 'DEV', 'Test', 'Development validation environment.', true, 1, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000002', 'SIT', 'Test', 'System integration testing environment.', true, 2, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000003', 'UAT', 'Test', 'User acceptance testing environment.', true, 3, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000004', 'Pre-Prod', 'Test', 'Pre-production verification environment.', true, 4, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000005', 'PROD', 'Prod', 'Production environment.', true, 5, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET
    environment_name = EXCLUDED.environment_name,
    environment_scope = EXCLUDED.environment_scope,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = now();

INSERT INTO releases (
    id,
    project_id,
    release_version,
    planned_deployment_date,
    actual_deployment_date,
    is_active,
    created_by_user_id,
    updated_by_user_id
) VALUES
    ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '2026.04', '2026-04-20', '2026-04-21', true, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '2026.05', '2026-05-18', null, true, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '2026.05-mobile', '2026-05-25', null, true, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET
    project_id = EXCLUDED.project_id,
    release_version = EXCLUDED.release_version,
    planned_deployment_date = EXCLUDED.planned_deployment_date,
    actual_deployment_date = EXCLUDED.actual_deployment_date,
    is_active = EXCLUDED.is_active,
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = now();

INSERT INTO severity_levels (
    id,
    severity_name,
    severity_rank,
    color_token,
    is_active
) VALUES
    (1, 'Low', 1, '--severity-low', true),
    (2, 'Medium', 2, '--severity-medium', true),
    (3, 'High', 3, '--severity-high', true),
    (4, 'Critical', 4, '--severity-critical', true)
ON CONFLICT (id) DO UPDATE SET
    severity_name = EXCLUDED.severity_name,
    severity_rank = EXCLUDED.severity_rank,
    color_token = EXCLUDED.color_token,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('severity_levels', 'id'), 4, true);

INSERT INTO priority_levels (
    id,
    priority_name,
    priority_rank,
    is_active
) VALUES
    (1, 'P4', 1, true),
    (2, 'P3', 2, true),
    (3, 'P2', 3, true),
    (4, 'P1', 4, true)
ON CONFLICT (id) DO UPDATE SET
    priority_name = EXCLUDED.priority_name,
    priority_rank = EXCLUDED.priority_rank,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('priority_levels', 'id'), 4, true);

INSERT INTO workflow_definitions (
    id,
    workflow_name,
    diagram_json,
    version_no,
    is_active,
    created_by_user_id,
    updated_by_user_id
) VALUES (
    '50000000-0000-0000-0000-000000000001',
    'Default Workflow',
    '{
      "nodes": [
        {"id": "node_assigned", "type": "process", "label": "Assigned", "position": {"x": 160, "y": 260}},
        {"id": "node_inprogress", "type": "process", "label": "InProgress", "position": {"x": 420, "y": 260}},
        {"id": "node_fixed", "type": "process", "label": "Fixed", "position": {"x": 700, "y": 260}},
        {"id": "node_test", "type": "process", "label": "Test", "position": {"x": 960, "y": 260}},
        {"id": "node_closed", "type": "process", "label": "Closed", "position": {"x": 1220, "y": 260}},
        {"id": "node_rejected", "type": "process", "label": "Rejected", "position": {"x": 420, "y": 90}}
      ],
      "edges": [
        {"id": "edge_1", "source": "node_assigned", "target": "node_inprogress"},
        {"id": "edge_2", "source": "node_inprogress", "target": "node_fixed"},
        {"id": "edge_3", "source": "node_inprogress", "target": "node_rejected"},
        {"id": "edge_4", "source": "node_fixed", "target": "node_test"},
        {"id": "edge_5", "source": "node_test", "target": "node_closed"},
        {"id": "edge_6", "source": "node_test", "target": "node_inprogress"}
      ],
      "viewport": {"x": 0, "y": 0, "zoom": 1}
    }'::jsonb,
    1,
    true,
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO UPDATE SET
    workflow_name = EXCLUDED.workflow_name,
    diagram_json = EXCLUDED.diagram_json,
    version_no = EXCLUDED.version_no,
    is_active = EXCLUDED.is_active,
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = now();

INSERT INTO workflow_transitions (
    id,
    workflow_definition_id,
    from_status,
    to_status,
    display_order,
    is_active
) VALUES
    ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Assigned', 'InProgress', 1, true),
    ('51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'InProgress', 'Fixed', 1, true),
    ('51000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'InProgress', 'Rejected', 2, true),
    ('51000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', 'Fixed', 'Test', 1, true),
    ('51000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000001', 'Test', 'Closed', 1, true),
    ('51000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000001', 'Test', 'InProgress', 2, true)
ON CONFLICT (id) DO UPDATE SET
    workflow_definition_id = EXCLUDED.workflow_definition_id,
    from_status = EXCLUDED.from_status,
    to_status = EXCLUDED.to_status,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

INSERT INTO defects (
    id,
    defect_key,
    title,
    description,
    project_id,
    module_component,
    environment_id,
    severity_id,
    priority_id,
    current_status,
    assigned_to_user_id,
    created_by_user_id,
    steps_html,
    expected_result,
    actual_result,
    fixed_in_release_id,
    fix_date,
    closure_date,
    created_at,
    updated_at,
    updated_by_user_id
) VALUES
    (
        '60000000-0000-0000-0000-000000000001',
        'DF-1042',
        'Invoice total mismatch after tax recalculation',
        'The invoice total changes after refreshing the payment review screen in UAT.',
        '20000000-0000-0000-0000-000000000002',
        'Invoice Review',
        '30000000-0000-0000-0000-000000000003',
        3,
        4,
        'InProgress',
        '10000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        '<ol><li>Open invoice review in UAT</li><li>Recalculate tax</li><li>Refresh the payment review screen</li></ol>',
        'Invoice total remains unchanged after recalculation.',
        'Invoice total changes after refresh.',
        null,
        null,
        null,
        now() - interval '5 days',
        now() - interval '1 day',
        '10000000-0000-0000-0000-000000000002'
    ),
    (
        '60000000-0000-0000-0000-000000000002',
        'DF-1043',
        'Claim attachment preview fails for PDF',
        'PDF attachment preview does not render in the claims evidence panel.',
        '20000000-0000-0000-0000-000000000001',
        'Evidence Upload',
        '30000000-0000-0000-0000-000000000002',
        2,
        3,
        'Assigned',
        '10000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        '<p>Upload a PDF in SIT and open preview.</p>',
        'PDF preview opens inside the evidence panel.',
        'Preview area stays blank.',
        null,
        null,
        null,
        now() - interval '4 days',
        now() - interval '4 days',
        '10000000-0000-0000-0000-000000000001'
    ),
    (
        '60000000-0000-0000-0000-000000000003',
        'DF-1044',
        'Mobile login returns generic failure message',
        'Invalid session message is not actionable in the mobile app.',
        '20000000-0000-0000-0000-000000000003',
        'Login',
        '30000000-0000-0000-0000-000000000004',
        1,
        2,
        'Fixed',
        '10000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000001',
        '<p>Open mobile app after token expiry and try to log in again.</p>',
        'User sees clear session expired message.',
        'User sees generic failure message.',
        '40000000-0000-0000-0000-000000000003',
        current_date - 1,
        null,
        now() - interval '8 days',
        now() - interval '1 day',
        '10000000-0000-0000-0000-000000000004'
    ),
    (
        '60000000-0000-0000-0000-000000000004',
        'DF-1045',
        'Production payment export duplicates records',
        'Daily export created duplicate payment records in PROD.',
        '20000000-0000-0000-0000-000000000002',
        'Payment Export',
        '30000000-0000-0000-0000-000000000005',
        4,
        4,
        'Test',
        '10000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000003',
        '<p>Run the daily payment export job in PROD.</p>',
        'Each payment appears once in the export file.',
        'Several payments appear twice.',
        '40000000-0000-0000-0000-000000000001',
        current_date - 2,
        null,
        now() - interval '6 days',
        now() - interval '2 days',
        '10000000-0000-0000-0000-000000000002'
    ),
    (
        '60000000-0000-0000-0000-000000000005',
        'DF-1046',
        'Inactive project defect should not affect dashboard',
        'Seed record used to confirm inactive projects are excluded from operational dashboard queries.',
        '20000000-0000-0000-0000-000000000004',
        'Legacy Sync',
        '30000000-0000-0000-0000-000000000003',
        3,
        3,
        'InProgress',
        '10000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        '<p>Legacy CRM sample record.</p>',
        'Dashboard excludes inactive project defects.',
        'Inactive project record exists for testing exclusion.',
        null,
        null,
        null,
        now() - interval '9 days',
        now() - interval '3 days',
        '10000000-0000-0000-0000-000000000003'
    )
ON CONFLICT (id) DO UPDATE SET
    defect_key = EXCLUDED.defect_key,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    project_id = EXCLUDED.project_id,
    module_component = EXCLUDED.module_component,
    environment_id = EXCLUDED.environment_id,
    severity_id = EXCLUDED.severity_id,
    priority_id = EXCLUDED.priority_id,
    current_status = EXCLUDED.current_status,
    assigned_to_user_id = EXCLUDED.assigned_to_user_id,
    created_by_user_id = EXCLUDED.created_by_user_id,
    steps_html = EXCLUDED.steps_html,
    expected_result = EXCLUDED.expected_result,
    actual_result = EXCLUDED.actual_result,
    fixed_in_release_id = EXCLUDED.fixed_in_release_id,
    fix_date = EXCLUDED.fix_date,
    closure_date = EXCLUDED.closure_date,
    updated_at = EXCLUDED.updated_at,
    updated_by_user_id = EXCLUDED.updated_by_user_id;

INSERT INTO defect_inline_assets (
    id,
    defect_id,
    asset_kind,
    original_filename,
    storage_key,
    content_type,
    file_size_bytes,
    width_px,
    height_px,
    created_by_user_id
) VALUES
    (
        '70000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000001',
        'steps_image',
        'clipboard-step-1.png',
        'defects/DF-1042/inline/clipboard-step-1.png',
        'image/png',
        238400,
        720,
        420,
        '10000000-0000-0000-0000-000000000001'
    )
ON CONFLICT (id) DO UPDATE SET
    storage_key = EXCLUDED.storage_key,
    content_type = EXCLUDED.content_type,
    file_size_bytes = EXCLUDED.file_size_bytes,
    width_px = EXCLUDED.width_px,
    height_px = EXCLUDED.height_px;

INSERT INTO defect_attachments (
    id,
    defect_id,
    original_filename,
    storage_key,
    content_type,
    file_extension,
    file_size_bytes,
    uploaded_by_user_id
) VALUES
    (
        '80000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000001',
        'invoice-error.png',
        'defects/DF-1042/attachments/invoice-error.png',
        'image/png',
        'png',
        340000,
        '10000000-0000-0000-0000-000000000001'
    ),
    (
        '80000000-0000-0000-0000-000000000002',
        '60000000-0000-0000-0000-000000000004',
        'payment-export.log',
        'defects/DF-1045/attachments/payment-export.log',
        'text/plain',
        'log',
        52400,
        '10000000-0000-0000-0000-000000000003'
    )
ON CONFLICT (id) DO UPDATE SET
    original_filename = EXCLUDED.original_filename,
    storage_key = EXCLUDED.storage_key,
    content_type = EXCLUDED.content_type,
    file_extension = EXCLUDED.file_extension,
    file_size_bytes = EXCLUDED.file_size_bytes,
    uploaded_by_user_id = EXCLUDED.uploaded_by_user_id;

INSERT INTO defect_comments (
    id,
    defect_id,
    comment_text,
    created_by_user_id
) VALUES
    (
        '90000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000001',
        'Reproduced in UAT using the latest tax table.',
        '10000000-0000-0000-0000-000000000002'
    ),
    (
        '90000000-0000-0000-0000-000000000002',
        '60000000-0000-0000-0000-000000000004',
        'Developer fix is ready for QA verification.',
        '10000000-0000-0000-0000-000000000003'
    )
ON CONFLICT (id) DO UPDATE SET
    comment_text = EXCLUDED.comment_text,
    created_by_user_id = EXCLUDED.created_by_user_id;

INSERT INTO defect_history_events (
    id,
    defect_id,
    event_batch_id,
    event_type,
    field_name,
    old_value,
    new_value,
    metadata_json,
    actor_user_id,
    created_at
) VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
        'defect_created',
        null,
        null,
        'DF-1042',
        '{}'::jsonb,
        '10000000-0000-0000-0000-000000000001',
        now() - interval '5 days'
    ),
    (
        'a0000000-0000-0000-0000-000000000002',
        '60000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000002',
        'status_changed',
        'current_status',
        'Assigned',
        'InProgress',
        '{}'::jsonb,
        '10000000-0000-0000-0000-000000000002',
        now() - interval '1 day'
    ),
    (
        'a0000000-0000-0000-0000-000000000003',
        '60000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000002',
        'priority_changed',
        'priority',
        'P2',
        'P1',
        '{}'::jsonb,
        '10000000-0000-0000-0000-000000000002',
        now() - interval '1 day'
    ),
    (
        'a0000000-0000-0000-0000-000000000004',
        '60000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000003',
        'attachment_uploaded',
        'attachment',
        null,
        'invoice-error.png',
        '{"attachment_id": "80000000-0000-0000-0000-000000000001", "file_size_bytes": 340000, "content_type": "image/png"}'::jsonb,
        '10000000-0000-0000-0000-000000000001',
        now() - interval '4 days'
    ),
    (
        'a0000000-0000-0000-0000-000000000005',
        '60000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000004',
        'inline_asset_added',
        'steps_html',
        null,
        'clipboard-step-1.png',
        '{"inline_asset_id": "70000000-0000-0000-0000-000000000001", "width_px": 720, "height_px": 420}'::jsonb,
        '10000000-0000-0000-0000-000000000001',
        now() - interval '5 days'
    )
ON CONFLICT (id) DO UPDATE SET
    event_batch_id = EXCLUDED.event_batch_id,
    event_type = EXCLUDED.event_type,
    field_name = EXCLUDED.field_name,
    old_value = EXCLUDED.old_value,
    new_value = EXCLUDED.new_value,
    metadata_json = EXCLUDED.metadata_json,
    actor_user_id = EXCLUDED.actor_user_id,
    created_at = EXCLUDED.created_at;

COMMIT;
