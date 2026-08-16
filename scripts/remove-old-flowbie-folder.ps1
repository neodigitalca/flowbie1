# Run after closing Cursor/workspace on B:\USE THIS\NEO Pulse
$old = "B:\USE THIS\NEO Pulse"
if (-not (Test-Path $old)) {
  Write-Host "Already removed: $old"
  exit 0
}
Remove-Item -LiteralPath $old -Recurse -Force
if (Test-Path $old) {
  Write-Error "Could not remove $old (close apps using that folder and retry)."
  exit 1
}
Write-Host "Removed $old"
