from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from flask_appbuilder.security.sqla.models import User
from superset.models.bulletins import Bulletin # To link to the existing Bulletin model

# Association table for Many-to-Many between EmailGroup and User (if storing emails directly from users)
# For simplicity now, we are storing emails as a text field in EmailGroup.
# If we wanted to link to existing Superset users or a dedicated EmailContact model,
# a many-to-many table would be appropriate here.

class EmailGroup(Model):
    __tablename__ = 'email_groups'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    # Storing emails as a comma-separated string. Consider JSON type if DB supports well.
    emails = Column(Text, nullable=True) 
    description = Column(Text, nullable=True)

    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    changed_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_fk = Column(Integer, ForeignKey('ab_user.id'), nullable=True)
    changed_by_fk = Column(Integer, ForeignKey('ab_user.id'), nullable=True)

    created_by = relationship('User', foreign_keys=[created_by_fk])
    changed_by = relationship('User', foreign_keys=[changed_by_fk])

    def __repr__(self):
        return self.name

class DisseminatedBulletinLog(Model):
    __tablename__ = 'disseminated_bulletin_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    bulletin_id = Column(Integer, ForeignKey('bulletins.id'), nullable=False)
    email_group_id = Column(Integer, ForeignKey('email_groups.id'), nullable=True)
    
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Status: e.g., "SUCCESS", "PARTIAL_SUCCESS", "FAILED", "PENDING"
    status = Column(String(50), nullable=False, default="PENDING")
    subject_sent = Column(String(500), nullable=False)
    message_body_sent = Column(Text, nullable=False) # The actual content sent
    
    # Store any error messages or details from the send operation
    details = Column(Text, nullable=True) 

    disseminated_by_fk = Column(Integer, ForeignKey('ab_user.id'), nullable=False)

    # New field to store the channel of dissemination
    channel = Column(String(50), nullable=True) # e.g., 'email', 'facebook', 'email_and_facebook'

    # Relationships
    bulletin = relationship('Bulletin', foreign_keys=[bulletin_id])
    email_group = relationship('EmailGroup', foreign_keys=[email_group_id])
    disseminated_by = relationship('User', foreign_keys=[disseminated_by_fk])

    def __repr__(self):
        return f"Log for Bulletin ID: {self.bulletin_id} to Group ID: {self.email_group_id} at {self.sent_at}"

# You might need to add these models to Superset's models/__init__.py
# so they are recognized by Flask-AppBuilder / Alembic for migrations. 