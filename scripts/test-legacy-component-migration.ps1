param(
  [int]$Port = 13307,
  [switch]$KeepDatabase
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $PSScriptRoot "..\docker-compose.integration.yml"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$previousPort = $env:TGR_INTEGRATION_DB_PORT

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

function Invoke-Sql {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Sql,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  $Sql | docker compose -f $composeFile exec -T mysql mysql -uroot tgr_consulting_test
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

function Invoke-MigrationFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $content = Get-Content -LiteralPath $Path -Raw
  $statements = $content -split '--> statement-breakpoint'
  foreach ($statement in $statements) {
    if (-not [string]::IsNullOrWhiteSpace($statement)) {
      Invoke-Sql -Sql $statement -Description "Migration $(Split-Path $Path -Leaf)"
    }
  }
}

try {
  $env:TGR_INTEGRATION_DB_PORT = "$Port"
  Invoke-Checked { docker compose -f $composeFile down --remove-orphans } "Legacy database cleanup"
  Invoke-Checked { docker compose -f $composeFile up -d --wait --wait-timeout 120 } "Legacy database startup"

  Get-ChildItem (Join-Path $repoRoot "drizzle") -Filter "*.sql" |
    Where-Object { $_.BaseName -match '^\d{4}_' -and [int]$_.BaseName.Substring(0, 4) -le 10 } |
    Sort-Object Name |
    ForEach-Object { Invoke-MigrationFile -Path $_.FullName }

  Invoke-Sql -Description "Legacy duplicate fixture" -Sql @'
INSERT INTO `project_component_records`
  (`id`, `versionId`, `componentType`, `name`, `status`, `payload`, `sourceType`, `sourceRef`, `updatedBy`, `createdAt`, `updatedAt`)
VALUES
  ('legacy-old', 'legacy-version', 'product_stock', 'Inventory', 'provided', JSON_OBJECT('marker', 'old'), 'current_document', 'legacy-old', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
  ('legacy-new', 'legacy-version', 'product_stock', 'Inventory', 'provided', JSON_OBJECT('marker', 'new'), 'current_document', 'legacy-new', 1, '2026-01-02 00:00:00', '2026-01-02 00:00:00');
'@

  Invoke-MigrationFile -Path (Join-Path $repoRoot "drizzle\0011_project_component_identity.sql")

  $survivor = docker compose -f $composeFile exec -T mysql mysql -uroot -N -B tgr_consulting_test -e "SELECT CONCAT(COUNT(*), ':', MAX(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.marker')))) FROM project_component_records WHERE versionId = 'legacy-version' AND componentType = 'product_stock' AND name = 'Inventory';"
  if ($LASTEXITCODE -ne 0 -or ($survivor.Trim() -ne "1:new")) {
    throw "Legacy deduplication kept an unexpected record: '$($survivor.Trim())'."
  }

  $duplicateSql = @'
INSERT INTO `project_component_records`
  (`id`, `versionId`, `componentType`, `name`, `status`, `payload`, `sourceType`, `sourceRef`, `updatedBy`)
VALUES
  ('legacy-duplicate', 'legacy-version', 'product_stock', 'Inventory', 'provided', JSON_OBJECT('marker', 'duplicate'), 'current_document', 'legacy-duplicate', 1);
'@
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $duplicateSql | docker compose -f $composeFile exec -T mysql mysql -uroot tgr_consulting_test 2>$null
    $duplicateExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorPreference
  }
  if ($duplicateExitCode -eq 0) {
    throw "The logical component unique constraint accepted a duplicate record."
  }

  Invoke-MigrationFile -Path (Join-Path $repoRoot "drizzle\0012_commercial_operations_component.sql")
  Invoke-MigrationFile -Path (Join-Path $repoRoot "drizzle\0013_lifecycle_idempotency.sql")

  Invoke-Sql -Description "Legacy snapshot fixture" -Sql @'
INSERT INTO `project_versions`
  (`id`, `projectId`, `parentVersionId`, `formulaSetVersionId`, `kind`, `state`, `isImmutable`, `inputHash`, `createdBy`, `createdAt`)
VALUES
  ('legacy-version', 'legacy-project', NULL, 'legacy-formula', 'working', 'draft', 0, REPEAT('0', 64), 1, '2026-01-01 00:00:00');

INSERT INTO `calculation_snapshots`
  (`id`, `projectVersionId`, `formulaSetVersionId`, `horizonMonths`, `inputHash`, `snapshotHash`, `calculationStatus`, `validationStatus`, `isAuthoritative`, `payload`, `createdBy`, `createdAt`)
VALUES
  ('legacy-snapshot-new', 'legacy-version', 'legacy-formula', 24, REPEAT('1', 64), REPEAT('2', 64), 'valid', 'valid', 1, JSON_OBJECT('authoritativeDomains', JSON_OBJECT('asOfMonth', 5)), 1, '2026-01-02 00:00:00'),
  ('legacy-snapshot-old', 'legacy-version', 'legacy-formula', 24, REPEAT('3', 64), REPEAT('4', 64), 'valid', 'valid', 1, JSON_OBJECT('authoritativeDomains', JSON_OBJECT('asOfMonth', 3)), 1, '2026-01-01 00:00:00');
'@

  Invoke-MigrationFile -Path (Join-Path $repoRoot "drizzle\0014_snapshot_analytical_identity.sql")
  Invoke-MigrationFile -Path (Join-Path $repoRoot "drizzle\0015_financial_revision.sql")

  $snapshotOrder = docker compose -f $composeFile exec -T mysql mysql -uroot -N -B tgr_consulting_test -e "SELECT GROUP_CONCAT(CONCAT(id, ':', asOfMonth) ORDER BY createdOrdinal SEPARATOR ',') FROM calculation_snapshots WHERE id LIKE 'legacy-snapshot-%';"
  if ($LASTEXITCODE -ne 0 -or ($snapshotOrder.Trim() -ne "legacy-snapshot-old:3,legacy-snapshot-new:5")) {
    throw "Legacy snapshot backfill lost chronological/as-of identity: '$($snapshotOrder.Trim())'."
  }

  Invoke-Sql -Description "Post-migration snapshot auto ordinal" -Sql @'
INSERT INTO `calculation_snapshots`
  (`id`, `projectVersionId`, `formulaSetVersionId`, `horizonMonths`, `asOfMonth`, `inputHash`, `snapshotHash`, `calculationStatus`, `validationStatus`, `isAuthoritative`, `payload`, `createdBy`, `createdAt`)
VALUES
  ('legacy-snapshot-post', 'legacy-version', 'legacy-formula', 24, 7, REPEAT('5', 64), REPEAT('6', 64), 'valid', 'valid', 1, JSON_OBJECT(), 1, '2026-01-03 00:00:00');
'@
  $postOrdinal = docker compose -f $composeFile exec -T mysql mysql -uroot -N -B tgr_consulting_test -e "SELECT createdOrdinal FROM calculation_snapshots WHERE id = 'legacy-snapshot-post';"
  if ($LASTEXITCODE -ne 0 -or [int64]$postOrdinal.Trim() -le 2) {
    throw "Post-migration snapshot did not receive a monotonic ordinal: '$($postOrdinal.Trim())'."
  }

  $financialRevision = docker compose -f $composeFile exec -T mysql mysql -uroot -N -B tgr_consulting_test -e "SELECT financialRevision FROM project_versions WHERE id = 'legacy-version';"
  if ($LASTEXITCODE -ne 0 -or [int]$financialRevision.Trim() -ne 0) {
    throw "Legacy project version did not receive the initial financial revision: '$($financialRevision.Trim())'."
  }

  Write-Host "Legacy migration proof passed: component identity, chronological snapshot backfill, and financial revision preserved."
}
finally {
  if (-not $KeepDatabase) {
    docker compose -f $composeFile down --remove-orphans
  }
  $env:TGR_INTEGRATION_DB_PORT = $previousPort
}
