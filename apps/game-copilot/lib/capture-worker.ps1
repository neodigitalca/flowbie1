param(
  [switch]$Worker,
  [string]$OutPath,
  [string]$ProcessName
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinCap {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnum, IntPtr lParam);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public static IntPtr FindWindowByProcessName(string processName) {
    if (string.IsNullOrWhiteSpace(processName)) return IntPtr.Zero;
    IntPtr found = IntPtr.Zero;
    uint targetPid = 0;
    var procs = System.Diagnostics.Process.GetProcessesByName(processName);
    if (procs != null && procs.Length > 0) targetPid = (uint)procs[0].Id;
    if (targetPid == 0) return IntPtr.Zero;
    EnumWindows((hWnd, lParam) => {
      if (!IsWindowVisible(hWnd)) return true;
      uint pid = 0;
      GetWindowThreadProcessId(hWnd, out pid);
      if (pid != targetPid) return true;
      StringBuilder sb = new StringBuilder(512);
      GetWindowText(hWnd, sb, 512);
      if (sb.Length > 0) { found = hWnd; return false; }
      if (found == IntPtr.Zero) found = hWnd;
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

function Capture-RegionToPath {
  param(
    [int]$Left,
    [int]$Top,
    [int]$Width,
    [int]$Height,
    [string]$TargetPath,
    [string]$Title,
    [string]$ProcName,
    [uint32]$PidVal,
    [string]$CaptureMode
  )
  if ($Width -lt 8 -or $Height -lt 8) { throw "Capture region too small" }
  $dir = Split-Path -Parent $TargetPath
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp = New-Object System.Drawing.Bitmap $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($Left, $Top, 0, 0, (New-Object System.Drawing.Size($Width, $Height)))
  $bmp.Save($TargetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  @{
    title = $Title
    processName = $ProcName
    pid = $PidVal
    width = $Width
    height = $Height
    captureMode = $CaptureMode
    captureLeft = $Left
    captureTop = $Top
  }
}

function Capture-HwndToPath {
  param([IntPtr]$Hwnd, [string]$TargetPath, [switch]$UseMonitor)
  if ($Hwnd -eq [IntPtr]::Zero) { throw "No window handle" }
  if ([WinCap]::IsIconic($Hwnd)) { throw "Game window minimized" }
  $rect = New-Object WinCap+RECT
  [void][WinCap]::GetWindowRect($Hwnd, [ref]$rect)
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  if ($w -lt 8 -or $h -lt 8) { throw "Window too small" }
  $sb = New-Object System.Text.StringBuilder 512
  [void][WinCap]::GetWindowText($Hwnd, $sb, 512)
  $title = $sb.ToString()
  $pidVal = [uint32]0
  [void][WinCap]::GetWindowThreadProcessId($Hwnd, [ref]$pidVal)
  $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
  $procName = if ($proc) { $proc.ProcessName } else { "" }
  if ($UseMonitor) {
    $centerX = [int](($rect.Left + $rect.Right) / 2)
    $centerY = [int](($rect.Top + $rect.Bottom) / 2)
    $screen = [System.Windows.Forms.Screen]::FromPoint([System.Drawing.Point]::new($centerX, $centerY))
    $bounds = $screen.Bounds
    return Capture-RegionToPath -Left $bounds.Left -Top $bounds.Top -Width $bounds.Width -Height $bounds.Height `
      -TargetPath $TargetPath -Title $title -ProcName $procName -PidVal $pidVal -CaptureMode "monitor"
  }
  return Capture-RegionToPath -Left $rect.Left -Top $rect.Top -Width $w -Height $h `
    -TargetPath $TargetPath -Title $title -ProcName $procName -PidVal $pidVal -CaptureMode "window"
}

function Capture-ToPath {
  param([string]$TargetPath, [string]$TargetProcess)
  $hwnd = [IntPtr]::Zero
  $useMonitor = $false
  if ($TargetProcess) {
    $hwnd = [WinCap]::FindWindowByProcessName($TargetProcess)
    $useMonitor = $true
  }
  if ($hwnd -eq [IntPtr]::Zero) {
    $hwnd = [WinCap]::GetForegroundWindow()
  }
  return Capture-HwndToPath -Hwnd $hwnd -TargetPath $TargetPath -UseMonitor:$useMonitor
}

if ($Worker) {
  [Console]::Out.WriteLine("READY")
  [Console]::Out.Flush()
  while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    if ($line -eq "EXIT") { break }
    try {
      $out = $line
      $proc = $null
      if ($line.StartsWith("{")) {
        $job = $line | ConvertFrom-Json
        $out = $job.outPath
        $proc = $job.processName
      }
      $meta = Capture-ToPath -TargetPath $out -TargetProcess $proc
      $payload = @{ ok = $true; meta = $meta } | ConvertTo-Json -Compress
      [Console]::Out.WriteLine($payload)
      [Console]::Out.Flush()
    } catch {
      $payload = @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
      [Console]::Out.WriteLine($payload)
      [Console]::Out.Flush()
    }
  }
  exit 0
}

if (-not $OutPath) { throw "OutPath required when not using -Worker" }
$meta = Capture-ToPath -TargetPath $OutPath -TargetProcess $ProcessName
$meta | ConvertTo-Json -Compress
