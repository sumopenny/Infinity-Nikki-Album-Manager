@echo off
setlocal
title Infinity Nikki Album Manager - Remote D1 Website

for %%I in ("%~dp0..") do set "PROJECT_DIR=%%~fI"
cd /d "%PROJECT_DIR%"

set "REMOTE_API_ORIGIN=%~1"
if not defined REMOTE_API_ORIGIN set "REMOTE_API_ORIGIN=https://infinity-nikki-album-manager.pages.dev"

echo.
echo ============================================================
echo  Infinity Nikki Album Manager - Remote D1 Website
echo ============================================================
echo.
echo This launcher serves the local website and proxies /api to:
echo %REMOTE_API_ORIGIN%
echo.
echo WARNING: Like actions from this local website will write to
echo the remote production database.
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
    echo Make sure the start folder is inside the project root folder.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
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
echo Starting local website with remote D1 API...
echo Website address: http://localhost:5173
echo Remote API origin: %REMOTE_API_ORIGIN%
echo.

start "Remote D1 Dev Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run dev:remote -- --port 5173 --strictPort"

echo Waiting for the website to start...
timeout /t 4 /nobreak >nul

start "" http://localhost:5173

echo.
echo If the browser did not open, visit this address manually:
echo http://localhost:5173
echo.
echo Keep the dev server window open while using the site.
timeout /t 2 /nobreak >nul
endlocal
