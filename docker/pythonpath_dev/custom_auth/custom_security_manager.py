from flask_appbuilder.security.forms import RegisterUserDBForm
from flask_babel import lazy_gettext
from wtforms import StringField, SelectField, PasswordField, SelectMultipleField
from wtforms.validators import DataRequired, Email, EqualTo
from wtforms.widgets import ListWidget, CheckboxInput
# Import the original RegisterUserDBView directly
from flask_appbuilder.security.registerviews import RegisterUserDBView as FabRegisterUserDBView
# Import base UserDBModelView
from flask_appbuilder.security.views import UserDBModelView as FabUserDBModelView # Corrected import alias
from flask_appbuilder.widgets import FormWidget
from flask_appbuilder.forms import DynamicForm
from flask_appbuilder.fieldwidgets import BS3TextFieldWidget, BS3PasswordFieldWidget, Select2Widget
from flask_wtf.recaptcha import RecaptchaField
import uuid # Import uuid
from werkzeug.security import generate_password_hash # Import for password hashing
import logging # Add logging import

# Additional imports for password reset
from flask import current_app, url_for, flash, redirect, request, g
from flask_appbuilder.baseviews import expose
from flask_appbuilder.security.forms import ResetPasswordForm # Reusing FAB's form
from flask_appbuilder.views import SimpleFormView
from itsdangerous import URLSafeTimedSerializer

# Import Optional for type hinting
from typing import Optional

# Import BuildError for exception handling
from werkzeug.routing import BuildError

log = logging.getLogger(__name__) # Add logger instance
logger = logging.getLogger(__name__) # Add logger instance for sync_role_definitions
# from superset import const as c # Optional: for FAB's log constants

from superset.security.manager import SupersetSecurityManager
from .custom_user_models import CustomUser, CustomRegisterUser


# Define the custom form class FIRST
class CustomRegisterUserDBForm(DynamicForm):
    """
    Custom registration form with additional fields in a specific order.
    """
    # Standard fields from original RegisterUserDBForm
    username = StringField(
        lazy_gettext("User Name"), # Note: Superset's default might use email as username. If so, this field might be redundant or handled differently.
        validators=[DataRequired()],
        widget=BS3TextFieldWidget(),
    )
    first_name = StringField(
        lazy_gettext("First Name"),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget(),
    )
    last_name = StringField(
        lazy_gettext("Last Name"),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget(),
    )
    # Custom fields inserted in the desired order
    position = StringField(
        lazy_gettext('Position'),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget()
    )
    contact_number = StringField(
        lazy_gettext('Contact Number'),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget()
    )
    gender_preference = SelectField(
        lazy_gettext('Gender Preference'),
        choices=[
            ('', '-- Select Gender Preference --'),
            ('Male', 'Male'),
            ('Female', 'Female'),
            ('Prefer not to say', 'Prefer not to say'),
            ('Other', 'Other')
        ],
        validators=[DataRequired()],
        widget=Select2Widget()
    )
    age_category = SelectField(
        lazy_gettext('Age category (years old)'),
        choices=[
            ('', '-- Select Age Category --'),
            ('Bellow 18', 'Bellow 18'),
            ('Between 19-49', 'Between 19-49'),
            ('More 50', 'More 50')
        ],
        validators=[DataRequired()],
        widget=Select2Widget()
    )
    has_disability = SelectField(
        lazy_gettext('Do you consider yourself as a person with disabilities?'),
        choices=[
            ('No', 'No'),
            ('Yes', 'Yes')
        ],
        validators=[DataRequired()],
        widget=Select2Widget()
    )
    disability_type = SelectMultipleField(
        lazy_gettext('Select the types of disabilities:'),
        choices=[
            ('Seeing', 'Seeing'),
            ('Listening', 'Listening'),
            ('Walking', 'Walking'),
            ('Speaking', 'Speaking'),
            ('Others', 'Others')
        ],
        widget=ListWidget(prefix_label=False),
        option_widget=CheckboxInput(),
    )
    email = StringField(
        lazy_gettext("Email"),
        validators=[DataRequired(), Email()],
        widget=BS3TextFieldWidget(),
    )
    password = PasswordField(
        lazy_gettext("Password"),
        description=lazy_gettext(
            "Please use a good password policy,"
            " this application does not check this for you"
        ),
        validators=[DataRequired()], # Consider adding PasswordComplexityValidator() if FAB version supports it here
        widget=BS3PasswordFieldWidget(),
    )
    conf_password = PasswordField(
        lazy_gettext("Confirm Password"),
        description=lazy_gettext("Please rewrite the password to confirm"),
        validators=[EqualTo("password", message=lazy_gettext("Passwords must match"))],
        widget=BS3PasswordFieldWidget(),
    )
    recaptcha = RecaptchaField()
    # You can add more fields as needed if they were in the original form


