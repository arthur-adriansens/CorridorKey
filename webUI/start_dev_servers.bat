
@echo off
set BROWSERSLIST_IGNORE_OLD_DATA=1

REM Start Uvicorn in a current (webUI) folder in background
start /B uv run uvicorn server.server:app --reload

REM Start Tailwind watcher in this (webUI) folder in background
start /B tailwindcss -i static/input.css -o static/styles.css --watch

REM Keep the window open
echo Both watchers started.
pause
