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