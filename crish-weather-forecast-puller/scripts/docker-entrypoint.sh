#!/bin/bash
set -e

# Run setup script first
source scripts/setup_env.sh

# Then run the main script
exec python scripts/scheduled_pull.py