# Plan to Extend Bulletin Dissemination to Facebook

This document outlines the plan to extend the existing bulletin dissemination feature in Superset to allow posting to Facebook pages.

**Phase 1: Backend Changes**

1.  **Facebook API Integration:**
    *   Create a new Python module: `superset/dissemination/facebook_utils.py`.
        *   This module will encapsulate all Facebook Graph API interactions.
        *   It should utilize the `facebook-sdk` Python library.
    *   Implement core functions within `facebook_utils.py`:
        *   `authenticate_facebook_api(app_id, app_secret, access_token)`: To initialize the API client.
        *   `post_to_facebook_page(graph, page_id, message, link=None, image_url=None)`: To publish a post to the specified Facebook page. This function should handle formatting the message appropriately (e.g., text content, optional link to the bulletin, optional image).
        *   Robust error handling for API responses (e.g., token expiration, permission issues, rate limiting).
2.  **Configuration:**
    *   Add new configuration options to `superset_config.py` (or the preferred configuration file/method for your Superset instance).
        *   `FACEBOOK_APP_ID`: Your Facebook App ID.
        *   `FACEBOOK_APP_SECRET`: Your Facebook App Secret.
        *   `FACEBOOK_PAGE_ID`: The ID of the target Facebook Page where bulletins will be posted.
        *   `FACEBOOK_ACCESS_TOKEN`: A long-lived Page Access Token with `pages_manage_posts` permission.
        *   **(Optional but Recommended)** `FACEBOOK_DEFAULT_MESSAGE_TEMPLATE`: A template string for the Facebook post, allowing customization (e.g., "New Bulletin: {title} - Read more: {url}").
3.  **Modify `DisseminateBulletinView` (in `superset/dissemination/views.py`):**
    *   **Form Update:**
        *   Modify `DisseminationForm` (likely in `superset/dissemination/forms.py`) to include a new field. This could be a `SelectMultipleField` or checkboxes for `dissemination_channels` (e.g., options: "Email", "Facebook").
    *   **Processing Logic Update:**
        *   In the `form` method of `DisseminateBulletinView`, after `form.validate_on_submit()`:
            *   Check the selected `dissemination_channels`.
            *   If "Facebook" is selected:
                *   Retrieve the bulletin details (title, advisory, URL to the bulletin if available).
                *   Fetch Facebook configuration values from `app.config`.
                *   Instantiate the Facebook Graph API client using `facebook_utils.authenticate_facebook_api`.
                *   Call `facebook_utils.post_to_facebook_page` with the formatted message, bulletin link, and potentially an image if the bulletin has one.
                *   Handle success and failure scenarios, providing appropriate flash messages to the user.
4.  **Logging:**
    *   Extend the `DisseminatedBulletinLog` model (in `superset/models/dissemination.py`):
        *   Add a new field, e.g., `channel = db.Column(db.String(50))` (possible values: "email", "facebook", "email_and_facebook").
        *   Alternatively, consider a related table if a single dissemination event can target multiple channels and you want to log individual channel success/failure. For simplicity, a string field is often sufficient initially.
    *   Update the logging logic in `DisseminateBulletinView` to:
        *   Populate the new `channel` field when creating a `DisseminatedBulletinLog` entry.
        *   If posting to multiple channels, consider creating separate log entries or a more detailed log message.

**Phase 2: Frontend Changes**

1.  **Update Dissemination Form Template (`superset/templates/dissemination/disseminate_form.html`):**
    *   Render the new `dissemination_channels` field added to `DisseminationForm`.
    *   Ensure the form correctly submits the selected channel(s) to the backend. This might involve adjusting JavaScript if the form has dynamic elements.

**Phase 3: Facebook App Setup and Configuration**

This phase involves creating and configuring an app on the Facebook for Developers platform.

1.  **Go to Facebook for Developers:**
    *   Navigate to `https://developers.facebook.com/`.
    *   Log in with your Facebook account.

2.  **Create a New App:**
    *   Click on "My Apps" in the top right corner.
    *   Click "Create App".
    *   Select an app type. For this use case, "Business" or "Manage Business Integrations" is often appropriate. If unsure, "Something Else" can work, and you can add products later.
    *   Provide an "App Display Name" (e.g., "Superset Bulletin Disseminator").
    *   Enter your "App Contact Email".
    *   If you have a Business Manager account, you can link it, but it's optional for basic setup.
    *   Click "Create App ID". You might need to complete a security check.

3.  **Add Products to Your App:**
    *   Once the app is created, you'll be taken to the App Dashboard.
    *   On the left sidebar, under "Products" or "Add product", locate and add the following:
        *   **Facebook Login:** Even if users aren't directly logging in via Facebook through Superset, this product is often a prerequisite for other permissions and API access related to users and pages.
        *   **Pages API:** This is essential for interacting with Facebook Pages. You might find it listed directly, or you might need to set up "Marketing API" or another related product and then configure permissions for Pages. Facebook's interface changes, so look for page-related APIs.

