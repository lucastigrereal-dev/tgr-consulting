param(
  [int]$Port = 13307
)

$ErrorActionPreference = "Stop"
$databaseName = "tgr_consulting_test"
$composeProject = "tgr-consulting-restore-drill"
$composeService = "mysql"
$composeFile = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\docker-compose.integration.yml")
)
$previousDatabaseUrl = $env:DATABASE_URL
$previousPort = $env:TGR_INTEGRATION_DB_PORT
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$drillId = [Guid]::NewGuid().ToString("N")
$canaryToken = "tgr-restore-drill-$drillId"
$tempDirectory = Join-Path $tempRoot "tgr-consulting-restore-$drillId"
$dumpPath = Join-Path $tempDirectory "tgr_consulting_test.sql"
$containerDumpPath = "/tmp/tgr-consulting-restore-$drillId.sql"
$containerRestorePath = "/tmp/tgr-consulting-restore-input-$drillId.sql"
$containerId = $null

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

function Invoke-Captured {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  $output = & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
  return (($output | Out-String).Trim())
}

function Assert-ContainerIdentity {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedContainerId
  )

  if ($ExpectedContainerId -notmatch "^[0-9a-f]{12,64}$") {
    throw "The restore drill did not resolve a valid container id."
  }
  $currentContainerId = Invoke-Captured {
    docker compose -p $composeProject -f $composeFile ps -q $composeService
  } "Restore drill container lookup"
  if ($currentContainerId -ne $ExpectedContainerId) {
    throw "The restore drill container changed; destructive database operations were refused."
  }
  $inspectJson = Invoke-Captured {
    docker inspect $ExpectedContainerId
  } "Restore drill container identity check"
  $inspect = @($inspectJson | ConvertFrom-Json)[0]
  $identity = "$($inspect.Config.Labels.'com.docker.compose.project')|$($inspect.Config.Labels.'com.docker.compose.service')|$($inspect.State.Running.ToString().ToLowerInvariant())"
  if ($identity -ne "$composeProject|$composeService|true") {
    throw "Unexpected container identity '$identity'; destructive database operations were refused."
  }
  $publishedPort = Invoke-Captured {
    docker port $ExpectedContainerId 3306/tcp
  } "Restore drill port check"
  if ($publishedPort -notmatch "127\.0\.0\.1:$Port$") {
    throw "Unexpected MySQL port binding '$publishedPort'; expected loopback port $Port."
  }
}

if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
  throw "Integration compose file was not found: $composeFile"
}
if ($databaseName -ne "tgr_consulting_test" -or $databaseName -notmatch "^[a-z0-9_]+$") {
  throw "Unsafe restore drill database target."
}
if ($composeProject -ne "tgr-consulting-restore-drill") {
  throw "Unsafe restore drill compose project target."
}
if ($Port -lt 1024 -or $Port -gt 65535 -or $Port -eq 3306 -or $Port -eq 13306) {
  throw "Use a dedicated unprivileged restore-drill port different from 3306 and 13306."
}
if (-not ([System.IO.Path]::GetFullPath($tempDirectory)).StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Temporary restore path escaped the operating-system temp directory."
}

