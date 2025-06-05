FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN echo "deb http://cdn-fastly.deb.debian.org/debian bookworm main" > /etc/apt/sources.list && \
    echo "deb http://cdn-fastly.deb.debian.org/debian bookworm-updates main" >> /etc/apt/sources.list && \
    echo "deb http://cdn-fastly.deb.debian.org/debian-security bookworm-security main" >> /etc/apt/sources.list && \
    apt-get update --allow-insecure-repositories && \
    apt-get install -y --no-install-recommends --reinstall ca-certificates debian-archive-keyring && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get update -o Acquire::ForceIPv4=true --allow-releaseinfo-change --allow-insecure-repositories && \
    apt-get install -y --allow-unauthenticated \
        git \
        gcc \
        g++ \
        postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory for persistence and make scripts executable
RUN mkdir -p data && \
    chmod 777 data && \
    chmod +x scripts/setup_env.sh

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    DOCKER_ENV=true \
    HOME=/root

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pg_isready -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USER || exit 1

# Create an entrypoint script to run setup and then the main script
COPY scripts/docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]