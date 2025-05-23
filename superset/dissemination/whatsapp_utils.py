import requests
import logging
from flask import current_app

logger = logging.getLogger(__name__)

def send_whatsapp_message(recipient_phone_number, message_template_name, template_params, access_token, phone_number_id):
    """
    Sends a WhatsApp message using the Meta Cloud API.
    """
    config = current_app.config
    api_version = config.get("WHATSAPP_CLOUD_API_VERSION", "v17.0") # Default to v17.0 if not set
    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "to": recipient_phone_number,
        "type": "template",
        "template": {
            "name": message_template_name,
            "language": {"code": "en"}, # Changed to "en" or your template's language code
            # template_params will be used to fill components if the template has variables
            # Example: "components": [{"type": "body", "parameters": [{"type": "text", "text": "param_value"}]}]
        },
    }

    # If template_params are provided, structure them for the API
    if template_params and isinstance(template_params, list) and all(isinstance(p, str) for p in template_params):
        components = []
        # Assuming the first param is for header (if present and template has header variable)
        # and the rest for body. This needs to align with how template_params are ordered in views.py
        # and how the WhatsApp template is structured (e.g. {{1}} in header, {{2}}, {{3}} in body)

        if len(template_params) > 0:
            # If there's more than one parameter, assume the first is for the header
            # and the template has a header component that accepts one text variable.
            # If only one parameter, assume it's for the body.
            # This logic needs to be robust based on actual template structures you use.
            
            header_params = []
            body_params = []

            if current_app.config.get("WHATSAPP_TEMPLATE_HAS_HEADER_VARIABLE", True) and len(template_params) >= 1:
                # Let's assume if there's one param, it could be header OR body depending on template.
                # For now, if there's only one, we will send it to body, unless config changes.
                # If template has header AND body variables, views.py must send at least two params.
                if len(template_params) > 1: # Simplistic: first for header, rest for body
                    header_params = [template_params[0]]
                    body_params = template_params[1:]
                elif len(template_params) == 1 and not current_app.config.get("WHATSAPP_TEMPLATE_PREFERS_SINGLE_PARAM_AS_HEADER", False):
                    # Single param, defaults to body unless configured otherwise
                    body_params = [template_params[0]]
                elif len(template_params) == 1 and current_app.config.get("WHATSAPP_TEMPLATE_PREFERS_SINGLE_PARAM_AS_HEADER", False):
                    header_params = [template_params[0]]
            else: # No header variable configured or no params to assign to header
                body_params = template_params

            if header_params:
                components.append({
                    "type": "header",
                    "parameters": [{"type": "text", "text": param} for param in header_params]
                })
            
            if body_params:
                components.append({
                    "type": "body",
                    "parameters": [{"type": "text", "text": param} for param in body_params]
                })

        if components:
            payload["template"]["components"] = components
        else:
            # This branch might be hit if template_params was not a list of strings or was empty after processing
            logger.info("No components added for WhatsApp template based on provided template_params.")

    elif template_params:
        # Logs if template_params is not None but also not a list of strings
        logger.warning("template_params were provided but not in the expected format (list of strings). Sending template without dynamic components.")

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4XX or 5XX)
        logger.info(f"WhatsApp message sent successfully to {recipient_phone_number}. Response: {response.json()}")
        return True, response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Error sending WhatsApp message to {recipient_phone_number}: {e}")
        if e.response is not None:
            logger.error(f"Response content: {e.response.text}")
            return False, e.response.json()
        return False, str(e)

# Placeholder for other functions to be implemented
def get_whatsapp_auth_token():
    # To be implemented: Retrieve token from config
    pass

def send_whatsapp_media_message(recipient_phone_number, message_template_name, template_params, media_id_or_url, access_token, phone_number_id):
    # To be implemented
    pass 