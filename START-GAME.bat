@echo off
title Empires Eternal - GAME SERVER (keep this window open)
cd /d "%~dp0"

echo ============================================================
echo   EMPIRES ETERNAL
echo ============================================================
echo.
echo   Building the game and starting the server...
echo   (the first time can take ~10-20 seconds)
echo.
echo   When you see:
echo       Empires Eternal server running on http://localhost:4000
echo   open  http://localhost:4000  in your browser.
echo.
echo   KEEP THIS WINDOW OPEN while you play. Close it to stop.
echo ============================================================
echo.

call npm install
call npm run preview

echo.
echo The game server has stopped. Press any key to close.
pause >nul
