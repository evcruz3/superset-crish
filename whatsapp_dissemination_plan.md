# Plan to Extend Bulletin Dissemination to WhatsApp

This document outlines the plan to extend the existing bulletin dissemination feature in Superset to allow sending messages via the WhatsApp Business API.

**Phase 1: Backend Changes**

1.  **WhatsApp API Integration (Using Meta Cloud API):**
    *   We will use **Meta's Cloud API** for WhatsApp integration, leveraging the existing Meta for Developers platform.
    *   Create a new Python module: `superset/dissemination/whatsapp_utils.py`.
        *   This module will encapsulate all WhatsApp Cloud API interactions.
        *   It should primarily use the `requests` Python library for making direct HTTP calls to the Cloud API.
    *   Implement core functions within `whatsapp_utils.py`:
        *   `get_whatsapp_auth_token()`: To retrieve the permanent System User Access Token from configuration or a secure source.
        *   `send_whatsapp_message(recipient_phone_number, message_template_name, template_params, access_token, phone_number_id)`: To send a pre-approved template message.
        *   `send_whatsapp_media_message(recipient_phone_number, message_template_name, template_params, media_id_or_url, access_token, phone_number_id)`: If sending messages with media. This might involve uploading media to WhatsApp first to get a media ID or using a publicly accessible URL.
    *   Implement a helper function to get user phone numbers. This might involve a new model field or a lookup mechanism if phone numbers are stored elsewhere.

2.  **Configuration:**
    *   Add new configuration options to `superset_config.py`:
        *   `WHATSAPP_CLOUD_API_VERSION`: (e.g., "v17.0") The version of the Graph API being used.
        *   `WHATSAPP_PHONE_NUMBER_ID`: The ID of the phone number sending messages.
        *   `WHATSAPP_BUSINESS_ACCOUNT_ID`: Your WhatsApp Business Account ID.
        *   `WHATSAPP_ACCESS_TOKEN`: The permanent System User Access Token for the Cloud API.
        *   `WHATSAPP_DEFAULT_TEMPLATE_NAME`: The name of the default pre-approved message template for bulletins.
        *   `WHATSAPP_BULLETIN_RECIPIENTS`: A list of phone numbers or a group ID to send bulletins to. **Crucially, ensure these users have opted-in to receive messages.**

3.  **Modify `DisseminateBulletinView` (in `superset/dissemination/views.py`):**
    *   **Form Update:**
        *   Modify `DisseminationForm` (likely in `superset/dissemination/forms.py`) to update the `dissemination_channels` field to include "WhatsApp".
        *   **(Optional)** Add a field to select specific WhatsApp recipients or groups if not using a predefined list from config. This requires careful consideration of user opt-in and privacy.
    *   **Processing Logic Update:**
        *   In the `form` method of `DisseminateBulletinView`, after `form.validate_on_submit()`:
            *   Check the selected `dissemination_channels`.
            *   If "WhatsApp" is selected:
                *   Retrieve the bulletin details (title, advisory, a short summary, URL to the bulletin).
                *   Fetch WhatsApp configuration values from `app.config`.
                *   Instantiate the WhatsApp API client using `whatsapp_utils.authenticate_whatsapp_api`.
                *   Retrieve recipient phone numbers (ensure opt-in).
                *   For each recipient, call `whatsapp_utils.send_whatsapp_message` (or `send_whatsapp_media_message`) using the pre-approved template name and filling in parameters (e.g., bulletin title, URL).
                *   Handle success and failure scenarios, providing appropriate flash messages to the user.

4.  **Logging:**
    *   Update the `DisseminatedBulletinLog` model (in `superset/models/dissemination.py`):
        *   Ensure the `channel` field can accommodate "whatsapp" (e.g., extend possible values to "email", "facebook", "whatsapp", "email_and_facebook_and_whatsapp", etc.).
        *   Consider if the existing structure is sufficient or if a more detailed logging mechanism for multi-channel posts is needed.
    *   Update the logging logic in `DisseminateBulletinView` to:
        *   Populate the `channel` field correctly when creating a `DisseminatedBulletinLog` entry.
        *   Log recipient phone numbers and delivery status if possible (API responses might provide this).

**Phase 2: Frontend Changes**

1.  **Update Dissemination Form Template (`superset/templates/dissemination/disseminate_form.html`):**
    *   Ensure the `dissemination_channels` field in the form correctly renders the "WhatsApp" option.
    *   Ensure the form correctly submits "WhatsApp" as a selected channel.
2.  **(Optional) User Opt-In Management:**
    *   If not managing opt-ins externally, a simple interface might be needed within Superset for users to subscribe/unsubscribe from WhatsApp bulletin notifications, or for administrators to manage the recipient list. This is a significant feature and should be planned carefully regarding data privacy and consent.

**Phase 3: WhatsApp Business API Setup and Configuration (Using Meta Cloud API)**

This phase involves setting up a WhatsApp Business Account (WABA) via the Meta for Developers platform and configuring message templates.

1.  **Leverage Existing Meta for Developers Setup:**
    *   Since you already have a Meta for Developers app for Facebook, you will manage the WhatsApp integration within the same app or create a new one under your existing Business Manager.
    *   The primary choice is to use **Meta's Cloud API**, which is directly managed through the Meta for Developers portal.

