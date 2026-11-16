@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if exist "%ProgramFiles%\GitHub CLI\gh.exe" set "PATH=%ProgramFiles%\GitHub CLI;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите LTS-версию с https://nodejs.org/ и перезапустите этот файл.
  pause
  exit /b 1
)
echo Запуск VStore Admin: http://127.0.0.1:4178
node admin\server.cjs
pause
