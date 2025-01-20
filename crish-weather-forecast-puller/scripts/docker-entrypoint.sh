#!/bin/bash
set -e  # Exit on error

echo "Starting docker-entrypoint.sh"

# Run setup_env.sh to create auth file
if ! source scripts/setup_env.sh; then
    echo "Error: setup_env.sh failed"
    exit 1
fi

# Verify DATAEX credentials are set
if [ -z "$DATAEX_USERNAME" ] || [ -z "$DATAEX_PASSWORD" ]; then
    echo "Error: DATAEX_USERNAME and DATAEX_PASSWORD must be set"
    exit 1
fi

# Verify database variables are set
if [ -z "$DATABASE_HOST" ] || [ -z "$DATABASE_PORT" ] || [ -z "$DATABASE_DB" ] || [ -z "$DATABASE_USER" ] || [ -z "$DATABASE_PASSWORD" ]; then
    echo "Error: Database environment variables are not properly set"
    env | grep -E 'DATABASE_'
    exit 1
fi

# Run the command through debug wrapper
exec ./debug-wrapper.sh "$@"