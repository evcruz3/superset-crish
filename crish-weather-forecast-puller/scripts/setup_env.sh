#!/bin/bash
# Setup script for Unix-like systems (Linux/macOS)
# This is run from the root of the project e.g. `./scripts/setup_env.sh`

# Load environment variables if .env exists
if [ -f .env ]; then
    source .env
fi

# Create .dataex_auth.json if username and password are set
if [ ! -z "$DATAEX_USERNAME" ] && [ ! -z "$DATAEX_PASSWORD" ]; then
    AUTH_FILE="$HOME/.dataex_auth.json"
    echo "{\"username\": \"$DATAEX_USERNAME\", \"password\": \"$DATAEX_PASSWORD\"}" > "$AUTH_FILE"
else
    echo "Warning: DATAEX_USERNAME and/or DATAEX_PASSWORD not set"
    exit 1
fi
