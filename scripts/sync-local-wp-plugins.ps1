# Sync neo-pulse-wp and neo-pulse-app from repo into WP Staging plugins dir.
# Prefers directory junctions; falls back to robocopy mirror for real folders.

param(
    [switch]$ForceRobocopy
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $PSScriptRoot "local-wp-staging.config.json"
$examplePath = Join-Path $PSScriptRoot "local-wp-staging.config.example.json"

if (-not (Test-Path $configPath)) {
    if (-not (Test-Path $examplePath)) {
        throw "Missing $configPath and $examplePath"
    }
    Copy-Item $examplePath $configPath
    Write-Host "Created $configPath from example. Edit paths if needed." -ForegroundColor Yellow
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$pluginsDir = [string]$config.pluginsDir
$wpRoot = [string]$config.wpRoot

if (-not $pluginsDir -or -not (Test-Path $pluginsDir)) {
    throw "pluginsDir not found: $pluginsDir"
}

$pluginMap = @{
    "neo-pulse-wp"  = Join-Path $repoRoot "wordpress-plugins\neo-pulse-wp"
    "neo-pulse-app" = Join-Path $repoRoot "wordpress-plugins\neo-pulse-app"
}

Push-Location $repoRoot
try {
    npm run embed:neo-pulse-wp-secrets
    if ($LASTEXITCODE -ne 0) { throw "embed:neo-pulse-wp-secrets failed" }
    node scripts/generate-local-app-secrets.mjs
    if ($LASTEXITCODE -ne 0) { throw "generate-local-app-secrets failed" }
    node scripts/setup-local-dominator.mjs
    if ($LASTEXITCODE -ne 0) { throw "setup-local-dominator failed" }
} finally {
    Pop-Location
}

function Test-Junction([string]$Path) {
    if (-not (Test-Path $Path)) { return $false }
    $item = Get-Item $Path -Force
    return $item.Attributes -band [IO.FileAttributes]::ReparsePoint
}

function Sync-Plugin([string]$Name, [string]$Source, [string]$Target) {
    if (-not (Test-Path $Source)) {
        throw "Repo plugin missing: $Source"
    }

    if (Test-Path $Target) {
        if (Test-Junction $Target) {
            $link = (Get-Item $Target).Target
            if ($link -eq $Source) {
                Write-Host "  $Name junction OK" -ForegroundColor Green
                return
            }
            Remove-Item $Target -Force
        } elseif ($ForceRobocopy) {
            Write-Host "  $Name mirroring (robocopy)..." -ForegroundColor Cyan
            robocopy $Source $Target /MIR /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
            if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $Name (exit $LASTEXITCODE)" }
            Write-Host "  $Name mirrored" -ForegroundColor Green
            return
        } else {
            throw "$Target exists and is not a junction to $Source. Re-run with -ForceRobocopy or remove the folder."
        }
    }

    Write-Host "  $Name creating junction..." -ForegroundColor Cyan
    cmd /c mklink /J "$Target" "$Source" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Junction failed; using robocopy mirror..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $Target -Force | Out-Null
        robocopy $Source $Target /MIR /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $Name (exit $LASTEXITCODE)" }
    }
    Write-Host "  $Name synced" -ForegroundColor Green
}

Write-Host "Syncing plugins to $pluginsDir" -ForegroundColor Cyan
foreach ($entry in $pluginMap.GetEnumerator()) {
    Sync-Plugin -Name $entry.Key -Source $entry.Value -Target (Join-Path $pluginsDir $entry.Key)
}

Write-Host "`nDone. Activate plugins in https://$($config.siteHost)/wp-admin/ if needed." -ForegroundColor Green

$dockerPhp = docker ps --filter "name=wpstg-neopulse-local-php" --format "{{.Names}}" 2>$null | Select-Object -First 1
if ($dockerPhp) {
    Write-Host "`nCopying plugins into Docker webroot ($dockerPhp)..." -ForegroundColor Cyan
    foreach ($entry in $pluginMap.GetEnumerator()) {
        $dest = "/var/www/wp-content/plugins/$($entry.Key)"
        docker exec $dockerPhp rm -rf $dest 2>$null
        docker exec $dockerPhp mkdir -p $dest 2>$null
        docker cp "$($entry.Value)/." "${dockerPhp}:$dest/" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  $($entry.Key) docker cp failed (exit $LASTEXITCODE)" -ForegroundColor Yellow
        } else {
            Write-Host "  $($entry.Key) copied to container" -ForegroundColor Green
        }
    }
    docker exec $dockerPhp kill -USR2 1 2>$null
    Write-Host "PHP opcache reload signaled." -ForegroundColor Green
} else {
    Write-Host "`nDocker PHP container not running; skipped container plugin copy." -ForegroundColor Yellow
}
