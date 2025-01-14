import os
from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from flask import current_app

class PublicEducationPost(Model):
    """A model for public education posts"""
    __tablename__ = "public_education_posts"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    hashtags = Column(String(255), nullable=False)
    created_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=False)
    created_by = relationship("User", foreign_keys=[created_by_fk])
    created_on = Column(DateTime, default=func.now(), nullable=False)
    changed_on = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return self.title

class PublicEducationAttachment(Model):
    """A model for public education post attachments"""
    __tablename__ = "public_education_attachments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("public_education_posts.id"), nullable=False)
    post = relationship("PublicEducationPost", backref="attachments")
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # 'pdf' or 'image'
    file_path = Column(String(1000), nullable=False)
    created_on = Column(DateTime, default=func.now(), nullable=False)

    @property
    def file_url(self):
        """Get the URL for the file"""
        return f"/api/v1/public_education/attachment/{self.id}/download"

    def __repr__(self):
        return self.file_name 