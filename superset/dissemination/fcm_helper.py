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
"""
Helper functions for Firebase Cloud Messaging integration in dissemination module
"""
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import firebase_admin
from firebase_admin import credentials, messaging
from flask import current_app

logger = logging.getLogger(__name__)


class FCMDisseminationHelper:
    """Helper class for FCM dissemination functionality"""
    
    _initialized = False
    
    @classmethod
    def initialize_fcm(cls) -> bool:
        """Initialize Firebase Admin SDK if not already initialized"""
        if cls._initialized:
            return True
            
        try:
            # Check if already initialized
            firebase_admin.get_app()
            cls._initialized = True
            return True
        except ValueError:
            # Not initialized, proceed with initialization
            config = current_app.config
            
            # Support both JSON string and file path configurations
            if config.get("FCM_CREDENTIALS_JSON"):
                try:
                    # Parse JSON credentials from config
                    cred_dict = json.loads(config["FCM_CREDENTIALS_JSON"])
                    cred = credentials.Certificate(cred_dict)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse FCM_CREDENTIALS_JSON: {e}")
                    return False
            elif config.get("FCM_CREDENTIALS_PATH"):
                try:
                    # Load from file path
                    cred = credentials.Certificate(config["FCM_CREDENTIALS_PATH"])
                except Exception as e:
                    logger.error(f"Failed to load FCM credentials from path: {e}")
                    return False
            else:
                logger.error(
                    "FCM credentials not configured. Set either FCM_CREDENTIALS_JSON "
                    "or FCM_CREDENTIALS_PATH in your configuration."
                )
                return False
            
            try:
                firebase_admin.initialize_app(cred)
                cls._initialized = True
                return True
            except Exception as e:
                logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
                return False
    
    @classmethod
    def send_bulletin_notification(
        cls,
        bulletin_id: int,
        title: str,
        advisory: str,
        risks: str,
        safety_tips: str,
        hashtags: Optional[str] = None,
        target: Optional[str] = None,
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Send bulletin notification via FCM
        
        Args:
            bulletin_id: ID of the bulletin
            title: Bulletin title
            advisory: Advisory text
            risks: Risks information
            safety_tips: Safety tips
            hashtags: Optional hashtags
            target: Optional specific target (token/topic). If None, uses default topic
            
        Returns:
            Tuple of (success, status_message, response_data)
        """
        if not cls.initialize_fcm():
            return False, "FCM not properly initialized", {}
        
        # Use default topic if no specific target provided
        if not target:
            target = current_app.config.get("FCM_DEFAULT_TOPIC", "/topics/bulletins")
        
        # Create notification content
        notification_title = title
        notification_body = advisory[:200] + "..." if len(advisory) > 200 else advisory
        
        # Create data payload
        data = {
            "bulletin_id": str(bulletin_id),
            "title": title,
            "advisory": advisory,
            "risks": risks,
            "safety_tips": safety_tips,
            "type": "bulletin",
            "action": "VIEW_BULLETIN",
        }
        
        if hashtags:
            data["hashtags"] = hashtags
        
        # Add deep link if configured
        deep_link_base = current_app.config.get("FCM_DEEP_LINK_BASE", "")
        if deep_link_base:
            data["deep_link"] = f"{deep_link_base}/bulletin/{bulletin_id}"
        
        # Ensure all data values are strings (FCM requirement)
        data = {k: str(v) for k, v in data.items()}
        
        try:
            # Create message
            # Add FCM analytics label for better reporting
            fcm_options = messaging.FCMOptions(
                analytics_label=f"bulletin_{bulletin_id}"
            )
            
            message_args = {
                "notification": messaging.Notification(
                    title=notification_title,
                    body=notification_body,
                ),
                "data": data,
                "fcm_options": fcm_options,
                "android": messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        icon="ic_notification",
                        color="#FF0000",
                        click_action="OPEN_BULLETIN",
                    ),
                ),
                "apns": messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(
                                title=notification_title,
                                body=notification_body,
                            ),
                            badge=1,
                            sound="default",
                            category="BULLETIN",
                        ),
                    ),
                ),
            }
            
            # Determine target type and add to message
            if target.startswith("/topics/"):
                message_args["topic"] = target.replace("/topics/", "")
                target_type = "topic"
            elif " " in target and ("'" in target or "in" in target):
                message_args["condition"] = target
                target_type = "condition"
            else:
                message_args["token"] = target
                target_type = "token"
            
            message = messaging.Message(**message_args)
            
            # Send the message
            response = messaging.send(message)
            
            return (
                True,
                f"Successfully sent to {target_type}: {target}",
                {
                    "message_id": response,
                    "target": target,
                    "target_type": target_type,
                }
            )
            
        except Exception as e:
            error_msg = f"Failed to send FCM notification: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg, {"error": str(e)}
    
    @classmethod
    def send_bulletin_multicast(
        cls,
        bulletin_id: int,
        title: str,
        advisory: str,
        risks: str,
        safety_tips: str,
        tokens: List[str],
        hashtags: Optional[str] = None,
    ) -> Tuple[int, int, List[str], List[str]]:
        """
        Send bulletin notification to multiple device tokens
        
        Args:
            bulletin_id: ID of the bulletin
            title: Bulletin title
            advisory: Advisory text
            risks: Risks information
            safety_tips: Safety tips
            tokens: List of FCM device tokens
            hashtags: Optional hashtags
            
        Returns:
            Tuple of (success_count, failure_count, successful_tokens, failed_tokens)
        """
        if not cls.initialize_fcm():
            return 0, len(tokens), [], tokens
        
        if not tokens:
            return 0, 0, [], []
        
        # Create notification content
        notification_title = title
        notification_body = advisory[:200] + "..." if len(advisory) > 200 else advisory
        
        # Create data payload
        data = {
            "bulletin_id": str(bulletin_id),
            "title": title,
            "advisory": advisory,
            "risks": risks,
            "safety_tips": safety_tips,
            "type": "bulletin",
            "action": "VIEW_BULLETIN",
        }
        
        if hashtags:
            data["hashtags"] = hashtags
        
        # Add deep link if configured
        deep_link_base = current_app.config.get("FCM_DEEP_LINK_BASE", "")
        if deep_link_base:
            data["deep_link"] = f"{deep_link_base}/bulletin/{bulletin_id}"
        
        # Ensure all data values are strings
        data = {k: str(v) for k, v in data.items()}
        
        try:
            # Create multicast message
            message = messaging.MulticastMessage(
                tokens=tokens,
                notification=messaging.Notification(
                    title=notification_title,
                    body=notification_body,
                ),
                data=data,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        icon="ic_notification",
                        color="#FF0000",
                        click_action="OPEN_BULLETIN",
                    ),
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(
                                title=notification_title,
                                body=notification_body,
                            ),
                            badge=1,
                            sound="default",
                            category="BULLETIN",
                        ),
                    ),
                ),
            )
            
            # Send multicast
            batch_response = messaging.send_multicast(message)
            
            # Process results
            successful_tokens = []
            failed_tokens = []
            
            for idx, response in enumerate(batch_response.responses):
                if response.success:
                    successful_tokens.append(tokens[idx])
                else:
                    failed_tokens.append(tokens[idx])
                    logger.error(
                        f"Failed to send to token {tokens[idx]}: {response.exception}"
                    )
            
            return (
                batch_response.success_count,
                batch_response.failure_count,
                successful_tokens,
                failed_tokens,
            )
            
        except Exception as e:
            logger.error(f"Failed to send FCM multicast: {str(e)}", exc_info=True)
            return 0, len(tokens), [], tokens