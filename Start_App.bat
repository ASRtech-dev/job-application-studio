@echo off
cd /d "%~dp0"
title Job Application Studio - Local Server
echo ========================================================
echo   Starting Job Application Studio on http://127.0.0.1:3000
echo ========================================================
echo.

call npm.cmd run use
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Could not start Job Application Studio.
  pause
)
