# Start local NEO Pulse dev stack: Docker Desktop, docker compose (neopulse.local), Vite on :8080.
#
# Usage (repo root):
#   npm run start:local
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-dev.ps1
#   powershell -File scripts/start-local-dev.ps1 -OpenBrowser
#
# Agent trigger phrases: launch, startup, start local, run local, neopulse.local, start docker site.

param(
    [switch]$OpenBrowser,
    [switch]$SkipDev,
    [switch]$SkipDocker,
    [int]$HealthTimeoutSec = 120
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $PSScriptRoot "local-wp-staging.config.json"
$examplePath = Join-Path $PSScriptRoot "local-wp-staging.config.example.json"
$viteLog = Join-Path $repoRoot ".local-dev-vite.log"
$flowbieTmp = "B:\Flowbie-tmp"
New-Item -ItemType Directory -Force -Path @(
    (Join-Path $flowbieTmp "chatgpt-audit-jobs"),
    (Join-Path $flowbieTmp "browser-automation-jobs"),
    (Join-Path $flowbieTmp "post-creator-jobs"),
    (Join-Path $flowbieTmp "ld-jobs")
) | Out-Null
if (-not $env:CHATGPT_AUDIT_JOBS_DIR) { $env:CHATGPT_AUDIT_JOBS_DIR = Join-Path $flowbieTmp "chatgpt-audit-jobs" }
if (-not $env:BROWSER_AUTOMATION_JOBS_DIR) { $env:BROWSER_AUTOMATION_JOBS_DIR = Join-Path $flowbieTmp "browser-automation-jobs" }
if (-not $env:POST_CREATOR_SERVER_JOBS_DIR) { $env:POST_CREATOR_SERVER_JOBS_DIR = Join-Path $flowbieTmp "post-creator-jobs" }
if (-not $env:LOCAL_DOMINATOR_JOBS_DIR) { $env:LOCAL_DOMINATOR_JOBS_DIR = Join-Path $flowbieTmp "ld-jobs" }

function Write-Step([string]$Message) {
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host $Message -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host $Message -ForegroundColor Yellow
}

function Get-LocalConfig() {
    if (-not (Test-Path $configPath)) {
        if (Test-Path $examplePath) {
            Copy-Item $examplePath $configPath
            Write-Warn "Created scripts/local-wp-staging.config.json from example."
        } else {
            throw "Missing scripts/local-wp-staging.config.json"
        }
    }
    return Get-Content $configPath -Raw | ConvertFrom-Json
}

function Test-DockerReady() {
    try {
        docker info --format "{{.ServerVersion}}" 1>$null 2>$null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Start-DockerEngine([int]$TimeoutSec) {
    if (Test-DockerReady) {
        Write-Ok "Docker is ready"
        return
    }

    $dockerDesktop = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dockerDesktop) {
        throw "Docker Desktop not found. Install Docker Desktop, then run this again."
    }

    Write-Step "Starting Docker Desktop..."
    Start-Process -FilePath $dockerDesktop | Out-Null

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-DockerReady) {
            Write-Ok "Docker is ready"
            return
        }
        Start-Sleep -Seconds 3
    }
    throw "Docker Desktop did not become ready within ${TimeoutSec}s."
}

function Start-LocalWpCompose([string]$SiteDir) {
    $compose = Join-Path $SiteDir "docker-compose.yml"
    if (-not (Test-Path $compose)) {
        throw "Missing $compose"
    }
    Write-Step "Starting site containers (docker compose, no WP Staging license)..."
    Push-Location $SiteDir
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        docker compose up -d
        if ($LASTEXITCODE -ne 0) {
            throw "docker compose up failed in $SiteDir"
        }
    } finally {
        $ErrorActionPreference = $prevEap
        Pop-Location
    }
}