4.  **Configure App Settings:**
    *   **Basic Settings:**
        *   Navigate to "Settings" > "Basic" in the left sidebar.
        *   Here you will find your `App ID` and `App Secret`. **Copy these and store them securely.** These will be your `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in `superset_config.py`.
        *   Fill in other required fields like "Privacy Policy URL" and "Terms of Service URL" (even if they are placeholders initially, Facebook often requires these for app activation).
        *   Set an "App Icon" and "Category".
    *   **Facebook Login Settings (if added):**
        *   Go to "Facebook Login" > "Settings".
        *   Under "Valid OAuth Redirect URIs", you might need to add your Superset domain if you plan to use any OAuth flows, though for server-to-server Page posting with a long-lived token, this might not be strictly necessary for the immediate posting feature but is good practice.

5.  **Obtain a Page Access Token:**
    *   This is the most crucial and sometimes tricky part. You need a **Long-Lived Page Access Token** that your Superset backend will use to post to the designated Facebook Page.
    *   **a. Get your Facebook Page ID:**
        *   Go to your Facebook Page.
        *   In the "About" section (or by looking at the URL), find your Page ID. It's a numerical string. This will be your `FACEBOOK_PAGE_ID`.
    *   **b. Use the Graph API Explorer:**
        *   Go to the Graph API Explorer: `https://developers.facebook.com/tools/explorer/`.
        *   In the "Facebook App" dropdown on the right, select the app you just created.
        *   **User or Page Token:** Click the dropdown and select "Get User Access Token".
        *   **Permissions:** A dialog will pop up. You need to grant permissions for your app to manage your page. Select the following permissions (the exact names might vary slightly):
            *   `pages_show_list` (to see the pages you manage)
            *   `pages_manage_posts` (to publish posts on behalf of the page)
            *   `pages_read_engagement` (optional, but good for seeing post performance)
            *   Click "Get Access Token". You'll be prompted by Facebook to confirm granting these permissions to your app for your user account.
        *   The Explorer will now have a **Short-Lived User Access Token**.
    *   **c. Exchange for a Long-Lived User Access Token:**
        *   With the short-lived User Access Token, make a GET request in the Graph API Explorer (or using `curl`/Postman) to the following endpoint:
            `GET /oauth/access_token?grant_type=fb_exchange_token&client_id={your-app-id}&client_secret={your-app-secret}&fb_exchange_token={short-lived-user-access-token}`
        *   Replace `{your-app-id}`, `{your-app-secret}`, and `{short-lived-user-access-token}` with your actual values.
        *   The response will contain a `access_token`. This is a **Long-Lived User Access Token** (valid for about 60 days).
    *   **d. Get the Long-Lived Page Access Token:**
        *   Using the **Long-Lived User Access Token** from the previous step, make a GET request in the Graph API Explorer to:
            `GET /me/accounts?access_token={long-lived-user-access-token}`
        *   This will list all the Facebook Pages your user account manages, along with an `access_token` for each page.
        *   Find the entry for your target Page (match the `id` with your `FACEBOOK_PAGE_ID`). The `access_token` listed for that page is a **Long-Lived Page Access Token**. This is the token you should store as `FACEBOOK_ACCESS_TOKEN` in your `superset_config.py`. These tokens typically do not expire unless revoked or permissions change.
        *   **Security Note:** Treat this Page Access Token like a password. Store it securely using environment variables or a secrets management system. Do not hardcode it directly into version-controlled files if possible.

6.  **App Mode (Development vs. Live):**
    *   While developing, your app will be in "Development" mode. This means only app admins, developers, and testers can use its integrations.
    *   If others in your organization need to authorize or if the app usage expands, you might need to switch it to "Live" mode. This often requires completing Facebook's App Review process if you are using permissions that require it. For posting to your own page with a token generated by an admin, you might be able to stay in development mode or go live with minimal review if only server-to-server API calls are made.

7.  **App Review (If Necessary):**
    *   If you switch your app to "Live" mode and it uses certain permissions (like `pages_manage_posts`), Facebook may require you to submit your app for review.
    *   Go to "App Review" in the left sidebar of your App Dashboard.
    *   Provide detailed explanations and screencasts of how your app uses each permission.
    *   This process can take time, so plan accordingly if it's needed. For an internal tool posting to a company page where the token is generated by an admin, you might not need extensive review if the token has the necessary permissions.

**Step-by-Step Implementation Guide (Summary)**

1.  **Install `facebook-sdk`:** Add to `requirements.txt` and install.
2.  **Create `superset/dissemination/facebook_utils.py`:** Implement Facebook API interaction logic.
3.  **Update Superset Configuration:** Add `FACEBOOK_*` keys to `superset_config.py`.
4.  **Modify Models and Forms:**
    *   Add `channel` to `DisseminatedBulletinLog` model.
    *   Add `dissemination_channels` to `DisseminationForm`.
5.  **Update `DisseminateBulletinView`:** Integrate Facebook posting logic, channel selection, and logging.
6.  **Update Frontend Template:** Modify `disseminate_form.html` to include the channel selection.
7.  **Facebook App Setup:** Follow the detailed steps above to create, configure your Facebook App, and obtain the necessary IDs and Page Access Token.
8.  **Testing:** Thoroughly test the email and Facebook dissemination features.

This plan provides a comprehensive approach. Remember to handle API keys and tokens securely. 

FACEBOOK_APP_ID = 1370637347489550
FACEBOOK_APP_SECRET = cc2efa39adad057cac3d04606993e391
FACEBOOK_PAGE_ID = 61576696407506
FACEBOOK_ACCESS_TOKEN = EAATelmA2hw4BOxobrJAkJYNQxiLEC27jggJCFLAjZAVjUd1zmLmehTe2HT98yZAYzD5mTzKUa8GU9ZCXfr310YKIQFY8jzUi5Pm7I1leZCOrCVFg9Ih70Ug0ngbZB4tmaI6FZApQ23r0fnxTSmxiP4ZASYBoDurWtc4nTThLcoMNwtBPMfJduioAdehezeUdeKfcZBpDfaix28yd65kPBZB7eboK4QEF6aZAZCmnuHU