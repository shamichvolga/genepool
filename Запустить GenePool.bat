@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
    echo Первый запуск: устанавливаю инструменты, это займёт около минуты...
    call npm install
)
echo Запускаю Gene Pool. Окно браузера откроется само.
echo Чтобы остановить игру, закройте это окно.
call npm run dev -- --open
