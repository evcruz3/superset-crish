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

# Association table for DisseminatedBulletinLog and EmailGroup
dissemination_email_group_association = Table(
    'dissemination_email_group_association',
    Model.metadata,
    Column('disseminated_bulletin_log_id', Integer, ForeignKey('disseminated_bulletin_logs.id'), primary_key=True),
    Column('email_group_id', Integer, ForeignKey('email_groups.id'), primary_key=True)
)

# Association table for DisseminatedBulletinLog and WhatsAppGroup
dissemination_whatsapp_group_association = Table(
    'dissemination_whatsapp_group_association',
    Model.metadata,
    Column('disseminated_bulletin_log_id', Integer, ForeignKey('disseminated_bulletin_logs.id'), primary_key=True),
    Column('whatsapp_group_id', Integer, ForeignKey('whatsapp_groups.id'), primary_key=True)
)

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

class WhatsAppGroup(Model):
    __tablename__ = 'whatsapp_groups'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    # Storing phone numbers as a comma-separated string. 
    # Ensure numbers include country codes and are validated appropriately before saving if possible.
    phone_numbers = Column(Text, nullable=True) 
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
    email_groups = relationship('EmailGroup', secondary=dissemination_email_group_association, backref='disseminated_bulletin_logs', lazy='selectin')
    whatsapp_groups = relationship('WhatsAppGroup', secondary=dissemination_whatsapp_group_association, backref='disseminated_bulletin_logs', lazy='selectin')
    disseminated_by = relationship('User', foreign_keys=[disseminated_by_fk])

    @property
    def associated_email_group_names(self):
        if not self.email_groups:
            return "[No Email Groups]"
        return ", ".join(sorted([group.name for group in self.email_groups]))

    @property
    def associated_whatsapp_group_names(self):
        if not self.whatsapp_groups:
            return "[No WhatsApp Groups]"
        return ", ".join(sorted([group.name for group in self.whatsapp_groups]))

    def __repr__(self):
        # Updated repr to handle multiple email groups
        email_group_names = ', '.join([eg.name for eg in self.email_groups]) if self.email_groups else "No Email Groups"
        whatsapp_group_names = ', '.join([wg.name for wg in self.whatsapp_groups]) if self.whatsapp_groups else "No WhatsApp Groups"
        
        group_info_parts = []
        if self.email_groups:
            group_info_parts.append(f"Email Groups: {email_group_names}")
        if self.whatsapp_groups:
            group_info_parts.append(f"WhatsApp Groups: {whatsapp_group_names}")

        group_info = ", ".join(group_info_parts)
        if not group_info: # if no email groups and no whatsapp groups
            group_info = "No Groups"

        return f"Log for Bulletin ID: {self.bulletin_id} to {group_info} at {self.sent_at}"

# You might need to add these models to Superset's models/__init__.py
# so they are recognized by Flask-AppBuilder / Alembic for migrations. 