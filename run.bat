@echo off
chcp 65001 >nul
echo ===================================
echo     AI File Searcher Launcher
echo ===================================

rem Node.js Installation Check
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install it from https://nodejs.org/
    pause
    exit /b
)

echo [1/2] Checking dependencies...
if not exist node_modules (
    echo First time setup: Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please check your internet connection.
        pause
        exit /b
    )
) else (
    echo Dependencies found. Skipping install.
)

echo.
echo [2/2] Opening browser...
start "" cmd /c "node server.js"
timeout /t 2 >nul
start http://localhost:3000

exit