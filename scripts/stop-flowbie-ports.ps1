# Stop processes listening on NEO Pulse dev ports (one shot, no spam).
param(
    [string]$PortList = '3001,3002,8000,8080'
)

$ErrorActionPreference = 'SilentlyContinue'
$Ports = @(
    $PortList.Split(',') |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ } |
        ForEach-Object { [int]$_ }
)
$pids = foreach ($port in $Ports) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess
}
$pids = @($pids | Where-Object { $_ -and $_ -gt 0 } | Sort-Object -Unique)

if (-not $pids.Count) {
    Write-Host "[OK] No listeners on ports $($Ports -join ', ')."
    exit 0
}

Write-Host "[INFO] Stopping $($pids.Count) process(es) on ports $($Ports -join ', '): $($pids -join ', ')"
foreach ($pid in $pids) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}
Write-Host "[OK] Port cleanup complete."
