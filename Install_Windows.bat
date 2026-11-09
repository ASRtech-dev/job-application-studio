@echo off
title Job Application Studio - Windows Installer
echo ========================================================
echo   Job Application Studio - Installation Setup
echo ========================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed or not in PATH!
  echo Please download and install Node.js 20+ from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo [1/2] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/2] Running setup and Playwright browser installation...
call npm run setup
if %errorlevel% neq 0 (
  echo [ERROR] Setup script failed.
  pause
  exit /b 1
)

echo.
echo ========================================================
echo   Installation Successful!
echo   Double-click Start_App.bat to launch the application.
echo ========================================================
echo.
pause
