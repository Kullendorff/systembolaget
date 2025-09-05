@echo off
echo Stopping wine services...
powershell -ExecutionPolicy Bypass -File "C:\systemet\stop-wine-services.ps1"
pause