try {
  New-Item -ItemType Directory -Path $tempDirectory -ErrorAction Stop | Out-Null
  $env:TGR_INTEGRATION_DB_PORT = "$Port"
  $env:DATABASE_URL = "mysql://root@127.0.0.1:$Port/$databaseName"

  Invoke-Checked {
    docker compose -p $composeProject -f $composeFile down --remove-orphans
  } "Restore drill stale stack cleanup"
  Invoke-Checked {
    docker compose -p $composeProject -f $composeFile up -d --wait --wait-timeout 120 $composeService
  } "Restore drill MySQL startup"
  $containerId = Invoke-Captured {
    docker compose -p $composeProject -f $composeFile ps -q $composeService
  } "Restore drill container lookup"
  Assert-ContainerIdentity -ExpectedContainerId $containerId

  Invoke-Checked { pnpm exec drizzle-kit migrate } "Restore drill database migrations"
  Invoke-Checked {
    docker exec $containerId mysql --user=root --database=$databaseName --execute="CREATE TABLE restore_drill_canary (canary_token VARCHAR(96) PRIMARY KEY, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP); INSERT INTO restore_drill_canary (canary_token) VALUES ('$canaryToken');"
  } "Restore drill canary insertion"
  $canaryBeforeDump = Invoke-Captured {
    docker exec $containerId mysql --user=root --database=$databaseName --batch --skip-column-names --execute="SELECT canary_token FROM restore_drill_canary WHERE canary_token = '$canaryToken';"
  } "Restore drill pre-dump canary check"
  if ($canaryBeforeDump -ne $canaryToken) {
    throw "The restore drill canary was not persisted before backup."
  }

  Invoke-Checked {
    docker exec $containerId sh -c "mysqldump --user=root --single-transaction --routines --events --triggers $databaseName > $containerDumpPath"
  } "Restore drill logical backup"
  Invoke-Checked {
    docker cp "${containerId}:$containerDumpPath" $dumpPath
  } "Restore drill dump export"
  if (-not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) {
    throw "Restore drill dump was not created outside the repository."
  }
  $dumpFile = Get-Item -LiteralPath $dumpPath
  if ($dumpFile.Length -le 0) {
    throw "Restore drill dump is empty."
  }
  $dumpStream = [System.IO.File]::OpenRead($dumpPath)
  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $dumpHash = -join ($sha256.ComputeHash($dumpStream) | ForEach-Object { $_.ToString("x2") })
    }
    finally {
      $sha256.Dispose()
    }
  }
  finally {
    $dumpStream.Dispose()
  }

  Invoke-Checked {
    docker exec $containerId rm -f $containerDumpPath
  } "Restore drill in-container dump handoff"
  Invoke-Checked {
    docker cp $dumpPath "${containerId}:$containerRestorePath"
  } "Restore drill dump import"

  Assert-ContainerIdentity -ExpectedContainerId $containerId
  $schemaBeforeDrop = Invoke-Captured {
    docker exec $containerId mysql --user=root --batch --skip-column-names --execute="SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '$databaseName';"
  } "Restore drill target schema check"
  if ($schemaBeforeDrop -ne $databaseName) {
    throw "Expected ephemeral schema '$databaseName' was not found; destructive operations were refused."
  }

  Write-Host "Validated ephemeral target: project=$composeProject service=$composeService container=$containerId database=$databaseName"
  Invoke-Checked {
    docker exec $containerId mysql --user=root --execute="DROP DATABASE IF EXISTS ``$databaseName``; CREATE DATABASE ``$databaseName``;"
  } "Restore drill ephemeral database recreation"
  Invoke-Checked {
    docker exec $containerId sh -c "mysql --user=root $databaseName < $containerRestorePath"
  } "Restore drill database restore"

  $restoredCanary = Invoke-Captured {
    docker exec $containerId mysql --user=root --database=$databaseName --batch --skip-column-names --execute="SELECT canary_token FROM restore_drill_canary WHERE canary_token = '$canaryToken';"
  } "Restore drill restored canary check"
  if ($restoredCanary -ne $canaryToken) {
    throw "Restore drill failed: restored canary did not match."
  }
  Write-Host "RESTORE_DRILL_PASS database=$databaseName canary=$restoredCanary dumpBytes=$($dumpFile.Length) dumpSha256=$dumpHash"
}
finally {
  docker compose -p $composeProject -f $composeFile down --remove-orphans
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Restore drill stack cleanup returned exit code $LASTEXITCODE."
  }
  if (Test-Path -LiteralPath $dumpPath -PathType Leaf) {
    Remove-Item -LiteralPath $dumpPath -Force
  }
  if (Test-Path -LiteralPath $tempDirectory -PathType Container) {
    $remaining = @(Get-ChildItem -LiteralPath $tempDirectory -Force)
    if ($remaining.Count -eq 0) {
      Remove-Item -LiteralPath $tempDirectory -Force
    } else {
      Write-Warning "Restore drill temp directory was not empty and was preserved: $tempDirectory"
    }
  }
  $env:DATABASE_URL = $previousDatabaseUrl
  $env:TGR_INTEGRATION_DB_PORT = $previousPort
}
