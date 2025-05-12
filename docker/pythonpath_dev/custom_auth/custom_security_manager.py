from flask_appbuilder.security.forms import RegisterUserDBForm
from flask_babel import lazy_gettext
from wtforms import StringField, SelectField
from wtforms.validators import DataRequired
# Import the original RegisterUserDBView directly
from flask_appbuilder.security.registerviews import RegisterUserDBView as FabRegisterUserDBView
# Import base UserDBModelView
from flask_appbuilder.security.views import UserDBModelView as FabUserDBModelView # Corrected import alias
import uuid # Import uuid
from werkzeug.security import generate_password_hash # Import for password hashing
import logging # Add logging import

log = logging.getLogger(__name__) # Add logger instance
# from superset import const as c # Optional: for FAB's log constants

from superset.security.manager import SupersetSecurityManager
from .custom_user_models import CustomUser, CustomRegisterUser


# Define the custom form class FIRST
class CustomRegisterUserDBForm(RegisterUserDBForm):
    """
    Custom registration form with additional fields
    """
    # Add your custom fields here
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
        validators=[DataRequired()]
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
        validators=[DataRequired()]
    )
    # You can add more fields as needed


# Define your custom registration view inheriting from the original SECOND
class CustomRegisterUserDBView(FabRegisterUserDBView):
    # Explicitly set the template to use
    form_template = "appbuilder/general/security/register_user.html"
    # Explicitly set the form class to use - NOW it's defined
    form = CustomRegisterUserDBForm


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
    registeruserdbform = CustomRegisterUserDBForm
    user_model = CustomUser
    registeruser_model = CustomRegisterUser
    # Point to the custom view
    registeruserdbview = CustomRegisterUserDBView
    userdbmodelview = CustomUserDBModelView # Use the custom user view

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