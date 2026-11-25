# CloudTorrent Development Startup Script
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Starting CloudTorrent Development Stack" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$env:PATH = "C:\Program Files\nodejs;C:\Users\Administrator\AppData\Local\Programs\Python\Python312;C:\Users\Administrator\AppData\Local\Programs\Python\Python312\Scripts;" + $env:PATH

# Verify PostgreSQL service
$pg = Get-Service -Name *postgres* -ErrorAction SilentlyContinue
if ($pg -and $pg.Status -ne 'Running') {
    Write-Host "Starting PostgreSQL service..." -ForegroundColor Yellow
    Start-Service $pg.Name
}

# Verify Redis service
$redis = Get-Service -Name *redis* -ErrorAction SilentlyContinue
if ($redis -and $redis.Status -ne 'Running') {
    Write-Host "Starting Redis service..." -ForegroundColor Yellow
    Start-Service $redis.Name
}

Write-Host "Services online. Launching backend API on http://localhost:8000..." -ForegroundColor Green
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "`$env:PATH = '$env:PATH'; cd '$PSScriptRoot\backend'; uvicorn app.main:app --reload --port 8000"

Write-Host "Launching frontend Vite dev server on http://localhost:3000..." -ForegroundColor Green
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "`$env:PATH = '$env:PATH'; cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "CloudTorrent development environment running!" -ForegroundColor Cyan
Write-Host "  Backend API:  http://localhost:8000/docs" -ForegroundColor Gray
Write-Host "  Frontend App: http://localhost:3000" -ForegroundColor Gray
