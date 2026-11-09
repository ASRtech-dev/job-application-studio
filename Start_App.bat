@echo off
title Job Application Studio - Local Server
echo ========================================================
echo   Starting Job Application Studio on http://127.0.0.1:3000
echo ========================================================
echo.

start http://127.0.0.1:3000
npm run dev
pause
