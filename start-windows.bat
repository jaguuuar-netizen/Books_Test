@echo off
chcp 65001 >nul
title My Book Shelf — Персональный книжный трекер
echo ===================================================
echo   My Book Shelf — Персональный книжный трекер
echo ===================================================
echo.
if not exist "node_modules" (
    echo [1/2] Установка необходимых компонентов...
    call npm install
)
echo [2/2] Запуск приложения на Windows...
start "" "http://localhost:3000"
call npm run dev
pause
