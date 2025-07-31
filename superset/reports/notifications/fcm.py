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
import json
import logging
from typing import Any, Dict, List, Optional, Union

import firebase_admin
from firebase_admin import credentials, messaging
from flask import current_app

from superset import app
from superset.exceptions import SupersetException
from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import NotificationError
from superset.utils.decorators import statsd_gauge

logger = logging.getLogger(__name__)


class FCMNotificationError(NotificationError):
    pass


class FCMNotification(BaseNotification):
    """
    Firebase Cloud Messaging implementation for push notifications
    """

    type = ReportRecipientType.FCM

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._initialize_fcm()

    def _initialize_fcm(self) -> None:
        """Initialize Firebase Admin SDK if not already initialized"""
        try:
            # Check if already initialized
            firebase_admin.get_app()
        except ValueError:
            # Not initialized, proceed with initialization
            config = app.config
            
            # Support both JSON string and file path configurations
            if config.get("FCM_CREDENTIALS_JSON"):
                # Parse JSON credentials from config
                cred_dict = json.loads(config["FCM_CREDENTIALS_JSON"])
                cred = credentials.Certificate(cred_dict)
            elif config.get("FCM_CREDENTIALS_PATH"):
                # Load from file path
                cred = credentials.Certificate(config["FCM_CREDENTIALS_PATH"])
            else:
                raise FCMNotificationError(
                    "FCM credentials not configured. Set either FCM_CREDENTIALS_JSON "
                    "or FCM_CREDENTIALS_PATH in your configuration."
                )
            
            firebase_admin.initialize_app(cred)

    def _create_notification(self) -> messaging.Notification:
        """Create FCM notification object from content"""
        title = self._content.name or "Superset Notification"
        body = self._content.text or self._content.description or ""
        
        return messaging.Notification(
            title=title,
            body=body,
        )

    def _create_data_payload(self) -> Dict[str, str]:
        """Create custom data payload for the notification"""
        data = {}
        
        if self._content.url:
            data["url"] = self._content.url
        
        if self._content.description:
            data["description"] = self._content.description
        
        # Add any additional custom data from recipient config
        if hasattr(self._recipient, "recipient_config_json"):
            try:
                config = json.loads(self._recipient.recipient_config_json or "{}")
                if isinstance(config.get("custom_data"), dict):
                    data.update(config["custom_data"])
            except json.JSONDecodeError:
                logger.warning("Invalid recipient config JSON")
        
        # FCM requires all data values to be strings
        return {k: str(v) for k, v in data.items()}

    def _get_target(self) -> Union[str, List[str]]:
        """
        Get the FCM target (token, topic, or condition) from recipient config
        """
        try:
            config = json.loads(self._recipient.recipient_config_json or "{}")
        except json.JSONDecodeError:
            raise FCMNotificationError("Invalid recipient configuration")
        
        # Support different targeting methods
        if config.get("token"):
            return config["token"]
        elif config.get("tokens"):
            return config["tokens"]
        elif config.get("topic"):
            return config["topic"]
        elif config.get("condition"):
            return config["condition"]
        else:
            raise FCMNotificationError(
                "No FCM target specified. Provide token, tokens, topic, or condition."
            )

    def _create_message(self) -> Union[messaging.Message, messaging.MulticastMessage]:
        """Create the FCM message based on target type"""
        notification = self._create_notification()
        data = self._create_data_payload()
        
        config = json.loads(self._recipient.recipient_config_json or "{}")
        target = self._get_target()
        
        # Common message configuration
        android_config = None
        apns_config = None
        web_push_config = None
        
        # Android-specific configuration
        if config.get("android"):
            android_config = messaging.AndroidConfig(
                priority=config["android"].get("priority", "high"),
                ttl=config["android"].get("ttl"),
                notification=messaging.AndroidNotification(
                    icon=config["android"].get("icon"),
                    color=config["android"].get("color"),
                    sound=config["android"].get("sound"),
                )
            )
        
        # iOS-specific configuration
        if config.get("apns"):
            apns_config = messaging.APNSConfig(
                headers=config["apns"].get("headers", {}),
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(
                            title=notification.title,
                            body=notification.body,
                        ),
                        badge=config["apns"].get("badge"),
                        sound=config["apns"].get("sound"),
                        content_available=config["apns"].get("content_available"),
                    )
                )
            )
        
        # Handle different target types
        if isinstance(target, list):
            # Multiple tokens - use multicast
            return messaging.MulticastMessage(
                tokens=target,
                notification=notification,
                data=data,
                android=android_config,
                apns=apns_config,
                webpush=web_push_config,
            )
        elif target.startswith("/topics/"):
            # Topic
            return messaging.Message(
                topic=target.replace("/topics/", ""),
                notification=notification,
                data=data,
                android=android_config,
                apns=apns_config,
                webpush=web_push_config,
            )
        elif " " in target and ("'" in target or "in" in target):
            # Condition
            return messaging.Message(
                condition=target,
                notification=notification,
                data=data,
                android=android_config,
                apns=apns_config,
                webpush=web_push_config,
            )
        else:
            # Single token
            return messaging.Message(
                token=target,
                notification=notification,
                data=data,
                android=android_config,
                apns=apns_config,
                webpush=web_push_config,
            )

    @statsd_gauge("fcm_notification.send")
    def send(self) -> None:
        """Send the FCM notification"""
        logger.info("Sending FCM notification")
        
        try:
            message = self._create_message()
            
            if isinstance(message, messaging.MulticastMessage):
                # Send multicast message
                response = messaging.send_multicast(message)
                
                if response.failure_count > 0:
                    failed_tokens = []
                    for idx, resp in enumerate(response.responses):
                        if not resp.success:
                            failed_tokens.append(message.tokens[idx])
                            logger.error(
                                f"Failed to send to token {message.tokens[idx]}: "
                                f"{resp.exception}"
                            )
                    
                    if response.success_count == 0:
                        raise FCMNotificationError(
                            f"Failed to send to all {response.failure_count} recipients"
                        )
                    else:
                        logger.warning(
                            f"Partially sent: {response.success_count} succeeded, "
                            f"{response.failure_count} failed"
                        )
                
                logger.info(
                    f"FCM multicast notification sent successfully to "
                    f"{response.success_count} recipients"
                )
            else:
                # Send single message
                response = messaging.send(message)
                logger.info(f"FCM notification sent successfully. Message ID: {response}")
                
        except Exception as ex:
            logger.exception("Failed to send FCM notification")
            raise FCMNotificationError(str(ex)) from ex


