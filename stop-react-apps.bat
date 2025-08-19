@echo off
echo Stopping all React apps on port 3000...
echo.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Stopping process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo Successfully stopped process %%a
    ) else (
        echo Failed to stop process %%a
    )
)
echo.
echo All React apps on port 3000 have been stopped.
pause
