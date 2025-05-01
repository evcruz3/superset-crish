from flask_appbuilder.security.sqla.models import User, RegisterUser
from sqlalchemy import Column, String

class CustomRegisterUser(RegisterUser):
    """
    Custom RegisterUser model with additional fields
    """
    __tablename__ = 'ab_register_user'
    
    gender = Column(String(50), nullable=True)
    age_range = Column(String(50), nullable=True)

class CustomUser(User):
    """
    Custom User model with additional fields
    """
    __tablename__ = 'ab_user'
    
    gender = Column(String(50), nullable=True)
    age_range = Column(String(50), nullable=True) 