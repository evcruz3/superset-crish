from flask import flash, request, redirect, g, make_response, url_for, Response
from flask_appbuilder import expose
from flask_appbuilder.api import expose as expose_api, protect, safe, rison
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from superset.views.base import BaseSupersetView
from superset.views.base_api import BaseSupersetApi, BaseSupersetModelRestApi, requires_form_data, statsd_metrics
from superset.extensions import event_logger, db
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from typing import Any, Dict, List, Optional, Type, Union
import pandas as pd
from werkzeug.wrappers import Response as WerkzeugResponse
from werkzeug.utils import secure_filename
import os
import logging
import traceback
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from superset.models.health_facilities import HealthFacility
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy import inspect, func
from sqlalchemy.types import String
from marshmallow import Schema, fields
from math import radians, cos, sin, asin, sqrt
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


# Schema for nearby facility parameters
class NearbyFacilitySchema(Schema):
    latitude = fields.Float(required=True)
    longitude = fields.Float(required=True)
    radius = fields.Float(missing=10.0)

# Update the rison schema to include filter properties
nearby_facility_rison_schema = {
    "type": "object",
    "properties": {
        "latitude": {"type": "number"},
        "longitude": {"type": "number"},
        "radius": {"type": "number"},
        # Add new optional filter properties
        "facility_type": {"type": "array", "items": {"type": "string"}},
        "name": {"type": "string"},
        "services": {"type": "string"},
        "has_ambulance": {"type": "boolean"},
        "has_emergency": {"type": "boolean"},
    },
    "required": ["latitude", "longitude"]
}

# Schema for facilities within bounds parameters
bounds_facility_rison_schema = {
    "type": "object",
    "properties": {
        # Bounding box coordinates
        "min_latitude": {"type": "number"},
        "min_longitude": {"type": "number"},
        "max_latitude": {"type": "number"},
        "max_longitude": {"type": "number"},
        # Optional filter properties (same as nearby)
        "facility_type": {"type": "array", "items": {"type": "string"}},
        "name": {"type": "string"},
        "services": {"type": "string"},
        "has_ambulance": {"type": "boolean"},
        "has_emergency": {"type": "boolean"},
    },
    "required": ["min_latitude", "min_longitude", "max_latitude", "max_longitude"]
}

