#!/bin/bash
set -e  # Exit on error

echo "Starting setup_env.sh"

# Load .env file if it exists
if [ -f .env ]; then
    echo "Loading .env file"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database configuration with fallbacks
export DATABASE_HOST=${DATABASE_HOST:-db}
export DATABASE_PORT=${DATABASE_PORT:-5432}
export DATABASE_DB=${DATABASE_DB:-superset}
export DATABASE_USER=${DATABASE_USER:-superset}
export DATABASE_PASSWORD=${DATABASE_PASSWORD:-superset}

echo "Database configuration:"
echo "DATABASE_HOST: $DATABASE_HOST"
echo "DATABASE_PORT: $DATABASE_PORT"
echo "DATABASE_DB: $DATABASE_DB"
echo "DATABASE_USER: $DATABASE_USER"

# Create dataex auth file if credentials are available
if [ ! -z "$DATAEX_USERNAME" ] && [ ! -z "$DATAEX_PASSWORD" ]; then
    echo "Creating dataex auth file..."
    AUTH_FILE="$HOME/.dataex_auth.json"
    echo "{\"username\": \"$DATAEX_USERNAME\", \"password\": \"$DATAEX_PASSWORD\"}" > "$AUTH_FILE"
    chmod 600 "$AUTH_FILE"
    echo "Auth file created at $AUTH_FILE"
else
    echo "Warning: DATAEX_USERNAME and/or DATAEX_PASSWORD not set"
fi

# Verify auth file exists
if [ -f "$HOME/.dataex_auth.json" ]; then
    echo "Auth file exists and is readable"
else
    echo "Error: Auth file not created or not readable"
    exit 1
fi
