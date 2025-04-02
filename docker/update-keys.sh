#!/bin/bash
set -e

# Clean up any existing sources
rm -f /etc/apt/sources.list
rm -f /etc/apt/sources.list.d/debian.sources

# Create keyrings directory
mkdir -p /etc/apt/keyrings

# Create initial sources.list
cat > /etc/apt/sources.list << EOF
deb http://deb.debian.org/debian bookworm main
deb http://deb.debian.org/debian bookworm-updates main
deb http://deb.debian.org/debian-security bookworm-security main
EOF

# Install required packages including debian-archive-keyring
apt-get update -qq
apt-get install -y --no-install-recommends \
    ca-certificates \
    debian-archive-keyring \
    gnupg2

# Update sources.list with signed-by option
cat > /etc/apt/sources.list << EOF
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] http://deb.debian.org/debian bookworm main
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] http://deb.debian.org/debian bookworm-updates main
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] http://deb.debian.org/debian-security bookworm-security main
EOF

# Update package lists with new sources
apt-get update -qq

# Don't clean up here - let apt-install.sh handle cleanup