# Define your custom form widget
class RegisterUserFormWidget(FormWidget):
    template = 'appbuilder/general/security/widgets/register_form_widget.html' # <--- YOUR NEW WIDGET TEMPLATE


# Define your custom registration view inheriting from the original SECOND
class CustomRegisterUserDBView(FabRegisterUserDBView):
    # Explicitly set the template to use
    form_template = "appbuilder/general/security/register_user.html"
    # Explicitly set the form class to use - NOW it's defined
    form = CustomRegisterUserDBForm
    edit_widget = RegisterUserFormWidget # <--- ASSIGN YOUR CUSTOM WIDGET HERE


# New Forms and Views for Password Reset

class ForgotPasswordForm(DynamicForm):
    email = StringField(
        lazy_gettext("Your Email"),
        validators=[DataRequired(), Email()],
        widget=BS3TextFieldWidget(),
        description=lazy_gettext("Enter the email associated with your account."),
    )

class ForgotPasswordView(SimpleFormView):
    route_base = "/forgotpassword"
    form = ForgotPasswordForm
    form_template = "appbuilder/general/security/forgot_password_form.html"
    email_body_template = (
        "To reset your password, please click the link below:<br><br>"
        "{reset_url}<br><br>"
        "If you did not request a password reset, please ignore this email."
    )

    _form_title_lazy = lazy_gettext("Forgot Password")
    _email_subject_lazy = lazy_gettext("Password Reset Request")

    @property
    def form_title(self):
        return self._form_title_lazy

    @property
    def email_subject(self):
        return self._email_subject_lazy

    @expose("/form", methods=["GET", "POST"])
    def this_form(self):
        self._init_vars()
        form = self.form.refresh()
        if request.method == "POST" and form.validate_on_submit():
            self.form_post(form)
            # Redirect even if user not found to prevent email enumeration
            flash(lazy_gettext("If your email is in our system, you will receive instructions to reset your password."), "info")
            return redirect(self.appbuilder.get_url_for_index)
        widgets = self._get_edit_widget(form=form)
        return self.render_template(
            self.form_template,
            title=self.form_title,
            widgets=widgets,
            form=form,
            appbuilder=self.appbuilder,
        )

    def form_post(self, form: DynamicForm) -> None:
        user = self.appbuilder.sm.find_user(email=form.email.data)
        if user:
            token = self.appbuilder.sm.generate_password_reset_token(user.email)
            reset_url = url_for(
                f"{self.appbuilder.sm.resetpasswordconfirmview_class.__name__}.this_form",
                _external=True,
                token=token,
            )
            # In a real application, you would email this URL to the user
            log.info(f"Password reset requested for {user.email}. Reset URL: {reset_url}")
            self.appbuilder.sm.send_password_reset_email(user.email, reset_url)
            # Flash message moved to this_form to always show after POST


class ResetPasswordConfirmView(SimpleFormView):
    route_base = "/resetpasswordconfirm"
    form = ResetPasswordForm # Reusing FAB's form
    form_template = "appbuilder/general/security/reset_password_form.html" # You might need to create this template
    redirect_url = "/" # Redirect to home page after successful reset
    token_max_age_seconds = 3600 # Token valid for 1 hour

    _form_title_lazy = "Reset Your Password"  # Plain string
    _message_lazy = "Password successfully reset. Please log in with your new password."  # Plain string
    _error_message_lazy = "Invalid or expired password reset link."  # Plain string

    @property
    def form_title(self):
        return self._form_title_lazy

    @property
    def message(self):
        return self._message_lazy

    @property
    def error_message(self):
        return self._error_message_lazy

    def _init_vars(self):
        super()._init_vars()
        # Pass the token max age to the template or form if needed for display
        # For now, it's used server-side only

    @expose("/form", methods=["GET", "POST"])
    @expose("/form/<token>", methods=["GET", "POST"])
    def this_form(self, token: str = None):
        self._init_vars()
        
        if request.method == "GET" and not token:
            token = request.args.get("token")

        if not token:
            flash(self.error_message, "danger")
            return redirect(self.appbuilder.get_url_for_login)

        email = self.appbuilder.sm.verify_password_reset_token(token, self.token_max_age_seconds)
        if not email:
            flash(self.error_message, "danger")
            return redirect(self.appbuilder.get_url_for_login)

        form = self.form.refresh()
        if request.method == "POST" and form.validate_on_submit():
            # Verify token again before processing post, in case it expired while form was open
            email_on_post = self.appbuilder.sm.verify_password_reset_token(token, self.token_max_age_seconds)
            if not email_on_post:
                flash(self.error_message, "danger")
                return redirect(self.appbuilder.get_url_for_login)
            
            user = self.appbuilder.sm.find_user(email=email_on_post)
            if not user:
                flash(self.error_message, "danger") # Should not happen if token was valid
                return redirect(self.appbuilder.get_url_for_login)

            self.form_post(form, user_id=user.id) # Pass user_id to form_post
            flash(self.message, "info")
            return redirect(self.appbuilder.get_url_for_login) # Redirect to login after successful reset

        widgets = self._get_edit_widget(form=form)
        return self.render_template(
            self.form_template,
            title=self.form_title,
            widgets=widgets,
            form=form,
            appbuilder=self.appbuilder,
            token=token # Pass token to template if form action needs it or for display
        )

    def form_post(self, form: DynamicForm, user_id: int) -> None: # Modified to accept user_id
        self.appbuilder.sm.reset_password(user_id, form.password.data)
        # Flash message handled in this_form

