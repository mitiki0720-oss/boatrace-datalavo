@echo off
cd /d "%~dp0"

echo Start safe boat Johnson predictions watcher.
echo Downloads are validated by Node.js and published through a temporary clean worktree.
echo Keep this window open.
echo Press Ctrl + C to stop.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-boat-johnson-and-push.ps1"

pause
