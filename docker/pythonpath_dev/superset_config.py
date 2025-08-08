# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
# This file is included in the final Docker image and SHOULD be overridden when
# deploying the image to prod. Settings configured here are intended for use in local
# development environments. Also note that superset_config_docker.py is imported
# as a final step as a means to override "defaults" configured here
#
import logging
import os

from celery.schedules import crontab
from flask_caching.backends.filesystemcache import FileSystemCache

logger = logging.getLogger()

DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_DB = os.getenv("DATABASE_DB")

EXAMPLES_USER = os.getenv("EXAMPLES_USER")
EXAMPLES_PASSWORD = os.getenv("EXAMPLES_PASSWORD")
EXAMPLES_HOST = os.getenv("EXAMPLES_HOST")
EXAMPLES_PORT = os.getenv("EXAMPLES_PORT")
EXAMPLES_DB = os.getenv("EXAMPLES_DB")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

SQLALCHEMY_EXAMPLES_URI = (
    f"{DATABASE_DIALECT}://"
    f"{EXAMPLES_USER}:{EXAMPLES_PASSWORD}@"
    f"{EXAMPLES_HOST}:{EXAMPLES_PORT}/{EXAMPLES_DB}"
)

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

# Disable async result backend when workers are disabled
RESULTS_BACKEND = None

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}
DATA_CACHE_CONFIG = CACHE_CONFIG

# MinIO/S3 Storage for Attachments
S3_BUCKET = os.getenv('S3_BUCKET', 'crish-attachments') # Default bucket name
S3_ENDPOINT_URL = os.getenv('S3_ENDPOINT_URL', 'http://minio:9000') # Docker service name 'minio' and its API port
S3_ACCESS_KEY = os.getenv('MINIO_ROOT_USER') # Should be defined in docker/.env
S3_SECRET_KEY = os.getenv('MINIO_ROOT_PASSWORD') # Should be defined in docker/.env
S3_PRESIGNED_URL_EXPIRATION = int(os.getenv('S3_PRESIGNED_URL_EXPIRATION', 3600)) # In seconds (1 hour)
S3_ADDRESSING_STYLE = os.getenv('S3_ADDRESSING_STYLE', 'path') # 'path' or 'virtual'
S3_PUBLIC_ENDPOINT_URL = os.getenv('S3_PUBLIC_ENDPOINT_URL', 'http://localhost:9090') # For frontend access

# Facebook Dissemination Configuration
FACEBOOK_APP_ID = os.getenv('FACEBOOK_APP_ID')
FACEBOOK_APP_SECRET = os.getenv('FACEBOOK_APP_SECRET')
FACEBOOK_PAGE_ID = os.getenv('FACEBOOK_PAGE_ID')
FACEBOOK_ACCESS_TOKEN = os.getenv('FACEBOOK_ACCESS_TOKEN')
# Optional: Default message template for Facebook posts
FACEBOOK_DEFAULT_MESSAGE_TEMPLATE = os.getenv('FACEBOOK_DEFAULT_MESSAGE_TEMPLATE', "New Bulletin: {title} - Read more at {url}")

# ----------------------------------------------------
# WhatsApp Dissemination Configuration
# ----------------------------------------------------
WHATSAPP_CLOUD_API_VERSION = os.getenv("WHATSAPP_CLOUD_API_VERSION", "v22.0") # Using the version from your curl
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID") # Your Phone Number ID
WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID") # Your WhatsApp Business Account ID
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN") # IMPORTANT: Replace with your actual token
WHATSAPP_DEFAULT_TEMPLATE_NAME = os.getenv("WHATSAPP_DEFAULT_TEMPLATE_NAME", "bulletin_alert") 

# Celery configuration disabled - no workers will be used
# class CeleryConfig:
#     broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
#     imports = (
#         "superset.sql_lab",
#         "superset.tasks.scheduler",
#         "superset.tasks.thumbnails",
#         "superset.tasks.cache",
#     )
#     result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
#     worker_prefetch_multiplier = 1
#     task_acks_late = False
#     beat_schedule = {
#         "reports.scheduler": {
#             "task": "reports.scheduler",
#             "schedule": crontab(minute="*", hour="*"),
#         },
#         "reports.prune_log": {
#             "task": "reports.prune_log",
#             "schedule": crontab(minute=10, hour=0),
#         },
#     }

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

# CORS Configuration
ENABLE_CORS = True
CORS_OPTIONS = {
    'allow_headers': ['Content-Type', 'Authorization', 'X-CSRFToken'],
    'resources': [r'/*'],  # Allow CORS for all routes
    'origins': ['*']  # Allow all origins
}

# Ensure dry run mode for any reports that might be configured
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True

# Force SQL Lab to run queries synchronously
SQLLAB_ASYNC_TIME_LIMIT_SEC = 0  # Setting to 0 forces synchronous execution

# Disable thumbnail cache configuration
THUMBNAIL_CACHE_CONFIG = {
    "CACHE_TYPE": "NullCache",
    "CACHE_NO_NULL_WARNING": True,
}

WEBDRIVER_BASEURL = "http://superset:8088/"  # When using docker compose baseurl should be http://superset_app:8088/
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL
SQLLAB_CTAS_NO_LIMIT = True


# Import and configure the custom security manager
from custom_auth.custom_security_manager import CustomSecurityManager
CUSTOM_SECURITY_MANAGER = CustomSecurityManager

# Enable user self-registration (required for custom security manager)
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = 'Alpha'

#
# Optionally import superset_config_docker.py (which will have been included on
# the PYTHONPATH) in order to allow for local settings to be overridden
#
try:
    import superset_config_docker
    from superset_config_docker import *  # noqa

    logger.info(
        f"Loaded your Docker configuration at " f"[{superset_config_docker.__file__}]"
    )
except ImportError:
    logger.info("Using default Docker config...")
