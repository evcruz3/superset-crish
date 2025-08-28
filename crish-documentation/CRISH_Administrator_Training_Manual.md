# CRISH Platform Administrator Training Manual

<!-- Updated and fact-checked August 22, 2025 - HealthOfficial role implementation -->

## Document Version: 1.0
## Date: August 2025
## Target Audience: System Administrators
## Languages: English | Português | Tetum

---

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture Overview](#system-architecture-overview)
3. [Installation and Setup](#installation-and-setup)
4. [User Management](#user-management)
5. [System Configuration](#system-configuration)
6. [Database Management](#database-management)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Backup and Recovery](#backup-and-recovery)
9. [Security Management](#security-management)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Quick Reference](#quick-reference)

---

## Introduction

Welcome to the CRISH Administrator Training Manual. This comprehensive guide provides system administrators with the knowledge and tools needed to effectively manage, maintain, and troubleshoot the Climate Resilient Infrastructure and System for Health (CRISH) - a customized Apache Superset-based platform.

### Training Objectives
Upon completion of this training, administrators will be able to:
- Deploy and configure the CRISH platform
- Manage users and permissions
- Monitor system performance
- Perform routine maintenance tasks
- Troubleshoot common issues
- Implement security best practices

### Prerequisites
- Basic Linux/Unix command line knowledge
- Understanding of Docker containers
- Familiarity with PostgreSQL databases
- Network administration basics

---

## System Architecture Overview

### Component Architecture
```
┌─────────────────────────────────────────────────────────┐
│            CRISH (Apache Superset-based)                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Frontend   │  │Apache Superset│  │   Database   │  │
│  │   (React)    │  │   (Flask)     │  │ (PostgreSQL) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Redis     │  │   Celery     │  │    MinIO     │  │
│  │   (Cache)    │  │  (Workers)   │  │ (Object Store)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Disease     │  │Weather Forecast│  │  Nginx      │  │
│  │ Predictor    │  │   Puller      │  │ (Proxy)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Key Services
1. **Apache Superset**: Main application server with CRISH customizations
2. **PostgreSQL**: Primary database
3. **Redis**: Caching and session management
4. **Celery**: Asynchronous task processing (workers and beat scheduler)
5. **MinIO**: Object storage for attachments and files
6. **Nginx**: Reverse proxy
7. **Disease Predictor**: CRISH-specific service for health predictions
8. **Weather Forecast Puller**: Service for weather data integration
9. **Case Reports Initializer**: Service for initializing health case data

---

## Installation and Setup

### System Requirements
- **OS**: Ubuntu 20.04 LTS or later
- **CPU**: Minimum 4 cores, recommended 8 cores
- **RAM**: Minimum 8GB, recommended 16GB
- **Storage**: Minimum 100GB SSD
- **Network**: Stable internet connection

### Installation Steps

#### 1. Access CRISH Repository
```bash
# Clone the CRISH-customized Apache Superset repository
# Contact your system administrator for the correct repository URL
# Example (replace with actual repository):
# git clone <your-crish-superset-repository-url>
# cd superset
```

#### 2. Install Docker and Docker Compose
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 3. Configure Environment
```bash
# Copy environment template
cp docker/.env docker/.env-local

# Edit configuration
nano docker/.env-local
```

Key environment variables:
```
# Database Configuration
DATABASE_DB=superset
DATABASE_USER=superset
DATABASE_PASSWORD=<secure_password>
DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_DIALECT=postgresql

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Application Settings
SUPERSET_SECRET_KEY=<generate_secure_key>
SUPERSET_ENV=production
SUPERSET_LOAD_EXAMPLES=no

# MinIO Configuration
MINIO_ROOT_USER=<minio_admin_user>
MINIO_ROOT_PASSWORD=<secure_minio_password>
S3_BUCKET=crish-attachments
```

#### 4. Deploy Application
```bash
# Build and start services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

#### 5. Initialize Database
```bash
# Run database migrations
docker-compose exec superset superset db upgrade

# Create admin user
docker-compose exec superset superset fab create-admin \
  --username admin \
  --firstname Superset \
  --lastname Admin \
  --email admin@superset.com \
  --password <secure_password>

# Initialize application
docker-compose exec superset superset init
```

---

## User Management

### User Roles and Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| Admin | Full system access | All operations (Superset built-in role) |
| Alpha | Advanced user access | Create and edit dashboards, access SQL Lab |
| HealthOfficial | CRISH health data access | All Gamma + SQL Lab + health dataset access + user profile editing |
| Gamma | Standard user access | View dashboards and charts |
| Public | Read-only access | View public dashboards |
| sql_lab | SQL Lab access | Execute SQL queries |

**Note**: CRISH includes a custom **HealthOfficial** role that is automatically created during system initialization. This role provides health officials with appropriate access to health-related datasets and functionality while maintaining security boundaries. Other custom roles can be created through the Security menu in the web interface.

### Creating Users

#### Via Web Interface
1. Navigate to Security → List Users
2. Click "+" button
3. Fill user information:
   - Username
   - First/Last name
   - Email
   - Password
   - Roles
4. Save user

#### Via Command Line
```bash
# Create user
docker-compose exec superset superset fab create-user \
  --role HealthOfficial \
  --username john_doe \
  --firstname John \
  --lastname Doe \
  --email john@health.tl \
  --password TempPass123

# List users
docker-compose exec superset superset fab list-users

# Reset password
docker-compose exec superset superset fab reset-password \
  --username john_doe \
  --password NewPass456
```

### Managing Permissions

#### Role-Based Access Control
```python
# CRISH Custom Security Manager
# Located in: docker/pythonpath_dev/custom_auth/custom_security_manager.py

from superset.security.manager import SupersetSecurityManager
from .custom_user_models import CustomUser, CustomRegisterUser

class CustomSecurityManager(SupersetSecurityManager):
    """Custom security manager with additional user fields and HealthOfficial role"""
    user_model = CustomUser
    registeruser_model = CustomRegisterUser
    
    # Additional user fields: position, contact_number, gender_preference,
    # age_category, has_disability, disability_type
    
    # HealthOfficial role configuration
    HEALTH_OFFICIAL_PERMISSIONS = {
        "can_write", "can_add", "can_edit"  # Allow editing health data
    }
    
    HEALTH_OFFICIAL_VIEW_MENUS = {
        "disease_forecast_alert", "weather_forecast_alerts", 
        "health_facilities", "bulletins_and_advisories",
        "email_groups", "whatsapp_groups", "weather_forecasts",
        "air_quality_forecasts", "disease_pipeline_run_history"
    }
    
    def _is_health_official_pvm(self, pvm):
        """Determines if a permission is granted to HealthOfficial role"""
        # Grants access to health datasets, SQL Lab, and user profile editing
        # See full implementation in the source code
```

**HealthOfficial Role Implementation Details:**
- **Automatic Creation**: The role is automatically created during `superset init`
- **Health Dataset Access**: Uses pattern matching to grant access to health-related datasets
- **Database Pattern Matching**: Grants access to datasets in the `[Superset].*` database
- **Permission Inheritance**: Includes all Gamma permissions plus SQL Lab access
- **Self-Service**: Users can edit their own profiles and reset passwords

#### Permission Matrix
| Feature | Admin | Alpha | HealthOfficial | Gamma | Public |
|---------|-------|-------|----------------|-------|--------|
| View Dashboards | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create/Edit Charts | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create/Edit Dashboards | ✓ | ✓ | ✓ | ✓ | ✗ |
| SQL Lab Access | ✓ | ✓ | ✓ | ✗ | ✗ |
| Health Dataset Access | ✓ | ✓ | ✓ | ✗ | ✗ |
| Database Connections | ✓ | ✓ | ✓ | ✓ | ✗ |
| User Profile Edit | ✓ | ✓ | ✓ | ✓ | ✗ |
| Manage Users | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manage Datasets | ✓ | ✓ | ✗ | ✗ | ✗ |
| System Config | ✓ | ✗ | ✗ | ✗ | ✗ |

**Key HealthOfficial Role Features:**
- **Automatic Health Dataset Access**: Grants access to all health-related datasets in the Superset database (disease forecasts, weather alerts, case reports, etc.)
- **SQL Lab Access**: Full SQL Lab functionality for health data analysis
- **Database Connection Access**: Can view and use database connections
- **User Profile Editing**: Can edit their own user profile information
- **All Gamma Permissions**: Inherits all standard user permissions (view/create charts and dashboards)

---

## System Configuration

### Application Settings

#### 1. General Configuration
```python
# docker/pythonpath_dev/superset_config_docker.py

# Application name (set in Docker config)
APP_NAME = "CRISH Health DSS"

# Note: Theme configuration is handled through CSS customizations
# in the frontend rather than Python config

# Language settings
LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "pt_TL": {"flag": "pt", "name": "Timorese Portuguese"},
    "id": {"flag": "tl", "name": "Tetum"},
}
```

#### 2. Performance Tuning
```python
# Note: Workers are DISABLED in CRISH configuration
# All queries run synchronously to avoid complexity

# Query limits
ROW_LIMIT = 50000
SQL_MAX_ROW = 100000

# Cache configuration
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": "redis",
    "CACHE_REDIS_PORT": 6379,
}
```

#### 3. Feature Flags
```python
# IMPORTANT: Workers are disabled in CRISH
FEATURE_FLAGS = {
    "ALERT_REPORTS": False,  # Disable scheduled reports and alerts
    "ALERT_REPORT_TABS": False,  # Hide alert/report tabs in UI
    "THUMBNAILS": False,  # Disable thumbnail generation
    "ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS": False,  # Disable dashboard screenshots
    "GLOBAL_ASYNC_QUERIES": False,  # Disable async queries globally
    "SQLLAB_FORCE_RUN_ASYNC": False,  # Don't force async in SQL Lab
    "ENABLE_TEMPLATE_PROCESSING": True,  # Keep template processing (doesn't need workers)
}

# Celery is completely disabled
CELERY_CONFIG = None
```

### Email Configuration
```python
# Email settings
SMTP_HOST = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_USER = 'crish-notifications@gmail.com'
SMTP_PASSWORD = '<app_password>'
SMTP_MAIL_FROM = 'crish-notifications@gmail.com'
```

### External Service Integration
```python
# WhatsApp Business API Configuration
WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0'
WHATSAPP_ACCESS_TOKEN = '<access_token>'
WHATSAPP_PHONE_ID = '<phone_number_id>'

# Facebook API Configuration
FACEBOOK_PAGE_ACCESS_TOKEN = '<page_access_token>'
FACEBOOK_PAGE_ID = '<page_id>'

# Email Configuration for Dissemination
EMAIL_REPORTS_SUBJECT_PREFIX = "[CRISH Alert] "
```

**Note**: 
- Weather data integration uses Visual Crossing API (configure VISUAL_CROSSING_API_KEY)
- Disease prediction models are stored in /app/dengueModels and /app/diarrheaModels
- CRISH includes custom dissemination features for WhatsApp and Facebook

---

## Database Management

### Database Operations

#### 1. Backup Procedures
```bash
# Manual backup
docker-compose exec db pg_dump -U superset superset > backup_$(date +%Y%m%d_%H%M%S).sql

# Example automated backup script (needs implementation)
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="superset"
DB_USER="superset"

# Create backup
docker-compose exec -T db pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/backup_$TIMESTAMP.sql

# Compress backup
gzip $BACKUP_DIR/backup_$TIMESTAMP.sql

# Remove old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

#### 2. Database Maintenance
```sql
-- Analyze tables for query optimization
ANALYZE;

-- Vacuum to reclaim space
VACUUM FULL;

-- Reindex for performance
REINDEX DATABASE superset;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### 3. Performance Monitoring
```sql
-- Active connections
SELECT pid, usename, application_name, client_addr, state 
FROM pg_stat_activity;

-- Slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Database size
SELECT pg_database_size('superset')/1024/1024 as size_mb;
```

---

## Monitoring and Maintenance

### System Monitoring

#### 1. Resource Monitoring
```bash
# CPU and Memory usage
docker stats --no-stream

# Disk usage
df -h

# Container logs
docker-compose logs -f --tail=100 superset

# System load
uptime
```

#### 2. Application Monitoring
```python
# Simple health check endpoint (actual implementation)
@app.route("/health")
@app.route("/healthcheck")
@app.route("/ping")
def health():
    return "OK"
```

**Note**: The current health check is a simple endpoint that only returns "OK". For production monitoring, consider implementing additional checks for database connectivity, Redis status, and disk space.

#### 3. Alert Configuration
```yaml
# Prometheus alerts
groups:
  - name: crish_alerts
    rules:
      - alert: HighCPUUsage
        expr: cpu_usage > 80
        for: 5m
        annotations:
          summary: "High CPU usage detected"
          
      - alert: LowDiskSpace
        expr: disk_free < 10
        for: 10m
        annotations:
          summary: "Low disk space warning"
```

### Routine Maintenance Tasks

#### Daily Tasks
- [ ] Check system logs for errors
- [ ] Verify backup completion
- [ ] Monitor disk space
- [ ] Review user activity

#### Weekly Tasks
- [ ] Update system packages
- [ ] Clean temporary files
- [ ] Review performance metrics
- [ ] Test backup restoration

#### Monthly Tasks
- [ ] Security updates
- [ ] Database optimization
- [ ] Certificate renewal check
- [ ] Capacity planning review

---

## Backup and Recovery

### Backup Strategy

#### 1. Full System Backup

**Note**: The backup scripts shown below are examples that need to be implemented. They are not currently included in the CRISH codebase.

```bash
#!/bin/bash
# Example full backup script (needs implementation)

BACKUP_ROOT="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker-compose exec -T db pg_dump -U superset superset > $BACKUP_ROOT/db/superset_$DATE.sql

# Application files
tar -czf $BACKUP_ROOT/files/app_$DATE.tar.gz /app/superset

# Configuration
tar -czf $BACKUP_ROOT/config/config_$DATE.tar.gz /app/docker

# MinIO data (Note: MinIO runs on ports 9090:9000 and 9091:9001)
# Access MinIO console at http://localhost:9091
# Note: MinIO mc client needs to be configured first
docker-compose exec -T minio mc mirror minio/crish-attachments $BACKUP_ROOT/minio/
```

#### 2. Incremental Backup
```bash
# Example incremental backup (needs implementation)
rsync -avz --delete /app/superset/ /backup/incremental/
```

### Recovery Procedures

#### 1. Database Recovery
```bash
# Stop application
docker-compose stop superset

# Restore database
docker-compose exec -T db psql -U superset superset < backup.sql

# Start application
docker-compose start superset
```

#### 2. Full System Recovery
```bash
# Restore application files
tar -xzf app_backup.tar.gz -C /

# Restore configuration
tar -xzf config_backup.tar.gz -C /

# Restore database
docker-compose exec -T db psql -U superset superset < db_backup.sql

# Restart all services
docker-compose restart
```

---

## Security Management

### Security Best Practices

#### 1. Access Control
- Use strong passwords (minimum 12 characters)
- Enable two-factor authentication
- Regular password rotation (90 days)
- Principle of least privilege

#### 2. Network Security
```bash
# Firewall configuration
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

#### 3. SSL/TLS Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name crish.gov.tl;
    
    ssl_certificate /etc/ssl/certs/crish.crt;
    ssl_certificate_key /etc/ssl/private/crish.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

### Security Auditing

#### 1. Access Logs
```bash
# Review access logs
tail -f /var/log/nginx/access.log

# Failed login attempts
grep "Failed login" /app/logs/superset.log
```

#### 2. Security Scanning
```bash
# Vulnerability scanning
docker scan crish/superset:latest

# Dependency checking
pip-audit -r requirements.txt
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Service Won't Start
```bash
# Check logs
docker-compose logs superset

# Common fixes:
# - Check port conflicts
sudo netstat -tulpn | grep :8088

# - Verify environment variables
docker-compose config

# - Rebuild containers
docker-compose build --no-cache
```

#### 2. Database Connection Issues
```bash
# Test connection
docker-compose exec superset python -c "
from superset import db
print(db.engine.execute('SELECT 1').scalar())
"

# Common fixes:
# - Check credentials
# - Verify network connectivity
# - Restart database service
docker-compose restart db
```

#### 3. Performance Issues
```bash
# Check resource usage
docker stats

# Common optimizations:
# - Increase worker count
# - Add Redis cache
# - Optimize database queries
# - Enable query result caching
```

#### 4. HealthOfficial Role Issues
```bash
# Check if HealthOfficial role was created
docker-compose exec superset python -c "
from superset import security_manager
roles = security_manager.find_role('HealthOfficial')
print('HealthOfficial role exists:', roles is not None)
"

# Recreate HealthOfficial role
docker-compose exec superset superset init

# Check user's roles
docker-compose exec superset python -c "
from superset import security_manager
user = security_manager.find_user('username')
print('User roles:', [r.name for r in user.roles])
"
```

**Common HealthOfficial Issues:**
- **Role not created**: Run `superset init` to create the role automatically
- **Access denied to health datasets**: Check logs for `[HealthOfficial]` entries
- **Can't edit profile**: Verify UserInfoEditView permissions are granted
- **Missing health data**: Ensure datasets are in the Superset database

### Error Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| ERR_001 | Database connection failed | Check DB credentials and network |
| ERR_002 | Redis connection timeout | Verify Redis service is running |
| ERR_003 | Insufficient memory | Increase system RAM or optimize queries |
| ERR_004 | API rate limit exceeded | Implement caching or request throttling |
| ERR_005 | HealthOfficial role access denied | Check role exists and user assignment |

---

## Quick Reference

### Essential Commands

```bash
# Service Management
docker-compose up -d              # Start all services
docker-compose down              # Stop all services
docker-compose restart superset  # Restart specific service
docker-compose logs -f           # View logs

# Database Operations
docker-compose exec superset superset db upgrade  # Run migrations
docker-compose exec db psql -U superset       # Database console

# User Management
docker-compose exec superset superset fab create-admin  # Create admin
docker-compose exec superset superset fab list-users    # List users

# Maintenance
docker system prune -a          # Clean unused resources
docker-compose pull            # Update images
```

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| docker-compose.yml | Service definitions | ./docker-compose.yml |
| superset_config.py | Application config | ./docker/pythonpath_dev/superset_config.py |
| .env | Environment variables | ./docker/.env |
| .env-local | Local environment overrides | ./docker/.env-local |
| nginx.conf | Web server config | ./docker/nginx/nginx.conf |

### Support Contacts

- **Technical Support**: Contact your system administrator
- **Documentation**: Local documentation and Apache Superset docs
- **Issue Tracker**: Contact development team
- **Apache Superset Documentation**: https://superset.apache.org/docs/

---

## Hands-on Exercises

### Exercise 1: HealthOfficial User Creation
1. Create a new health official user with the HealthOfficial role:
   ```bash
   docker-compose exec superset superset fab create-user \
     --role HealthOfficial \
     --username dr_silva \
     --firstname Maria \
     --lastname Silva \
     --email maria.silva@health.tl \
     --password TempPass123
   ```
2. Test login and verify permissions:
   - Login to the web interface
   - Check access to Database Connections menu
   - Verify SQL Lab functionality
   - Test user profile editing
   - Confirm access to health datasets only

### Exercise 2: Backup and Restore
1. Create a manual backup
2. Delete test data
3. Restore from backup
4. Verify data integrity

### Exercise 3: Performance Monitoring
1. Generate load on the system
2. Monitor resource usage
3. Identify bottlenecks
4. Implement optimization

### Exercise 4: Security Audit
1. Review access logs
2. Check for failed login attempts
3. Verify SSL configuration
4. Run security scan

---

## Additional Resources

### CRISH Documentation
- CRISH Field Worker Training Manual
- CRISH Health Official Training Manual  
- CRISH Quick Reference Guide
- CRISH Test Plans
- Technical Progress Reports

### External Resources
- [Docker Official Documentation](https://docs.docker.com/)
- [PostgreSQL Administration Guide](https://www.postgresql.org/docs/)
- [Apache Superset Documentation](https://superset.apache.org/docs/)

---

*This training manual is a living document and will be updated regularly to reflect system changes and improvements.*