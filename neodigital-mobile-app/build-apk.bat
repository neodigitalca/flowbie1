@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo.
echo  NEOPulse — build debug APK
echo  JAVA_HOME=%JAVA_HOME%
echo  ANDROID_HOME=%ANDROID_HOME%
echo.

call npm install
if errorlevel 1 goto fail

call npm run assets:generate
if errorlevel 1 goto fail

call npx cap sync android
if errorlevel 1 goto fail

cd android
call gradlew.bat assembleDebug
if errorlevel 1 goto fail

echo.
echo  Success: app\build\outputs\apk\debug\app-debug.apk
echo  Copy to phone and install (see README.md).
echo.
cd ..
endlocal
exit /b 0

:fail
echo.
echo  Build failed.
cd /d "%~dp0"
endlocal
exit /b 1
