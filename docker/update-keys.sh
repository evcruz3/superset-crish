#!/bin/bash
set -e

# Clean up any existing sources
rm -f /etc/apt/sources.list
rm -f /etc/apt/sources.list.d/debian.sources

# Create keyrings directory
mkdir -p /etc/apt/keyrings

# Create temporary sources.list without verification
cat > /etc/apt/sources.list << EOF
deb [trusted=yes] http://deb.debian.org/debian bookworm main
deb [trusted=yes] http://deb.debian.org/debian bookworm-updates main
deb [trusted=yes] http://deb.debian.org/debian-security bookworm-security main
EOF

# Install required packages for key management
apt-get update -qq || true
apt-get install -y --no-install-recommends \
    ca-certificates \
    gnupg2 \
    curl \
    wget

# Create a single keyring file
KEYRING_FILE="/etc/apt/keyrings/debian-archive-keyring.gpg"

# Download the Debian keyring directly using wget
wget -q -O- https://ftp-master.debian.org/keys/release-12.gpg | gpg --batch --dearmor -o $KEYRING_FILE
wget -q -O- https://ftp-master.debian.org/keys/archive-key-12.gpg | gpg --batch --dearmor -o "$KEYRING_FILE.tmp"
cat "$KEYRING_FILE.tmp" >> "$KEYRING_FILE"
rm "$KEYRING_FILE.tmp"

# Add security keys
wget -q -O- https://ftp-master.debian.org/keys/archive-key-12-security.gpg | gpg --batch --dearmor -o "$KEYRING_FILE.tmp"
cat "$KEYRING_FILE.tmp" >> "$KEYRING_FILE"
rm "$KEYRING_FILE.tmp"

# Update sources.list with signed-by option
cat > /etc/apt/sources.list << EOF
deb [signed-by=$KEYRING_FILE] http://deb.debian.org/debian bookworm main
deb [signed-by=$KEYRING_FILE] http://deb.debian.org/debian bookworm-updates main
deb [signed-by=$KEYRING_FILE] http://deb.debian.org/debian-security bookworm-security main
EOF

# Update package lists with new sources
apt-get update -qq

# Don't clean up here - let apt-install.sh handle cleanup