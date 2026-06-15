@echo off
title Empires Eternal - GAME SERVER (keep this window open)
cd /d "%~dp0"

echo ============================================================
echo   EMPIRES ETERNAL
echo ============================================================
echo.
echo   Starting the game server and client...
echo.
echo   IMPORTANT: keep THIS window open while you play.
echo   Closing it stops the server and you won't be able to log in.
echo.
echo   When you see a line like:
echo       CLIENT  ^>  Local:  http://localhost:5173/
echo   open that address in your browser.
echo ============================================================
echo.

call npm run dev

echo.
echo The game server has stopped. Press any key to close.
pause >nul
