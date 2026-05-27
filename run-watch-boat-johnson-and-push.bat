@echo off
cd /d "%~dp0"

echo Start boat Johnson predictions watcher.
echo Keep this window open.
echo Press Ctrl + C to stop.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-boat-johnson-and-push.ps1"

pause