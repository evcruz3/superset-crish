# Development Environment Setup Guide

This guide outlines the steps required to set up and run Apache Superset in a development environment.

## Prerequisites

- Docker and Docker Compose
- Node.js (v16 or higher recommended)
- npm (v7 or higher)

## Initial Setup

1. **Environment Configuration**

   Create or modify the `.env` file in the root directory with the following configurations:
   ```env
   COMPOSE_PROJECT_NAME=superset

   # Database Configuration
   DATABASE_DIALECT=postgresql
   DATABASE_HOST=superset_db
   DATABASE_PORT=5432
   DATABASE_DB=superset
   DATABASE_USER=superset
   DATABASE_PASSWORD=superset

   # Examples Database
   EXAMPLES_DB=examples
   EXAMPLES_HOST=superset_db
   EXAMPLES_USER=superset
   EXAMPLES_PASSWORD=superset
   EXAMPLES_PORT=5432

   # Important: Replace with a secure key in production
   SECRET_KEY=your_secret_key_here

   # Redis Configuration
   REDIS_HOST=superset_cache
   REDIS_PORT=6379

   # Superset Specific
   SUPERSET_ENV=development
   SUPERSET_LOAD_EXAMPLES=yes
   CYPRESS_CONFIG=false
   SUPERSET_PORT=8088
   ```

   **Important**: Replace `your_secret_key_here` with a secure key. This key is used for database encryption and must remain consistent once set.

2. **Frontend Build Configuration**

   The frontend needs to be built separately in development mode. To enable this:

   a. Modify the Docker Compose configuration to disable frontend building in the container:
   ```yaml
   # In docker-compose.yml or docker-compose-non-dev.yml
   x-superset-image: &superset-image
     image: *superset-repo
     environment:
       - FRONTEND_BUILD_ONLY=false  # Add this line
   ```

## Running the Development Environment

1. **Start Frontend Development Server**

   First, start the frontend development server:
   ```bash
   cd superset-frontend
   npm install  # Only needed first time or when dependencies change
   npm run dev-server
   ```
   This will start the webpack dev server on port 9000.

2. **Start Docker Services**

   In a new terminal, from the root directory:
   ```bash
   docker compose up
   ```

   For a clean start (recommended when changing configurations):
   ```bash
   docker compose down -v  # Removes volumes for clean slate
   docker compose up
   ```

## Accessing the Application

- Main Superset interface: http://localhost:8088
- Development server: http://localhost:9000

Default login credentials:
- Username: admin
- Password: admin

## Troubleshooting

1. **Encryption Key Issues**
   If you encounter `ValueError: Invalid decryption key` error:
   - Ensure the `SECRET_KEY` in `.env` hasn't changed
   - If the key was changed, you'll need to:
     ```bash
     docker compose down -v  # This will clear the database
     # Then restart with the new key
     docker compose up
     ```

2. **Frontend Build Issues**
   If the frontend isn't updating:
   - Ensure the dev-server is running (`npm run dev-server`)
   - Check the webpack dev server output for errors
   - Clear your browser cache
   - Ensure `FRONTEND_BUILD_ONLY=false` is set in your environment

3. **Database Connection Issues**
   If the database fails to initialize:
   ```bash
   docker compose down -v  # Clear all data
   docker compose up superset_db -d  # Start DB first
   # Wait a few seconds for DB to initialize
   docker compose up  # Start remaining services
   ```

## Development Tips

1. **Hot Reloading**
   - Frontend changes will automatically reload when using `npm run dev-server`
   - Python changes in the `superset` directory will trigger automatic reloads

2. **Logs**
   View logs for specific services:
   ```bash
   docker compose logs superset_app  # Main application logs
   docker compose logs superset_init  # Initialization logs
   docker compose logs superset_db  # Database logs
   ```

3. **Database Reset**
   To completely reset the database:
   ```bash
   docker compose down -v
   docker compose up
   ```

## Important Notes

- Always use `docker compose down -v` when changing the `SECRET_KEY` to avoid encryption/decryption issues
- Keep the dev-server running while developing frontend changes
- The development setup uses different ports than production (8088 vs 8080)
- Example data loading can be disabled by setting `SUPERSET_LOAD_EXAMPLES=no` in `.env` 