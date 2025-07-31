from flask_appbuilder import ModelView, expose, BaseView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from flask import redirect, url_for, request, flash, g, current_app # g for current user, current_app for config
from markupsafe import Markup # Import Markup
import json # Import the json library
import logging # Add logging import
import re # Add re import at the top of the file

# Setup logger for this module
logger = logging.getLogger(__name__)

from flask_appbuilder.security.decorators import protect, has_access # Ensure has_access is also imported if needed for SPA views

from superset import appbuilder, db
from superset.models.dissemination import EmailGroup, DisseminatedBulletinLog, WhatsAppGroup
from superset.models.bulletins import Bulletin # For dropdown in dissemination form
from superset.utils.core import send_email_smtp # For sending emails
from superset.views.base import SupersetModelView, DeleteMixin, BaseSupersetView # Import BaseSupersetView
# Import the new form
from .forms import DisseminationForm
from superset.utils.pdf import generate_bulletin_pdf
# Import Facebook utils
from .facebook_utils import get_facebook_graph_api, upload_single_photo_to_facebook, create_facebook_feed_post # New imports
# Import WhatsApp utils
from .whatsapp_utils import send_whatsapp_message # Added WhatsApp import
import boto3 # For S3 interaction
from botocore.exceptions import ClientError # For S3 error handling
import os # For path joining if needed for temporary files
import requests # Added for making HTTP requests for webhook

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

class WhatsAppGroupModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(WhatsAppGroup) # Use WhatsAppGroup model
    route_base = "/whatsappgroups"

    list_title = _("Manage WhatsApp Groups")
    show_title = _("Show WhatsApp Group")
    add_title = _("Add WhatsApp Group")
    edit_title = _("Edit WhatsApp Group")

    list_columns = ["name", "description", "created_by", "changed_on"]
    show_fieldsets = [
        (
            _("Summary"),
            {"fields": ["name", "description", "phone_numbers"]},
        ),
        (
            _("Audit Trail"),
            {"fields": ["created_by", "created_on", "changed_by", "changed_on"], "expanded": False},
        ),
    ]
    add_columns = ["name", "description", "phone_numbers"]
    edit_columns = ["name", "description", "phone_numbers"]
    search_columns = ["name", "description", "phone_numbers", "created_by"]
    label_columns = {
        "name": _("Group Name"),
        "description": _("Description"),
        "phone_numbers": _("Phone Numbers (comma-separated, e.g., +1234567890)"),
        "created_by": _("Created By"),
        "changed_on": _("Changed On"),
    }

    def pre_add(self, item: "WhatsAppGroup") -> None:
        if g.user:
            item.created_by_fk = g.user.id
            item.changed_by_fk = g.user.id

    def pre_update(self, item: "WhatsAppGroup") -> None:
        if g.user:
            item.changed_by_fk = g.user.id

class DisseminatedBulletinLogModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(DisseminatedBulletinLog)
    route_base = "/disseminatedbulletinlogs"

    list_title = _("Disseminated Bulletin Logs")
    show_title = _("Show Dissemination Log")
   
    can_add = False
    can_edit = False

    order_columns = ['sent_at']
    order_direction = 'desc'
    page_size = 25

    list_columns = ["bulletin", "associated_email_group_names", "associated_whatsapp_group_names", "sent_at", "status", "subject_sent", "disseminated_by"]

    # Custom formatters
    def format_sent_at(value=None) -> str:
        if not value:
            logging.warning("format_sent_at received None for value.")
            return _("[No Date]") # Placeholder for missing date
        try:
            return value.strftime('%a, %d %b, %Y %H:%M:%S')
        except AttributeError:
            logging.warning(f"format_sent_at received non-datetime value: {value!r} of type {type(value)}")
            return _("[Invalid Date]")

    def format_status_as_chip(status=None) -> Markup:
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

    def format_bulletin_with_icon(bulletin=None) -> Markup:
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
        'bulletin': format_bulletin_with_icon,
    }
    
    show_fieldsets = [
        (
            _("Log Details"),
            {"fields": ["bulletin", "associated_email_group_names", "associated_whatsapp_group_names", "sent_at", "status", "subject_sent", "message_body_sent", "details", "disseminated_by"]},
        ),
    ]
    search_columns = ["status", "subject_sent"] 

    label_columns = {
        "bulletin": _("Bulletin Title"),
        "associated_email_group_names": _("Email Groups"),
        "associated_whatsapp_group_names": _("WhatsApp Groups"),
        "sent_at": _("Sent At"),
        "status": _("Status"),
        "subject_sent": _("Subject Sent"),
        "message_body_sent": _("Message Body Sent"),
        "details": _("Details/Errors"),
        "disseminated_by": _("Disseminated By"),
    }

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

    def _whatsapp_groups_to_json(self, whatsapp_groups_list): # New method for WhatsApp groups
        """ Converts a list of WhatsAppGroup objects to a JSON string for the template. """
        output = []
        for group in whatsapp_groups_list:
            phone_numbers_list = [p.strip() for p in (group.phone_numbers or "").split(',') if p.strip()]
            output.append({
                "id": group.id,
                "name": group.name,
                "phone_numbers": phone_numbers_list
            })
        return json.dumps(output)

    @expose("/form/", methods=["GET", "POST"])
    def form(self):
        form = DisseminationForm()
        bulletins_query = db.session.query(Bulletin).order_by(Bulletin.created_on.desc()).all()
        email_groups_query = db.session.query(EmailGroup).order_by(EmailGroup.name).all()
        whatsapp_groups_query = db.session.query(WhatsAppGroup).order_by(WhatsAppGroup.name).all() # Query WhatsApp groups
        
        bulletins_json_for_template = self._bulletins_to_json(bulletins_query)
        email_groups_json_for_template = self._email_groups_to_json(email_groups_query)
        whatsapp_groups_json_for_template = self._whatsapp_groups_to_json(whatsapp_groups_query) # JSON for WhatsApp groups

        form.bulletin_id.choices = [ (b.id, b.title) for b in bulletins_query ]
        form.bulletin_id.choices.insert(0, (0, _('-- Select a Bulletin --')))
        form.email_group_ids.choices = [ (g.id, g.name) for g in email_groups_query ]
        form.whatsapp_group_id.choices = [ (g.id, g.name) for g in whatsapp_groups_query ] # Populate WhatsApp group choices
        # form.whatsapp_group_id.choices.insert(0, (0, _('-- Select a WhatsApp Group --'))) # Will be a multi-select

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
            # if form.whatsapp_group_id.data is None: # Set default for WhatsApp group
            #     if not form.dissemination_channels.data or 'whatsapp' in form.dissemination_channels.data:
            #         form.whatsapp_group_id.data = 0
            
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
            whatsapp_success = False # Initialize WhatsApp success status
            mobile_app_broadcast_success = False # Initialize Mobile App Broadcast success status
            log_entries = []
            processed_channels = []

            # --- Email Dissemination ---
            if 'email' in dissemination_channels:
                processed_channels.append('email')
                email_group_ids = form.email_group_ids.data # Changed to email_group_ids
                subject = form.subject.data
                message_body = form.message.data # Renamed for clarity

                selected_email_groups = db.session.query(EmailGroup).filter(EmailGroup.id.in_(email_group_ids)).all()
                
                if not selected_email_groups:
                    flash(_("No valid email groups were selected or found for Email dissemination."), "danger")
                    log_entries.append(DisseminatedBulletinLog(
                        bulletin_id=bulletin.id,
                        # No single email_group_id to log here directly, association table handles it
                        subject_sent=subject if subject else "N/A for failed email",
                        message_body_sent=message_body if message_body else "N/A for failed email",
                        disseminated_by_fk=g.user.id if g.user else None,
                        status="FAILED",
                        details="No email groups selected or found.",
                        channel="email"
                    ))
                else:
                    try:
                        pdf_buffer = generate_bulletin_pdf(bulletin)
                        pdf_filename = f"{bulletin.title.replace(' ', '_')}.pdf"
                        pdf_data = pdf_buffer.read()
                        
                        all_recipient_emails = set() # Use a set to ensure uniqueness
                        for group in selected_email_groups:
                            if group.emails:
                                group_emails = [e.strip() for e in group.emails.split(',') if e.strip()]
                                all_recipient_emails.update(group_emails)

                        recipient_list = list(all_recipient_emails)

                        if not recipient_list:
                             raise ValueError("No recipients found in the selected email groups.")

                        # Replace \n with <br> and append two new lines at the end of the html_email_body 
                        html_email_body = message_body.replace('\n', '<br>') + "<br><br>"

                        send_email_smtp(
                            to=",".join(recipient_list),
                            subject=subject,
                            html_content=html_email_body,
                            pdf={pdf_filename: pdf_data},
                            config=current_app.config
                        )
                        log_entry = DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            # email_group_id=email_group.id, # Removed: will be handled by association
                            subject_sent=subject,
                            message_body_sent=message_body,
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="SUCCESS",
                            channel="email"
                        )
                        log_entry.email_groups = selected_email_groups # Assign selected groups to the relationship
                        log_entries.append(log_entry)
                        email_success = True
                    except Exception as e:
                        logging.error(f"Error disseminating bulletin via Email: {e}", exc_info=True)
                        log_entry = DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            # No single email_group_id to log here directly
                            subject_sent=subject if subject else "N/A for failed email",
                            message_body_sent=message_body if message_body else "N/A for failed email",
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="FAILED",
                            details=f"Email Error: {str(e)}",
                            channel="email"
                        )
                        # Even on failure, try to associate with initially intended groups if available
                        if selected_email_groups:
                            log_entry.email_groups = selected_email_groups
                        log_entries.append(log_entry)
            
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

            # --- WhatsApp Dissemination ---
            if 'whatsapp' in dissemination_channels:
                processed_channels.append('whatsapp')
                logger.info("Processing WhatsApp dissemination channel.")

                wa_phone_id_config = current_app.config.get('WHATSAPP_PHONE_NUMBER_ID') # Renamed to avoid clash
                wa_token_config = current_app.config.get('WHATSAPP_ACCESS_TOKEN') # Renamed
                wa_template_name_config = current_app.config.get('WHATSAPP_DEFAULT_TEMPLATE_NAME', 'bulletin_alert') # Renamed
                
                whatsapp_group_ids_form = form.whatsapp_group_id.data # Changed to whatsapp_group_ids
                selected_whatsapp_groups = db.session.query(WhatsAppGroup).filter(WhatsAppGroup.id.in_(whatsapp_group_ids_form)).all()

                if not selected_whatsapp_groups:
                    error_msg = "No WhatsApp groups selected or found."
                    logger.error(error_msg)
                    flash(_(error_msg), "danger")
                    log_entry = DisseminatedBulletinLog(
                        bulletin_id=bulletin.id,
                        # whatsapp_group_id=whatsapp_group_id_form if whatsapp_group_id_form else None, # Removed
                        disseminated_by_fk=g.user.id if g.user else None,
                        status="FAILED",
                        details=error_msg,
                        channel="whatsapp",
                        subject_sent=f"WhatsApp attempt for: {bulletin.title} (Template: {wa_template_name_config})",
                        message_body_sent="WhatsApp Group Error"
                    )
                    log_entry.whatsapp_groups = [] # Ensure association is empty
                    log_entries.append(log_entry)
                # Check essential configs like token and phone ID, template name
                elif not wa_phone_id_config or not wa_token_config or wa_token_config == "YOUR_PERMANENT_SYSTEM_USER_ACCESS_TOKEN_PLEASE_REPLACE" or not wa_template_name_config:
                    missing_configs = []
                    if not wa_phone_id_config: missing_configs.append("WHATSAPP_PHONE_NUMBER_ID from config")
                    if not wa_token_config or wa_token_config == "YOUR_PERMANENT_SYSTEM_USER_ACCESS_TOKEN_PLEASE_REPLACE":
                        missing_configs.append("WHATSAPP_ACCESS_TOKEN from config (ensure it's replaced)")
                    if not wa_template_name_config: missing_configs.append("WHATSAPP_DEFAULT_TEMPLATE_NAME from config")
                    
                    error_msg = f"WhatsApp dissemination is not configured correctly in system settings. Missing: {', '.join(missing_configs)}."
                    logger.error(error_msg)
                    flash(_(error_msg), "warning")
                    log_entry = DisseminatedBulletinLog(
                        bulletin_id=bulletin.id,
                        # whatsapp_group_id=whatsapp_group_id_form, # Removed
                        disseminated_by_fk=g.user.id if g.user else None,
                        status="FAILED",
                        details=error_msg,
                        channel="whatsapp",
                        subject_sent=f"WhatsApp attempt for: {bulletin.title} (Template: {wa_template_name_config})",
                        message_body_sent="System Configuration Error"
                    )
                    if selected_whatsapp_groups: # Try to associate even on config failure
                        log_entry.whatsapp_groups = selected_whatsapp_groups
                    log_entries.append(log_entry)
                else:
                    all_wa_recipients_set = set() # Use a set to ensure uniqueness across groups
                    for group in selected_whatsapp_groups:
                        if group.phone_numbers:
                            group_numbers = [p.strip() for p in group.phone_numbers.split(',') if p.strip()]
                            all_wa_recipients_set.update(group_numbers)
                    
                    wa_recipients_list = list(all_wa_recipients_set)

                    if not wa_recipients_list:
                        selected_group_names = ", ".join([g.name for g in selected_whatsapp_groups])
                        error_msg = f"No valid phone numbers found in the selected WhatsApp group(s): '{selected_group_names}'."
                        logger.error(error_msg)
                        flash(_(error_msg), "danger")
                        log_entry = DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            # whatsapp_group_id=whatsapp_group_id_form, # Removed
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="FAILED",
                            details=error_msg,
                            channel="whatsapp",
                            subject_sent=f"WhatsApp attempt for: {bulletin.title} (Template: {wa_template_name_config})",
                            message_body_sent="Empty Group Recipient List"
                        )
                        log_entry.whatsapp_groups = selected_whatsapp_groups # Associate with the selected (but empty) groups
                        log_entries.append(log_entry)
                    else:
                        success_count = 0
                        failure_count = 0
                        whatsapp_log_details = []

                        wa_subject = form.subject.data
                        wa_message = form.message.data

                        # --- Parsing logic for wa_message ---
                        parsed_content = {
                            'advisory': '',
                            'risks': '',
                            'safety_tips': ''
                        }
                        if wa_message:
                            # Use regex to split the message by known headers, keeping the headers for context if needed
                            # This pattern looks for the headers and captures the text until the next header or end of string
                            # It assumes headers are uppercase and followed by a colon, possibly newlines/spaces.
                            
                            # Simpler approach: Split and then find sections.
                            # This is less reliant on perfect regex and order, but assumes keywords exist.
                            # Convert message to uppercase for case-insensitive keyword matching
                            message_upper = wa_message.upper()
                            
                            advisory_keyword = "ADVISORY:"
                            risks_keyword = "RISKS:"
                            safety_tips_keyword = "SAFETY TIPS:"

                            advisory_start_idx = message_upper.find(advisory_keyword)
                            risks_start_idx = message_upper.find(risks_keyword)
                            safety_tips_start_idx = message_upper.find(safety_tips_keyword)

                            # Create a list of found keywords and their start indices
                            sections = []
                            if advisory_start_idx != -1:
                                sections.append((advisory_start_idx, advisory_keyword, 'advisory'))
                            if risks_start_idx != -1:
                                sections.append((risks_start_idx, risks_keyword, 'risks'))
                            if safety_tips_start_idx != -1:
                                sections.append((safety_tips_start_idx, safety_tips_keyword, 'safety_tips'))
                            
                            # Sort sections by their start index to process them in order
                            sections.sort()

                            for i, (start_idx, keyword, section_key) in enumerate(sections):
                                content_start = start_idx + len(keyword)
                                content_end = None
                                if i + 1 < len(sections): # If there's a next section
                                    content_end = sections[i+1][0] # End before the next section starts
                                
                                section_text = wa_message[content_start:content_end].strip()
                                parsed_content[section_key] = section_text
                            
                            # If no keywords found, put the whole message into advisory as a fallback
                            if not sections and wa_message.strip():
                                parsed_content['advisory'] = wa_message.strip()
                                logger.info("WhatsApp message keywords (ADVISORY, RISKS, SAFETY TIPS) not found. Using entire message for advisory part.")

                        # --- End parsing logic ---

                        def sanitize_whatsapp_text(text_content):
                            if not text_content: return "" 
                            processed_text = text_content.replace('\r\n', ' ').replace('\n', ' ').replace('\r', ' ')
                            processed_text = processed_text.replace('\t', ' ')
                            processed_text = ' '.join(processed_text.split())
                            return processed_text

                        sanitized_subject = sanitize_whatsapp_text(wa_subject)
                        sanitized_advisory = sanitize_whatsapp_text(parsed_content['advisory'])
                        sanitized_risks = sanitize_whatsapp_text(parsed_content['risks'])
                        sanitized_safety_tips = sanitize_whatsapp_text(parsed_content['safety_tips'])
                        
                        MAX_HEADER_LENGTH = 60 
                        # Assume body parts also have a significant limit, e.g., 250-300 chars each, verify with your template!
                        # WhatsApp often quotes ~1024 for the whole body, but individual {{n}} can be less.
                        # For safety, let's use a moderate limit per section. ADJUST THESE!
                        MAX_BODY_PARAM_LENGTH = 300 

                        truncated_subject = (sanitized_subject[:MAX_HEADER_LENGTH-3] + '...') if len(sanitized_subject) > MAX_HEADER_LENGTH else sanitized_subject
                        truncated_advisory = (sanitized_advisory[:MAX_BODY_PARAM_LENGTH-3] + '...') if len(sanitized_advisory) > MAX_BODY_PARAM_LENGTH else sanitized_advisory
                        truncated_risks = (sanitized_risks[:MAX_BODY_PARAM_LENGTH-3] + '...') if len(sanitized_risks) > MAX_BODY_PARAM_LENGTH else sanitized_risks
                        truncated_safety_tips = (sanitized_safety_tips[:MAX_BODY_PARAM_LENGTH-3] + '...') if len(sanitized_safety_tips) > MAX_BODY_PARAM_LENGTH else sanitized_safety_tips

                        # Assumes template {{1}} for subject, {{2}} for advisory, {{3}} for risks, {{4}} for safety_tips
                        template_params = [
                            truncated_subject, 
                            truncated_advisory, 
                            truncated_risks, 
                            truncated_safety_tips
                        ]
                        # Filter out empty strings if a section was not present and your template can't handle empty params
                        # However, it's often better if the template itself is designed to look okay with empty params.
                        # template_params = [p for p in template_params if p] # Optional: if empty strings cause issues

                        for recipient_phone in wa_recipients_list:
                            try:
                                logger.info(f"Sending WhatsApp to {recipient_phone} using template {wa_template_name_config} with params: {template_params}")
                                sent, response = send_whatsapp_message(
                                    recipient_phone_number=recipient_phone,
                                    message_template_name=wa_template_name_config,
                                    template_params=template_params, 
                                    access_token=wa_token_config,
                                    phone_number_id=wa_phone_id_config
                                )
                                if sent:
                                    success_count += 1
                                    whatsapp_log_details.append(f"Sent to {recipient_phone}: Success (MsgID: {response.get('messages', [{}])[0].get('id', 'N/A')}).")
                                    logger.info(f"WhatsApp message sent to {recipient_phone}. Response: {response}")
                                else:
                                    failure_count += 1
                                    error_detail = response if isinstance(response, dict) else {"error": str(response)}
                                    whatsapp_log_details.append(f"Sent to {recipient_phone}: Failed ({error_detail.get('error', {}).get('message', 'Unknown API error')}).")
                                    logger.error(f"Failed to send WhatsApp message to {recipient_phone}. Response: {response}")
                            except Exception as e_wa:
                                failure_count += 1
                                logger.error(f"Exception sending WhatsApp to {recipient_phone}: {e_wa}", exc_info=True)
                                whatsapp_log_details.append(f"Sent to {recipient_phone}: Failed (Exception: {str(e_wa)}).")

                        final_status = "FAILED"
                        if success_count > 0 and failure_count == 0:
                            final_status = "SUCCESS"
                            whatsapp_success = True
                        elif success_count > 0 and failure_count > 0:
                            final_status = "PARTIAL_SUCCESS"
                            whatsapp_success = True # Still mark as overall success for the channel if at least one went through
                        
                        log_entry = DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            # whatsapp_group_id=selected_whatsapp_group.id, # Removed: will be handled by association
                            disseminated_by_fk=g.user.id if g.user else None,
                            status=final_status,
                            details="; ".join(whatsapp_log_details),
                            channel="whatsapp",
                            # For WhatsApp, subject/message_body are less direct. Log template info.
                            subject_sent=f"WhatsApp Template: {wa_template_name_config} (Subject: {sanitized_subject[:100]}...)", 
                            message_body_sent=f"Recipients: {len(wa_recipients_list)}. Advisory: {truncated_advisory[:50]}... Risks: {truncated_risks[:50]}... Tips: {truncated_safety_tips[:50]}... Success: {success_count}, Failed: {failure_count}."
                        )
                        log_entry.whatsapp_groups = selected_whatsapp_groups # Assign selected groups to the relationship
                        log_entries.append(log_entry)
                        if final_status == "SUCCESS":
                            logger.info("All WhatsApp messages disseminated successfully.")

            # --- Mobile App Broadcast Dissemination ---
            if 'mobile_app_broadcast' in dissemination_channels:
                processed_channels.append('mobile_app_broadcast')
                logger.info("Processing Mobile App Broadcast dissemination channel.")
                
                # Import FCM helper
                from superset.dissemination.fcm_helper import FCMDisseminationHelper
                
                # Check if FCM is configured
                fcm_configured = (
                    current_app.config.get("FCM_CREDENTIALS_JSON") or 
                    current_app.config.get("FCM_CREDENTIALS_PATH")
                )
                
                if not fcm_configured:
                    error_msg = "Mobile App Broadcast is not configured correctly: FCM credentials are missing. Set either FCM_CREDENTIALS_JSON or FCM_CREDENTIALS_PATH in configuration."
                    logger.error(error_msg)
                    flash(_(error_msg), "warning")
                    log_entries.append(DisseminatedBulletinLog(
                        bulletin_id=bulletin.id,
                        disseminated_by_fk=g.user.id if g.user else None,
                        status="FAILED",
                        details=error_msg,
                        channel="mobile_app_broadcast",
                        subject_sent=f"Mobile App Broadcast attempt for: {bulletin.title}",
                        message_body_sent="Configuration Error"
                    ))
                else:
                    # Send FCM notification
                    success, status_msg, response_data = FCMDisseminationHelper.send_bulletin_notification(
                        bulletin_id=bulletin.id,
                        title=bulletin.title,
                        advisory=bulletin.advisory,
                        risks=bulletin.risks,
                        safety_tips=bulletin.safety_tips,
                        hashtags=bulletin.hashtags,
                    )
                    
                    if success:
                        mobile_app_broadcast_success = True
                        log_entries.append(DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="SUCCESS",
                            details=f"Successfully sent FCM notification. {status_msg}",
                            channel="mobile_app_broadcast",
                            subject_sent=bulletin.title,
                            message_body_sent=json.dumps({
                                "target": response_data.get("target"),
                                "message_id": response_data.get("message_id"),
                                "bulletin_data": {
                                    "id": bulletin.id,
                                    "title": bulletin.title,
                                    "advisory": bulletin.advisory[:100] + "...",  # Truncate for logging
                                }
                            })
                        ))
                        logger.info(f"Mobile App Broadcast (FCM) sent successfully for bulletin {bulletin.id}. Message ID: {response_data.get('message_id')}")
                    else:
                        logger.error(f"Error sending Mobile App Broadcast (FCM) for bulletin {bulletin.id}: {status_msg}")
                        log_entries.append(DisseminatedBulletinLog(
                            bulletin_id=bulletin.id,
                            disseminated_by_fk=g.user.id if g.user else None,
                            status="FAILED",
                            details=f"FCM notification failed: {status_msg}",
                            channel="mobile_app_broadcast",
                            subject_sent=bulletin.title,
                            message_body_sent=json.dumps(response_data) if response_data else "No response data"
                        ))

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
                # Determine overall success for each processed channel for consolidated messaging
                email_channel_processed = 'email' in processed_channels
                facebook_channel_processed = 'facebook' in processed_channels
                whatsapp_channel_processed = 'whatsapp' in processed_channels
                mobile_app_broadcast_channel_processed = 'mobile_app_broadcast' in processed_channels # New check

                # Consolidate success/failure messages
                results_summary = []
                any_failures = False

                if email_channel_processed:
                    if email_success:
                        results_summary.append(str(_("Email: Success.")))
                    else:
                        error_detail = next((log.details for log in log_entries if log.channel == 'email' and log.status == 'FAILED'), 'Unknown error')
                        results_summary.append(str(_("Email: Failed (%(error)s).", error=error_detail)))
                        any_failures = True
                
                if facebook_channel_processed:
                    # For Facebook, check if log status is SUCCESS or PARTIAL_SUCCESS for overall success
                    fb_log_entry = next((log for log in log_entries if log.channel == 'facebook'), None)
                    fb_final_status = fb_log_entry.status if fb_log_entry else "FAILED"

                    if fb_final_status == "SUCCESS" or fb_final_status == "PARTIAL_SUCCESS":
                        results_summary.append(str(_("Facebook: Success (%(status)s).", status=fb_final_status)))
                    else:
                        error_detail = fb_log_entry.details if fb_log_entry else 'Unknown error'
                        results_summary.append(str(_("Facebook: Failed (%(error)s).", error=error_detail)))
                        any_failures = True

                if whatsapp_channel_processed:
                    wa_log_entry = next((log for log in log_entries if log.channel == 'whatsapp'), None)
                    wa_final_status = wa_log_entry.status if wa_log_entry else "FAILED"
                    
                    if whatsapp_success: # Relies on whatsapp_success being True for SUCCESS or PARTIAL_SUCCESS
                        results_summary.append(str(_("WhatsApp: Success (%(status)s).", status=wa_final_status)))
                    else:
                        error_detail = wa_log_entry.details if wa_log_entry else 'Unknown error'
                        results_summary.append(str(_("WhatsApp: Failed (%(error)s).", error=error_detail)))
                        any_failures = True
                
                if mobile_app_broadcast_channel_processed:
                    if mobile_app_broadcast_success:
                        results_summary.append(str(_("Mobile App Broadcast: Success.")))
                    else:
                        mab_log_entry = next((log for log in log_entries if log.channel == 'mobile_app_broadcast' and log.status == 'FAILED'), None)
                        error_detail = mab_log_entry.details if mab_log_entry else 'Unknown error'
                        results_summary.append(str(_("Mobile App Broadcast: Failed (%(error)s).", error=error_detail)))
                        any_failures = True

                if results_summary:
                    final_message = str(_("Dissemination Result: ")) + " ".join(results_summary)
                    if any_failures:
                        flash(final_message, "warning")
                    else:
                        flash(final_message, "success")
                elif not processed_channels: # Should not happen if form validates, but as a fallback
                     flash(_("No channels were processed."), "info")

            return redirect(url_for("DisseminatedBulletinLogModelView.list"))
        
        elif request.method == "POST": # Form validation failed
            flash(_("Please correct the errors below and try again."), "danger")

        return self.render_template(
            "dissemination/disseminate_form.html", 
            form=form,
            bulletins=bulletins_query, 
            email_groups=email_groups_query,
            whatsapp_groups=whatsapp_groups_query, # Pass WhatsApp groups to template
            bulletins_json=bulletins_json_for_template,
            email_groups_json=email_groups_json_for_template,
            whatsapp_groups_json=whatsapp_groups_json_for_template, # Pass JSON to template
            selected_bulletin=selected_bulletin_for_template
        )

class EmailGroupsSPAView(BaseSupersetView): # Inherit from BaseSupersetView
    route_base = "/emailgroups" 
    class_permission_name = "EmailGroups" # Define class permission name for consistency and potential future use

    @expose("/list/")
    @has_access # Use has_access for SPA views, usually tied to class_permission_name 'can_list' or a specific permission
    def list(self):
        # This method will be used by the SPA to render its main page.
        # You can pass initial data or configuration to the template if needed.
        # For a pure SPA, this might just render a basic HTML template that loads the React app.
        return super().render_app_template() # Use the method from BaseSupersetView or equivalent


class WhatsAppGroupsSPAView(BaseSupersetView):
    route_base = "/whatsappgroups"
    class_permission_name = "WhatsAppGroups"

    @expose("/list/")
    @has_access
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