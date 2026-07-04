@echo off
chcp 65001 >nul
title Infinity Nikki Album Manager - One Click Start
setlocal enabledelayedexpansion
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo.
echo ============================================================
echo  Infinity Nikki Album Manager / 无限暖暖相册管理
echo ============================================================
echo.
echo This window starts the website. Please do not close the dev server window while using the site.
echo 这个窗口负责启动网站。使用网站时请不要关闭开发服务窗口。
echo.

:: 检测Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found.
    echo 请先安装 Node.js LTS: https://nodejs.org/
    echo 安装完成后，重新双击这个文件。
    echo.
    pause
    exit /b 1
)

:: 检测npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found.
    echo Please reinstall Node.js LTS from https://nodejs.org/
    echo 请重新安装 Node.js LTS。
    echo.
    pause
    exit /b 1
)

:: 检测项目根目录
if not exist "package.json" (
    echo [ERROR] package.json was not found.
    echo Please put this BAT file in the project root folder.
    echo 请确认这个 BAT 文件放在项目根目录，和 package.json 同一文件夹。
    echo.
    pause
    exit /b 1
)

:: 安装依赖
if not exist "node_modules\" (
    echo First run detected: installing dependencies...
    echo 第一次运行：正在安装依赖，请耐心等待，可能需要几分钟。
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed.
        echo 依赖安装失败。检查网络，或手动在项目目录执行 npm install。
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Starting local website...
echo 正在启动本地网站...
echo.
echo Website address / 网站地址: http://localhost:5173
echo.
echo A new dev server window will open. Keep it open while using the website.
echo 即将打开开发服务窗口，使用网站时请勿关闭。
echo.

:: 启动新终端运行dev，修复引号嵌套问题
start "Dev Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run dev -- --port 5173 --strictPort"

echo Waiting for website to start...
echo 等待服务启动中...
timeout /t 4 /nobreak >nul

start "" http://localhost:5173

echo.
echo If browser not pop up, open this link manually:
echo 如果浏览器未自动弹出，请手动访问：
echo http://localhost:5173
echo.
echo You can close this window now, keep dev server window open.
echo 可关闭本窗口，请勿关闭开发服务窗口。
echo.
pause
endlocal