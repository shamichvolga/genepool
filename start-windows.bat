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
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
    echo GenePool is already running - opening it in the browser.
    start "" http://localhost:5173/
    timeout /t 3 >nul
    exit /b
)
echo Starting GenePool. Your browser will open automatically.
echo To stop it, close this window.
call npm run dev -- --open
