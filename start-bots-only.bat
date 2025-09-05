@echo off
echo Starting Wine Bot Services (without API)...
echo.

echo [1/2] Starting MCP server...
start "MCP Server" cmd /k "cd /d C:\systemet\mcp-server && npm start"
timeout /t 2 /nobreak >nul

echo [2/2] Starting Discord bot...
start "Discord Bot" cmd /k "cd /d C:\systemet\discord-bot && npm start"

echo.
echo Wine services started!
echo.
echo Windows opened:
echo - MCP Server (stdio) 
echo - Discord Bot (Vin är Livet#4082)
echo.
echo NOTE: Using cached wine database. Run full system if you need fresh data.
pause