2.  **Set up/Verify Meta Business Manager:**
    *   Go to `business.facebook.com`.
    *   Create or use an existing Business Manager account. This is required to manage your WhatsApp Business Account.

3.  **Create a WhatsApp Business Account (WABA):**
    *   Within your Meta Business Manager, navigate to "Business Settings" > "Accounts" > "WhatsApp Accounts".
    *   Click "Add" and follow the steps to create a new WABA or connect an existing one. This will involve verifying your business.

4.  **Choose and Verify Phone Number:**
    *   You need a dedicated phone number for the WhatsApp Cloud API. This number must not be actively used on another WhatsApp account (personal or Business App).
    *   You can use an existing phone number (after disconnecting it from any WhatsApp app) or get a new one.
    *   The phone number needs to be registered and verified with Meta through your WhatsApp Business Account.

5.  **Connect to the Meta Cloud API:**
    *   In your Meta App Dashboard (`developers.facebook.com`):
        *   Select your existing app or create a new one for this purpose.
        *   Add the "WhatsApp" product to your app if not already present.
        *   Navigate to "WhatsApp" > "API Setup" (or similar, the interface may change).
        *   Here you will find your `Phone Number ID` and your `WhatsApp Business Account ID`.
        *   You will need to generate a **permanent System User Access Token**. Follow Meta's documentation for creating a System User in your Business Manager and then generating a token for that user with the `whatsapp_business_management` and `whatsapp_business_messaging` permissions. This token is long-lived and should be stored securely.
        *   Store the `Access Token`, `Phone Number ID`, `WhatsApp Business Account ID`, and the chosen Cloud API version (e.g., `v17.0`) in `superset_config.py`.
    *   The API endpoint will typically be `https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages`.

6.  **Create Message Templates:**
    *   **Crucial Step:** For business-initiated conversations on WhatsApp, you **must** use pre-approved Message Templates.
    *   Templates can include placeholders (e.g., `{{1}}`, `{{2}}`) for dynamic content.
    *   **Template Creation (via Meta for Developers portal or Business Manager):**
        *   Within your WhatsApp Business Account settings (accessible via Business Manager or the App Dashboard), go to "Message Templates".
        *   Click "Create Template".
        *   Choose a category (e.g., "Utility" or "Marketing" - note that marketing templates might have stricter rules).
        *   Define the template name (e.g., `bulletin_notification`).
        *   Select languages.
        *   Write the template body using placeholders. Example:
            `New CRISH Bulletin: {{1}} is now available. View details: {{2}}`
        *   You can add buttons (call-to-action or quick reply).
        *   Submit the template for review by Meta. Approval can take from a few minutes to a few days.

7.  **User Opt-In Strategy:**
    *   **Mandatory:** You must obtain explicit user consent (opt-in) before sending them messages via WhatsApp.
    *   Clearly state what kind of messages users will receive and how frequently.
    *   Provide an easy way for users to opt-out.
    *   Store proof of opt-in.
    *   This is a legal and policy requirement. Failure to comply can lead to your number being blocked.
    *   For internal dissemination, this might be simpler (e.g., employees agreeing to receive work-related updates), but formal opt-in is still best practice.

8.  **Webhook for Inbound Messages & Status Updates (Optional but Recommended):**
    *   Configure a webhook endpoint in your WhatsApp settings within the Meta for Developers App Dashboard.
    *   This endpoint in Superset (e.g., a new Flask Blueprint) would receive callbacks for message status updates (sent, delivered, read) and any inbound messages from users.
    *   This is important for tracking and can be a Phase 2 improvement for two-way communication.

**Step-by-Step Implementation Guide (Summary using Meta Cloud API)**

1.  **Install `requests` library:** Ensure `requests` is in `requirements.txt` and installed.
2.  **Create `superset/dissemination/whatsapp_utils.py`:** Implement WhatsApp Cloud API interaction logic using `requests`.
3.  **Update Superset Configuration:** Add `WHATSAPP_CLOUD_API_VERSION`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_DEFAULT_TEMPLATE_NAME`, and `WHATSAPP_BULLETIN_RECIPIENTS` to `superset_config.py`.
4.  **WhatsApp Business API Setup (Meta Cloud API):**
    *   Ensure Meta Business Manager is set up.
    *   Create/Verify WABA within Business Manager.
    *   Register and verify your chosen phone number with Meta.
    *   In the Meta App Dashboard, add the WhatsApp product, configure API settings, and obtain `Phone Number ID`, `WhatsApp Business Account ID`.
    *   Generate and securely store a permanent System User Access Token.
    *   Create and get approval for Message Templates (e.g., `bulletin_notification`) via the Meta platform.
5.  **Define User Opt-In Mechanism.**
6.  **Modify Models and Forms:**
    *   Update `DisseminatedBulletinLog` model's `channel` field.
    *   Add "WhatsApp" to `dissemination_channels` in `DisseminationForm`.
7.  **Update `DisseminateBulletinView`:** Integrate WhatsApp sending logic, channel selection, and logging.
8.  **Update Frontend Template:** Modify `disseminate_form.html` for the "WhatsApp" channel.
9.  **Testing:** Thoroughly test bulletin dissemination to WhatsApp, including template parameter filling and error handling.

This plan provides a comprehensive approach. Prioritize obtaining user opt-in and understanding WhatsApp's commerce and business policies. 