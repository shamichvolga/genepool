@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo Node.js is not installed. Install it from https://nodejs.org/ and run this file again.
    echo.
    pause
    exit /b 1
)
if not exist node_modules (
    echo First start: installing tools, this takes about a minute...
    call npm install
)
echo Building GenePool (about 30 seconds)...
call npx vite build
echo.
echo Starting the built version. Your browser will open automatically.
echo This version does not reload when the code changes - good for long runs.
echo To stop it, close this window.
call npx vite preview --open
