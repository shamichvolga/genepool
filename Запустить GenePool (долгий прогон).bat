@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ═══════════════════════════════════════════════════════════
    echo ERROR: Node.js is not installed
    echo Node.js not found / Ошибка: Node.js не установлен
    echo.
    echo Please install Node.js from:
    echo https://nodejs.org/
    echo.
    echo Пожалуйста, установите Node.js с:
    echo https://nodejs.org/
    echo ═══════════════════════════════════════════════════════════
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Первый запуск: устанавливаю инструменты, это займёт около минуты...
    call npm install
)
echo Собираю Gene Pool (около полуминуты)...
call npx vite build
echo.
echo Запускаю собранную версию. Окно браузера откроется само.
echo Эта версия НЕ перезапускается, когда меняется код, - для долгих наблюдений.
echo Чтобы увидеть свежие изменения кода, закройте это окно и запустите ярлык снова.
echo Чтобы остановить игру, закройте это окно.
call npx vite preview --open
