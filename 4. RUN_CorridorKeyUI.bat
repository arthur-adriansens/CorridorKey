
@echo off

REM Start Uvicorn server in background (minimized)
start "Uvicorn" /min cmd /k ^
  "echo Starting server... && cd /d %~dp0 && uv run --extra cuda uvicorn webUI.server.server:app --log-level warning"

REM Open browser to the web UI
start http://localhost:8000