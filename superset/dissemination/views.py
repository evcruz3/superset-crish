from flask_appbuilder import ModelView, expose, BaseView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from flask import redirect, url_for, request, flash, g, current_app # g for current user, current_app for config
from markupsafe import Markup # Import Markup
import json # Import the json library
import logging # Add logging import

# Setup logger for this module
logger = logging.getLogger(__name__)

from flask_appbuilder.security.decorators import protect, has_access # Ensure has_access is also imported if needed for SPA views

from superset import appbuilder, db
from superset.models.dissemination import EmailGroup, DisseminatedBulletinLog
from superset.models.bulletins import Bulletin # For dropdown in dissemination form
from superset.utils.core import send_email_smtp # For sending emails
from superset.views.base import SupersetModelView, DeleteMixin, BaseSupersetView # Import BaseSupersetView
# Import the new form
from .forms import DisseminationForm
from superset.utils.pdf import generate_bulletin_pdf
# Import Facebook utils
from .facebook_utils import get_facebook_graph_api, upload_single_photo_to_facebook, create_facebook_feed_post # New imports
import boto3 # For S3 interaction
from botocore.exceptions import ClientError # For S3 error handling
import os # For path joining if needed for temporary files

# Import for celery task if we define it here or in a tasks.py file
# from .tasks import send_bulletin_email_task

class EmailGroupModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(EmailGroup)
    route_base = "/emailgroups"

    list_title = _("Manage Email Groups")
    show_title = _("Show Email Group")
    add_title = _("Add Email Group")
    edit_title = _("Edit Email Group")

    list_columns = ["name", "description", "created_by", "changed_on"]
    show_fieldsets = [
        (
            _("Summary"),
            {"fields": ["name", "description", "emails"]},
        ),
        (
            _("Audit Trail"),
            {"fields": ["created_by", "created_on", "changed_by", "changed_on"], "expanded": False},
        ),
    ]
    add_columns = ["name", "description", "emails"]
    edit_columns = ["name", "description", "emails"]
    search_columns = ["name", "description", "emails", "created_by"]
    label_columns = {
        "name": _("Group Name"),
        "description": _("Description"),
        "emails": _("Email Addresses (comma-separated)"),
        "created_by": _("Created By"),
        "changed_on": _("Changed On"),
    }

    def pre_add(self, item: "EmailGroup") -> None:
        if g.user:
            item.created_by_fk = g.user.id
            item.changed_by_fk = g.user.id

    def pre_update(self, item: "EmailGroup") -> None:
        if g.user:
            item.changed_by_fk = g.user.id

class DisseminatedBulletinLogModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(DisseminatedBulletinLog)
    route_base = "/disseminatedbulletinlogs"

    list_title = _("Disseminated Bulletin Logs")
    show_title = _("Show Dissemination Log")
   
    can_add = False
    can_edit = False

    # Ensure default sort order is by sent_at descending
    order_columns = ['sent_at']
    order_direction = 'desc'
    page_size = 25 # Add page size for pagination

    list_columns = ["bulletin", "email_group", "sent_at", "status", "subject_sent", "disseminated_by"]

    # Custom formatters
    def format_sent_at(value=None) -> str: # Make value argument optional
        if not value:
            logging.warning("format_sent_at received None for value.")
            return _("[No Date]") # Placeholder for missing date
        try:
            return value.strftime('%a, %d %b, %Y %H:%M:%S')
        except AttributeError:
            logging.warning(f"format_sent_at received non-datetime value: {value!r} of type {type(value)}")
            return _("[Invalid Date]")

    def format_status_as_chip(status=None) -> Markup: # Make status argument optional
        if not status:
            logging.warning("format_status_as_chip received None or empty for status.")
            return Markup(_('[No Status]')) # Or return Markup('') if preferred
        
        status_str = str(status) # Ensure status is a string
        status_lower = status_str.lower()
        chip_class = "label-default" # Default chip style
        if status_lower == "success":
            chip_class = "label-success"
        elif status_lower == "failed":
            chip_class = "label-danger"
        elif status_lower == "pending":
            chip_class = "label-warning"
        elif status_lower == "partial_success": # Assuming this status exists
            chip_class = "label-info"
        
        return Markup(f'<span class="label {chip_class}">{status_str.upper()}</span>')

    def format_bulletin_with_icon(bulletin=None) -> Markup: # Make bulletin argument optional
        if not bulletin:
            logging.warning("format_bulletin_with_icon received None for bulletin.")
            return Markup(_('[No Bulletin Data]'))

        bulletin_title = getattr(bulletin, 'title', None)
        bulletin_id = getattr(bulletin, 'id', '[Unknown ID]')

        if not bulletin_title:
            logging.warning(f"format_bulletin_with_icon: Bulletin (ID: {bulletin_id}) has no title.")
            bulletin_title = _('[Unknown Title]')
        
        return Markup(f'<i class="fa fa-file-text-o" aria-hidden="true"></i> {bulletin_title}')

    formatters_columns = {
        'sent_at': format_sent_at,
        'status': format_status_as_chip,
        'bulletin': format_bulletin_with_icon
    }
    
    show_fieldsets = [
        (
            _("Log Details"),
            {"fields": ["bulletin", "email_group", "sent_at", "status", "subject_sent", "message_body_sent", "details", "disseminated_by"]},
        ),
    ]
    # Original problematic search_columns:
    # search_columns = ["bulletin.title", "email_group.name", "status", "subject_sent", "disseminated_by.first_name", "disseminated_by.last_name"]
    
    # Simplified search_columns to avoid the KeyError. 
    # Searching on related fields like 'bulletin.title' will require a different approach or a FAB version/patch that handles it.
    search_columns = ["status", "subject_sent"] 
    # You can also add relationship fields if they are directly searchable by their string representation, e.g., "bulletin", "email_group", "disseminated_by"
    # However, to keep it minimal for fixing the startup error, starting with direct attributes.
    # Consider adding back relationship names if needed, e.g. search_columns = ["status", "subject_sent", "bulletin", "email_group"]

    label_columns = {
        "bulletin": _("Bulletin Title"),
        "email_group": _("Email Group"),
        "sent_at": _("Sent At"),
        "status": _("Status"),
        "subject_sent": _("Subject Sent"),
        "message_body_sent": _("Message Body Sent"),
        "details": _("Details/Errors"),
        "disseminated_by": _("Disseminated By"),
    }
    # To make bulletin and email_group searchable by their names in the list view
    # This requires proper setup in SQLAInterface or custom query handling if default doesn't work.

