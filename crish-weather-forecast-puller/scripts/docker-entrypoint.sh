#!/bin/bash
set -e

echo "Starting docker-entrypoint.sh"

# Source bashrc to get pixi environment
echo "Sourcing bashrc for pixi environment..."
source ~/.bashrc

# Set up environment
export PATH="/usr/local/bin:/app/.pixi/env/bin:$PATH"
export PIXI_ROOT=/app/.pixi

# Verify pixi is available
echo "Checking pixi installation..."
which pixi || echo "Warning: pixi not found in PATH"
echo "PIXI_ROOT: $PIXI_ROOT"
echo "PATH: $PATH"

# Verify pixi environment
echo "Verifying pixi environment..."
pixi info || echo "Warning: pixi environment not properly activated"

# Run setup_env.sh to create auth file
echo "Running setup_env.sh..."
source scripts/setup_env.sh
echo "setup_env.sh completed"

# Log the command that will be executed
echo "Executing command: $@"

# Execute the CMD
exec "$@"