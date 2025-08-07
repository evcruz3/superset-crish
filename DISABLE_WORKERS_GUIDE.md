# Guide to Disabling Superset Worker Services

## Overview
This guide explains how to safely disable the Celery worker services (`superset-worker` and `superset-worker-beat`) in your Superset deployment.

## Current Configuration Status

The following files have been updated to disable workers by default:
- `docker-compose.override.yml` - Disables worker services via Docker profiles
- `docker/pythonpath_dev/superset_config.py` - Sets CELERY_CONFIG = None
- `docker/pythonpath_dev/superset_config_docker.py` - Overrides all async features
- `docker/.env-local` - Contains environment variables to disable async features

## Step 1: Disable Worker Services in Docker Compose

A `docker-compose.override.yml` file has been created that will automatically disable the worker services when you run docker-compose.

## Step 2: Environment Configuration

Add these environment variables to your `docker/.env` or `docker/.env-local` file:

```bash
# Disable async query execution in SQL Lab
SUPERSET_FEATURE_ENABLE_SQLLAB_BACKEND_PERSISTENCE=false
SQLLAB_ASYNC_TIME_LIMIT_SEC=0

# Disable features that require workers
ALERT_REPORTS_NOTIFICATION_DRY_RUN=true
THUMBNAIL_SELENIUM_USER=
THUMBNAIL_CACHE_CONFIG=

# Optional: Disable scheduled features
ENABLE_SCHEDULED_EMAIL_REPORTS=false
ENABLE_ALERTS=false
```

## Step 3: Update superset_config.py (Required)

Add these lines to your `docker/pythonpath_dev/superset_config.py` or create a `superset_config_docker.py` file:

```python
# Disable Celery completely
CELERY_CONFIG = None

# Disable all async and worker-dependent features
FEATURE_FLAGS = {
    "ALERT_REPORTS": False,  # Disable scheduled reports and alerts
    "ALERT_REPORT_TABS": False,  # Hide alert/report tabs in UI
    "THUMBNAILS": False,  # Disable thumbnail generation
    "ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS": False,  # Disable dashboard screenshots
    "GLOBAL_ASYNC_QUERIES": False,  # Disable async queries globally
    "SQLLAB_FORCE_RUN_ASYNC": False,  # Don't force async in SQL Lab
    "ENABLE_TEMPLATE_PROCESSING": True,  # Keep template processing (doesn't need workers)
}

# Force SQL Lab to run queries synchronously
SQLLAB_ASYNC_TIME_LIMIT_SEC = 0  # Setting to 0 forces synchronous execution

# Disable async result backend
RESULTS_BACKEND = None

# Disable thumbnail cache configuration
THUMBNAIL_CACHE_CONFIG = None

# Ensure dry run mode for any reports that might be configured
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
```

## Features Affected by Disabling Workers

When workers are disabled, the following features will be affected:

1. **SQL Lab Async Queries**: Queries will run synchronously (blocking)
2. **Scheduled Reports/Alerts**: Will not function
3. **Thumbnail Generation**: Dashboard/chart thumbnails won't be generated
4. **Background Cache Warming**: Cache will only be populated on-demand
5. **Dashboard Screenshots**: API endpoints for screenshots will be disabled
6. **Long-running queries**: May timeout if they exceed web server timeout limits
7. **Email Reports**: Scheduled email reports will not be sent

## Step 4: Apply Changes

1. Stop all services:
   ```bash
   docker-compose down
   ```

2. Start services without workers:
   ```bash
   docker-compose up -d
   ```

3. Verify workers are not running:
   ```bash
   docker-compose ps
   ```
   You should NOT see `superset_worker` or `superset_worker_beat` in the list.

## Reverting Changes

To re-enable workers:

1. Delete or rename the `docker-compose.override.yml` file:
   ```bash
   rm docker-compose.override.yml
   # or
   mv docker-compose.override.yml docker-compose.override.yml.disabled
   ```

2. Remove or comment out the environment variables added above

3. Restart services:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## Notes

- The `docker-compose.override.yml` file is automatically loaded by Docker Compose
- Services with the `disabled` profile are not started unless explicitly requested
- Ensure your use case doesn't require any of the affected features before disabling workers
- Monitor application logs for any errors related to missing worker functionality
- For production deployments, consider adjusting web server timeouts (Gunicorn) to handle longer-running synchronous queries
- Database-level async settings can be configured per database in the Superset UI under "Advanced" → "Asynchronous query execution"