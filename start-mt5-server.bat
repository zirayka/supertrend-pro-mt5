@echo off
echo ========================================
echo    MT5 File Server for SuperTrend Pro
echo ========================================
echo.
echo Starting MT5 file server...
echo This will serve your MT5 data files to the web application.
echo.
echo Make sure:
echo 1. MT5 Terminal is running
echo 2. SuperTrend Expert Advisor is attached to a chart
echo 3. Files are being created in Common\Files folder
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js

pause