#!/bin/bash

echo "=== Debug Information ==="
echo "Current directory: $(pwd)"
echo "Contents of current directory:"
ls -la

echo -e "\n=== Environment Variables ==="
env | grep -E 'DATABASE_|DATAEX_|DOCKER_|PYTHON|HOME'

echo -e "\n=== Python Version ==="
pixi run python --version

echo -e "\n=== Pixi Environment ==="
pixi list

echo -e "\n=== Starting Application ==="
exec "$@" 