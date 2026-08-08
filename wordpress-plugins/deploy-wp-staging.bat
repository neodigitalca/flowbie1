@echo off
cd /d "%~dp0.."
node wordpress-plugins/deploy-wp-staging.js
pause
