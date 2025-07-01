from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from flask_appbuilder.security.sqla.models import User # For created_by relationship if not already there
from superset.disease_forecast_alerts.models import DiseaseForecastAlert

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
    
    # Alert relationships - only one can be set
    disease_forecast_alert_id = Column(Integer, ForeignKey('disease_forecast_alerts.id'), nullable=True)
    weather_forecast_alert_composite_id = Column(String(200), nullable=True)  # Stores composite ID from WeatherForecastAlert
    
    created_by_fk = Column(Integer, ForeignKey('ab_user.id'), nullable=False)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    changed_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Check constraint to ensure only one alert type is set
    __table_args__ = (
        CheckConstraint(
            '(disease_forecast_alert_id IS NULL) != (weather_forecast_alert_composite_id IS NULL) OR (disease_forecast_alert_id IS NULL AND weather_forecast_alert_composite_id IS NULL)',
            name='chk_bulletin_single_alert_type'
        ),
    )
    
    # Relationships
    created_by = relationship(User, foreign_keys=[created_by_fk])
    disease_forecast_alert = relationship(
        DiseaseForecastAlert, 
        foreign_keys=[disease_forecast_alert_id]
    )
    image_attachments = relationship(
        "BulletinImageAttachment",
        backref="bulletin", # Allows BulletinImageAttachment.bulletin
        cascade="all, delete-orphan", # Deletes attachments if bulletin is deleted
        lazy="select" # Changed from "dynamic"
    )

    @property
    def alert_type(self):
        """Returns the type of alert this bulletin is associated with."""
        if self.disease_forecast_alert_id:
            return "disease"
        elif self.weather_forecast_alert_composite_id:
            return "weather"
        return None
    
    @property 
    def weather_forecast_alert(self):
        """
        Returns the associated WeatherForecastAlert if this bulletin is linked to one.
        Note: This requires a manual query since we're storing the composite ID as a string.
        """
        if not self.weather_forecast_alert_composite_id:
            return None
            
        from superset.weather_forecast_alerts.models import WeatherForecastAlert
        from superset import db
        
        # Parse the composite ID back to its components
        parts = self.weather_forecast_alert_composite_id.split('_', 2)
        if len(parts) != 3:
            return None
            
        municipality_code, forecast_date, weather_parameter = parts
        
        return db.session.query(WeatherForecastAlert).filter_by(
            municipality_code=municipality_code,
            forecast_date=forecast_date,
            weather_parameter=weather_parameter
        ).first()

    def __repr__(self):
        return self.title # This will make FAB display the title

    # If you need a more complex representation for other contexts, 
    # consider __str__ or specific formatters in views. 