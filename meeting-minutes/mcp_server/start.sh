#!/bin/bash

# Meeting-Minutes MCP Server Launcher
# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    npm install --silent >/dev/null 2>&1
fi

# Build the TypeScript code if needed
if [ ! -d "dist" ] || [ "src/index.ts" -nt "dist/index.js" ]; then
    npm run build --silent >/dev/null 2>&1
fi

# Start the server
node dist/index.js 