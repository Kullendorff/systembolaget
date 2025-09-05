@echo off
echo Starting Systembolaget Wine Systems...
echo.

echo [1/3] Starting systemet-collector API server...
start "SystemetCollector API" cmd /k "cd /d C:\systemet\systemet-collector && npm run api"
timeout /t 5 /nobreak >nul

echo [2/3] Starting MCP server...
start "MCP Server" cmd /k "cd /d C:\systemet\mcp-server && npm start"
timeout /t 2 /nobreak >nul

echo [3/3] Starting Discord bot...
start "Discord Bot" cmd /k "cd /d C:\systemet\discord-bot && npm start"

echo.
echo All systems started!
echo.
echo Windows opened:
echo - SystemetCollector API (http://localhost:3000)
echo - MCP Server (stdio)
echo - Discord Bot (Vin är Livet#4082)
echo.
pause