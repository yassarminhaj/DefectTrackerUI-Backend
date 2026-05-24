param(
    [string]$HostName,
    [string]$Port,
    [string]$Database,
    [string]$User,
    [string]$PgBin,
    [switch]$Force
)

. "$PSScriptRoot\_maintenance_common.ps1"

$config = Get-DbConfig
if (-not $HostName) { $HostName = $config.Host }
if (-not $Port) { $Port = $config.Port }
if (-not $Database) { $Database = $config.Database }
if (-not $User) { $User = $config.User }

$projectRoot = Get-ProjectRoot
$psql = Find-PostgresTool -ToolName "psql" -PgBin $PgBin
$seedSql = Join-Path $projectRoot "database\seed.sql"

if ($config.Password) {
    $env:PGPASSWORD = $config.Password
}

$rowCountQuery = @"
select coalesce(sum(row_count), 0) as total_rows
from (
    select count(*) as row_count from app_users
    union all select count(*) from user_password_events
    union all select count(*) from projects
    union all select count(*) from environments
    union all select count(*) from releases
    union all select count(*) from severity_levels
    union all select count(*) from priority_levels
    union all select count(*) from workflow_definitions
    union all select count(*) from workflow_transitions
    union all select count(*) from defects
    union all select count(*) from defect_inline_assets
    union all select count(*) from defect_attachments
    union all select count(*) from defect_comments
    union all select count(*) from defect_history_events
) counts;
"@

Write-Host "Checking whether app tables are empty..."
$rawCount = & $psql `
    --host $HostName `
    --port $Port `
    --username $User `
    --dbname $Database `
    --tuples-only `
    --no-align `
    --command $rowCountQuery

if ($LASTEXITCODE -ne 0) {
    throw "Could not verify table emptiness. Ensure schema exists before loading test data."
}

$totalRows = [int]($rawCount | Select-Object -Last 1).Trim()

if ($totalRows -gt 0 -and -not $Force) {
    throw "Test data was not loaded. App tables already contain $totalRows rows. Reset Database first, then Load Test Data."
}

Write-Host "Loading test data..."
& $psql --host $HostName --port $Port --username $User --dbname $Database --file $seedSql
if ($LASTEXITCODE -ne 0) {
    throw "Seed script failed with exit code $LASTEXITCODE."
}

Write-Host "Test data load complete."
