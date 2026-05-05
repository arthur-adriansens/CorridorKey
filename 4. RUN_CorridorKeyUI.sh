#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start Uvicorn server in background
echo "Starting server..."
cd "$SCRIPT_DIR"
uv run --extra cuda uvicorn webUI.server.server:app --log-level error &

# Open browser to the web UI
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open ./webUI/starting.html 

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open ./webUI/starting.html
else
    echo "Unsupported OS for automatic browser opening. Please open ./webUI/starting.html manually. Server is starting..."
fi