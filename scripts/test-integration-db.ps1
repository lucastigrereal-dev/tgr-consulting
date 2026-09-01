param(
  [int]$Port = 13306,
  [switch]$KeepDatabase
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $PSScriptRoot "..\docker-compose.integration.yml"
$previousDatabaseUrl = $env:DATABASE_URL
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

function Wait-ForHealthyDatabase {
  param(
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $containerId = (& docker compose -f $composeFile ps -q mysql).Trim()
    if ($containerId) {
      $state = (& docker inspect --format "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}" $containerId).Trim()
      if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect the integration database container."
      }
      if ($state -eq "running|healthy") {
        return
      }
      if ($state.StartsWith("exited|")) {
        throw "Integration database exited before becoming healthy ($state)."
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "Integration database did not become healthy within $TimeoutSeconds seconds."
}

try {
  $env:TGR_INTEGRATION_DB_PORT = "$Port"
  $env:DATABASE_URL = "mysql://root@127.0.0.1:$Port/tgr_consulting_test"

  Invoke-Checked { docker compose -f $composeFile down --remove-orphans } "Integration database cleanup"
  Invoke-Checked { docker compose -f $composeFile up -d } "Integration database startup"
  Wait-ForHealthyDatabase
  Invoke-Checked { pnpm exec drizzle-kit migrate } "Database migrations"
  Invoke-Checked {
    pnpm exec vitest run server/db.integration.test.ts server/routers/igr.database.integration.test.ts server/routers/igr.goalseek.database.integration.test.ts
  } "Database integration tests"
}
finally {
  if (-not $KeepDatabase) {
    docker compose -f $composeFile down --remove-orphans
  }

  $env:DATABASE_URL = $previousDatabaseUrl
  $env:TGR_INTEGRATION_DB_PORT = $previousPort
}
