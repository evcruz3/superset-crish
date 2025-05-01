from flask_appbuilder.security.forms import RegisterUserDBForm
from flask_babel import lazy_gettext
from wtforms import StringField
from wtforms.validators import DataRequired

from superset.security.manager import SupersetSecurityManager
from .custom_user_models import CustomUser, CustomRegisterUser


class CustomRegisterUserDBForm(RegisterUserDBForm):
    """
    Custom registration form with additional fields
    """
    # Add your custom fields here
    gender = StringField(lazy_gettext('Gender'), validators=[DataRequired()])
    age_range = StringField(lazy_gettext('Age Range'), validators=[DataRequired()])
    # You can add more fields as needed


class CustomSecurityManager(SupersetSecurityManager):
    """
    Custom security manager that uses the custom registration form and user models
    """
    registeruserdbform = CustomRegisterUserDBForm
    user_model = CustomUser
    registeruser_model = CustomRegisterUser

    def add_register_user(
        self, username, first_name, last_name, email, password="", gender="", age_range=""
    ):
        """
        Custom add_register_user method to handle additional fields
        """
        register_user = self.registeruser_model()
        register_user.username = username
        register_user.email = email
        register_user.first_name = first_name
        register_user.last_name = last_name
        register_user.password = password
        register_user.gender = gender  # Store the gender field
        register_user.age_range = age_range  # Store the age range field
        register_user.registration_hash = self.get_registration_hash()
        self.add_register_user_db_session(register_user)
        return register_user

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
        password="",
        gender="",
        age_range="",
    ):
        """
        Override add_user to include custom fields when creating a user
        """
        user = self.user_model()
        user.first_name = first_name
        user.last_name = last_name
        user.username = username
        user.email = email
        user.active = True
        user.gender = gender  # Save the gender field
        user.age_range = age_range  # Save the age range field
        user.roles.append(role)
        user.password = password
        self.get_session.add(user)
        self.get_session.commit()
        return user

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
                password=register_user.password,
                gender=register_user.gender,  # Transfer the gender field
                age_range=register_user.age_range,  # Transfer the age range field
            )
            return user
        return None 