# Define your custom UserDBModelView
class CustomUserDBModelView(FabUserDBModelView): # Ensure this inherits from the aliased FabUserDBModelView
    user_show_fieldsets = [
        (
            lazy_gettext("User info"),
            {"fields": ["username", "active", "roles", "login_count"]},
        ),
        (
            lazy_gettext("Personal Info"),
            {"fields": ["first_name", "last_name", "email", "position", "contact_number", "gender_preference", "age_category", "has_disability", "disability_type"], "expanded": True},
        ),
    ]
    show_fieldsets = [
        (
            lazy_gettext("User info"),
            {"fields": ["username", "active", "roles", "login_count"]},
        ),
        (
            lazy_gettext("Personal Info"),
            {"fields": ["first_name", "last_name", "email", "position", "contact_number", "gender_preference", "age_category", "has_disability", "disability_type"], "expanded": True},
        ),
        (
            lazy_gettext("Audit Info"),
            {
                "fields": [
                    "last_login",
                    "fail_login_count",
                    "created_on",
                    "created_by",
                    "changed_on",
                    "changed_by",
                ],
                "expanded": False,
            },
        ),
    ]
    label_columns = {
        # **FabUserDBModelView.label_columns, # This might cause issues if FabUserDBModelView doesn't have this directly
        # Instead, let's copy from the parent or define explicitly if needed
        "first_name": lazy_gettext("First Name"),
        "last_name": lazy_gettext("Last Name"),
        "username": lazy_gettext("User Name"),
        "active": lazy_gettext("Is Active?"),
        "email": lazy_gettext("Email"),
        "roles": lazy_gettext("Role"),
        "last_login": lazy_gettext("Last login"),
        "login_count": lazy_gettext("Login count"),
        "fail_login_count": lazy_gettext("Failed login count"),
        "created_on": lazy_gettext("Created on"),
        "created_by": lazy_gettext("Created by"),
        "changed_on": lazy_gettext("Changed on"),
        "changed_by": lazy_gettext("Changed by"),
        "position": lazy_gettext("Position"),
        "contact_number": lazy_gettext("Contact Number"),
        "gender_preference": lazy_gettext("Gender Preference"),
        "age_category": lazy_gettext("Age Category"),
        "has_disability": lazy_gettext("Has Disability?"),
        "disability_type": lazy_gettext("Disability Type"),
    }


