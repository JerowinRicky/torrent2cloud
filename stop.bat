@echo off
title Stop CloudTorrent
echo ========================================================================
echo   Stopping CloudTorrent Local Services...
echo ========================================================================
echo.
taskkill /F /FI "WINDOWTITLE eq CloudTorrent*" >nul 2>&1
echo Done! All CloudTorrent local services have been stopped.
timeout /t 2 >nul
