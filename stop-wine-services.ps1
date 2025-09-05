# Stop all wine-related services gracefully
Write-Host "Stopping wine-related services..." -ForegroundColor Yellow

# Get all node processes with command line info
$allNodeProcesses = Get-WmiObject Win32_Process -Filter "name = 'node.exe'" | Select-Object ProcessId, CommandLine

# Find wine-related processes
$wineProcesses = $allNodeProcesses | Where-Object {
    $_.CommandLine -like "*discord-bot*" -or 
    $_.CommandLine -like "*systembolaget-mcp-server*" -or
    $_.CommandLine -like "*systemet-collector*"
}

if ($wineProcesses.Count -eq 0) {
    Write-Host "No wine-related processes found." -ForegroundColor Green
    exit 0
}

Write-Host "Found $($wineProcesses.Count) wine-related processes:" -ForegroundColor Cyan
foreach ($proc in $wineProcesses) {
    Write-Host "  PID: $($proc.ProcessId) - $($proc.CommandLine)" -ForegroundColor Gray
}

# Stop each process
foreach ($proc in $wineProcesses) {
    Write-Host "Stopping PID: $($proc.ProcessId)" -ForegroundColor Yellow
    try {
        Stop-Process -Id $proc.ProcessId -Force
        Write-Host "  Stopped successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "  Failed to stop: $_" -ForegroundColor Red
    }
}

Write-Host "All wine services stopped!" -ForegroundColor Green