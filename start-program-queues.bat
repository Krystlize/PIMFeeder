@echo off
echo Starting Program Queues App...
echo.
echo This will start the program-queues app on http://localhost:3001
echo.
echo Stopping any existing React apps on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo.
echo Starting Program Queues App...
cd program-queues
npm start
pause
