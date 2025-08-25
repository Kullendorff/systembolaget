@echo off
echo ========================================
echo   Uppdaterar Systembolagets vindata
echo ========================================
echo.

cd /d C:\systemet
node scripts\download-data.js

echo.
echo ✅ Klart! Starta Claude Desktop för att använda senaste datan.
echo.
pause