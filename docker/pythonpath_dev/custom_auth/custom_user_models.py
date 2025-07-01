from flask_appbuilder.security.sqla.models import User, RegisterUser
from sqlalchemy import Column, String

class CustomRegisterUser(RegisterUser):
    """
    Custom RegisterUser model with additional fields
    """
    __tablename__ = 'ab_register_user'
    
    position = Column(String(100), nullable=True)
    gender_preference = Column(String(50), nullable=True)
    age_category = Column(String(50), nullable=True)
    has_disability = Column(String(10), nullable=True)
    disability_type = Column(String(255), nullable=True)  # For comma-separated values
    contact_number = Column(String(50), nullable=True)

class CustomUser(User):
    """
    Custom User model with additional fields
    """
    __tablename__ = 'ab_user'
    
    position = Column(String(100), nullable=True)
    gender_preference = Column(String(50), nullable=True)
    age_category = Column(String(50), nullable=True)
    has_disability = Column(String(10), nullable=True)
    disability_type = Column(String(255), nullable=True)
    contact_number = Column(String(50), nullable=True) 