class HealthFacilitiesRestApi(BaseSupersetModelRestApi):
    resource_name = "health_facilities"
    allow_browser_login = True
    datamodel = SQLAInterface(HealthFacility)
    class_permission_name = "HealthFacilities"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "nearby_facilities", "facility_types", "facility_locations", "facility_counts", "municipalities", "facilities_in_bounds"
    }
    list_columns = [
        "id", "name", "facility_type", "code", "municipality", 
        "location", "suco", "aldeia", "latitude", "longitude", "elevation",
        "property_type", "address", "phone", "email", "services", 
        "operating_days", "operating_hours", "total_beds", "maternity_beds", 
        "has_ambulance", "has_emergency", "created_on"
    ]
    show_columns = list_columns
    search_columns = ["name", "facility_type", "code", "location", "municipality", 
                    "suco", "aldeia", "services"]
    order_columns = ["name", "facility_type", "location", "municipality", "created_on"]
    # base_filters = [["id", HealthFacility.id, ">", 0]]
    
    # Helper function for haversine distance calculation
    def haversine_distance(self, lat1, lon1, lat2, lon2):
        """Calculate the great circle distance between two points on the earth"""
        # Convert decimal degrees to radians
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        
        # Haversine formula
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # Radius of earth in kilometers
        return c * r

    @expose_api("/municipalities", methods=["GET"])
    @safe
    @statsd_metrics
    def municipalities(self) -> Response:
        """Get list of facility municipalities
        ---
        get:
          summary: Get all facility municipalities
          responses:
            200:
              description: List of facility municipalities
            500:
              description: Server error
        """
        try:
            # Check if the table exists
            inspector = inspect(db.engine)
            if not inspector.has_table(HealthFacility.__tablename__):
                return self.response(200, data={'municipalities': []})
                
            municipalities = db.session.query(HealthFacility.municipality).distinct().all()
            return self.response(200, data={
                'municipalities': [m[0] for m in municipalities]
            })
        except Exception as e:
            logger.error(f"Error listing facility municipalities: {str(e)}")
            logger.error(traceback.format_exc())
            return self.response(500, message=str(e))
    
    @expose_api("/nearby", methods=["GET"])
    @safe
    @rison(schema=nearby_facility_rison_schema)
    @statsd_metrics
    def nearby_facilities(self, **kwargs: Any) -> Response:
        """Get facilities near a location, with optional filters
        ---
        get:
          summary: Get facilities near a location with optional filters
          parameters:
            - in: query
              name: q
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/nearby_facility_rison_schema' # Use the schema definition
          responses:
            200:
              description: List of nearby facilities matching filters
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            args = kwargs.get("rison", {})
            latitude = args.get("latitude")
            longitude = args.get("longitude")
            radius = args.get("radius", 10.0)

            # Extract filter arguments
            filter_facility_type = args.get("facility_type")
            filter_name = args.get("name")
            filter_services = args.get("services")
            filter_has_ambulance = args.get("has_ambulance")
            filter_has_emergency = args.get("has_emergency")

            if not latitude or not longitude:
                return self.response(400, message="Latitude and longitude are required")

            # Check if the table exists
            inspector = inspect(db.engine)
            if not inspector.has_table(HealthFacility.__tablename__):
                return self.response(200, data={'facilities': []})

            # Build the base query
            query = db.session.query(HealthFacility)

            # Apply filters to the query
            if filter_facility_type:
                # Use 'in_' if it's a list with items
                if isinstance(filter_facility_type, list) and filter_facility_type:
                    query = query.filter(HealthFacility.facility_type.in_(filter_facility_type))
                # Handle potential single string if needed, though schema expects array
                elif isinstance(filter_facility_type, str):
                     query = query.filter(HealthFacility.facility_type == filter_facility_type)
            if filter_name:
                # Use case-insensitive search for name
                query = query.filter(HealthFacility.name.ilike(f"%{filter_name}%"))
            if filter_services:
                # Use case-insensitive search for services
                query = query.filter(HealthFacility.services.ilike(f"%{filter_services}%"))
            if filter_has_ambulance is not None:
                query = query.filter(HealthFacility.has_ambulance == filter_has_ambulance)
            if filter_has_emergency is not None:
                query = query.filter(HealthFacility.has_emergency == filter_has_emergency)

            # Fetch potential facilities based on filters
            logger.info(f"Executing filtered query: {str(query)}")
            potential_facilities = query.all()
            logger.info(f"Found {len(potential_facilities)} potential facilities after filtering.")

            # Filter by distance using Haversine
            nearby = []
            for facility in potential_facilities:
                # Ensure latitude and longitude are not None before calculating distance
                if facility.latitude is not None and facility.longitude is not None:
                    distance = self.haversine_distance(
                        latitude, longitude,
                        facility.latitude, facility.longitude
                    )
                    if distance <= radius:
                        facility_dict = facility.to_dict()
                        facility_dict['distance'] = round(distance, 2)
                        nearby.append(facility_dict)
                else:
                     logger.warning(f"Facility ID {facility.id} has missing coordinates.")


            # Sort by distance
            nearby.sort(key=lambda x: x.get('distance', float('inf'))) # Use inf for missing distances

            return self.response(200, data={
                'facilities': nearby
            })
        except Exception as e:
            logger.error(f"Error finding nearby facilities: {str(e)}")
            logger.error(traceback.format_exc())
            return self.response(500, message=str(e))

    @expose_api("/types", methods=["GET"])
    @safe
    @statsd_metrics
    def facility_types(self) -> Response:
        """Get list of facility types
        ---
        get:
          summary: Get all facility types
          responses:
            200:
              description: List of facility types
            500:
              description: Server error
        """
        try:
            # Check if the table exists
            inspector = inspect(db.engine)
            if not inspector.has_table(HealthFacility.__tablename__):
                return self.response(200, data={'types': []})
                
            types = db.session.query(HealthFacility.facility_type).distinct().all()
            return self.response(200, data={
                'types': [t[0] for t in types]
            })
        except Exception as e:
            logger.error(f"Error listing facility types: {str(e)}")
            logger.error(traceback.format_exc())
            return self.response(500, message=str(e))
            
    @expose_api("/locations", methods=["GET"])
    @safe
    @statsd_metrics
    def facility_locations(self) -> Response:
        """Get list of facility locations/administrative posts
        ---
        get:
          summary: Get all facility locations
          responses:
            200:
              description: List of facility locations
            500:
              description: Server error
        """
        try:
            # Check if the table exists
            inspector = inspect(db.engine)
            if not inspector.has_table(HealthFacility.__tablename__):
                return self.response(200, data={'locations': []})
                
            locations = db.session.query(HealthFacility.location).distinct().all()
            return self.response(200, data={
                'locations': [l[0] for l in locations]
            })
        except Exception as e:
            logger.error(f"Error listing facility locations: {str(e)}")
            logger.error(traceback.format_exc())
            return self.response(500, message=str(e))
            
    @expose_api("/counts", methods=["GET"])
    @safe
    @statsd_metrics
    def facility_counts(self) -> Response:
        """Get counts of facilities by type, location, etc.
        ---
        get:
          summary: Get facility counts
          responses:
            200:
              description: Facility counts
            500:
              description: Server error
        """
        try:
            # Check if the table exists
            inspector = inspect(db.engine)
            if not inspector.has_table(HealthFacility.__tablename__):
                return self.response(200, data={
                    'total': 0,
                    'by_type': {},
                    'by_location': {},
                    'by_municipality': {}
                })
            
            # Count by type
            type_counts = db.session.query(
                HealthFacility.facility_type,
                func.count(HealthFacility.id)
            ).group_by(HealthFacility.facility_type).all()
            
            # Count by location/administrative post
            location_counts = db.session.query(
                HealthFacility.location,
                func.count(HealthFacility.id)
            ).group_by(HealthFacility.location).all()
            
            # Count by municipality
            municipality_counts = db.session.query(
                HealthFacility.municipality,
                func.count(HealthFacility.id)
            ).group_by(HealthFacility.municipality).all()
            
            # Total facilities
            total_count = db.session.query(func.count(HealthFacility.id)).scalar()
            
            return self.response(200, data={
                'total': total_count,
                'by_type': {t[0]: t[1] for t in type_counts},
                'by_location': {l[0]: l[1] for l in location_counts},
                'by_municipality': {m[0]: m[1] for m in municipality_counts}
            })
        except Exception as e:
            logger.error(f"Error calculating facility counts: {str(e)}")
            logger.error(traceback.format_exc())
            return self.response(500, message=str(e))

    @expose_api("/bounds", methods=["GET"])
    @safe
    @rison(schema=bounds_facility_rison_schema)
    @statsd_metrics
    def facilities_in_bounds(self, **kwargs: Any) -> Response:
        """Get facilities within a specified bounding box, with optional filters
        ---
        get:
          summary: Get facilities within a bounding box with optional filters
          parameters:
            - in: query
              name: q
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/bounds_facility_rison_schema' # Reference the new schema
          responses:
            200:
              description: List of facilities within bounds matching filters
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            args = kwargs.get("rison", {})
            min_latitude = args.get("min_latitude")
            min_longitude = args.get("min_longitude")
            max_latitude = args.get("max_latitude")
            max_longitude = args.get("max_longitude")

            # Extract filter arguments (same as nearby)
            filter_facility_type = args.get("facility_type")
            filter_name = args.get("name")
            filter_services = args.get("services")
            filter_has_ambulance = args.get("has_ambulance")
            filter_has_emergency = args.get("has_emergency")

            # Basic validation for bounds
            if None in [min_latitude, min_longitude, max_latitude, max_longitude]:
                return self.response(400, message="Bounding box coordinates (min/max latitude/longitude) are required")

            # Check if the table exists
            inspector = inspect(db.engine)
            if not inspector.has_table(HealthFacility.__tablename__):
                return self.response(200, data={'facilities': []})

            # Build the base query
            query = db.session.query(HealthFacility)

            # Apply bounding box filter
            query = query.filter(HealthFacility.latitude.between(min_latitude, max_latitude))
            query = query.filter(HealthFacility.longitude.between(min_longitude, max_longitude))

            # Apply optional filters (reuse logic from nearby)
            if filter_facility_type:
                # Use 'in_' if it's a list with items
                if isinstance(filter_facility_type, list) and filter_facility_type:
                    query = query.filter(HealthFacility.facility_type.in_(filter_facility_type))
                # Handle potential single string if needed
                elif isinstance(filter_facility_type, str):
                     query = query.filter(HealthFacility.facility_type == filter_facility_type)
            if filter_name:
                query = query.filter(HealthFacility.name.ilike(f"%{filter_name}%"))
            if filter_services:
                query = query.filter(HealthFacility.services.ilike(f"%{filter_services}%"))
            if filter_has_ambulance is not None:
                query = query.filter(HealthFacility.has_ambulance == filter_has_ambulance)
            if filter_has_emergency is not None:
                query = query.filter(HealthFacility.has_emergency == filter_has_emergency)

            # Fetch facilities based on bounds and filters
            logger.info(f"Executing bounds query: {str(query)}")
            facilities_in_bounds = query.all()
            logger.info(f"Found {len(facilities_in_bounds)} facilities within bounds after filtering.")

            # Convert results to dictionary format (optional, depends on how frontend uses it)
            result_list = [facility.to_dict() for facility in facilities_in_bounds]

            return self.response(200, data={
                'facilities': result_list
            })
        except Exception as e:
            logger.error(f"Error finding facilities in bounds: {str(e)}")
            logger.error(traceback.format_exc())
            return self.response(500, message=str(e))
