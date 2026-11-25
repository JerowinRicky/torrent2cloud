#!/bin/bash
set -e

echo "[CloudTorrent] Starting container entrypoint initialization..."

# Wait for database availability
if [ -n "$DATABASE_URL" ]; then
    echo "[CloudTorrent] Waiting for database connection..."
    python - <<'EOF'
import os
import sys
import time
from urllib.parse import urlparse
import psycopg2

db_url = os.environ.get("DATABASE_URL", "")
# Strip asyncpg driver if present for synchronous ping check
sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

max_retries = 30
retry_interval = 2

for i in range(max_retries):
    try:
        conn = psycopg2.connect(sync_url)
        conn.close()
        print("[CloudTorrent] Database connection established successfully.")
        sys.exit(0)
    except Exception as e:
        print(f"[CloudTorrent] Database not ready yet ({e}), retrying in {retry_interval}s... ({i+1}/{max_retries})")
        time.sleep(retry_interval)

print("[CloudTorrent] Could not connect to database after timeout.")
sys.exit(1)
EOF
fi

# Run database migrations if RUN_MIGRATIONS is set or if running as API container
if [ "$RUN_MIGRATIONS" = "true" ] || [ "$1" = "uvicorn" ]; then
    echo "[CloudTorrent] Applying latest database migrations with Alembic..."
    alembic upgrade head
    echo "[CloudTorrent] Migrations applied successfully."
fi

# Ensure storage directories exist and have proper permissions
mkdir -p "${STORAGE_INCOMPLETE_PATH:-/data/incomplete}"
mkdir -p "${STORAGE_COMPLETED_PATH:-/data/completed}"
mkdir -p "${STORAGE_RESUME_PATH:-/data/resume_data}"

echo "[CloudTorrent] Initialization complete. Executing command: $@"
exec "$@"