class DisseminateBulletinView(BaseView):
    route_base = "/disseminatebulletin"
    default_view = "form"

    def _bulletins_to_json(self, bulletins_list):
        """ Converts a list of Bulletin objects to a JSON string for the template. """
        output = []
        for bulletin in bulletins_list:
            output.append({
                "id": bulletin.id,
                "title": bulletin.title,
                "advisory": bulletin.advisory or "", # Ensure None becomes empty string
                "risks": bulletin.risks or "",
                "safety_tips": bulletin.safety_tips or "",
                "hashtags": bulletin.hashtags or ""
            })
        return json.dumps(output)

    def _email_groups_to_json(self, email_groups_list):
        """ Converts a list of EmailGroup objects to a JSON string for the template, including emails. """
        output = []
        for group in email_groups_list:
            # Split emails string into a list, handling potential None or empty strings
            emails_list = [e.strip() for e in (group.emails or "").split(',') if e.strip()]
            output.append({
                "id": group.id,
                "name": group.name,
                "emails": emails_list # Store emails as a list
            })
        return json.dumps(output)

    @expose("/form/", methods=["GET", "POST"])
    def form(self):
        form = DisseminationForm()
        bulletins_query = db.session.query(Bulletin).order_by(Bulletin.created_on.desc()).all()
        email_groups_query = db.session.query(EmailGroup).order_by(EmailGroup.name).all()
        bulletins_json_for_template = self._bulletins_to_json(bulletins_query)
        email_groups_json_for_template = self._email_groups_to_json(email_groups_query)

        form.bulletin_id.choices = [ (b.id, b.title) for b in bulletins_query ]
        form.bulletin_id.choices.insert(0, (0, _('-- Select a Bulletin --')))
        form.email_group_id.choices = [ (g.id, g.name) for g in email_groups_query ]
        form.email_group_id.choices.insert(0, (0, _('-- Select an Email Group --')))

        selected_bulletin_for_template = None

        if request.method == "GET":
            preselect_bulletin_id_str = request.args.get('bulletin_id')
            if preselect_bulletin_id_str:
                try:
                    preselect_bulletin_id = int(preselect_bulletin_id_str)
                    if any(b.id == preselect_bulletin_id for b in bulletins_query):
                        form.bulletin_id.data = preselect_bulletin_id
                        selected_bulletin_for_template = db.session.query(Bulletin).get(preselect_bulletin_id)
                    else:
                        flash(_("Invalid bulletin ID provided for pre-selection."), "warning")
                except ValueError:
                    flash(_("Invalid bulletin ID format."), "warning")
            
            if form.bulletin_id.data is None or form.bulletin_id.data == 0:
                form.bulletin_id.data = 0
            if form.email_group_id.data is None:
                 # Set default for email group only if not pre-selecting channels or if email is a default channel
                if not form.dissemination_channels.data or 'email' in form.dissemination_channels.data:
                    form.email_group_id.data = 0
            
            # Pre-select channels if specified in query params (e.g., ?channels=email,facebook)
            preselect_channels_str = request.args.get('channels')
            if preselect_channels_str:
                preselect_channels = [channel.strip() for channel in preselect_channels_str.split(',')]
                valid_channels = [choice[0] for choice in form.dissemination_channels.choices]
                form.dissemination_channels.data = [ch for ch in preselect_channels if ch in valid_channels]
            elif not form.dissemination_channels.data: # Default to email if no preselection
                form.dissemination_channels.data = ['email']


        if form.validate_on_submit():
            bulletin_id = form.bulletin_id.data
            dissemination_channels = form.dissemination_channels.data # List of selected channels e.g. ['email', 'facebook']
            
            bulletin = db.session.query(Bulletin).get(bulletin_id)
            if not bulletin:
                flash(_("Selected bulletin not found."), "danger")
                return redirect(url_for("DisseminateBulletinView.form"))

            email_success = False
            facebook_success = False
            log_entries = []
            processed_channels = []

            # --- Email Dissemination ---
            if 'email' in dissemination_channels:
                processed_channels.append('email')
                email_group_id = form.email_group_id.data
                subject = form.subject.data
                message_body = form.message.data # Renamed for clarity

                email_group = db.session.query(EmailGroup).get(email_group_id)
                if not email_group:
                    flash(_("Selected email group not found for Email dissemination."), "danger")
                else:
                    try:
                        pdf_buffer = generate_bulletin_pdf(bulletin)
                        pdf_filename = f"{bulletin.title.replace(' ', '_')}.pdf"
                        pdf_data = pdf_buffer.read()
                        
                        recipient_emails_str = email_group.emails
                        recipient_list = [e.strip() for e in recipient_emails_str.split(',') if e.strip()]

                        if not recipient_list:
                             raise ValueError("No recipients found in the selected email group.")

                        send_email_smtp(
                            to=",".join(recipient_list),
                            subject=subject,
                            html_content=message_body,
                            pdf={pdf_filename: pdf_data},
                            config=current_app.config
                        )
                        log_entries.append(DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            email_group_id=email_group.id, # Log email group for email channel
                            subject_sent=subject,
                            message_body_sent=message_body,
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="SUCCESS",
                            channel="email"
                        ))
                        email_success = True
                    except Exception as e:
                        logging.error(f"Error disseminating bulletin via Email: {e}", exc_info=True)
                        log_entries.append(DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            email_group_id=email_group.id if email_group else None,
                            subject_sent=subject if subject else "N/A for failed email",
                            message_body_sent=message_body if message_body else "N/A for failed email",
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="FAILED",
                            details=f"Email Error: {str(e)}",
                            channel="email"
                        ))
            
            # --- Facebook Dissemination ---
            if 'facebook' in dissemination_channels:
                processed_channels.append('facebook')
                fb_access_token = current_app.config.get('FACEBOOK_ACCESS_TOKEN')
                fb_page_id = current_app.config.get('FACEBOOK_PAGE_ID')

                if not fb_access_token or not fb_page_id:
                    logging.error("Facebook Access Token or Page ID is not configured.")
                    flash(_("Facebook dissemination is not configured correctly (missing Access Token or Page ID)."), "warning")
                    log_entries.append(DisseminatedBulletinLog(
                        bulletin_id=bulletin.id,
                        disseminated_by_fk=g.user.id if g.user else None,
                        status="FAILED",
                        details="Facebook configuration missing (Token or Page ID).",
                        channel="facebook",
                        subject_sent=form.subject.data if form.subject.data else f"FB Post attempt for: {bulletin.title}",
                        message_body_sent="Configuration Error"
                    ))
                else:
                    # Content for Facebook post from form
                    fb_subject_from_form = form.subject.data
                    fb_message_from_form = form.message.data
                    facebook_page_post_content = f"{fb_subject_from_form}\n\n{fb_message_from_form}"
                    
                    uploaded_fb_photo_ids = []
                    image_upload_errors = []
                    # The main_fb_post_message is now facebook_page_post_content
                    # main_fb_post_message = bulletin.title
                    # if bulletin.advisory:
                    #     main_fb_post_message += "\n\n" + bulletin.advisory
                    # main_fb_post_message = main_fb_post_message[:1500] # Truncate if too long for a main post

                    try:
                        graph = get_facebook_graph_api(fb_access_token)

                        # Step 1: Upload all images as unpublished photos with their captions
                        if bulletin.image_attachments and len(bulletin.image_attachments) > 0:
                            s3_bucket_name = current_app.config.get('S3_BUCKET')
                            s3_endpoint_url = current_app.config.get('S3_ENDPOINT_URL')
                            s3_access_key = current_app.config.get('S3_ACCESS_KEY')
                            s3_secret_key = current_app.config.get('S3_SECRET_KEY')
                            s3_region = current_app.config.get('S3_REGION')

                            if not s3_bucket_name:
                                raise ValueError("S3_BUCKET is not configured for image attachments.")

                            s3_client = boto3.client(
                                's3',
                                aws_access_key_id=s3_access_key,
                                aws_secret_access_key=s3_secret_key,
                                endpoint_url=s3_endpoint_url,
                                region_name=s3_region
                            )
                            
                            for attachment in bulletin.image_attachments:
                                s3_image_url_for_download = None
                                try:
                                    s3_object_key = attachment.s3_key
                                    if not s3_object_key:
                                        logger.warning(f"Attachment ID {attachment.id} missing s3_key, skipping.")
                                        image_upload_errors.append(f"Attachment ID {attachment.id}: missing s3_key.")
                                        continue

                                    s3_image_url_for_download = s3_client.generate_presigned_url(
                                        'get_object',
                                        Params={'Bucket': s3_bucket_name, 'Key': s3_object_key},
                                        ExpiresIn=300 
                                    )
                                    logger.info(f"Generated S3 presigned URL for attachment {s3_object_key}: {s3_image_url_for_download}")
                                    
                                    photo_caption = attachment.caption or bulletin.title # Use attachment caption or fallback
                                    
                                    fb_photo_id = upload_single_photo_to_facebook(
                                        graph=graph,
                                        page_id=fb_page_id,
                                        image_caption=photo_caption,
                                        image_url=s3_image_url_for_download,
                                        published=False # Upload as unpublished first
                                    )
                                    uploaded_fb_photo_ids.append(fb_photo_id)
                                    logger.info(f"Uploaded attachment {s3_object_key} to FB, photo ID: {fb_photo_id}")
                                except Exception as e_img:
                                    attachment_identifier = getattr(attachment, 's3_key', 'N/A') # Get identifier safely
                                    logger.error(f"Error processing/uploading attachment {attachment_identifier} to Facebook: {e_img}", exc_info=True)
                                    image_upload_errors.append(f"Img '{attachment_identifier}': {str(e_img)[:100]}")
                        
                        # Step 2: Create the main feed post, attaching the unpublished photos
                        post_id = create_facebook_feed_post(
                            graph=graph,
                            page_id=fb_page_id,
                            message=facebook_page_post_content, # Use combined content from form
                            attached_media_ids=uploaded_fb_photo_ids if uploaded_fb_photo_ids else None
                        )
                        
                        log_details = f"Facebook Post ID: {post_id}."
                        if uploaded_fb_photo_ids:
                            photo_ids_str = ', '.join(map(str, uploaded_fb_photo_ids))
                            log_details += f" Attached Photo IDs: {photo_ids_str}."
                        if image_upload_errors:
                            image_errors_str = '; '.join(image_upload_errors)
                            log_details += f" Image Upload Errors: {image_errors_str}."
                            # If there were image errors but the main post succeeded, consider it partial success or flag warning.
                            # For now, main post success dictates overall FB success for this log entry.

                        log_entries.append(DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="SUCCESS" if not image_upload_errors else "PARTIAL_SUCCESS", # Mark as partial if some images failed
                            details=log_details,
                            channel="facebook",
                            subject_sent=fb_subject_from_form,
                            message_body_sent=fb_message_from_form[:1000] 
                        ))
                        facebook_success = True

                    except Exception as e:
                        logging.error(f"Error disseminating bulletin via Facebook: {e}", exc_info=True)
                        # Ensure fb_caption is defined or use a fallback for the log
                        # current_fb_message_for_log = main_fb_post_message if 'main_fb_post_message' in locals() else "N/A for failed Facebook post"
                        # Correctly join image errors in the exception log details
                        image_errors_details_str = '; '.join(image_upload_errors) if image_upload_errors else 'None'
                        log_entries.append(DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="FAILED",
                            details=f"Facebook Error: {str(e)}. Image Errors: {image_errors_details_str}",
                            channel="facebook",
                            subject_sent=fb_subject_from_form if 'fb_subject_from_form' in locals() else "N/A",
                            message_body_sent=fb_message_from_form[:1000] if 'fb_message_from_form' in locals() else "N/A"
                        ))
                        # facebook_success remains False

            # --- Save all log entries ---
            if log_entries:
                try:
                    db.session.add_all(log_entries)
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    logging.error(f"Error saving dissemination logs: {e}", exc_info=True)
                    flash(_("Critical error: Failed to save dissemination log(s). Please check system logs."), "danger")


            # --- Flash overall status message ---
            final_log_channel = ",".join(sorted(list(set(processed_channels)))) # e.g. "email,facebook"
            
            if dissemination_channels: # Only flash messages if channels were selected
                if 'email' in dissemination_channels and 'facebook' in dissemination_channels:
                    if email_success and facebook_success:
                        flash(_("Bulletin disseminated successfully to Email and Facebook."), "success")
                    else:
                        # Detailed message construction
                        msg_parts = []
                        if email_success: 
                            msg_parts.append(str(_("Email: Success.")))
                        else: 
                            error_detail = next((log.details for log in log_entries if log.channel == 'email' and log.status == 'FAILED'), 'Unknown error')
                            msg_parts.append(str(_("Email: Failed (%(error)s).", error=error_detail)))
                        
                        if facebook_success: 
                            msg_parts.append(str(_("Facebook: Success.")))
                        else: 
                            error_detail = next((log.details for log in log_entries if log.channel == 'facebook' and log.status == 'FAILED'), 'Unknown error')
                            msg_parts.append(str(_("Facebook: Failed (%(error)s).", error=error_detail)))
                        flash(str(_("Dissemination Result: ")) + " ".join(msg_parts), "warning" if not (email_success and facebook_success) else "info")

                elif 'email' in dissemination_channels:
                    if email_success:
                        flash(_("Bulletin disseminated successfully via Email."), "success")
                    else:
                        error_detail = next((log.details for log in log_entries if log.channel == 'email' and log.status == 'FAILED'), 'Unknown error')
                        flash(_("Failed to disseminate bulletin via Email (%(error)s).", error=error_detail), "danger")
                elif 'facebook' in dissemination_channels:
                    if facebook_success:
                        flash(_("Bulletin disseminated successfully to Facebook."), "success")
                    else:
                        error_detail = next((log.details for log in log_entries if log.channel == 'facebook' and log.status == 'FAILED'), 'Unknown error')
                        flash(_("Failed to disseminate bulletin to Facebook (%(error)s).", error=error_detail), "danger")

            return redirect(url_for("DisseminatedBulletinLogModelView.list"))
        
        elif request.method == "POST": # Form validation failed
            flash(_("Please correct the errors below and try again."), "danger")

        return self.render_template(
            "dissemination/disseminate_form.html", 
            form=form,
            bulletins=bulletins_query, 
            email_groups=email_groups_query,
            bulletins_json=bulletins_json_for_template,
            email_groups_json=email_groups_json_for_template,
            selected_bulletin=selected_bulletin_for_template
        )

