#!/bin/bash

# Run setup_env.sh to create auth file
source scripts/setup_env.sh

# Execute the CMD
exec "$@"