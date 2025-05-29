from flask_appbuilder.security.forms import RegisterUserDBForm
from flask_babel import lazy_gettext
from wtforms import StringField, SelectField, PasswordField
from wtforms.validators import DataRequired, Email, EqualTo
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
    gender = SelectField(
        lazy_gettext('Gender'),
        choices=[
            ('', '-- Select Gender --'),
            ('Female', 'Female'),
            ('Male', 'Male'),
            ('Non-binary', 'Non-binary'),
            ('Other', 'Other'),
            ('Prefer not to say', 'Prefer not to say')
        ],
        validators=[DataRequired()],
        widget=Select2Widget()
    )
    age_range = SelectField(
        lazy_gettext('Age Range'),
        choices=[
            ('', '-- Select Age Range --'),
            ('Under 18', 'Under 18'),
            ('18-24', '18-24'),
            ('25-34', '25-34'),
            ('35-44', '35-44'),
            ('45-54', '45-54'),
            ('55-64', '55-64'),
            ('65 or Over', '65 or Over')
        ],
        validators=[DataRequired()],
        widget=Select2Widget()
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
            {"fields": ["first_name", "last_name", "email", "gender", "age_range"], "expanded": True},
        ),
    ]
    show_fieldsets = [
        (
            lazy_gettext("User info"),
            {"fields": ["username", "active", "roles", "login_count"]},
        ),
        (
            lazy_gettext("Personal Info"),
            {"fields": ["first_name", "last_name", "email", "gender", "age_range"], "expanded": True},
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
        "gender": lazy_gettext("Gender"), # Custom label
        "age_range": lazy_gettext("Age Range"), # Custom label
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
        self, username, first_name, last_name, email, password="", gender="", age_range=""
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
        register_user.gender = gender
        register_user.age_range = age_range
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
            gender=form.gender.data,  # Pass the gender field to add_register_user
            age_range=form.age_range.data,  # Pass the age range field to add_register_user
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
        gender="",
        age_range="",
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
        user.gender = gender
        user.age_range = age_range
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
                gender=register_user.gender, 
                age_range=register_user.age_range,
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