#!/bin/bash
# Setup script for Unix-like systems (Linux/macOS)
# This is run from the root of the project e.g. `./scripts/setup_env.sh`

# Load .env file if it exists
if [ -f .env ]; then
    echo "Loading environment from .env file"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "No .env file found, using environment variables"
fi

# Database configuration with fallbacks
export DATABASE_HOST=${DATABASE_HOST:-db}
export DATABASE_PORT=${DATABASE_PORT:-5432}
export DATABASE_DB=${DATABASE_DB:-superset}
export DATABASE_USER=${DATABASE_USER:-superset}
export DATABASE_PASSWORD=${DATABASE_PASSWORD:-superset}

echo "Database configuration:"
echo "HOST: $DATABASE_HOST"
echo "PORT: $DATABASE_PORT"
echo "DB: $DATABASE_DB"
echo "USER: $DATABASE_USER"
echo "PASSWORD: [HIDDEN]"

# Create dataex auth file if credentials are available
if [ ! -z "$DATAEX_USERNAME" ] && [ ! -z "$DATAEX_PASSWORD" ]; then
    echo "Creating DATAEX authentication file"
    echo "{\"username\": \"$DATAEX_USERNAME\", \"password\": \"$DATAEX_PASSWORD\"}" > ~/.dataex_auth.json
    chmod 600 ~/.dataex_auth.json
    echo "DATAEX authentication file created successfully"
else
    echo "ERROR: DATAEX_USERNAME and/or DATAEX_PASSWORD not set"
    echo "Please set these environment variables in your docker/.env or docker/.env-local file"
    echo "Container will continue running but data pulls will fail"
fi
