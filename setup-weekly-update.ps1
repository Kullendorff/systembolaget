# PowerShell-script för att schemalägga veckovis uppdatering
# Kör detta EN gång för att sätta upp schemaläggning

$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "C:\systemet\scripts\download-data.js" -WorkingDirectory "C:\systemet"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName "UpdateSystembolagetData" -Action $action -Trigger $trigger -Principal $principal -Description "Uppdaterar Systembolagets vindata varje måndag"

Write-Host "✅ Schemalagt! Vindata uppdateras automatiskt varje måndag kl 09:00" -ForegroundColor Green
Write-Host "Du kan se/ändra detta i Task Scheduler (Aktivitetshanteraren)" -ForegroundColor Yellow