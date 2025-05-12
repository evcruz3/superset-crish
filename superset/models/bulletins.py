from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from flask_appbuilder.security.sqla.models import User # For created_by relationship if not already there

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
    # Assuming User model is correctly imported for the relationship
    created_by = relationship(User, foreign_keys=[created_by_fk])

    def __repr__(self):
        return self.title # This will make FAB display the title

    # If you need a more complex representation for other contexts, 
    # consider __str__ or specific formatters in views. 