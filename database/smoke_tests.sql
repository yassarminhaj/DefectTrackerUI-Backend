-- Defect Tracker Phase 1 database smoke tests
-- Read-only checks. Run after schema.sql and seed.sql.

\echo ''
\echo '1. Active project operational defect count'
SELECT
    count(*) AS active_project_defects
FROM defects d
JOIN projects p ON p.id = d.project_id
WHERE p.is_active = true
  AND d.is_deleted = false;

\echo ''
\echo '2. Inactive project records exist but are excluded from active dashboard queries'
SELECT
    d.defect_key,
    p.project_name,
    p.is_active
FROM defects d
JOIN projects p ON p.id = d.project_id
WHERE p.is_active = false
ORDER BY d.defect_key;

\echo ''
\echo '3. Test context defects from active projects'
SELECT
    d.defect_key,
    d.current_status,
    p.project_name,
    e.environment_name,
    e.environment_scope
FROM defects d
JOIN projects p ON p.id = d.project_id
JOIN environments e ON e.id = d.environment_id
WHERE p.is_active = true
  AND d.is_deleted = false
  AND e.environment_scope = 'Test'
ORDER BY d.defect_key;

\echo ''
\echo '4. Prod context defects from active projects'
SELECT
    d.defect_key,
    d.current_status,
    p.project_name,
    e.environment_name,
    e.environment_scope
FROM defects d
JOIN projects p ON p.id = d.project_id
JOIN environments e ON e.id = d.environment_id
WHERE p.is_active = true
  AND d.is_deleted = false
  AND e.environment_scope = 'Prod'
ORDER BY d.defect_key;

\echo ''
\echo '5. Allowed next statuses for InProgress'
SELECT
    wt.from_status,
    wt.to_status,
    wt.display_order
FROM workflow_transitions wt
JOIN workflow_definitions wd ON wd.id = wt.workflow_definition_id
WHERE wd.is_active = true
  AND wt.is_active = true
  AND wt.from_status = 'InProgress'
ORDER BY wt.display_order, wt.to_status;

\echo ''
\echo '6. Terminal status check for Rejected'
SELECT
    'Rejected' AS current_status,
    count(*) AS allowed_next_status_count
FROM workflow_transitions wt
JOIN workflow_definitions wd ON wd.id = wt.workflow_definition_id
WHERE wd.is_active = true
  AND wt.is_active = true
  AND wt.from_status = 'Rejected';

\echo ''
\echo '7. Release rollout content derived from fixed_in_release_id'
SELECT
    r.release_version,
    r.planned_deployment_date,
    r.actual_deployment_date,
    d.defect_key,
    d.title,
    d.current_status
FROM releases r
JOIN defects d ON d.fixed_in_release_id = r.id
ORDER BY r.release_version, d.defect_key;

\echo ''
\echo '8. Defect history rows grouped by event_batch_id'
SELECT
    d.defect_key,
    h.event_batch_id,
    count(*) AS event_count,
    min(h.created_at) AS event_time
FROM defect_history_events h
JOIN defects d ON d.id = h.defect_id
GROUP BY d.defect_key, h.event_batch_id
ORDER BY d.defect_key, event_time;

\echo ''
\echo '9. Inline assets are separate from standalone attachments'
SELECT
    d.defect_key,
    count(DISTINCT ia.id) AS inline_asset_count,
    count(DISTINCT da.id) FILTER (WHERE da.is_deleted = false) AS attachment_count
FROM defects d
LEFT JOIN defect_inline_assets ia ON ia.defect_id = d.id
LEFT JOIN defect_attachments da ON da.defect_id = d.id
GROUP BY d.defect_key
ORDER BY d.defect_key;

\echo ''
\echo '10. Comments belong to defects and remain separate from history'
SELECT
    d.defect_key,
    c.comment_text,
    u.username AS comment_author
FROM defect_comments c
JOIN defects d ON d.id = c.defect_id
JOIN app_users u ON u.id = c.created_by_user_id
WHERE c.is_deleted = false
ORDER BY d.defect_key, c.created_at;