function Test-TcpPort([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Wait-HttpOk([string]$Url, [int]$TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $code = curl.exe -k -s -o NUL -w "%{http_code}" $Url 2>$null
            if ($code -match "^(200|301|302)$") { return $true }
        } catch {
            # retry
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Start-LocalWorkerServer() {
    $workerPort = 10000
    if (Test-TcpPort $workerPort) {
        Write-Ok "Host worker already listening on http://localhost:$workerPort"
        return
    }

    Write-Step "Starting host worker (npm run start:ld-worker on :$workerPort)..."
    $workerLog = Join-Path $repoRoot ".local-dev-worker.log"
    $workerCmd = "Set-Location -LiteralPath '$repoRoot'; npm run start:ld-worker *>> '$workerLog'"
    Start-Process powershell -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command", $workerCmd
    ) -WindowStyle Minimized | Out-Null

    $deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort $workerPort) {
            Write-Ok "Host worker ready at http://localhost:$workerPort (log: .local-dev-worker.log)"
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "Host worker did not start on port $workerPort within ${HealthTimeoutSec}s. See .local-dev-worker.log"
}

function Start-ViteDevServer() {
    if (Test-TcpPort 8080) {
        Write-Ok "Vite already listening on http://localhost:8080"
        return
    }

    Write-Step "Starting Vite dev server (npm run dev)..."
    $devCmd = "Set-Location -LiteralPath '$repoRoot'; npm run dev *>> '$viteLog'"
    Start-Process powershell -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command", $devCmd
    ) -WindowStyle Minimized | Out-Null

    $deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort 8080) {
            Write-Ok "Vite ready at http://localhost:8080 (log: .local-dev-vite.log)"
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "Vite did not start on port 8080 within ${HealthTimeoutSec}s. See .local-dev-vite.log"
}

$config = Get-LocalConfig
$siteHost = [string]$config.siteHost
$siteUrl = ([string]$config.siteUrl).TrimEnd("/")
$devUrl = if ($config.viteDevUrl) { [string]$config.viteDevUrl } else { "http://localhost:8080/" }
$wpStagingSiteDir = Split-Path ([string]$config.wpRoot) -Parent
if (-not $wpStagingSiteDir -or -not (Test-Path $wpStagingSiteDir)) {
    $wpStagingSiteDir = Join-Path $env:USERPROFILE "wpstaging\sites\$siteHost"
}

Write-Step "NEO Pulse local startup"
Write-Host "  Repo:     $repoRoot"
Write-Host "  WP site:  $siteUrl"
Write-Host "  Dev app:  $devUrl"
Write-Host ""

if (-not $SkipDocker) {
    Start-DockerEngine ([Math]::Max($HealthTimeoutSec, 240))
    Start-LocalWpCompose $wpStagingSiteDir

    Write-Step "Waiting for $siteUrl ..."
    if (-not (Wait-HttpOk "$siteUrl/" $HealthTimeoutSec)) {
        throw "$siteUrl did not respond. Check Docker Desktop is running."
    }
    Write-Ok "$siteUrl is up"
} else {
    Write-Warn "Skipped Docker (-SkipDocker)"
}

if (-not $SkipDev) {
    Start-ViteDevServer
} else {
    Write-Warn "Skipped Vite (-SkipDev)"
}

Start-LocalWorkerServer

Write-Step "Priming WordPress cron (local wp-config has DISABLE_WP_CRON)..."
curl.exe -k -s -o NUL "$siteUrl/wp-cron.php?doing_wp_cron"
Write-Ok "wp-cron ping sent"

Write-Host ""
Write-Ok "Local stack ready."
Write-Host "  WordPress:  $siteUrl/"
Write-Host "  WP Admin:   $siteUrl/wp-admin/"
Write-Host "  Host worker: http://localhost:10000/ (post creator + LD jobs)"
Write-Host "  React app:  $devUrl"
Write-Host "  Login:      ${devUrl}login"
Write-Host ""
Write-Host "If Forge shows Unauthorized after a reboot, hard-refresh the browser or sign in again."
Write-Host "First-time setup only: npm run setup:local-wp"
Write-Host "Docs: docs/local-wp-staging-dev.md"

if ($OpenBrowser) {
    Start-Process "$devUrl"
}
