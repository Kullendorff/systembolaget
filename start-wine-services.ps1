# Start Wine Services Automation Script
# Starts systemet-collector API and Discord bot with proper error handling

Write-Host "🍷 Starting Systembolaget Wine Services..." -ForegroundColor Magenta
Write-Host ""

# Function to check if a port is in use
function Test-Port {
    param($Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Function to wait for service to start
function Wait-ForService {
    param($Port, $ServiceName, $TimeoutSeconds = 30)
    Write-Host "⏳ Waiting for $ServiceName to start on port $Port..." -ForegroundColor Yellow
    
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        if (Test-Port -Port $Port) {
            Write-Host "✅ $ServiceName is now running on port $Port" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 1
        $elapsed++
    }
    
    Write-Host "❌ $ServiceName failed to start within $TimeoutSeconds seconds" -ForegroundColor Red
    return $false
}

# Check current directory
if (-not (Test-Path "systemet-collector")) {
    Write-Host "❌ Error: Must run from C:\systemet directory" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

# Step 1: Start systemet-collector API
Write-Host "🔧 [1/2] Starting systemet-collector API..." -ForegroundColor Cyan

if (Test-Port -Port 3000) {
    Write-Host "ℹ️  systemet-collector API already running on port 3000" -ForegroundColor Yellow
} else {
    # Start API server in new window
    $apiProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\systemet\systemet-collector'; npm run api" -PassThru -WindowStyle Normal
    
    # Wait for API to start
    if (-not (Wait-ForService -Port 3000 -ServiceName "systemet-collector API")) {
        Write-Host "❌ Failed to start systemet-collector API" -ForegroundColor Red
        exit 1
    }
}

# Test API endpoint
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/products" -Method Get -TimeoutSec 5
    $productCount = $response.products.Count
    Write-Host "🍷 API loaded with $productCount wine products" -ForegroundColor Green
} catch {
    Write-Host "⚠️  API running but response test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Start Discord bot
Write-Host "🤖 [2/2] Starting Discord bot..." -ForegroundColor Cyan

# Check if bot process is already running
$existingBot = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*Discord*" -or 
    $_.ProcessName -eq "node"
}

if ($existingBot) {
    Write-Host "ℹ️  Discord bot may already be running" -ForegroundColor Yellow
}

# Start Discord bot in new window
$botProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\systemet\discord-bot'; npm start" -PassThru -WindowStyle Normal

# Give bot time to start
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "🎉 Wine services startup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Service Status:" -ForegroundColor White
Write-Host "   • systemet-collector API: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   • Discord Bot: Vin är Livet#4082" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 Test the Discord bot with: !vin Jean Leon 2020" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to continue..."
Read-Host