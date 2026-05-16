@echo off
chcp 65001 >nul
echo 正在关闭旧的 XHS-Downloader 服务 (端口 5008)...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5008 " ^| findstr "LISTENING"') do (
    echo 发现进程 PID: %%a，正在终止...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo 正在启动 XHS-Downloader Web 服务...
cd /d "%~dp0"
start "XHS-Downloader" cmd /k "uv run main.py WEB"

echo 启动完成！浏览器访问 http://localhost:5008/web/
timeout /t 3
