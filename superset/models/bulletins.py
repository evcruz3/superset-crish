from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

class Bulletin(Model):
    __tablename__ = 'bulletins'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False)
    advisory = Column(Text, nullable=False)
    risks = Column(Text, nullable=False)
    safety_tips = Column(Text, nullable=False)
    hashtags = Column(String(500))
    chart_id = Column(Integer, ForeignKey('slices.id'))
    created_by_fk = Column(Integer, ForeignKey('ab_user.id'), nullable=False)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    changed_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    chart = relationship('Slice', foreign_keys=[chart_id])
    created_by = relationship('User', foreign_keys=[created_by_fk]) 