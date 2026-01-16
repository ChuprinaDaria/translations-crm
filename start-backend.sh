#!/bin/bash
# Script to start backend with proper configuration

cd "/home/dchuprina/crm translation/translations-crm/backend"

# Export environment variables
export DATABASE_URL="postgresql://translator:traslatorini2025@localhost:5434/crm_db"
export JWT_SECRET="dev-secret-key-change-in-production"
export APP_ENV="dev"

# Kill any existing backend processes
pkill -f "uvicorn main:app" 2>/dev/null

# Start backend with logging
echo "Starting backend..."
venv/bin/python3 -m uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --log-level info \
  2>&1 | tee /tmp/crm_backend_realtime.log

