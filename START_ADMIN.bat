@echo off
setlocal
cd /d "%~dp0"
set "PATH=%ProgramFiles%\Git\cmd;%ProgramFiles%\GitHub CLI;%PATH%"
set "VSTORE_ADMIN_PORT=4178"
call :check_port 4178
if errorlevel 1 goto check_tools
set "VSTORE_ADMIN_PORT=4179"
call :check_port 4179
if not errorlevel 1 goto ports_busy
:check_tools
where node >nul 2>nul
if errorlevel 1 goto no_node
where git >nul 2>nul
if errorlevel 1 goto no_git
where gh >nul 2>nul
if errorlevel 1 goto no_gh
echo Starting VStore Admin at http://127.0.0.1:%VSTORE_ADMIN_PORT%
node admin\server.cjs
pause
exit /b
:check_port
netstat -ano | findstr /c:"127.0.0.1:%~1 " | findstr /c:"LISTENING" >nul
exit /b %errorlevel%
:ports_busy
echo Ports 4178 and 4179 are already in use. Close an older VStore Admin window and run this file again.
pause
exit /b 1
:no_node
echo Node.js was not found. Install the LTS version from https://nodejs.org/ and run this file again.
pause
exit /b 1
:no_git
echo Git for Windows was not found. Install it from https://git-scm.com/download/win and run this file again.
pause
exit /b 1
:no_gh
echo GitHub CLI was not found. Install it from https://cli.github.com/ and run this file again.
pause
exit /b 1
