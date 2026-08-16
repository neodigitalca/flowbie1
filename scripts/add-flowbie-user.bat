@echo off
setlocal
cd /d "%~dp0.."

echo NEO Pulse user setup (create or reset password via /api/auth/setup-admin)
echo.

node scripts/add-neo-pulse-user.mjs %*
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
  echo.
  echo Failed. If users already exist, you need NEO_PULSE_APP_SETUP_KEY from server secrets.
  pause
)

exit /b %EXITCODE%
