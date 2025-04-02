#!/bin/bash
set -e

# Clean up any existing sources
rm -f /etc/apt/sources.list
rm -f /etc/apt/sources.list.d/debian.sources

# Create keyrings directory
mkdir -p /etc/apt/keyrings

# Create initial sources.list without signed-by option
cat > /etc/apt/sources.list << EOF
deb http://deb.debian.org/debian bookworm main
deb http://deb.debian.org/debian bookworm-updates main
deb http://deb.debian.org/debian-security bookworm-security main
EOF

# Install required packages for key management
apt-get update -qq || true
apt-get install -y --no-install-recommends \
    ca-certificates \
    gnupg2 \
    curl

# Get Debian archive keyring directly
curl -fsSL https://ftp-master.debian.org/keys/release-11.asc | gpg --dearmor -o /etc/apt/keyrings/debian-archive-keyring.gpg

# Update sources.list with signed-by option
cat > /etc/apt/sources.list << EOF
deb [signed-by=/etc/apt/keyrings/debian-archive-keyring.gpg] http://deb.debian.org/debian bookworm main
deb [signed-by=/etc/apt/keyrings/debian-archive-keyring.gpg] http://deb.debian.org/debian bookworm-updates main
deb [signed-by=/etc/apt/keyrings/debian-archive-keyring.gpg] http://deb.debian.org/debian-security bookworm-security main
EOF

# Update package lists with new sources
apt-get update -qq

# Don't clean up here - let apt-install.sh handle cleanup