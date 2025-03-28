import os
from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from flask import current_app
from geoalchemy2 import Geometry
import geoalchemy2.functions as geofunc

class HealthFacility(Model):
    """A model for health facilities"""
    __tablename__ = "health_facilities"

    id = Column(Integer, primary_key=True)
    key = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    facility_type = Column(String(100), nullable=False)  # Hospital, Health Center, Clinic, etc.
    code = Column(String(50), nullable=True) # Facility code
    
    # Geographic and administrative information
    municipality = Column(String(100), nullable=False)
    location = Column(String(255), nullable=False)  # Administrative post or location name (Postu Administrative)
    suco = Column(String(255), nullable=True) # Suco (sub-district)
    aldeia = Column(String(255), nullable=True) # Aldeia (village)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation = Column(Float, nullable=True) # Elevation in meters
    
    # Property information
    property_type = Column(String(100), nullable=True) # Property type (rented, owned, etc.)
    
    # Contact and operational info
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    services = Column(Text, nullable=True) # Services offered
    operating_days = Column(String(255), nullable=True) # Operating days
    operating_hours = Column(String(255), nullable=True) # Operating hours
    
    # Capacity information
    total_beds = Column(Integer, nullable=True)
    maternity_beds = Column(Integer, nullable=True)
    has_ambulance = Column(Boolean, default=False)
    has_emergency = Column(Boolean, default=False)
    
    # Tracking information
    created_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_fk])
    created_on = Column(DateTime, default=func.now(), nullable=False)
    changed_on = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return self.name
        
    @property
    def coordinates(self):
        """Return the coordinates as a tuple"""
        return (self.longitude, self.latitude)
        
    def to_dict(self):
        """Return a dictionary representation of the facility"""
        return {
            'id': self.id,
            'name': self.name,
            'facility_type': self.facility_type,
            'code': self.code,
            'municipality': self.municipality,
            'location': self.location,
            'suco': self.suco,
            'aldeia': self.aldeia,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'elevation': self.elevation,
            'property_type': self.property_type,
            'address': self.address,
            'phone': self.phone,
            'email': self.email,
            'services': self.services,
            'operating_days': self.operating_days,
            'operating_hours': self.operating_hours,
            'total_beds': self.total_beds,
            'maternity_beds': self.maternity_beds,
            'has_ambulance': self.has_ambulance,
            'has_emergency': self.has_emergency,
            'created_on': self.created_on.isoformat() if self.created_on else None
        } 