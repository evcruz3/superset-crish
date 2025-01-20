#!/bin/bash
set -e

echo "Starting docker-entrypoint.sh"

# Run setup_env.sh to create auth file
echo "Running setup_env.sh..."
source scripts/setup_env.sh
echo "setup_env.sh completed"

# Log the command that will be executed
echo "Executing command: $@"

# Execute the CMD
exec "$@"