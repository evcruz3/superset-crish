from flask_appbuilder import ModelView, expose, BaseView
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from flask import redirect, url_for, request, flash, g # g for current user
from markupsafe import Markup # Import Markup
import json # Import the json library
import logging # Add logging import

from superset import appbuilder, db
from superset.models.dissemination import EmailGroup, DisseminatedBulletinLog
from superset.models.bulletins import Bulletin # For dropdown in dissemination form
from superset.utils.core import send_email_smtp # For sending emails
from superset.views.base import SupersetModelView, DeleteMixin
# Import the new form
from .forms import DisseminationForm
from superset.utils.pdf import generate_bulletin_pdf

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
        email_groups_query = db.session.query(EmailGroup).order_by(EmailGroup.name).all() # Renamed variable
        bulletins_json_for_template = self._bulletins_to_json(bulletins_query)
        email_groups_json_for_template = self._email_groups_to_json(email_groups_query) # Generate JSON for email groups

        form.bulletin_id.choices = [ (b.id, b.title) for b in bulletins_query ]
        form.bulletin_id.choices.insert(0, (0, _('-- Select a Bulletin --')))
        form.email_group_id.choices = [ (g.id, g.name) for g in email_groups_query ] # Use renamed variable
        form.email_group_id.choices.insert(0, (0, _('-- Select an Email Group --')))

        selected_bulletin_for_template = None

        if request.method == "GET":
            # Check for bulletin_id from query parameter for pre-selection
            preselect_bulletin_id_str = request.args.get('bulletin_id')
            if preselect_bulletin_id_str:
                try:
                    preselect_bulletin_id = int(preselect_bulletin_id_str)
                    # Check if this ID is valid and in our choices
                    if any(b.id == preselect_bulletin_id for b in bulletins_query):
                        form.bulletin_id.data = preselect_bulletin_id
                        selected_bulletin_for_template = db.session.query(Bulletin).get(preselect_bulletin_id)
                    else:
                        flash(_("Invalid bulletin ID provided for pre-selection."), "warning")
                except ValueError:
                    flash(_("Invalid bulletin ID format."), "warning")
            
            # Ensure default placeholder if no valid pre-selection or other data
            if form.bulletin_id.data is None or form.bulletin_id.data == 0:
                form.bulletin_id.data = 0 # Default to placeholder
            if form.email_group_id.data is None:
                form.email_group_id.data = 0

        if form.validate_on_submit():
            bulletin_id = form.bulletin_id.data
            email_group_id = form.email_group_id.data
            subject = form.subject.data
            message = form.message.data  # This is now the email body

            # Fetch the bulletin and email group
            bulletin = db.session.query(Bulletin).get(bulletin_id)
            email_group = db.session.query(EmailGroup).get(email_group_id) # Use correct variable

            # Generate PDF attachment
            pdf_buffer = generate_bulletin_pdf(bulletin)
            pdf_filename = f"{bulletin.title}.pdf"
            pdf_data = pdf_buffer.read()

            # Prepare email recipients
            recipient_emails_str = email_group.emails
            recipient_list = [e.strip() for e in recipient_emails_str.split(',') if e.strip()]

            try:
                # Use the pdf parameter for PDF attachments
                send_email_smtp(
                    to=",".join(recipient_list),
                    subject=subject,
                    html_content=message,  # Use the message field as the email body
                    pdf={pdf_filename: pdf_data},  # Correct format for PDF attachment
                    config=appbuilder.app.config
                )
                log_entry = DisseminatedBulletinLog(
                    bulletin_id=bulletin.id,
                    email_group_id=email_group.id,
                    subject_sent=subject,
                    message_body_sent=message,
                    disseminated_by_fk=g.user.id if g.user else None,
                    status="SUCCESS"
                )
                db.session.add(log_entry)
                db.session.commit()
                flash(_("Bulletin disseminated successfully to group '%(group_name)s'.", group_name=email_group.name), "info")
            except Exception as e:
                db.session.rollback()
                if 'log_entry' in locals() and log_entry.id:
                    log_entry.status = "FAILED"
                    log_entry.details = str(e)
                    db.session.commit()
                flash(_("Error disseminating bulletin: %(error)s", error=str(e)), "danger")
            
            return redirect(url_for("DisseminatedBulletinLogModelView.list"))
        elif request.method == "POST": # Form validation failed
            # Errors are in form.errors and will be displayed by the template
            flash(_("Please correct the errors below and try again."), "danger")

        # For GET request or if form validation failed on POST
        return self.render_template(
            "dissemination/disseminate_form.html", 
            form=form,
            bulletins=bulletins_query, 
            email_groups=email_groups_query, # Pass the query result (optional, could remove if unused)
            bulletins_json=bulletins_json_for_template,
            email_groups_json=email_groups_json_for_template, # Pass the email group JSON
            selected_bulletin=selected_bulletin_for_template # Pass the pre-selected bulletin details
        )

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