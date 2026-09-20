@echo off
setlocal EnableExtensions
title Template client migrate
cd /d "%~dp0"

echo.
echo  Template client migrate
echo  Password stays in WPE_SFTP_PASS or the SFTP catalog. Do not write it to job.json.
echo.

set /p "TEMPLATE_SITE_URL=Template site URL: "
set /p "CLIENT_SITE_URL=New client site URL: "
set /p "EMCP_URL=EMCP URL: "
set /p "WPE_SFTP_HOST=SFTP host (blank to skip apply): "
set /p "WPE_SFTP_USER=SFTP user: "
set /p "WPE_SFTP_PORT=SFTP port [2222]: "
if "%WPE_SFTP_PORT%"=="" set "WPE_SFTP_PORT=2222"
set /p "BRAND_FOLDER=Brand folder path (blank = no media this run): "

echo.
echo  Writing job and pointing EMCP ...
echo.

call npm run template-client-migrate
if errorlevel 1 (
  echo.
  echo  Identity migrate failed.
  pause
  exit /b 1
)

echo.
echo  Authenticate EMCP, confirm the host, then review the template homepage.
pause
exit /b 0
