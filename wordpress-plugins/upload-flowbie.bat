@echo off
REM Sync wordpress-plugins\flowbie-wp\ to WP Engine (flowbie.ca) via parallel SFTP.
REM Config: wordpress-plugins\flowbie-wpengine.config.json (or hardcoded defaults in deploy-flowbie-sftp.js).
REM From repo root: npm install (once). Then run this file or: npm run deploy:flowbie-plugin

setlocal
cd /d "%~dp0\.."

echo.
echo ========================================
echo   Flowbie WP - flowbie.ca SFTP upload
echo ========================================
echo.

call npm run deploy:flowbie-plugin
if errorlevel 1 (
  echo.
  echo [ERROR] Deploy failed.
  pause
  exit /b 1
)

echo.
echo [OK] Upload finished. Check https://flowbie.ca/wp-admin/plugins.php
echo.
pause
