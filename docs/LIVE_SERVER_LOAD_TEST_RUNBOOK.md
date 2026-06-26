# Live Server Load Test Runbook

This runbook defines how to performance test the Defect Tracker application after it is deployed to a live-like server. Use it for staging/UAT first. Do not run the first load test directly against production with real users unless the test window, rollback plan, and data policy are approved.

## Objective

Validate how the application performs with at least 1000 backend defect records under realistic user traffic.

The test should answer:

- Can users log in and navigate core pages without errors?
- Can the dashboard and defect list stay responsive with 1000+ defects?
- At what user count do latency, HTTP errors, or database errors become unacceptable?
- Is the live server configuration stronger than the local Flask development setup?

## Environment

Record these details before every run:

| Item | Value |
|---|---|
| Test date/time | TBD |
| Tester | TBD |
| Target URL | `https://<server-domain>` |
| Environment | Staging / UAT / Production |
| App version / commit | TBD |
| Server CPU / RAM | TBD |
| App server | TBD, for example Waitress, Gunicorn, IIS reverse proxy |
| PostgreSQL host/version | TBD |
| Defect record count | Target: `>= 1000` |
| Test account | TBD |
| Data context | Test / Prod / All |

## Preconditions

- Application is deployed and reachable over HTTPS.
- The target server uses a production-style app server, not Flask debug/dev server.
- PostgreSQL is running with production-like connection limits.
- Monitoring/logging is enabled for:
  - HTTP status codes
  - app errors
  - database connection errors
  - CPU, memory, and disk usage
  - PostgreSQL active connections and slow queries
- A test account exists and can log in.
- The database contains at least 1000 active defect records.
- If testing production, use a maintenance window or agreed traffic limit.

## Test Data

Required minimum:

- `>= 1000` active defects
- Multiple projects
- Multiple environments
- Multiple statuses: `New`, `Assigned`, `In Progress`, `Retest`, `Closed`
- Multiple severities and priorities
- Some fixed/closed defects with release fields populated

Before testing, capture:

```sql
select count(*) as active_defects
from defects
where is_deleted = false;
```

Optional distribution checks:

```sql
select current_status, count(*)
from defects
where is_deleted = false
group by current_status
order by current_status;

select p.project_name, count(*)
from defects d
join projects p on p.id = d.project_id
where d.is_deleted = false
group by p.project_name
order by count(*) desc;
```

## User Journeys

Each virtual user should repeat these actions:

1. Open `/login.html`.
2. Log in with the test account.
3. Open `/dashboard.html`.
4. Open `/defect_list.html`.
5. Sort or filter the defect list.
6. Open one defect detail page.
7. Open one defect edit page without saving destructive changes.
8. Open `/projects.html`.
9. Open `/users.html`.
10. Open `/environments.html`.
11. Open `/status_workflow.html`.
12. Log out or end the browser session.

