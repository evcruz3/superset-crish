#!/bin/bash
# Setup script for Unix-like systems (Linux/macOS)
# This is run from the root of the project e.g. `./scripts/setup_env.sh`

# Load .env file if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database configuration with fallbacks
export DATABASE_HOST=${DATABASE_HOST:-db}
export DATABASE_PORT=${DATABASE_PORT:-5432}
export DATABASE_DB=${DATABASE_DB:-superset}
export DATABASE_USER=${DATABASE_USER:-superset}
export DATABASE_PASSWORD=${DATABASE_PASSWORD:-superset}

# Create dataex auth file if credentials are available
if [ ! -z "$DATAEX_USERNAME" ] && [ ! -z "$DATAEX_PASSWORD" ]; then
    echo "{\"username\": \"$DATAEX_USERNAME\", \"password\": \"$DATAEX_PASSWORD\"}" > ~/.dataex_auth.json
    chmod 600 ~/.dataex_auth.json
else
    echo "Warning: DATAEX_USERNAME and/or DATAEX_PASSWORD not set"
    exit 1
fi
