# Use official pixi image
FROM ghcr.io/prefix-dev/pixi:0.39.2-jammy

# Set working directory and create non-root user
WORKDIR /app
RUN useradd -m -s /bin/bash datauser

# Install git, postgresql-client and clean up in one layer
RUN apt-get update && \
    apt-get install -y git postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Copy only necessary files and set permissions
COPY pixi.toml pixi.lock ./
COPY scripts ./scripts
RUN chmod +x scripts/setup_env.sh && \
    chmod +x scripts/docker-entrypoint.sh && \
    mkdir -p data && \
    chown -R datauser:datauser /app data && \
    chmod 777 data && \
    rm -rf .pixi

# Switch to non-root user and set up environment
USER datauser
ENV PYTHONUNBUFFERED=1 \
    HOME=/home/datauser \
    DOCKER_ENV=true

# Create fresh pixi environment and verify installation
RUN pixi install && \
    echo "Verifying pixi environment..." && \
    pixi run python --version && \
    pixi list

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pg_isready -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USER || exit 1

# Add debug wrapper script
COPY --chown=datauser:datauser scripts/debug-wrapper.sh ./
RUN chmod +x debug-wrapper.sh

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["pixi", "run", "python", "scripts/scheduled_pull.py"]