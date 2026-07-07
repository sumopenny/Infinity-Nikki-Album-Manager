@echo off
setlocal
title Infinity Nikki Album Manager - One Click Start

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo.
echo ============================================================
echo  Infinity Nikki Album Manager - One Click Start
echo ============================================================
echo.
echo This launcher will install dependencies if needed, then start
echo the local website. Keep the dev server window open while using it.
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found.
    echo Please install Node.js LTS from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found.
    echo Please reinstall Node.js LTS from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERROR] package.json was not found.
    echo Make sure this BAT file is in the project root folder.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo First run detected: installing dependencies.
    echo This may take a few minutes.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed.
        echo Check your network, or manually run npm install in this folder.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Starting local website...
echo Website address: http://localhost:5173
echo.
echo A new dev server window will open. Keep it open while using the site.
echo.

start "Dev Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run dev -- --port 5173 --strictPort"

echo Waiting for the website to start...
timeout /t 4 /nobreak >nul

start "" http://localhost:5173

echo.
echo If the browser did not open, visit this address manually:
echo http://localhost:5173
echo.
echo You can close this launcher window now, but keep the dev server window open.
echo.
pause
endlocal
