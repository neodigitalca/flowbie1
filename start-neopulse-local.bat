@echo off
setlocal EnableExtensions
title NEO Pulse local (neopulse.local)
cd /d "%~dp0"

echo.
echo  Starting NEO Pulse local...
echo  WordPress: https://neopulse.local/
echo  App:       http://localhost:8080/
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-dev.ps1" -OpenBrowser
if errorlevel 1 (
  echo.
  echo  Startup failed. Check Docker Desktop is running.
  echo  Vite log: .local-dev-vite.log
  pause
  exit /b 1
)

echo.
echo  Stack is up. Vite and the host worker stay running in the background.
echo  You can close this window.
pause
exit /b 0
