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

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads')
ALLOWED_EXTENSIONS = {'xlsx'}
TEMPLATE_FILE = 'facilities_template.xlsx'  # Name for the stored template

logger = logging.getLogger(__name__)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

class UpdateFacilitiesRestApi(BaseSupersetApi):
    resource_name = "update_facilities"
    allow_browser_login = True
    class_permission_name = "UpdateFacilities"
    base_permissions = [
        'can_list',
        'can_show',
        'can_add',
        'can_upload',
        'can_write',
        'can_read',
        'menu_access'
    ]

    @expose_api("/template", methods=["GET"])
    @safe
    def get_template(self) -> dict[str, bool]:
        """Get the latest facilities template file
        ---
        get:
          summary: Get facilities template
          responses:
            200:
              description: Template file
              content:
                application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
                  schema:
                    type: string
                    format: binary
            404:
              description: Template not found
        """
        template_path = os.path.join(UPLOAD_FOLDER, TEMPLATE_FILE)
        logger.info(f"Looking for template at: {template_path}")
        logger.info(f"Upload folder exists: {os.path.exists(UPLOAD_FOLDER)}")
        
        if not os.path.exists(template_path):
            logger.error(f"Template file not found at: {template_path}")
            return self.response(404, message="No template file found")
        
        try:
            from flask import send_file
            logger.info(f"Sending template file: {template_path}")
            return send_file(
                template_path,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name='facilities_template.xlsx'
            )
        except Exception as e:
            logger.error(f"Error sending template file: {str(e)}")
            return self.response(500, message=f"Error accessing template: {str(e)}")

    @expose_api("/upload", methods=["POST"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.upload",
        log_to_statsd=False,
    )
    def upload(self) -> dict[str, bool]:
        """Upload facilities data
        ---
        post:
          summary: Upload facilities data
          security:
            - csrf_token: []
          permissions:
            - can_write
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    file:
                      type: string
                      format: binary
          responses:
            200:
              description: Success
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        logger.info(f"Upload folder path: {UPLOAD_FOLDER}")
        
        if not os.path.exists(UPLOAD_FOLDER):
            logger.info(f"Creating upload folder: {UPLOAD_FOLDER}")
            try:
                os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            except Exception as e:
                logger.error(f"Error creating upload folder: {str(e)}")
                return self.response(500, message=f"Error creating upload directory: {str(e)}")

        logger.info("Request files: %s", request.files)
        logger.info("Request form: %s", request.form)
        
        if 'file' not in request.files:
            logger.error("No file found in request.files")
            return self.response(400, message="No file provided")
        
        file = request.files['file']
        if file.filename == '':
            return self.response(400, message="No file selected")

        if file and allowed_file(file.filename):
            # Save as temporary file for processing
            temp_filepath = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
            logger.info(f"Saving uploaded file to: {temp_filepath}")
            
            try:
                file.save(temp_filepath)
                logger.info(f"File saved successfully: {temp_filepath}")
                
                self.process_facilities_file(temp_filepath)
                
                # If processing successful, save as template
                template_path = os.path.join(UPLOAD_FOLDER, TEMPLATE_FILE)
                logger.info(f"Copying to template: {template_path}")
                
                import shutil
                shutil.copy2(temp_filepath, template_path)
                logger.info(f"Saved new template: {template_path}")
                
                # Verify template exists
                if os.path.exists(template_path):
                    logger.info(f"Template file verified at: {template_path}")
                else:
                    logger.error(f"Template file not found after copy: {template_path}")
                
                os.remove(temp_filepath)  # Clean up the temporary file
                return self.response(200, message="File processed successfully and saved as template")
            except Exception as ex:
                logger.error(f"Error processing file: {str(ex)}")
                logger.error(traceback.format_exc())
                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)  # Clean up on error
                return self.response(500, message=str(ex))

        return self.response(400, message="Invalid file type")

    def process_facilities_file(self, file_path):
        sheets_data = pd.read_excel(file_path, sheet_name=None)

        administrative_posts = [
            "Aileu", "Ainaro", "Atauro", "Baucau", "Bobonaro",
            "Covalima", "Dili", "Ermera", "Manatuto", "Manufahi",
            "Lautem", "Liquica", "Raeoa", "Viqueque"
        ]

        # Process data from each sheet
        for sheet_name, data in sheets_data.items():
            if sheet_name in administrative_posts:
                logger.info(f"Processing sheet: {sheet_name}")
                cleaned_data = pd.read_excel(file_path, sheet_name=sheet_name, header=0)
                # ensure header names are whitespace trimmed
                cleaned_data.columns = cleaned_data.columns.str.strip()
                # print headers
                logger.info(f"Headers: {cleaned_data.columns}")
                # Drop rows with missing essential data (using the Facility Name column)
                cleaned_data = cleaned_data.dropna(subset=['Facility Name'])
                cleaned_data.columns = cleaned_data.columns.str.strip()

                # Ensure we have the coordinates
                cleaned_data = cleaned_data.dropna(subset=['Longitude', 'Latitude'])

                # Convert data types for numeric columns
                numeric_columns = ['Longitude', 'Latitude', 'Elevation (m)', 'Ambulance', 'Maternity bed', 'Total bed']
                for col in numeric_columns:
                    if col in cleaned_data.columns:
                        cleaned_data[col] = pd.to_numeric(cleaned_data[col], errors='coerce')
                
                # Process each facility
                for _, row in cleaned_data.iterrows():
                    try:
                        # Extract data from row and ensure proper types
                        longitude = float(row['Longitude']) if pd.notna(row.get('Longitude')) else 0.0
                        latitude = float(row['Latitude']) if pd.notna(row.get('Latitude')) else 0.0
                        
                        if longitude == 0.0 or latitude == 0.0:
                            logger.warning(f"Skipping facility with invalid coordinates: {row.get('Facility Name')}")
                            continue
                        
                        # Parse numeric fields with proper type handling
                        try:
                            elevation = float(row.get('Elevation (m)')) if pd.notna(row.get('Elevation (m)')) else None
                        except (ValueError, TypeError):
                            elevation = None
                        
                        try:
                            total_beds = int(row.get('Total bed')) if pd.notna(row.get('Total bed')) else None
                        except (ValueError, TypeError):
                            total_beds = None
                            
                        try:
                            maternity_beds = int(row.get('Maternity bed')) if pd.notna(row.get('Maternity bed')) else None
                        except (ValueError, TypeError):
                            maternity_beds = None
                        
                        # Parse boolean field
                        try:
                            has_ambulance = bool(row.get('Ambulance', False))
                        except (ValueError, TypeError):
                            has_ambulance = False
                        
                        # id will be based from the concatenation of the municipality and No
                        key = (str(row.get('No', '')) if pd.notna(row.get('No')) else None) + str(sheet_name)
                        # Ensure text fields are strings
                        name = str(row.get('Facility Name', f"Facility in {sheet_name}"))
                        facility_type = str(row.get('Facility Type', 'Unknown')) if pd.notna(row.get('Facility Type')) else 'Unknown'
                        code = str(row.get('Code', '')) if pd.notna(row.get('Code')) else None
                        municipality = str(row.get('Municipality', sheet_name)) if pd.notna(row.get('Municipality')) else sheet_name
                        location = str(row.get('Postu Administrative', sheet_name)) if pd.notna(row.get('Postu Administrative')) else sheet_name
                        suco = str(row.get('Suco', '')) if pd.notna(row.get('Suco')) else None
                        aldeia = str(row.get('Aldeia', '')) if pd.notna(row.get('Aldeia')) else None
                        property_type = str(row.get('Property', '')) if pd.notna(row.get('Property')) else None
                        
                        # Optional fields
                        address = None  # Not in the Excel but in our model
                        phone = None    # Not in the Excel but in our model
                        email = None    # Not in the Excel but in our model
                        services = str(row.get('Services Offer', '')) if pd.notna(row.get('Services Offer')) else None
                        operating_days = str(row.get('Operating Days', '')) if pd.notna(row.get('Operating Days')) else None
                        operating_hours = str(row.get('Operating Hours', '')) if pd.notna(row.get('Operating Hours')) else None
                        
                        # Set emergency services based on facility type
                        has_emergency = 'emergency' in facility_type.lower() if facility_type else False
                        
                        # Use the model to create a new facility
                        facility = HealthFacility(
                            key=key,
                            name=name,
                            facility_type=facility_type,
                            code=code,
                            municipality=municipality,  
                            location=location,
                            suco=suco,
                            aldeia=aldeia,
                            latitude=latitude,
                            longitude=longitude,
                            elevation=elevation,  
                            property_type=property_type,
                            address=address,
                            phone=phone,
                            email=email,
                            services=services,
                            operating_days=operating_days,
                            operating_hours=operating_hours,  
                            total_beds=total_beds,
                            maternity_beds=maternity_beds,
                            has_ambulance=has_ambulance,
                            has_emergency=has_emergency
                        )
                        
                        # upsert the facility based on key
                        existing_facility = db.session.query(HealthFacility).filter_by(key=key).first()
                        if existing_facility:
                            existing_facility.update(facility)
                        else:
                            db.session.add(facility)

                    except Exception as e:
                        logger.error(f"Error processing facility row: {e}")
                        logger.error(traceback.format_exc())
                
                # Commit after each sheet
                db.session.commit()
                logger.info(f"Processed facilities for {sheet_name}")
        
        logger.info("All facilities processed successfully")

