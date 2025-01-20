#!/bin/bash
set -e  # Exit on error

echo "Starting docker-entrypoint.sh"

# Run setup_env.sh to create auth file
echo "Running setup_env.sh..."
if ! source scripts/setup_env.sh; then
    echo "Error: setup_env.sh failed"
    exit 1
fi
echo "setup_env.sh completed successfully"

# Verify DATAEX credentials are set
if [ -z "$DATAEX_USERNAME" ] || [ -z "$DATAEX_PASSWORD" ]; then
    echo "Error: DATAEX_USERNAME and DATAEX_PASSWORD must be set"
    exit 1
fi
echo "DATAEX credentials verified"

# Verify database variables are set
if [ -z "$DATABASE_HOST" ] || [ -z "$DATABASE_PORT" ] || [ -z "$DATABASE_DB" ] || [ -z "$DATABASE_USER" ] || [ -z "$DATABASE_PASSWORD" ]; then
    echo "Error: Database environment variables are not properly set"
    env | grep -E 'DATABASE_'
    exit 1
fi
echo "Database variables verified"

# Verify auth file exists and is readable
if [ ! -f "$HOME/.dataex_auth.json" ]; then
    echo "Error: Auth file not found at $HOME/.dataex_auth.json"
    exit 1
fi
echo "Auth file verified"

echo "All checks passed, starting application..."
# Run the command through debug wrapper
exec ./debug-wrapper.sh "$@"