from flask import flash, request, redirect, g, make_response, url_for
from flask_appbuilder import expose
from flask_appbuilder.api import expose as expose_api, protect, safe
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from superset.views.base import BaseSupersetView
from superset.views.base_api import BaseSupersetApi, requires_form_data
from superset.extensions import event_logger
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP
import pandas as pd
import sqlite3
from werkzeug.utils import secure_filename
import os
import logging
from flask_appbuilder.security.decorators import has_access_api
from flask_appbuilder.models.sqla.interface import SQLAInterface
import traceback

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
                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)  # Clean up on error
                return self.response(500, message=str(ex))

        return self.response(400, message="Invalid file type")

    def process_facilities_file(self, file_path):
        sheets_data = pd.read_excel(file_path, sheet_name=None)
        conn = sqlite3.connect('health_facilities.db')

        administrative_posts = [
            "Aileu", "Ainaro", "Atauro", "Baucau", "Bobonaro",
            "Covalima", "Dili", "Ermera", "Manatuto", "Manufahi",
            "Lautem", "Liquica", "Raeoa", "Viqueque"
        ]

        for sheet_name, data in sheets_data.items():
            if sheet_name in administrative_posts:
                cleaned_data = pd.read_excel(file_path, sheet_name=sheet_name, header=0)
                cleaned_data = cleaned_data.dropna(subset=[cleaned_data.columns[1]])
                cleaned_data.columns = cleaned_data.columns.str.strip()

                # Convert data types
                numeric_columns = ['Longitude', 'Latitude', 'Ambulance', 'Maternity bed', 'Total bed']
                for col in numeric_columns:
                    if col in cleaned_data.columns:
                        cleaned_data[col] = pd.to_numeric(cleaned_data[col], errors='coerce')
                        if col != 'Longitude' and col != 'Latitude':
                            cleaned_data[col] = cleaned_data[col].astype('Int64')

                cleaned_data = cleaned_data.dropna(subset=['Longitude', 'Latitude'])
                cleaned_data.to_sql('Facility', conn, if_exists='replace', index=False)

        conn.commit()
        conn.close()
