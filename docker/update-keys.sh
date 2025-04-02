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
    curl \
    dirmngr

# Add all the necessary Debian GPG keys
# Debian bookworm keys
gpg --keyserver keyserver.ubuntu.com --recv-keys 0E98404D386FA1D9
gpg --export 0E98404D386FA1D9 | gpg --dearmor -o /etc/apt/keyrings/debian-archive-keyring.gpg
gpg --keyserver keyserver.ubuntu.com --recv-keys 6ED0E7B82643E131
gpg --export 6ED0E7B82643E131 | gpg --dearmor -o /etc/apt/keyrings/debian-archive-keyring-2.gpg
gpg --keyserver keyserver.ubuntu.com --recv-keys F8D2585B8783D481
gpg --export F8D2585B8783D481 | gpg --dearmor -o /etc/apt/keyrings/debian-archive-keyring-3.gpg

# Debian security keys
gpg --keyserver keyserver.ubuntu.com --recv-keys 54404762BBB6E853
gpg --export 54404762BBB6E853 | gpg --dearmor -o /etc/apt/keyrings/debian-security-keyring.gpg
gpg --keyserver keyserver.ubuntu.com --recv-keys BDE6D2B9216EC7A8
gpg --export BDE6D2B9216EC7A8 | gpg --dearmor -o /etc/apt/keyrings/debian-security-keyring-2.gpg

# Combine all keyrings
cat /etc/apt/keyrings/debian-archive-keyring*.gpg > /etc/apt/keyrings/debian-all.gpg
cat /etc/apt/keyrings/debian-security-keyring*.gpg >> /etc/apt/keyrings/debian-all.gpg

# Update sources.list with signed-by option pointing to combined keyring
cat > /etc/apt/sources.list << EOF
deb [signed-by=/etc/apt/keyrings/debian-all.gpg] http://deb.debian.org/debian bookworm main
deb [signed-by=/etc/apt/keyrings/debian-all.gpg] http://deb.debian.org/debian bookworm-updates main
deb [signed-by=/etc/apt/keyrings/debian-all.gpg] http://deb.debian.org/debian-security bookworm-security main
EOF

# Update package lists with new sources
apt-get update -qq

# Don't clean up here - let apt-install.sh handle cleanup