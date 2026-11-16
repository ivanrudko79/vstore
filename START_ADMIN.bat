@echo off
setlocal
cd /d "%~dp0"
set "PATH=%ProgramFiles%\Git\cmd;%ProgramFiles%\GitHub CLI;%PATH%"
netstat -ano | findstr /c:"127.0.0.1:4178 " | findstr /c:"LISTENING" >nul
if not errorlevel 1 goto already_running
where node >nul 2>nul
if errorlevel 1 goto no_node
where git >nul 2>nul
if errorlevel 1 goto no_git
where gh >nul 2>nul
if errorlevel 1 goto no_gh
echo Starting VStore Admin at http://127.0.0.1:4178
node admin\server.cjs
pause
exit /b
:already_running
echo VStore Admin is already running at http://127.0.0.1:4178.
echo Close the existing VStore Admin Command Prompt window, then run this file again to load updates.
pause
exit /b 0
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
