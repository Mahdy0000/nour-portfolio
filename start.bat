@echo off
rem Double-click to run the forged.build clone locally.
rem The scene needs http:// (WebAssembly + fetch), so it cannot run from file://.
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js is required. Install it from https://nodejs.org & pause & exit /b 1)
start "" cmd /c "timeout /t 2 /nobreak >nul && start "" http://127.0.0.1:4173/"
node server.js
pause
