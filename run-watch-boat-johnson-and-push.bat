@echo off
cd /d "%~dp0"
chcp 65001 >nul

echo Start safe boat Johnson predictions watcher.
echo Downloads are validated by Node.js and published through a temporary clean worktree.
echo Keep this window open.
echo Press Ctrl + C to stop.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-boat-johnson-and-push.ps1" %*
set "WATCH_EXIT=%ERRORLEVEL%"

if not "%WATCH_EXIT%"=="0" (
  echo.
  echo Watcher stopped with exit code %WATCH_EXIT%. Review scripts\boat-johnson-auto-push-log.txt.
  pause
  exit /b %WATCH_EXIT%
)

echo.
echo Watcher ended normally. Review scripts\boat-johnson-auto-push-log.txt.
pause
