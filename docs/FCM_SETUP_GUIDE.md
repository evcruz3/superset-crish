# Firebase Cloud Messaging (FCM) Setup Guide for Superset

This guide explains how to set up Firebase Cloud Messaging (FCM) to replace the webhook-based mobile app broadcast mechanism in Apache Superset.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Firebase Project Setup](#firebase-project-setup)
4. [Superset Configuration](#superset-configuration)
5. [Implementation Details](#implementation-details)
6. [Testing](#testing)
7. [Migration from Webhook](#migration-from-webhook)
8. [Troubleshooting](#troubleshooting)

## Overview

The FCM integration replaces the previous webhook-based mobile app broadcast system with direct push notifications through Firebase Cloud Messaging. This provides:

- Direct push notifications to mobile devices
- Better reliability and delivery tracking
- Support for topics, device tokens, and conditional targeting
- Rich notification features (images, actions, deep links)
- Cross-platform support (iOS, Android, Web)

## Prerequisites

- Firebase account (free tier is sufficient for testing)
- Python 3.9+ environment
- Access to Superset configuration files
- Mobile app with FCM integration (for receiving notifications)

## Firebase Project Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select an existing project
3. Follow the setup wizard

### 2. Generate Service Account Credentials

1. In Firebase Console, go to Project Settings (gear icon)
2. Navigate to "Service accounts" tab
3. Click "Generate new private key"
4. Save the downloaded JSON file securely

### 3. Enable Cloud Messaging

1. In Firebase Console, go to "Cloud Messaging" section
2. Note your Server Key and Sender ID for reference
3. Configure your mobile app with the appropriate configuration files:
   - Android: `google-services.json`
   - iOS: `GoogleService-Info.plist`

## Superset Configuration

### 1. Install Dependencies

The FCM dependency has been added to `pyproject.toml`:

```toml
dependencies = [
    # ... other dependencies ...
    "firebase-admin>=6.0.0, <7.0",
]
```

Install the updated dependencies:

```bash
pip install -e .
# or if using pip-compile
pip-compile && pip install -r requirements.txt
```

### 2. Configure FCM Credentials

Edit your `superset_config.py` file and add one of the following configurations:

#### Option A: Using Service Account File Path

```python
# Path to your Firebase service account JSON file
FCM_CREDENTIALS_PATH = "/path/to/your/firebase-service-account.json"
```

#### Option B: Using Environment Variable (Recommended for Production)

```python
import os
import json

# Load credentials from environment variable
FCM_CREDENTIALS_JSON = os.getenv("FCM_CREDENTIALS_JSON", "{}")
```

Then set the environment variable with your service account JSON:

```bash
export FCM_CREDENTIALS_JSON='{"type": "service_account", "project_id": "your-project", ...}'
```

### 3. Optional Configuration

```python
# Default topic for bulletin broadcasts
FCM_DEFAULT_TOPIC = "/topics/bulletins"

# Deep link base URL for your mobile app
FCM_DEEP_LINK_BASE = "yourapp://deeplink"
```

## Implementation Details

### File Structure

The FCM implementation consists of:

1. **`/superset/reports/notifications/fcm.py`**: FCM notification class for the reports framework
2. **`/superset/dissemination/fcm_helper.py`**: Helper class for bulletin dissemination
3. **`/superset/reports/models.py`**: Updated with `FCM` recipient type

### Sending Notifications

The system supports multiple targeting methods:

#### 1. Topic-based Broadcasting (Recommended for Bulletins)

```python
# Sends to all devices subscribed to the topic
target = "/topics/bulletins"
```

#### 2. Individual Device Tokens

```python
# Send to specific device
target = "device_fcm_token_here"
```

#### 3. Conditional Targeting

```python
# Send to devices that match conditions
target = "'TopicA' in topics && ('TopicB' in topics || 'TopicC' in topics)"
```

### Notification Payload

Each bulletin notification includes:

```json
{
  "notification": {
    "title": "Bulletin Title",
    "body": "Advisory preview..."
  },
  "data": {
    "bulletin_id": "123",
    "title": "Full Title",
    "advisory": "Complete advisory text",
    "risks": "Risk information",
    "safety_tips": "Safety tips",
    "type": "bulletin",
    "action": "VIEW_BULLETIN",
    "deep_link": "yourapp://bulletin/123"
  }
}
```

## Testing

### 1. Test FCM Configuration

Create a test script to verify FCM is working:

```python
from superset.dissemination.fcm_helper import FCMDisseminationHelper

# Test sending to a topic
success, message, data = FCMDisseminationHelper.send_bulletin_notification(
    bulletin_id=1,
    title="Test Bulletin",
    advisory="This is a test advisory",
    risks="Test risks",
    safety_tips="Test safety tips",
    target="/topics/test"
)

print(f"Success: {success}")
print(f"Message: {message}")
print(f"Data: {data}")
```

### 2. Test from Superset UI

1. Create a test bulletin
2. Select "Mobile App Broadcast" as dissemination channel
3. Submit and check logs for successful FCM delivery

### 3. Verify on Mobile Device

Ensure your mobile app:
1. Has FCM properly integrated
2. Is subscribed to the appropriate topics
3. Can handle the notification payload structure

## Migration from Webhook

### Removing Old Configuration

Remove or comment out the old webhook configuration:

```python
# MOBILE_APP_BROADCAST_WEBHOOK_URL = "https://your-webhook-url"
# MOBILE_APP_BROADCAST_SECRET = "your-secret"
```

### Database Considerations

The existing `DisseminatedBulletinLog` table structure remains compatible. The logs will now show:
- Channel: "mobile_app_broadcast" (unchanged)
- Details: FCM-specific success/failure messages
- Message body: FCM message ID and target information

## Troubleshooting

### Common Issues

1. **"FCM not properly initialized"**
   - Check credentials file path or JSON format
   - Verify service account has Cloud Messaging permissions

2. **"Failed to send FCM notification"**
   - Check internet connectivity
   - Verify Firebase project is active
   - Check notification payload size (max 4KB)

3. **Notifications not received on device**
   - Verify device token or topic subscription
   - Check app notification permissions
   - Review FCM message priority settings

### Debugging

Enable debug logging:

```python
import logging
logging.getLogger('superset.dissemination.fcm_helper').setLevel(logging.DEBUG)
logging.getLogger('superset.reports.notifications.fcm').setLevel(logging.DEBUG)
```

### FCM Dashboard

Monitor notification delivery in Firebase Console:
1. Go to Cloud Messaging section
2. Check "Reports" for delivery statistics
3. Use "Notifications composer" for testing

## Security Considerations

1. **Service Account Security**
   - Never commit service account JSON to version control
   - Use environment variables in production
   - Restrict service account permissions to minimum required

2. **Notification Content**
   - Avoid sending sensitive data in notification body
   - Use data payload for detailed information
   - Implement proper authentication in your mobile app

3. **Rate Limiting**
   - FCM has quotas for API calls
   - Implement retry logic with exponential backoff
   - Consider batching for multiple recipients

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [FCM Python Admin SDK Reference](https://firebase.google.com/docs/reference/admin/python/firebase_admin.messaging)
- [FCM Best Practices](https://firebase.google.com/docs/cloud-messaging/best-practices)