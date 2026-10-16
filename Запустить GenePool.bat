@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
    echo Первый запуск: устанавливаю инструменты, это займёт около минуты...
    call npm install
)

rem Сервер уже запущен (окно открыто раньше)? Тогда просто открыть игру ещё раз.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
    echo Gene Pool уже запущен - открываю его в браузере.
    start "" http://localhost:5173/
    timeout /t 3 >nul
    exit /b
)

echo Запускаю Gene Pool. Окно браузера откроется само.
echo.
echo Правки кода НЕ перезапускают мир: сверху появится плашка "Код изменился",
echo кнопка "применить, сохранив мир" продолжит ту же популяцию на новом коде.
echo Чтобы остановить игру, закройте это окно.
call npm run dev -- --open
