# One-time local WP Staging setup: hosts, secrets, plugin sync.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

Write-Host "Local WP Staging setup" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot`n"

$configPath = Join-Path $PSScriptRoot "local-wp-staging.config.json"
$examplePath = Join-Path $PSScriptRoot "local-wp-staging.config.example.json"
if (-not (Test-Path $configPath)) {
    Copy-Item $examplePath $configPath
    Write-Host "Created scripts/local-wp-staging.config.json from example." -ForegroundColor Yellow
}

Write-Host "Step 1/3: Fix hosts file (UAC prompt)..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "fix-wp-staging-hosts.ps1") -NoPrompt

Write-Host "`nStep 2/3: Embed WP plugin secrets..." -ForegroundColor Cyan
Push-Location $repoRoot
try {
    npm run embed:neo-pulse-wp-secrets
    if ($LASTEXITCODE -ne 0) { throw "embed:neo-pulse-wp-secrets failed" }
    node scripts/generate-local-app-secrets.mjs
    if ($LASTEXITCODE -ne 0) { throw "generate-local-app-secrets failed" }
} finally {
    Pop-Location
}

Write-Host "`nStep 3/3: Sync plugins to WP Staging..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "sync-local-wp-plugins.ps1")

$config = Get-Content $configPath -Raw | ConvertFrom-Json
Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "  WP Admin:  https://$($config.siteHost)/wp-admin/"
Write-Host "  Dev app:   npm run dev:local  then open http://localhost:8080"
Write-Host "  Bootstrap: POST https://$($config.siteHost)/api/auth/setup-admin (first run only)"
Write-Host "  Docs:      docs/local-wp-staging-dev.md"
