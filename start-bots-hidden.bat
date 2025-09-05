@echo off
echo Starting Wine Services in background (no CMD windows)...

:: Start MCP server in background
echo Starting MCP server...
start /B "" powershell -WindowStyle Hidden -Command "cd 'C:\systemet\mcp-server'; npm start"

:: Wait a moment
timeout /t 3 /nobreak >nul

:: Start Discord bot in background  
echo Starting Discord bot...
start /B "" powershell -WindowStyle Hidden -Command "cd 'C:\systemet\discord-bot'; npm start"

echo.
echo Wine services started in background!
echo - MCP Server (hidden)
echo - Discord Bot (hidden)
echo.
echo Use stop-wine-services.ps1 to stop all services.
pause