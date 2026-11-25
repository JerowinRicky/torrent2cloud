@echo off
title CloudTorrent - Local Server
setlocal enabledelayedexpansion

:: ---------------------------------------------------------------------------
:: Add Python and Node.js to PATH for this session
:: ---------------------------------------------------------------------------
set "PATH=C:\Program Files\nodejs;C:\Users\Administrator\AppData\Local\Programs\Python\Python312;C:\Users\Administrator\AppData\Local\Programs\Python\Python312\Scripts;%PATH%"

cd /d "%~dp0"

echo ========================================================================
echo   CloudTorrent - Starting Local Services (No Docker Required)
echo ========================================================================
echo.

:: 1. Ensure local Windows database and cache services are running
echo [*] Checking PostgreSQL and Redis services...
net start postgresql-x64-18 >nul 2>&1
net start postgresql >nul 2>&1
net start Redis >nul 2>&1

:: 2. Ensure storage folders exist
if not exist "volumes\data\incomplete" mkdir "volumes\data\incomplete"
if not exist "volumes\data\completed" mkdir "volumes\data\completed"
if not exist "volumes\data\resume_data" mkdir "volumes\data\resume_data"

:: 3. Run database migrations
echo [*] Checking database schema and applying migrations...
cd /d "%~dp0backend"
python -m alembic upgrade head
cd /d "%~dp0"

:: 4. Start Backend API Server
echo [*] Starting Backend REST API & WebSockets on http://localhost:8000...
start "CloudTorrent - Backend API (Port 8000)" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --port 8000"

:: 5. Start Celery Torrent Worker & Periodic Scheduler
echo [*] Starting Torrent Engine Worker and Scheduler...
start "CloudTorrent - Celery Worker and Scheduler" cmd /k "cd /d %~dp0backend && python run_worker.py"

:: 6. Start Frontend Web Interface
echo [*] Starting Frontend UI on http://localhost:3000...
start "CloudTorrent - Frontend UI (Port 3000)" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

:: 7. Launch Browser
echo.
echo ========================================================================
echo   CloudTorrent is now running locally!
echo   - Web Interface: http://localhost:3000
echo   - API / Swagger: http://localhost:8000/docs
echo ========================================================================
echo.
echo Opening CloudTorrent in your web browser...
timeout /t 3 >nul
start http://localhost:3000

echo.
echo Press any key to stop all CloudTorrent local services, or close this window to keep running.
pause >nul

echo Stopping services...
taskkill /F /FI "WINDOWTITLE eq CloudTorrent*" >nul 2>&1
echo CloudTorrent local services stopped.
timeout /t 2 >nul
exit /b 0
