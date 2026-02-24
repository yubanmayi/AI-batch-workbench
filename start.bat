@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [INFO] node_modules not found, installing dependencies...
  npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Starting dev server on 0.0.0.0:5173
echo [INFO] Access from LAN: http://<your-local-ip>:5173
npm run dev
