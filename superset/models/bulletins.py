from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from flask_appbuilder.security.sqla.models import User # For created_by relationship if not already there

class BulletinImageAttachment(Model):
    __tablename__ = 'bulletin_image_attachments'

    id = Column(Integer, primary_key=True)
    bulletin_id = Column(Integer, ForeignKey('bulletins.id'), nullable=False)
    s3_key = Column(String(1024), nullable=False) # S3 object key
    caption = Column(Text, nullable=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    changed_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # bulletin = relationship("Bulletin", back_populates="image_attachments") # if bidirectional needed in attachment

    def __repr__(self):
        return f"<BulletinImageAttachment {self.s3_key}>"

class Bulletin(Model):
    __tablename__ = 'bulletins'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False)
    advisory = Column(Text, nullable=False)
    risks = Column(Text, nullable=False)
    safety_tips = Column(Text, nullable=False)
    hashtags = Column(String(500))
    # chart_id = Column(Integer, ForeignKey('slices.id')) # Removed
    # image_attachments = Column(Text, nullable=True)  # Stores JSON string: [{"key": "s3_key1", "caption": "caption1"}, ...] # OLD
    created_by_fk = Column(Integer, ForeignKey('ab_user.id'), nullable=False)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    changed_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    # chart = relationship('Slice', foreign_keys=[chart_id]) # Removed
    created_by = relationship(User, foreign_keys=[created_by_fk])
    image_attachments = relationship(
        "BulletinImageAttachment",
        backref="bulletin", # Allows BulletinImageAttachment.bulletin
        cascade="all, delete-orphan", # Deletes attachments if bulletin is deleted
        lazy="select" # Changed from "dynamic"
    )

    def __repr__(self):
        return self.title # This will make FAB display the title

    # If you need a more complex representation for other contexts, 
    # consider __str__ or specific formatters in views. 