def send_fcm_notification(
    tokens: Union[str, List[str]],
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    **kwargs: Any
) -> None:
    """
    Utility function to send FCM notification directly without report context
    
    Args:
        tokens: Single token string, list of tokens, topic, or condition
        title: Notification title
        body: Notification body
        data: Optional custom data payload
        **kwargs: Additional FCM configuration options
    """
    try:
        # Initialize FCM if needed
        try:
            firebase_admin.get_app()
        except ValueError:
            config = current_app.config
            if config.get("FCM_CREDENTIALS_JSON"):
                cred_dict = json.loads(config["FCM_CREDENTIALS_JSON"])
                cred = credentials.Certificate(cred_dict)
            elif config.get("FCM_CREDENTIALS_PATH"):
                cred = credentials.Certificate(config["FCM_CREDENTIALS_PATH"])
            else:
                raise FCMNotificationError("FCM credentials not configured")
            firebase_admin.initialize_app(cred)
        
        # Create notification
        notification = messaging.Notification(title=title, body=body)
        
        # Prepare data payload
        if data:
            data = {k: str(v) for k, v in data.items()}
        
        # Determine message type and send
        if isinstance(tokens, list):
            message = messaging.MulticastMessage(
                tokens=tokens,
                notification=notification,
                data=data,
                **kwargs
            )
            response = messaging.send_multicast(message)
            logger.info(f"Sent to {response.success_count} devices")
        else:
            # Single token, topic, or condition
            message_args = {
                "notification": notification,
                "data": data,
                **kwargs
            }
            
            if tokens.startswith("/topics/"):
                message_args["topic"] = tokens.replace("/topics/", "")
            elif " " in tokens and ("'" in tokens or "in" in tokens):
                message_args["condition"] = tokens
            else:
                message_args["token"] = tokens
            
            message = messaging.Message(**message_args)
            response = messaging.send(message)
            logger.info(f"Message sent: {response}")
            
    except Exception as ex:
        logger.exception("Failed to send FCM notification")
        raise FCMNotificationError(str(ex)) from ex