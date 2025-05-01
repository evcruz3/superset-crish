# Forecast Data Puller

A tool for pulling forecast data using the dataex-client package. Runs as a standalone Python application or Docker container with scheduled data pulling.

## Prerequisites

- [pixi](https://prefix.dev/) for local development
- Docker (optional, for containerized deployment)
- Git

## Quick Start

### Local Development
```bash
# Create and activate environment
pixi shell

# Pull data manually
pixi run pull-data

# Run scheduled puller
pixi run scheduled-pull
```

Data is stored in `./data/` when running locally.

### Docker Deployment
```bash
# Start service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down
```

Data is mounted to `/app/data/` in Docker.

## Configuration

Create a `.env` file with:
```
DATAEX_USERNAME=your_username
DATAEX_PASSWORD=your_password
POSTGRES_HOST=your_external_db_host
POSTGRES_PORT=5432
POSTGRES_DB=your_db_name
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
```

## Project Structure

```
forecast-data-puller/
├── data/                    # Directory for pulled data
├── scripts/                 # Activation and utility scripts
│   ├── setup_env.sh        # Unix/Mac activation script
│   ├── pull_data.py        # Script for manual data pulling
│   ├── scheduled_pull.py   # Script for scheduled data pulling
│   └── transform_weather_data.py  # Weather data transformation script
├── .env                     # Environment variables configuration
├── .env-example            # Example environment configuration
├── .dockerignore           # Docker build ignore rules
├── .gitattributes          # Git attributes configuration
├── .gitignore              # Git ignore rules
├── docker-compose.yml      # Docker Compose configuration
├── Dockerfile              # Docker configuration
├── pixi.toml              # Project configuration and dependencies
├── pixi.lock              # Lock file for dependencies
└── README.md              # Project documentation
```

## Authentication and Execution Flow

### Local Development (`pixi run scheduled-pull`)

1. **Environment Setup**
   - Ensure `.env` file exists in project root with credentials:
     ```bash
     DATAEX_USERNAME=your_username
     DATAEX_PASSWORD=your_password
     POSTGRES_HOST=your_db_host
     # ... other database credentials
     ```

2. **Authentication Flow**
   ```mermaid
   graph TD
      A[pixi run scheduled-pull] --> B[source setup_env.sh]
      B --> C{Check .env exists}
      C -->|Yes| D[Load from .env]
      C -->|No| E[Check env variables]
      D --> F[Check credentials]
      E --> F
      F -->|Valid| G[Create ~/.dataex_auth.json]
      F -->|Invalid| H[Exit with error]
      G --> I[Run scheduled_pull.py]
   ```

   - `setup_env.sh` first tries to load from `.env`
   - If `.env` doesn't exist, uses existing environment variables
   - Creates `~/.dataex_auth.json` only if credentials are available
   - Authentication file format:
     ```json
     {
       "username": "your_username",
       "password": "your_password"
     }
     ```

### Docker Deployment (`docker-compose up`)

1. **Environment Setup**
   - Environment variables can be provided through:
     ```yaml
     # docker-compose.yml
     services:
       weather-forecast:
         env_file: .env     # Method 1: Using .env file
         environment:       # Method 2: Direct environment variables
           DATAEX_USERNAME: your_username
           DATAEX_PASSWORD: your_password
     ```

2. **Container Startup Flow**
   ```mermaid
   graph TD
      A[docker-compose up] --> B[docker-entrypoint.sh]
      B --> C[Execute setup_env.sh]
      C --> D{Check credentials}
      D -->|Available| E[Create .dataex_auth.json]
      D -->|Missing| F[Log warning]
      E --> G[Start scheduled_pull.py]
      F --> G
   ```

   - Docker entrypoint runs setup_env.sh before application starts
   - Credentials can come from either .env file or environment variables
   - Auth file created in container's `/home/datauser/.dataex_auth.json`

### Key Differences

- **Local Development**:
  - Requires `.env` file in project root
  - Auth file created in local user's home directory
  - Fails if credentials are missing

- **Docker Deployment**:
  - Flexible credential sources (env_file or environment variables)
  - Auth file created in container's `/home/datauser/`
  - Continues execution even without `.env` file

### Troubleshooting

- **Local Development**:
  - Verify `.env` file exists and has correct permissions
  - Check `~/.dataex_auth.json` exists after setup
  - Run `cat ~/.dataex_auth.json` to verify credentials

- **Docker Deployment**:
  - Check environment variables: `docker-compose config`
  - View container logs: `docker-compose logs`
  - Inspect auth file: `docker exec weather-forecast cat /home/datauser/.dataex_auth.json`

## Features

### Weather Data Collection
- Pulls weather forecast data from the DATAEX API
- Processes parameters including maximum temperature, rainfall, relative humidity, and wind speed
- Calculates derived parameters such as heat index
- Stores data in the PostgreSQL database for access by other CRISH components

### Weather Alert Generation
- Analyzes weather data to identify potentially dangerous conditions
- Generates alerts for various weather parameters with different severity levels:
  - Normal: Regular conditions, no alert needed
  - Extreme Caution: Conditions warrant increased vigilance
  - Danger: Potentially dangerous conditions
  - Extreme Danger: Severe weather conditions requiring immediate action
- Stores alerts in the `weather_forecast_alerts` table

### Automated Bulletin Creation
- Automatically creates bulletins in the Superset bulletins system for high severity weather alerts
- Only creates bulletins for alerts with 'Danger' or 'Extreme Danger' level
- Includes detailed information in the bulletin:
  - Title indicating the alert level, weather parameter, and location
  - Advisory text with details about the alert
  - Customized safety tips based on the weather parameter
  - Specific risks associated with the weather condition
  - Relevant hashtags for easy categorization
- Bulletins appear in the Superset Bulletins and Advisories interface
- Created with admin user ID (1) to ensure proper visibility

## Database Tables

### Bulletin Table Integration
The service also integrates with the Superset `bulletins` table:

```sql
-- Simplified schema for the bulletins table
CREATE TABLE IF NOT EXISTS bulletins (
    id INTEGER PRIMARY KEY,
    title VARCHAR,
    advisory TEXT,
    hashtags VARCHAR,
    chart_id INTEGER,
    created_by_fk INTEGER,
    created_on TIMESTAMP,
    changed_on TIMESTAMP,
    risks TEXT,
    safety_tips TEXT
);
```

## Testing

### Unit Tests
The project includes test scripts to verify functionality:

- `test_alert_generation.py`: Tests the weather alert generation
- `test_bulletin_creation()`: Tests the bulletin creation process for weather alerts

To run tests:
```bash
python scripts/test_alert_generation.py
```