# Integration Plan for Weather Forecast Puller

## 1. Service Configuration Changes

### A. Docker Compose Files
Add the following service to all three docker-compose files (`docker-compose.yml`, `docker-compose-non-dev.yml`, `docker-compose-image-tag.yml`):

```yaml
weather-forecast-puller:
    build: ./crish-weather-forecast-puller
    container_name: superset_weather_forecast_puller
    volumes:
      - ./crish-weather-forecast-puller/data:/app/data
    env_file:
      - path: docker/.env # default
        required: true
      - path: docker/.env-local # optional override
        required: false
    depends_on:
      - db
    restart: unless-stopped
    user: "root"
```

### B. Environment Variables
Add the following to `docker/.env`:

```bash
# Weather Forecast Puller Configuration
DATAEX_USERNAME=your_username
DATAEX_PASSWORD=your_password

# Database configuration is already set in the existing env file:
# DATABASE_HOST=db
# DATABASE_PORT=5432
# DATABASE_DB=superset
# DATABASE_USER=superset
# DATABASE_PASSWORD=superset
```

## 2. Required Code Modifications

### A. Database Connection Changes

1. **scripts/transform_weather_data.py**
   - Update environment variable names to match Superset's:
   ```python
   # Change from:
   db_uri = (
       f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
       f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}"
       f"/{os.getenv('POSTGRES_DB')}"
   )
   
   # Change to:
   db_uri = (
       f"postgresql://{os.getenv('DATABASE_USER', 'superset')}:{os.getenv('DATABASE_PASSWORD', 'superset')}"
       f"@{os.getenv('DATABASE_HOST', 'db')}:{os.getenv('DATABASE_PORT', '5432')}"
       f"/{os.getenv('DATABASE_DB', 'superset')}"
   )
   ```

2. **scripts/scheduled_pull.py**
   - Update environment variable logging:
   ```python
   env_vars = {
       'DATAEX_USERNAME': os.getenv('DATAEX_USERNAME'),
       'DATAEX_PASSWORD': bool(os.getenv('DATAEX_PASSWORD')),
       'DATABASE_HOST': os.getenv('DATABASE_HOST', 'db'),
       'DATABASE_PORT': os.getenv('DATABASE_PORT', '5432'),
       'DATABASE_DB': os.getenv('DATABASE_DB', 'superset'),
       'DATABASE_USER': os.getenv('DATABASE_USER', 'superset'),
       'DATABASE_PASSWORD': bool(os.getenv('DATABASE_PASSWORD'))
   }
   ```

### B. Data Directory Configuration
1. **scripts/scheduled_pull.py**
   - Update data directory path for Docker environment:
   ```python
   if os.getenv('DOCKER_ENV'):
       data_dir = Path('/app/data').resolve()
   ```

### C. Environment Variable Handling
1. **scripts/setup_env.sh**
   - Add fallback to Superset database variables:
   ```bash
   # Database configuration
   export DATABASE_HOST=${DATABASE_HOST:-db}
   export DATABASE_PORT=${DATABASE_PORT:-5432}
   export DATABASE_DB=${DATABASE_DB:-superset}
   export DATABASE_USER=${DATABASE_USER:-superset}
   export DATABASE_PASSWORD=${DATABASE_PASSWORD:-superset}
   ```

### D. Dockerfile Updates
1. **Dockerfile**
   - Add database client for healthcheck:
   ```dockerfile
   # Add PostgreSQL client for healthcheck
   RUN apt-get update && \
       apt-get install -y git postgresql-client && \
       rm -rf /var/lib/apt/lists/*
   ```
   - Update healthcheck to use Superset's database variables:
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
       CMD pg_isready -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USER || exit 1
   ```

## 3. Implementation Steps

1. **Docker Compose Updates**
   - Add service configuration to all three compose files
   - Ensure consistent naming and dependencies

2. **Environment Configuration**
   - Update `docker/.env` with required variables
   - Create documentation for required credentials

3. **Code Modifications**
   - Apply all code changes listed above
   - Test database connectivity with new variable names
   - Verify data ingestion works with Superset database

4. **Database Schema**
   - Verify table creation permissions in Superset database
   - Document table schemas for:
     - rainfall_daily_weighted_average
     - rh_daily_avg_region
     - tmax_daily_tmax_region
     - ws_daily_avg_region

## 4. Security Considerations

1. **Credentials Management**
   - Store sensitive credentials in `.env-local` (gitignored)
   - Document credential requirements

2. **Container Security**
   - Service runs as root (matching other services)
   - Data directory permissions handled in Dockerfile

## 5. Monitoring and Maintenance

1. **Logging**
   - Logs accessible via `docker logs superset_weather_forecast_puller`
   - Integration with existing logging setup

2. **Health Checks**
   - Database connectivity check every 30s
   - Automatic restart on failure

## 6. Database Tables Schema

### Weather Parameter Tables

Each weather parameter will have its own table with the following schema:

```sql
CREATE TABLE IF NOT EXISTS rainfall_daily_weighted_average (
    forecast_date DATE NOT NULL,
    day_name VARCHAR(10) NOT NULL,
    value FLOAT NOT NULL,
    municipality_code VARCHAR(5) NOT NULL,
    municipality_name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS rh_daily_avg_region (
    forecast_date DATE NOT NULL,
    day_name VARCHAR(10) NOT NULL,
    value FLOAT NOT NULL,
    municipality_code VARCHAR(5) NOT NULL,
    municipality_name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS tmax_daily_tmax_region (
    forecast_date DATE NOT NULL,
    day_name VARCHAR(10) NOT NULL,
    value FLOAT NOT NULL,
    municipality_code VARCHAR(5) NOT NULL,
    municipality_name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS ws_daily_avg_region (
    forecast_date DATE NOT NULL,
    day_name VARCHAR(10) NOT NULL,
    value FLOAT NOT NULL,
    municipality_code VARCHAR(5) NOT NULL,
    municipality_name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_forecast_alerts (
    municipality_code VARCHAR(5) NOT NULL,
    forecast_date DATE NOT NULL,
    weather_parameter VARCHAR(50) NOT NULL,
    alert_level VARCHAR(30) NOT NULL,
    alert_title VARCHAR(100) NOT NULL,
    alert_message TEXT NOT NULL,
    parameter_value FLOAT NOT NULL,
    municipality_name VARCHAR(50) NOT NULL
);
```

## 7. Testing Plan

1. **Unit Tests**
   - Test database connection with new environment variables
   - Test data transformation with sample data
   - Test data ingestion with test database

2. **Integration Tests**
   - Test service startup in Docker environment
   - Test data pulling and processing pipeline
   - Test database table creation and data insertion

3. **System Tests**
   - Test interaction with Superset database
   - Test concurrent access with other services
   - Test logging and monitoring integration

## 8. Rollback Plan

1. **Pre-Implementation Backup**
   - Backup existing database schema and data
   - Backup all configuration files

2. **Rollback Steps**
   - Remove service from docker-compose files
   - Restore original environment variables
   - Remove added database tables if necessary

## 9. Post-Implementation Tasks

1. **Documentation**
   - Update main README with integration details
   - Document troubleshooting procedures
   - Update environment variable documentation

2. **Monitoring Setup**
   - Set up alerts for failed health checks
   - Configure log rotation
   - Set up database table size monitoring 