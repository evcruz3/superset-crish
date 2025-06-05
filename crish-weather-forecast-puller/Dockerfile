FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    gcc \
    g++ \
    postgresql-client \
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