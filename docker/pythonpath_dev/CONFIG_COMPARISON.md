# Configuration Comparison: Dev vs Production

## Configuration Structure

### Base Configuration (`superset_config.py`)
Contains all non-sensitive, common configurations:
- Database connection (from env vars)
- Redis configuration
- Feature flags (workers disabled)
- CORS settings
- WebDriver settings
- Custom security manager
- App branding (APP_NAME, APP_ICON)
- Language settings
- Screenshot/thumbnail settings

### Development Override (`superset_config_docker.py`)
Minimal file with only dev-specific sensitive data:
- SECRET_KEY (dev value)
- Email credentials (dev Gmail account: erickson49366@gmail.com)
- Local URLs (localhost:8088)
- API tokens (with defaults from env vars)

### Production Override (`superset_config_docker.prod.py`)
Minimal file with only production-specific sensitive data:
- SECRET_KEY (should be changed in production)
- Email credentials (production Gmail: kokodnmg@gmail.com)
- Production URLs (crish-demo.rimes.int)
- Production S3 endpoint
- Hidden environment tags
- Production API tokens

## Key Differences Between Dev and Production

| Configuration | Development | Production |
|--------------|-------------|------------|
| SECRET_KEY | 'SomethingNotEntirelySecret' | Should be changed to secure value |
| Email Account | erickson49366@gmail.com | kokodnmg@gmail.com |
| WEBDRIVER_BASEURL_USER_FRIENDLY | http://localhost:8088/ | http://crish-demo.rimes.int/ |
| S3_PUBLIC_ENDPOINT_URL | http://localhost:9090 | https://s3-api.crish.rimes.int/ |
| EMAIL_REPORTS_CTA | (not set) | "Explore in CRISH" |
| Environment Tags | All hidden | All hidden |
| AUTH_USER_REGISTRATION_ROLE | 'FieldWorker' (in base) | FieldWorker' (in base) |