class CustomSecurityManager(SupersetSecurityManager):
    """
    Custom security manager that uses the custom registration form and user models
    """
    user_model = CustomUser
    registeruser_model = CustomRegisterUser
    registeruserdbform = CustomRegisterUserDBForm
    # Point to the custom view
    registeruserdbview = CustomRegisterUserDBView
    userdbmodelview = CustomUserDBModelView # Use the custom user view

    # Expose view CLASSES for external registration
    forgotpasswordview_class = ForgotPasswordView
    resetpasswordconfirmview_class = ResetPasswordConfirmView

    # Health Official specific permissions - things they CAN do that Gamma users cannot
    HEALTH_OFFICIAL_PERMISSIONS = {
        "can_write",  # Allow editing health data
        "can_add",    # Allow adding new health records
        "can_edit",   # Allow editing existing records
    }

    # Health modules that Health Officials should have full access to
    HEALTH_OFFICIAL_VIEW_MENUS = {
        "disease_forecast_alert",  # From DiseaseForecastAlertRestApi
        "weather_forecast_alerts", 
        "health_facilities",  # From HealthFacilitiesRestApi
        "bulletins_and_advisories",  # From BulletinsRestApi
        "email_groups",  # From EmailGroupsRestApi  
        "whatsapp_groups",  # From WhatsAppGroupsRestApi
        "weather_forecasts",  # From WeatherForecastsApi
        "air_quality_forecasts",
        "disease_pipeline_run_history",  # From DiseasePipelineRunHistoryRestApi
        # Also include variations that might exist
        "dissemination",
        "Bulletins",
        "Health Facilities", 
        "Dissemination"
    }

    # Field Worker specific permissions - focused on read access and uploads
    FIELD_WORKER_PERMISSIONS = {
        "can_read",  # Basic read-only access
        "can_this_form_get",  # For form viewing (uploads, profile)
        "can_this_form_post",  # For form submission (uploads, profile)
        "menu_access",  # Menu access to relevant sections
    }

    # Field Worker modules - read access to data and upload capabilities
    FIELD_WORKER_VIEW_MENUS = {
        "health_facilities",  # View facility information
        "update_case_reports",  # Upload disease case data
        "weather_forecasts",  # View weather context for field work
        "bulletins_and_advisories",  # View health bulletins
        "whatsapp_groups",  # Read WhatsApp group information
        # API variations
        "UpdateCaseReportsRestApi",
        "HealthFacilitiesRestApi", 
        "WeatherForecastsApi",
        "BulletinsRestApi",
        "WhatsAppGroupsRestApi",
    }

    def __init__(self, appbuilder):
        super().__init__(appbuilder)
        # Initialize the serializer for password reset tokens
        self.pwd_reset_serializer = URLSafeTimedSerializer(
            current_app.config["SECRET_KEY"], salt="password-reset"
        )
        # DO NOT register views here; it will be done in superset/initialization/__init__.py

    def get_url_for_forgot_password_form(self):
        try:
            # This endpoint name is standard if FAB registers the view class directly
            return url_for("ForgotPasswordView.this_form")
        except BuildError:
            log.error("Could not build URL for ForgotPasswordView.this_form in get_url_for_forgot_password_form")
            return "#error-generating-url-forgot-password" # Fallback URL

    def _get_password_stamp(self, user_password_hash: str) -> str:
        """Helper to get a consistent stamp from the password hash."""
        # Example: use a portion of the hash. Adjust if your hash format differs.
        # This is a simple way; a more robust way might involve hashing the hash.
        parts = user_password_hash.split('$')
        if len(parts) > 1: # Handles common formats like scrypt:salt:hash or pbkdf2:alg:salt:hash
            return parts[-1][:8] # Take first 8 chars of the actual hash part
        return user_password_hash[:8] # Fallback for simpler hashes

    def generate_password_reset_token(self, email: str) -> Optional[str]:
        """
        Generates a secure, timed token for password reset,
        including a stamp from the user's current password hash.
        """
        user = self.find_user(email=email)
        if not user or not user.password: # Ensure user and password hash exist
            return None
        
        password_stamp = self._get_password_stamp(user.password)

        try:
            return self.pwd_reset_serializer.dumps({
                "user_id": user.id, 
                "email": email,
                "password_stamp": password_stamp
            })
        except Exception as e:
            log.error(f"Error generating password reset token for {email}: {e}", exc_info=True)
            return None

    def verify_password_reset_token(self, token: str, max_age_seconds: int) -> Optional[str]:
        """
        Verifies a password reset token (timed and password-stamped)
        and returns the user's email if valid.
        """
        if not token:
            return None
        try:
            data = self.pwd_reset_serializer.loads(token, max_age=max_age_seconds)
            user_id = data.get("user_id")
            token_email = data.get("email")
            original_password_stamp = data.get("password_stamp")

            if not all([user_id, token_email, original_password_stamp]):
                log.warning("Password reset token is missing expected data.")
                return None

            user = self.get_user_by_id(user_id)
            if not user or not user.password: # User must exist and have a password
                log.warning(f"User not found or no password for ID {user_id} from token.")
                return None

            if user.email != token_email: # Email check
                log.warning("Token email does not match user's current email.")
                return None

            current_password_stamp = self._get_password_stamp(user.password)
            if current_password_stamp != original_password_stamp:
                log.warning("Password stamp mismatch. Password may have been changed since token issuance.")
                return None
            
            return user.email # Valid token for this user and password state
        except Exception as e: # Catches expired, invalid, tampered tokens, or other errors
            log.warning(f"Invalid, expired, or malformed password reset token received: {e}")
            return None

    def add_register_user(
        self, username, first_name, last_name, email, password="",
        position="", contact_number="", gender_preference="", age_category="",
        has_disability="", disability_type=None
    ):
        """
        Custom add_register_user method to handle additional fields.
        Now directly handles session and commit.
        """
        register_user = self.registeruser_model()
        register_user.username = username
        register_user.email = email
        register_user.first_name = first_name
        register_user.last_name = last_name
        register_user.password = generate_password_hash(password)
        register_user.position = position
        register_user.contact_number = contact_number
        register_user.gender_preference = gender_preference
        register_user.age_category = age_category
        register_user.has_disability = has_disability
        # Join list of disability types into a string
        register_user.disability_type = ", ".join(disability_type) if disability_type else ""
        register_user.registration_hash = str(uuid.uuid1())
        try:
            self.appbuilder.get_session.add(register_user)
            self.appbuilder.get_session.commit()
            log.info(f"Successfully added registration for user: {username}") # Example log
            return register_user
        except Exception as e:
            # Use FAB's constant if available, or a generic message
            # log_msg = getattr(c, 'LOGMSG_ERR_SEC_ADD_REGISTER_USER', "Error adding register user")
            log.error("Error adding register user to the database.", exc_info=True) # Log with exception info
            self.appbuilder.get_session.rollback()
            return None

    def register_user(self, form):
        """
        Override register_user to save the custom fields
        """
        self.add_register_user(
            username=form.username.data,
            first_name=form.first_name.data,
            last_name=form.last_name.data,
            email=form.email.data,
            password=form.password.data,
            position=form.position.data,
            contact_number=form.contact_number.data,
            gender_preference=form.gender_preference.data,
            age_category=form.age_category.data,
            has_disability=form.has_disability.data,
            disability_type=form.disability_type.data,
        )
        
    def add_user(
        self,
        username,
        first_name,
        last_name,
        email,
        role,
        password="",       # For plain password
        hashed_password="", # For already hashed password
        position="",
        contact_number="",
        gender_preference="",
        age_category="",
        has_disability="",
        disability_type="",
    ):
        """
        Override add_user to include custom fields when creating a user.
        Now accepts hashed_password.
        """
        user = self.user_model()
        user.first_name = first_name
        user.last_name = last_name
        user.username = username
        user.email = email
        user.active = True # User is activated by clicking the link
        user.position = position
        user.contact_number = contact_number
        user.gender_preference = gender_preference
        user.age_category = age_category
        user.has_disability = has_disability
        user.disability_type = disability_type
        # Ensure role is a list if it isn't already
        user.roles = role if isinstance(role, list) else [role]

        if hashed_password:
            user.password = hashed_password
        elif password:
            user.password = generate_password_hash(password)
        # Else, if neither is provided, password remains uninitialized (or handled by model default)

        try:
            self.appbuilder.get_session.add(user)
            self.appbuilder.get_session.commit()
            log.info(f"Successfully created user: {username}")
            return user
        except Exception as e:
            log.error(f"Error creating user {username}", exc_info=True)
            self.appbuilder.get_session.rollback()
            return None

    def create_db_user(self, registration_hash, user_data):
        """
        Override to transfer custom fields from registration to user
        """
        register_user = self.find_register_user(registration_hash)
        if register_user:
            user = self.add_user(
                username=register_user.username,
                first_name=register_user.first_name,
                last_name=register_user.last_name,
                email=register_user.email,
                role=self.find_role(self.auth_user_registration_role),
                hashed_password=register_user.password, # Pass hashed password
                position=register_user.position,
                contact_number=register_user.contact_number,
                gender_preference=register_user.gender_preference,
                age_category=register_user.age_category,
                has_disability=register_user.has_disability,
                disability_type=register_user.disability_type,
            )
            return user
        return None

    def send_password_reset_email(self, email: str, reset_url: str):
        """
        Sends the password reset email using the send_email_smtp utility.
        """
        log.info(f"[SM] Attempting to send password reset email to {email} with URL: {reset_url}")
        try:
            # Import the utility for sending emails
            from superset.utils.core import send_email_smtp

            subject = self.forgotpasswordview_class().email_subject
            # Ensure email_body_template is accessed correctly (it's a string on the class instance)
            body_template = self.forgotpasswordview_class().email_body_template
            html_content = body_template.format(reset_url=reset_url)

            # Basic check for essential SMTP configurations
            if not all(
                [
                    current_app.config.get("SMTP_HOST"),
                    current_app.config.get("SMTP_MAIL_FROM"),
                ]
            ):
                log.error(
                    "SMTP not configured. Missing SMTP_HOST or SMTP_MAIL_FROM. Cannot send password reset email."
                )
                return

            send_email_smtp(
                to=email,
                subject=str(subject),  # Ensure subject is a string here
                html_content=html_content,
                config=current_app.config,  # Pass the whole app config
                # No attachments, pdfs, or images for this email
            )
            log.info(f"Password reset email successfully sent to {email} via send_email_smtp.")
        except Exception as e:
            log.error(f"Error sending password reset email to {email} using send_email_smtp: {e}", exc_info=True)

    def _is_health_official_pvm(self, pvm):
        """
        Return True if the FAB permission/view is HealthOfficial user related, False otherwise.
        
        HealthOfficial role logic:
        - Start with Gamma permissions (basic read access)
        - Add SQL Lab access for health data queries
        - Add write/edit permissions for health-specific modules
        - Add access to specific health-related charts
        - Exclude admin-only functions
        
        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is HealthOfficial related
        """
        # Log specific permissions we're interested in
        if pvm.permission.name == "datasource_access":
            logger.debug(f"[HealthOfficial] Evaluating permission: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
        elif pvm.view_menu.name in {"UserInfoEditView", "UserDBModelView", "ResetMyPasswordView"} or "form" in pvm.permission.name.lower():
            logger.info(f"[HealthOfficial] 🔍 Evaluating user-related permission: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
        
        # PRIORITY CHECK: UserInfoEditView permissions FIRST before all other checks
        if pvm.view_menu.name == "UserInfoEditView":
            logger.info(f"[HealthOfficial] 🔍 EXPLICIT CHECK - UserInfoEditView permission: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            if pvm.permission.name in {"can_this_form_get", "can_this_form_post"}:
                logger.info(f"[HealthOfficial] ✅ EXPLICITLY GRANTED user profile edit: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
                return True
            else:
                logger.info(f"[HealthOfficial] ❌ EXPLICITLY DENIED unknown UserInfoEditView permission: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
                # Don't return False here - let it fall through to other checks
                logger.info(f"[HealthOfficial] ⚠️ FALLING THROUGH to other checks for UserInfoEditView permission: '{pvm.permission.name}'")
        
        # First check if this is accessible to all users
        if self._is_accessible_to_all(pvm):
            if pvm.permission.name == "datasource_access":
                logger.debug(f"[HealthOfficial] ✅ GRANTED via _is_accessible_to_all: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Exclude admin-only permissions
        if self._is_admin_only(pvm):
            if pvm.permission.name == "datasource_access":
                logger.debug(f"[HealthOfficial] ❌ DENIED - admin only: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return False
            
        # Check for health-related datasets BEFORE excluding user-defined permissions
        # This allows HealthOfficial to access specific health datasets
        if self._is_health_chart_access(pvm):
            # Logging is handled inside _is_health_chart_access method
            return True
        
        # Exclude user-defined permissions (those are handled separately)
        if self._is_user_defined_permission(pvm):
            if pvm.permission.name == "datasource_access":
                logger.debug(f"[HealthOfficial] ❌ DENIED - user defined: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return False
        
        # Include SQL Lab permissions for health data analysis
        if self._is_sql_lab_pvm(pvm):
            logger.debug(f"[HealthOfficial] ✅ GRANTED via SQL Lab: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Allow access to Database Connections (needed for health data queries)
        if (pvm.view_menu.name == "Database" and pvm.permission.name in {"can_read", "menu_access"}):
            logger.debug(f"[HealthOfficial] ✅ GRANTED database connection access: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # NOTE: UserInfoEditView permissions are now checked at the top of this function
        
        # Allow users to view their own info and reset password
        if (pvm.view_menu.name == "UserDBModelView" and pvm.permission.name in {"can_userinfo", "resetmypassword"}):
            logger.debug(f"[HealthOfficial] ✅ GRANTED user info access: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Allow password reset functionality
        if (pvm.view_menu.name == "ResetMyPasswordView" and pvm.permission.name in {"can_this_form_get", "can_this_form_post"}):
            logger.debug(f"[HealthOfficial] ✅ GRANTED password reset: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # For health-specific modules, allow write access (not just read)
        if (pvm.view_menu.name in self.HEALTH_OFFICIAL_VIEW_MENUS and 
            pvm.permission.name in self.HEALTH_OFFICIAL_PERMISSIONS):
            logger.debug(f"[HealthOfficial] ✅ GRANTED via health module write: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Include all Gamma permissions (basic read access)
        if self._is_gamma_pvm(pvm):
            if pvm.permission.name == "datasource_access":
                logger.debug(f"[HealthOfficial] ✅ GRANTED via Gamma permissions: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            elif pvm.view_menu.name == "UserInfoEditView":
                logger.info(f"[HealthOfficial] ✅ GRANTED via Gamma permissions (UserInfoEditView): '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Final denial
        if pvm.permission.name == "datasource_access":
            logger.debug(f"[HealthOfficial] ❌ FINAL DENIAL: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            
        return False

    def _is_field_worker_pvm(self, pvm):
        """
        Return True if the FAB permission/view is FieldWorker user related, False otherwise.
        
        FieldWorker role logic:
        - Start with Gamma permissions (basic read access)
        - Add specific upload permissions for case reports
        - Add self-service profile management permissions
        - Add access to health datasets for dashboard viewing
        - Focus on data collection workflow needs
        - No write/edit permissions except for uploads and profile
        
        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is FieldWorker related
        """
        # Log specific permissions we're interested in
        if pvm.permission.name == "datasource_access":
            logger.debug(f"[FieldWorker] Evaluating permission: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
        elif pvm.view_menu.name in {"UserInfoEditView", "UserDBModelView", "ResetMyPasswordView"} or "form" in pvm.permission.name.lower():
            logger.info(f"[FieldWorker] 🔍 Evaluating user-related permission: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
        
        # PRIORITY CHECK: UserInfoEditView permissions FIRST for profile self-editing
        if pvm.view_menu.name == "UserInfoEditView":
            logger.info(f"[FieldWorker] 🔍 EXPLICIT CHECK - UserInfoEditView permission: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            if pvm.permission.name in {"can_this_form_get", "can_this_form_post"}:
                logger.info(f"[FieldWorker] ✅ EXPLICITLY GRANTED user profile edit: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
                return True
            else:
                logger.info(f"[FieldWorker] ❌ EXPLICITLY DENIED unknown UserInfoEditView permission: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
                # Don't return False here - let it fall through to other checks
        
        # First check if this is accessible to all users
        if self._is_accessible_to_all(pvm):
            if pvm.permission.name == "datasource_access":
                logger.debug(f"[FieldWorker] ✅ GRANTED via _is_accessible_to_all: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Exclude admin-only permissions
        if self._is_admin_only(pvm):
            if pvm.permission.name == "datasource_access":
                logger.debug(f"[FieldWorker] ❌ DENIED - admin only: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return False
            
        # Check for health-related datasets for dashboard viewing
        if self._is_health_chart_access(pvm):
            logger.debug(f"[FieldWorker] ✅ GRANTED via health chart access: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Exclude user-defined permissions (handled separately)
        if self._is_user_defined_permission(pvm):
            if pvm.permission.name == "datasource_access":
                logger.debug(f"[FieldWorker] ❌ DENIED - user defined: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return False
        
        # Include SQL Lab permissions for basic data queries (read-only)
        if self._is_sql_lab_pvm(pvm):
            logger.debug(f"[FieldWorker] ✅ GRANTED via SQL Lab: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Allow access to Database Connections (needed for dashboard viewing)
        if (pvm.view_menu.name == "Database" and pvm.permission.name in {"can_read", "menu_access"}):
            logger.debug(f"[FieldWorker] ✅ GRANTED database connection access: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Allow users to view their own info and reset password
        if (pvm.view_menu.name == "UserDBModelView" and pvm.permission.name in {"can_userinfo", "resetmypassword"}):
            logger.debug(f"[FieldWorker] ✅ GRANTED user info access: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Allow password reset functionality
        if (pvm.view_menu.name == "ResetMyPasswordView" and pvm.permission.name in {"can_this_form_get", "can_this_form_post"}):
            logger.debug(f"[FieldWorker] ✅ GRANTED password reset: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # For field worker specific modules, allow the defined permissions
        if (pvm.view_menu.name in self.FIELD_WORKER_VIEW_MENUS and 
            pvm.permission.name in self.FIELD_WORKER_PERMISSIONS):
            logger.debug(f"[FieldWorker] ✅ GRANTED via field worker module access: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Include all Gamma permissions (basic read access)
        if self._is_gamma_pvm(pvm):
            if pvm.permission.name == "datasource_access":
                logger.debug(f"[FieldWorker] ✅ GRANTED via Gamma permissions: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            elif pvm.view_menu.name == "UserInfoEditView":
                logger.info(f"[FieldWorker] ✅ GRANTED via Gamma permissions (UserInfoEditView): '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            return True
        
        # Final denial
        if pvm.permission.name == "datasource_access":
            logger.debug(f"[FieldWorker] ❌ FINAL DENIAL: '{pvm.permission.name}' on '{pvm.view_menu.name}'")
            
        return False

    def _is_health_chart_access(self, pvm):
        """
        Check if this permission is for a health-related dataset that HealthOfficial should access
        Based on actual CRISH datasets visible in the system
        """
        # Actual health-related datasets/tables from CRISH system
        health_datasets = {
            # Weather-related datasets
            "combined weather parameter forecasts with heat index",
            "weather_forecast_alerts",
            
            # Disease-related datasets  
            "latest available weekly case reports",
            "disease_forecast",
            "disease_forecast_alerts", 
            "disease historical vs forecast",
            "tlhis_diseases",
            
            # Health facilities
            "health_facilities",
        }
        
        # Actual database name in CRISH system
        health_databases = {
            "superset"  # Main database name (checking lowercase since we convert view_name to lowercase)
        }
        
        # Check if this is datasource_access permission for health-related data
        if pvm.permission.name == "datasource_access":
            view_name = pvm.view_menu.name.lower()  # Convert to lowercase for consistent matching
            
            # Log the permission being checked
            logger.debug(f"[HealthOfficial] Checking datasource_access for: '{pvm.view_menu.name}' (lowercase: '{view_name}')")
            
            # Check for exact health dataset matches: [superset].[table_name](id:123)
            for dataset in health_datasets:
                dataset_lower = dataset.lower()
                dataset_pattern1 = f".{dataset_lower}"
                dataset_pattern2 = f".{dataset_lower}("
                
                # Match patterns like [superset].[dataset_name] or [superset].[dataset_name](id:
                if dataset_pattern1 in view_name or dataset_pattern2 in view_name:
                    logger.info(f"[HealthOfficial] ✅ GRANTED access to health dataset: '{dataset}' (matched pattern: '{dataset_pattern1}' in '{view_name}')")
                    return True
                else:
                    logger.debug(f"[HealthOfficial] ❌ No match for dataset '{dataset}' (pattern '{dataset_pattern1}' not in '{view_name}')")
            
            # Check for health database patterns: [superset].[anything]
            for database in health_databases:
                database_pattern = f"[{database}]."
                if database_pattern in view_name:
                    logger.info(f"[HealthOfficial] ✅ GRANTED access to health database: '{database}' (matched pattern: '{database_pattern}' in '{view_name}')")
                    return True
                else:
                    logger.debug(f"[HealthOfficial] ❌ No match for database '{database}' (pattern '{database_pattern}' not in '{view_name}')")
            
            # Log when no health datasets match
            logger.debug(f"[HealthOfficial] ❌ DENIED access - no health dataset patterns matched for: '{pvm.view_menu.name}'")
                    
        return False

    def sync_role_definitions(self):
        """
        Initialize roles including custom HealthOfficial and FieldWorker roles
        """
        logger.info("🏥 [CRISH] Syncing role definitions with HealthOfficial and FieldWorker")
        
        # Call parent method to create all standard roles
        super().sync_role_definitions()
        
        # Get all permission view menus once
        pvms = self._get_all_pvms()
        
        # Add HealthOfficial role using the same pattern as built-in roles
        self.set_role("HealthOfficial", self._is_health_official_pvm, pvms)
        
        # Add FieldWorker role for field data collection
        self.set_role("FieldWorker", self._is_field_worker_pvm, pvms)
        
        # Log the health datasets we're looking for
        health_datasets = {
            "combined weather parameter forecasts with heat index",
            "weather_forecast_alerts",
            "latest available weekly case reports", 
            "disease_forecast",
            "disease_forecast_alerts",
            "disease historical vs forecast",
            "tlhis_diseases",
            "health_facilities",
        }
        
        # Log the field worker modules
        field_worker_modules = {
            "health_facilities",
            "update_case_reports", 
            "weather_forecasts",
            "bulletins_and_advisories",
            "whatsapp_groups",
        }
        
        logger.info(f"🏥 [CRISH] HealthOfficial role created successfully with access to {len(health_datasets)} health datasets:")
        for dataset in sorted(health_datasets):
            logger.info(f"  📊 {dataset}")
        
        logger.info(f"👷 [CRISH] FieldWorker role created successfully with access to {len(field_worker_modules)} field modules:")
        for module in sorted(field_worker_modules):
            logger.info(f"  📱 {module}")
            
        logger.info("🏥 [CRISH] To troubleshoot permissions, check logs for '[HealthOfficial]' or '[FieldWorker]' entries") 