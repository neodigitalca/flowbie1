# Fix WP Staging hosts entries for neopulse.local
# Run as Administrator: right-click PowerShell -> Run as administrator, then:
#   & "B:\Flowbie One\scripts\fix-wp-staging-hosts.ps1"

param(
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Re-launching as Administrator..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

$content = Get-Content $hostsPath -Raw

$block = @"
# WP Staging site mapping
127.3.2.1 neopulse.local
127.3.2.1 adminer.neopulse.local
"@

if ($content -match '(?s)# WP Staging site mapping.*?(?=\r?\n(?:#|\r?\n|$))') {
    $content = $content -replace '(?s)# WP Staging site mapping.*?(?=\r?\n(?:#|\r?\n|$))', $block.TrimEnd()
} else {
    $content = $content.TrimEnd() + "`r`n`r`n" + $block
}

Set-Content -Path $hostsPath -Value $content -NoNewline

Write-Host "Hosts file updated:" -ForegroundColor Green
Select-String -Path $hostsPath -Pattern "neopulse|127\.3\.2"

Write-Host "`nTesting HTTPS..." -ForegroundColor Cyan
curl.exe -k -I --connect-timeout 5 https://neopulse.local/ 2>&1 | Select-String "HTTP/"

Write-Host "`nDone. Reload WP Staging Desktop Diagnose tab." -ForegroundColor Green
if (-not $NoPrompt) {
    Read-Host "Press Enter to close"
}