For API-only load tests, map the journey to these endpoint groups:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/charts`
- `GET /api/v1/defects?page=1&pageSize=100`
- `GET /api/v1/defects?page=1&pageSize=10`
- `GET /api/v1/defects/{defectId}`
- `GET /api/v1/defects/{defectId}/history?page=1&pageSize=100`
- `GET /api/v1/projects`
- `GET /api/v1/users?page=1&pageSize=100`
- `GET /api/v1/environments`
- `GET /api/v1/workflow`

## Load Profile

Use stepped load. Do not jump straight to the maximum target.

| Step | Users | Ramp-up | Hold | Purpose |
|---|---:|---:|---:|---|
| Smoke | 1 | 0 min | 5 min | Confirm login and core journeys work |
| Baseline | 5 | 2 min | 10 min | Establish normal latency |
| Small team | 10 | 3 min | 10 min | Validate common internal usage |
| Phase 1 target | 25 | 5 min | 15 min | Match local-pilot concurrency target |
| Extended | 50 | 10 min | 15 min | Optional capacity check |
| Stress | Increase by 25 | 5 min per step | 10 min per step | Find breaking point |

Stop the test if:

- HTTP 5xx rate exceeds 1% for 2 consecutive minutes.
- Login failures exceed 1%.
- Database connection errors appear repeatedly.
- p95 page/API latency exceeds 10 seconds for 3 consecutive minutes.
- CPU or memory remains saturated and user impact is expected.

## Metrics To Capture

Application metrics:

- Total requests
- Requests per second
- HTTP 2xx/3xx/4xx/5xx counts
- Login success rate
- Page-flow success rate
- Failed requests by endpoint
- Median, p90, p95, and max response time
- Browser console errors, for UI tests

Server metrics:

- CPU percent
- Memory usage
- Disk I/O
- Network throughput
- App worker/process count
- App server request queue, if available

Database metrics:

- Active connections
- Connection wait/errors
- Slow queries
- Lock waits
- CPU and memory
- Query timings for dashboard and defect-list endpoints

## Acceptance Criteria

For Phase 1 live-server completion, the `25 users` step should meet:

| Criterion | Target |
|---|---:|
| Login success rate | `100%` |
| Page-flow success rate | `>= 95%` |
| HTTP 5xx rate | `0%` preferred, `< 0.5%` maximum |
| Database unavailable errors | `0` |
| Median page/API action time | `< 2 seconds` |
| p95 page/API action time | `< 5 seconds` |
| Critical browser console errors | `0` |
| Server CPU | Should not stay above `85%` |
| Server memory | Should not continuously grow |

If any target fails, record the failure as a Phase 1 performance finding and rerun only after a fix or configuration change.

## Recommended Test Runs

Run these in order:

1. **Single-user 1000-record UI timing**
   - Confirms the deployed app handles the dataset without concurrency.
   - Expected result: no 5xx, no console errors, pages load normally.

2. **25-user UI load**
   - Confirms realistic concurrent browser traffic.
   - Expected result: meets Phase 1 acceptance criteria.

3. **25-user API load**
   - Confirms backend behavior without browser rendering noise.
   - Use this to isolate backend/database bottlenecks.

4. **Stress test**
   - Optional.
   - Increase users until error rate, latency, or resource usage crosses the stop threshold.

## Evidence Folder

Save all run artifacts in one dated folder:

```text
load-test-results/
  YYYY-MM-DD-phase1-live-load/
    summary.md
    raw-results.json
    browser-console.log
    server-metrics.csv
    db-metrics.csv
    screenshots/
```

## Summary Template

Use this template for `summary.md`:

```markdown
# Phase 1 Live Load Test Summary

## Result

PASS / FAIL

## Environment

- Target URL:
- Environment:
- App version / commit:
- Server:
- PostgreSQL:
- Active defect count:
- Test date/time:

## Load Profile

| Step | Users | Duration | Result |
|---|---:|---:|---|
| Smoke | 1 | 5 min | TBD |
| Baseline | 5 | 10 min | TBD |
| Small team | 10 | 10 min | TBD |
| Phase 1 target | 25 | 15 min | TBD |

## Metrics

| Metric | Value |
|---|---:|
| Login success rate | TBD |
| Page-flow success rate | TBD |
| HTTP 5xx rate | TBD |
| Median response time | TBD |
| p95 response time | TBD |
| Max response time | TBD |
| Database unavailable errors | TBD |
| Critical console errors | TBD |
| Peak CPU | TBD |
| Peak memory | TBD |
| Peak DB connections | TBD |

## Findings

- TBD

## Decision

Phase 1 load-test status: PASS / FAIL

## Follow-Ups

- TBD
```

## Notes From Local 1000-Defect Test

The local workstation test with 1000 defects showed:

- Single-user UI navigation passed.
- The local Flask development setup failed under 25 concurrent browser contexts with `503 database_unavailable`.
- The live-server test should therefore focus on validating production-style app server and database connection behavior, not just the 1000-record dataset.
