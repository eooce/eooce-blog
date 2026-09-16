#!/bin/bash

# Start backend API server (port 3001) from repo root
npm run start &
BACKEND_PID=$!

# Start frontend dev server (web/, exposed port 9199)
(cd "$(dirname "$0")/web" && npm run dev -- --host 0.0.0.0 --port 9199)

# Stop backend when frontend exits
trap "kill $BACKEND_PID 2>/dev/null" EXIT