class EmailGroupsSPAView(BaseSupersetView): # Inherit from BaseSupersetView
    route_base = "/emailgroups" 
    class_permission_name = "EmailGroups" # Define class permission name for consistency and potential future use
    # default_view = "list" # default_view is not typically needed for BaseSupersetView SPA hosts
    # allow_browser_login = True # Not typically needed for BaseSupersetView with @has_access

    @expose("/list/")
    @has_access # Use has_access for SPA views, usually tied to class_permission_name 'can_list' or a specific permission
    def list(self):
        return super().render_app_template()

# Registration of views and menu items
# This is usually done in a central place, e.g., where appbuilder is initialized.
# For now, let's assume it's handled elsewhere, or we'll add it to superset/app.py or superset/views/core.py
# Example (would go into e.g. superset/views/__init__.py or where appbuilder is configured):

# appbuilder.add_view(
#     EmailGroupModelView,
#     "Manage Email Groups",
#     label=_("Email Groups"),
#     category="Dissemination",
#     category_label=_("Dissemination"),
#     icon="fa-users",
# )
# appbuilder.add_view(
#     DisseminatedBulletinLogModelView,
#     "View Dissemination Logs",
#     label=_("Dissemination Logs"),
#     category="Dissemination",
#     icon="fa-history",
# )
# appbuilder.add_view(
#     DisseminateBulletinView, 
#     "Disseminate Bulletin", 
#     label=_("Disseminate Bulletin"), 
#     category="Dissemination", 
#     icon="fa-envelope-o"
# ) 