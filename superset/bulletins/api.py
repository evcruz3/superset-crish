from flask import request, g, Response, send_file, current_app
from flask_appbuilder.api import expose, protect, safe, rison, permission_name
from flask_appbuilder.api.schemas import get_item_schema
from flask_appbuilder.security.decorators import has_access_api
from superset.views.base_api import BaseSupersetModelRestApi, RelatedFieldFilter
from superset.extensions import db
from superset.models.bulletins import Bulletin, BulletinImageAttachment
from superset.disease_forecast_alerts.models import DiseaseForecastAlert
from superset.weather_forecast_alerts.models import WeatherForecastAlert
from flask_appbuilder.models.sqla.interface import SQLAInterface
from typing import Any, Dict
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from werkzeug.wrappers import Response as WerkzeugResponse
from marshmallow import ValidationError
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners
import json
from superset.views.base_api import requires_json, statsd_metrics
from superset.commands.exceptions import DeleteFailedError
from superset.utils.pdf import generate_bulletin_pdf
from superset.extensions import cache_manager
from io import BytesIO
import os
import uuid
import boto3
from botocore.exceptions import ClientError
from werkzeug.utils import secure_filename
from datetime import datetime, date, timedelta
import logging
from sqlalchemy import cast, asc, desc, or_, and_
from sqlalchemy.types import Date as SQLDate, String

logger = logging.getLogger(__name__)

def _get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=current_app.config.get('S3_ENDPOINT_URL'),
        aws_access_key_id=current_app.config.get('S3_ACCESS_KEY'),
        aws_secret_access_key=current_app.config.get('S3_SECRET_KEY'),
        config=boto3.session.Config(signature_version='s3v4', s3={'addressing_style': current_app.config.get('S3_ADDRESSING_STYLE', 'path')})
    )

def _get_s3_client_for_presigning():
    public_endpoint = current_app.config.get('S3_PUBLIC_ENDPOINT_URL')
    if not public_endpoint:
        current_app.logger.error("S3_PUBLIC_ENDPOINT_URL is not configured for presigning client.")
        return None
    return boto3.client(
        's3',
        endpoint_url=public_endpoint,
        aws_access_key_id=current_app.config.get('S3_ACCESS_KEY'),
        aws_secret_access_key=current_app.config.get('S3_SECRET_KEY'),
        config=boto3.session.Config(
            signature_version='s3v4', 
            s3={'addressing_style': current_app.config.get('S3_ADDRESSING_STYLE', 'path')}
        )
    )

class BulletinsRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Bulletin)
    resource_name = "bulletins_and_advisories"
    openapi_spec_tag = "CRISH Bulletins and Advisories"
    allow_browser_login = True
    class_permission_name = "BulletinsAndAdvisories"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = (
        RouteMethod.REST_MODEL_VIEW_CRUD_SET
        | { "bulk_delete", "download_bulletin_pdf" }
        # We are overriding POST and PUT, so remove them from default set if they were there
        # However, REST_MODEL_VIEW_CRUD_SET includes GET, POST, PUT, DELETE by default.
        # We will override them explicitly.
    )
    # Remove POST and PUT from include_route_methods if they are part of a set, 
    # or define it explicitly to exclude them if we are fully overriding.
    # For now, let's assume explicit @expose for POST and PUT will take precedence.

    list_columns = [
        "id",
        "title",
        "advisory",
        "risks",
        "safety_tips",
        "hashtags",
        "created_by.first_name",
        "created_by.last_name",
        "created_on",
        "changed_on",
        "image_attachments",
        "disease_forecast_alert.municipality_code",
        "disease_forecast_alert.municipality_name",
        "disease_forecast_alert.disease_type",
        "disease_forecast_alert.alert_level",
        "weather_forecast_alert_composite_id",
    ]
    show_columns = list_columns
    list_select_columns = list_columns
    add_columns = ["title", "advisory", "risks", "safety_tips", "hashtags"]
    edit_columns = add_columns

    order_columns = [
        "changed_on",
        "created_on",
        "title",
    ]

    # Eager load image_attachments and disease_forecast_alert to avoid N+1 queries and issues with dynamic loading
    list_query_options = [
        db.joinedload(Bulletin.image_attachments),
        db.joinedload(Bulletin.disease_forecast_alert)
    ]
    show_query_options = [
        db.joinedload(Bulletin.image_attachments),
        db.joinedload(Bulletin.disease_forecast_alert)
    ]

    def pre_add(self, item: Bulletin) -> None:
        """Set the created_by user before adding"""
        item.created_by_fk = g.user.id
        # Image attachments are handled after the bulletin is created and has an ID,
        # or within the same transaction if possible.
        # For now, let's assume _handle_image_attachment_upload will be called in post_add
        # or adapted to create attachments and associate them.
        # However, flask-appbuilder's pre_add happens before the item has an ID if it's a new item.
        # We will handle attachments in the POST endpoint directly after item creation.

    def pre_update_get_obj(self, item_id: int) -> Bulletin | None:
        """
        Called before pre_update, loads the original item.
        We might not need _orig_image_attachments in the same way,
        as we'll be comparing new files/captions with existing related objects.
        """
        return self.datamodel.get(item_id, self._base_filters)

    def pre_update(self, item: Bulletin) -> None:
        """
        Handle image upload before updating.
        This is called after FAB has updated simple fields from the payload.
        We'll manage image attachments (add/delete/update captions) in the PUT endpoint.
        """
        # FAB handles changed_on by default.
        pass # Image handling moved to the PUT endpoint

    def _delete_s3_object(self, object_key: str) -> None:
        if not object_key:
            return
        try:
            s3_client = _get_s3_client()
            bucket_name = current_app.config.get('S3_BUCKET')
            s3_client.delete_object(Bucket=bucket_name, Key=object_key)
            current_app.logger.info(f"Deleted S3 object: {object_key}") # Use current_app.logger
        except ClientError as e:
            current_app.logger.error(f"Error deleting S3 object {object_key}: {e}")
            # Depending on requirements, you might want to raise an exception or handle silently

    def _handle_image_attachment_upload(self, bulletin_item: Bulletin, is_update: bool = False) -> None:
        """
        Handles uploading multiple image attachments and their captions.
        Saves them as BulletinImageAttachment records.
        Deletes old attachments if they are removed or replaced.
        Checks for S3 bucket existence and creates it if necessary.
        """
        s3_bucket = current_app.config.get('S3_BUCKET')
        s3_client = _get_s3_client()

        if not s3_bucket:
            current_app.logger.error("S3_BUCKET is not configured in the application settings. Cannot perform S3 operations.")
            raise ValueError("S3_BUCKET is not configured, which is required for file uploads.")

        # --- Handling existing attachments (for updates) ---
        if is_update:
            current_attachment_ids_in_payload = set()
            keys_to_delete_from_s3 = []
            attachments_to_delete_from_db = []

            # Collect IDs of attachments submitted in the form (implies they should be kept/updated)
            i = 0
            while True:
                attachment_id_str = request.form.get(f"existing_attachment_id_{i}")
                if attachment_id_str is None:
                    break
                try:
                    attachment_id = int(attachment_id_str)
                    current_attachment_ids_in_payload.add(attachment_id)
                    # Update caption if provided
                    caption = request.form.get(f"existing_attachment_caption_{i}")
                    attachment_to_update = db.session.query(BulletinImageAttachment).filter_by(
                        id=attachment_id, bulletin_id=bulletin_item.id
                    ).first()
                    if attachment_to_update and caption is not None: # Allow empty string for caption
                        attachment_to_update.caption = caption
                except ValueError:
                    current_app.logger.warning(f"Invalid existing_attachment_id format: {attachment_id_str}")
                i += 1
            
            # Find attachments in DB that are not in the payload (these should be deleted)
            if bulletin_item.image_attachments: 
                for existing_db_attachment in bulletin_item.image_attachments:
                    if existing_db_attachment.id not in current_attachment_ids_in_payload:
                        attachments_to_delete_from_db.append(existing_db_attachment)
                        if existing_db_attachment.s3_key:
                            keys_to_delete_from_s3.append(existing_db_attachment.s3_key)
            
            # Perform deletions
            for s3_key_to_delete in keys_to_delete_from_s3:
                self._delete_s3_object(s3_key_to_delete)
            for db_attachment_to_delete in attachments_to_delete_from_db:
                db.session.delete(db_attachment_to_delete)
            
            # db.session.flush() # Flush deletions before adding new ones if needed, or commit at end

        # --- Handling new file uploads ---
        # Check if there are any new files to upload before attempting bucket operations
        has_new_files_to_upload = any(
            key.startswith("image_attachment_file_") and request.files[key] and request.files[key].filename
            for key in request.files
        )

        if has_new_files_to_upload:
            if not s3_client: # Should ideally not happen if _get_s3_client is robust
                 current_app.logger.error("S3 client is not available. Cannot check or create bucket.")
                 raise ConnectionError("S3 client could not be initialized.")

            try:
                current_app.logger.debug(f"Checking if S3 bucket '{s3_bucket}' exists.")
                s3_client.head_bucket(Bucket=s3_bucket)
                current_app.logger.info(f"S3 bucket '{s3_bucket}' already exists.")
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code')
                http_status_code = e.response.get('ResponseMetadata', {}).get('HTTPStatusCode')
                
                # Check for NoSuchBucket (common in MinIO/older SDKs) or 404 (common in AWS S3 for head_bucket on non-existent bucket)
                if error_code == 'NoSuchBucket' or http_status_code == 404:
                    current_app.logger.info(f"S3 bucket '{s3_bucket}' does not exist. Attempting to create it...")
                    try:
                        # For MinIO, region is typically not needed for create_bucket.
                        # For AWS S3, you might need to specify a region if not us-east-1 or if client isn't configured for a specific region:
                        # e.g., s3_client.create_bucket(Bucket=s3_bucket, CreateBucketConfiguration={'LocationConstraint': 'your-aws-region'})
                        s3_client.create_bucket(Bucket=s3_bucket)
                        current_app.logger.info(f"S3 bucket '{s3_bucket}' created successfully.")
                    except ClientError as ce:
                        current_app.logger.error(f"Failed to create S3 bucket '{s3_bucket}': {ce}")
                        # Propagate a clear error message to the client/logs
                        raise Exception(f"S3 bucket '{s3_bucket}' could not be created. Please check S3 permissions and configuration. Original error: {str(ce)}") from ce
                else:
                    # Some other ClientError occurred when trying to check for the bucket.
                    current_app.logger.error(f"Unexpected error when checking for S3 bucket '{s3_bucket}': {e}")
                    raise # Re-raise the original unexpected S3 error

        i = 0
        while True:
            image_file = request.files.get(f"image_attachment_file_{i}")
            caption = request.form.get(f"image_caption_{i}", "") # Default to empty string if not provided

            if not image_file or not image_file.filename:
                # If no file at index i, check if we should stop (e.g., based on a max number or just break)
                # For now, assume if file_i is missing, subsequent files are also missing.
                # A more robust way might be to have a count of new files in the form.
                break 

            filename = secure_filename(image_file.filename)
            object_name = f"bulletin_images/{bulletin_item.id}/{uuid.uuid4().hex}_{filename}"
            
            current_app.logger.info(f"Attempting S3 upload. Bucket: '{s3_bucket}', Object Key: '{object_name}'")
            try:
                s3_client.upload_fileobj(
                    image_file,
                    s3_bucket,
                    object_name,
                    ExtraArgs={'ContentType': image_file.content_type or 'application/octet-stream'}
                )
                current_app.logger.info(f"Uploaded image {object_name} to S3 bucket {s3_bucket}.")
                
                # Create and add new BulletinImageAttachment
                new_attachment = BulletinImageAttachment(
                    bulletin_id=bulletin_item.id, # Ensure bulletin_item has an ID
                    s3_key=object_name,
                    caption=caption
                )
                db.session.add(new_attachment)
                # bulletin_item.image_attachments.append(new_attachment) # If using backref and session.add is enough

            except ClientError as e:
                current_app.logger.error(f"Error uploading image to S3: {e}")
                # Decide on error handling: raise to rollback, or collect errors
                raise Exception(f"S3 upload failed for {filename}: {str(e)}")
            except Exception as e: # Catch other potential errors during attachment creation
                current_app.logger.error(f"Error creating attachment for {filename}: {e}")
                raise
            i += 1

    def pre_delete(self, item: Bulletin) -> None:
        """Check permissions before deleting and delete S3 objects and related attachments."""
        if item.created_by_fk != g.user.id and not self.appbuilder.sm.is_admin():
            raise DeleteFailedError("You can only delete bulletins that you created")

        # Delete S3 objects and database entries for each attachment
        if item.image_attachments: 
            for attachment in item.image_attachments:
                if attachment.s3_key:
                    self._delete_s3_object(attachment.s3_key)
                # The cascade delete on the relationship should handle deleting the attachment
                # from the database when the bulletin is deleted, or delete them explicitly:
                # db.session.delete(attachment) 
        # If cascade="all, delete-orphan" is set on the relationship, 
        # SQLAlchemy will handle deleting BulletinImageAttachment rows when a Bulletin is deleted.
        # The S3 objects must be deleted manually as done above.

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(schema={"type": "array", "items": {"type": "integer"}})
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk bulletins
        ---
        delete:
          description: >-
            Deletes multiple bulletins in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: integer
          responses:
            200:
              description: Bulletins deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            # Check if user has permission to delete
            if not self.appbuilder.sm.has_access('can_write', self.class_permission_name):
                return self.response_403()

            # Get bulletins
            bulletins = self.datamodel.session.query(Bulletin).filter(
                Bulletin.id.in_(item_ids)
            ).all()

            if not bulletins:
                return self.response_404()

            # Check if user has permission to delete each bulletin
            for bulletin in bulletins:
                try:
                    self.pre_delete(bulletin)
                except DeleteFailedError as ex:
                    return self.response_403(message=str(ex))

            # Delete bulletins
            for bulletin in bulletins:
                self.datamodel.delete(bulletin)

            return self.response(
                200,
                message=f"Deleted {len(bulletins)} bulletins",
            )
        except Exception as ex:
            return self.response_422(message=str(ex))

    def _generate_presigned_url(self, object_key: str) -> str | None:
        if not object_key:
            return None
        try:
            s3_client_presigning = _get_s3_client_for_presigning()
            bucket_name = current_app.config.get('S3_BUCKET')
            
            public_endpoint_check = current_app.config.get('S3_PUBLIC_ENDPOINT_URL')
            if not public_endpoint_check:
                current_app.logger.error("S3_PUBLIC_ENDPOINT_URL is not configured. Cannot generate valid presigned URL for frontend.")
                return None

            url = s3_client_presigning.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': object_key},
                ExpiresIn=current_app.config.get('S3_PRESIGNED_URL_EXPIRATION', 3600)
            )
            # No replacement needed anymore, URL is generated with public host
            # current_app.logger.debug(f"Generated presigned URL with public host: {url}")
            return url

        except ClientError as e:
            current_app.logger.error(f"ClientError generating presigned URL for {object_key}: {e}")
            return None
        except Exception as e:
            current_app.logger.error(f"Unexpected error in _generate_presigned_url for {object_key}: {e}")
            return None

    def _augment_with_presigned_url(self, item_dict: dict) -> None:
        # This method will augment a bulletin dictionary.
        # It now expects item_dict['image_attachments'] to be a list of serialized attachment dicts.
        
        if 'image_attachments' in item_dict and isinstance(item_dict['image_attachments'], list):
            for attachment_dict in item_dict['image_attachments']:
                if isinstance(attachment_dict, dict) and 's3_key' in attachment_dict:
                    url = self._generate_presigned_url(attachment_dict['s3_key'])
                    attachment_dict['url'] = url
                else:
                    # Handle cases where an attachment might not be a dict or miss s3_key
                    attachment_dict['url'] = None 
        else:
            # Ensure the key exists even if there are no attachments or it's not a list
            item_dict['image_attachments'] = []

    def _augment_with_alert_info(self, item_dict: dict) -> None:
        """Augment bulletin dictionary with alert type and weather alert information."""
        # Add alert_type field
        if item_dict.get('disease_forecast_alert'):
            item_dict['alert_type'] = 'disease'
        elif item_dict.get('weather_forecast_alert_composite_id'):
            item_dict['alert_type'] = 'weather'
        else:
            item_dict['alert_type'] = None
            
        # For weather alerts, add the parsed weather alert information
        if item_dict.get('weather_forecast_alert_composite_id'):
            try:
                composite_id = item_dict['weather_forecast_alert_composite_id']
                parts = composite_id.split('_', 3)
                if len(parts) == 4:
                    municipality_code, created_date, forecast_date, weather_parameter = parts
                    
                    # Try to get the full weather alert details
                    weather_alert = db.session.query(WeatherForecastAlert).filter_by(
                        municipality_code=municipality_code,
                        created_date=created_date,
                        forecast_date=forecast_date,
                        weather_parameter=weather_parameter
                    ).first()
                    
                    if weather_alert:
                        item_dict['weather_forecast_alert'] = {
                            'municipality_code': weather_alert.municipality_code,
                            'municipality_name': weather_alert.municipality_name,
                            'created_date': weather_alert.created_date,
                            'forecast_date': weather_alert.forecast_date,
                            'weather_parameter': weather_alert.weather_parameter,
                            'alert_level': weather_alert.alert_level,
                            'parameter_value': weather_alert.parameter_value,
                            'alert_title': weather_alert.alert_title,
                            'alert_message': weather_alert.alert_message
                        }
                    # else:
                    #     # Fallback to parsed values
                    #     item_dict['weather_forecast_alert'] = {
                    #         'municipality_code': municipality_code,
                    #         'municipality_name': None,
                    #         'created_date': None,
                    #         'forecast_date': forecast_date,
                    #         'weather_parameter': weather_parameter,
                    #         'alert_level': None,
                    #         'parameter_value': None,
                    #         'alert_title': None,
                    #         'alert_message': None
                    #     }
            except (ValueError, AttributeError) as e:
                current_app.logger.warning(f"Error parsing weather alert composite ID {item_dict.get('weather_forecast_alert_composite_id')}: {e}")
                item_dict['weather_forecast_alert'] = None

    @expose("/<pk>", methods=("GET",))
    # @protect()
    @safe
    @permission_name("get")
    @statsd_metrics
    def get(self, pk: int, **kwargs: Any) -> Response:
        response = super().get(pk, **kwargs)
        if response.status_code == 200:
            try:
                data = json.loads(response.data)
                if 'result' in data and isinstance(data['result'], dict):
                    self._augment_with_presigned_url(data['result'])
                    self._augment_with_alert_info(data['result'])
                    response.data = json.dumps(data)
                    response.headers['Content-Type'] = 'application/json' # Ensure content type is correct
            except (json.JSONDecodeError, TypeError) as e: # Added TypeError for response.data if not bytes/str
                current_app.logger.error(f"Error processing response for presigned URL (get): {e}")
        return response

    @expose("/", methods=("GET",))
    @safe
    @permission_name("get_list")
    @statsd_metrics
    @rison()
    def get_list(self, **kwargs: Any) -> Response:
        """Get list of bulletins.
        ---
        get:
          summary: Get a list of bulletins
          description: >-
            Retrieves a list of bulletins.
            Supports pagination, sorting, and filtering.
            Filters can be applied using the 'q' parameter with a Rison-encoded JSON object
            (for complex queries like 'in', 'sw', 'ct', and for pagination/sorting)
            or via direct query parameters for simple equality checks on specific fields.
            Direct query parameters are ANDed with any filters specified in 'q'.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: string
            description: >-
              A Rison-encoded query for comprehensive filtering, sorting, and pagination.
              Example: q=(filters:!((col:title,opr:ct,value:Dengue)),page:0,page_size:25)
          - name: created_on_start
            in: query
            required: false
            schema:
              type: string
              format: date
            description: "Filter by start date for creation date range (inclusive, YYYY-MM-DD)."
          - name: created_on_end
            in: query
            required: false
            schema:
              type: string
              format: date
            description: "Filter by end date for creation date range (inclusive, YYYY-MM-DD)."
          - name: forecast_date_start
            in: query
            required: false
            schema:
              type: string
              format: date
            description: "Filter by start date for forecast date range (inclusive, YYYY-MM-DD). Applies to both disease and weather forecast alerts."
          - name: forecast_date_end
            in: query
            required: false
            schema:
              type: string
              format: date
            description: "Filter by end date for forecast date range (inclusive, YYYY-MM-DD). Applies to both disease and weather forecast alerts."
          - name: title
            in: query
            required: false
            schema:
              type: string
            description: Filter by title (case-insensitive contains).
          - name: hashtags
            in: query
            required: false
            schema:
              type: string
            description: Filter by hashtags (case-insensitive contains).
          - name: bulletin_type
            in: query
            required: false
            schema:
              type: string
              enum: [disease, weather]
            description: Filter by bulletin type (disease or weather forecast).
          - name: municipality_code
            in: query
            required: false
            schema:
              type: string
              enum: [TL-AL, TL-AN, TL-AT, TL-BA, TL-BO, TL-CO, TL-DI, TL-ER, TL-MT, TL-MF, TL-LA, TL-LI, TL-OE, TL-VI]
            description: Filter by municipality code from associated alerts.
          - name: municipality_name
            in: query
            required: false
            schema:
              type: string
              enum: [Aileu, Ainaro, Atauro, Baucau, Bobonaro, Covalima, Dili, Ermera, Manatuto, Manufahi, Lautem, Liquica, Raeoa, Viqueque]
            description: Filter by municipality name (case-insensitive contains) from associated alerts.
          - name: parameter
            in: query
            required: false
            schema:
              type: string
              enum: ["Wind Speed", "Rainfall", "Temperature", "Dengue", "Diarrhea"]
            description: Filter by parameter (disease_type for disease alerts, weather_parameter for weather alerts).
          - name: page
            in: query
            required: false
            schema:
              type: integer
              default: 0
            description: "Page number for pagination (0-indexed). Used if not specified in 'q'."
          - name: page_size
            in: query
            required: false
            schema:
              type: integer
              default: 25
            description: "Number of results per page. Used if not specified in 'q'. Set to -1 to retrieve all results."
          responses:
            200:
              description: A list of bulletins
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      ids:
                        type: array
                        items:
                          type: integer
                        description: A list of bulletin IDs
                      count:
                        type: integer
                        description: The total number of bulletins found
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/{{self.__class__.__name__}}.get_list'
                      page:
                        type: integer
                      page_size:
                        type: integer
                      total_pages:
                        type: integer
                      next_page_url:
                        type: [string, "null"]
                      prev_page_url:
                        type: [string, "null"]
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        logger.debug(f"Bulletins - Original kwargs from framework/rison (from 'q' param): {kwargs.get('rison')}")
        logger.debug(f"Bulletins - Request args (for direct filters): {request.args}")

        # Build base query with eager loading
        query = self.datamodel.session.query(self.datamodel.obj).options(*self.list_query_options)
        
        # Extract forecast date parameters for use throughout the method
        forecast_date_start_str = request.args.get("forecast_date_start")
        forecast_date_end_str = request.args.get("forecast_date_end")
        
        # Add left joins for alert relationships to support filtering
        query = query.outerjoin(DiseaseForecastAlert, self.datamodel.obj.disease_forecast_alert_id == DiseaseForecastAlert.id)
        
        logger.debug("Base query with joins: %s", query)
        
        # Date range filtering for created_on
        created_on_start_str = request.args.get("created_on_start")
        created_on_end_str = request.args.get("created_on_end")

        if created_on_start_str:
            try:
                start_date = date.fromisoformat(created_on_start_str)
                query = query.filter(cast(self.datamodel.obj.created_on, SQLDate) >= start_date)
            except ValueError:
                return self.response_400(message=f"Invalid date format for created_on_start: {created_on_start_str}")

        if created_on_end_str:
            try:
                end_date = date.fromisoformat(created_on_end_str)
                query = query.filter(cast(self.datamodel.obj.created_on, SQLDate) <= end_date)
            except ValueError:
                return self.response_400(message=f"Invalid date format for created_on_end: {created_on_end_str}")

        # Date range filtering for forecast_date (applies to both disease and weather alerts)
        logger.debug("Forecast date filtering - start_str: %s, end_str: %s", forecast_date_start_str, forecast_date_end_str)

        if forecast_date_start_str or forecast_date_end_str:
            forecast_filters = []
            
            # Disease alert forecast date filtering
            if forecast_date_start_str or forecast_date_end_str:
                # Start with bulletins that have disease forecast alerts AND the alert has valid data
                disease_forecast_filter = and_(
                    self.datamodel.obj.disease_forecast_alert_id.isnot(None),
                    DiseaseForecastAlert.id.isnot(None),  # Ensure the join actually found a matching alert
                    DiseaseForecastAlert.forecast_date.isnot(None)  # Ensure the alert has a valid forecast date
                )
                
                if forecast_date_start_str:
                    try:
                        start_date = date.fromisoformat(forecast_date_start_str)
                        logger.debug("Disease forecast start_date parsed: %s", start_date)
                        
                        # Debug: Check what disease forecast alerts exist for this date
                        debug_alerts = self.datamodel.session.query(DiseaseForecastAlert).filter(
                            cast(DiseaseForecastAlert.forecast_date, SQLDate) == start_date
                        ).all()
                        logger.debug("Disease alerts found for date %s: %d", start_date, len(debug_alerts))
                        for alert in debug_alerts[:3]:  # Log first 3 for debugging
                            logger.debug("Alert ID %s: forecast_date=%s (raw), municipality=%s, disease=%s", 
                                       alert.id, alert.forecast_date, alert.municipality_name, alert.disease_type)
                        
                        # Debug: Also check with >= comparison to see if there are alerts that should match
                        debug_alerts_gte = self.datamodel.session.query(DiseaseForecastAlert).filter(
                            cast(DiseaseForecastAlert.forecast_date, SQLDate) >= start_date
                        ).all()
                        logger.debug("Disease alerts found with >= %s: %d", start_date, len(debug_alerts_gte))
                        
                        # Debug: Check raw forecast_date values around this date
                        debug_all_alerts = self.datamodel.session.query(DiseaseForecastAlert).limit(5).all()
                        logger.debug("Sample disease alerts (first 5):")
                        for alert in debug_all_alerts:
                            logger.debug("Alert ID %s: forecast_date=%s (type: %s)", 
                                       alert.id, alert.forecast_date, type(alert.forecast_date))
                        
                        # Debug: Check bulletins linked to disease forecast alerts for this date
                        debug_bulletins = self.datamodel.session.query(Bulletin).join(
                            DiseaseForecastAlert, Bulletin.disease_forecast_alert_id == DiseaseForecastAlert.id
                        ).filter(
                            cast(DiseaseForecastAlert.forecast_date, SQLDate) == start_date
                        ).all()
                        logger.debug("Bulletins with disease alerts for date %s: %d", start_date, len(debug_bulletins))
                        for bulletin in debug_bulletins[:3]:  # Log first 3
                            logger.debug("Bulletin ID %s: title=%s, alert_id=%s", 
                                       bulletin.id, bulletin.title, bulletin.disease_forecast_alert_id)
                        
                        # Debug: Try with >= to see if the comparison logic works
                        debug_bulletins_gte = self.datamodel.session.query(Bulletin).join(
                            DiseaseForecastAlert, Bulletin.disease_forecast_alert_id == DiseaseForecastAlert.id
                        ).filter(
                            cast(DiseaseForecastAlert.forecast_date, SQLDate) >= start_date
                        ).all()
                        logger.debug("Bulletins with disease alerts >= date %s: %d", start_date, len(debug_bulletins_gte))
                        
                        # Debug: Check if the issue is with the outerjoin vs inner join
                        debug_bulletins_outerjoin = self.datamodel.session.query(Bulletin).outerjoin(
                            DiseaseForecastAlert, Bulletin.disease_forecast_alert_id == DiseaseForecastAlert.id
                        ).filter(
                            and_(
                                Bulletin.disease_forecast_alert_id.isnot(None),
                                cast(DiseaseForecastAlert.forecast_date, SQLDate) >= start_date
                            )
                        ).all()
                        logger.debug("Bulletins with outerjoin and disease alerts >= date %s: %d", start_date, len(debug_bulletins_outerjoin))
                        
                        disease_forecast_filter = and_(
                            disease_forecast_filter,
                            cast(DiseaseForecastAlert.forecast_date, SQLDate) >= start_date
                        )
                    except ValueError:
                        return self.response_400(message=f"Invalid date format for forecast_date_start: {forecast_date_start_str}")
                
                if forecast_date_end_str:
                    try:
                        end_date = date.fromisoformat(forecast_date_end_str)
                        logger.debug("Disease forecast end_date parsed: %s", end_date)
                        disease_forecast_filter = and_(
                            disease_forecast_filter,
                            cast(DiseaseForecastAlert.forecast_date, SQLDate) <= end_date
                        )
                    except ValueError:
                        return self.response_400(message=f"Invalid date format for forecast_date_end: {forecast_date_end_str}")
                
                logger.debug("Disease forecast filter created: %s", disease_forecast_filter)
                forecast_filters.append(disease_forecast_filter)

            # Weather alert forecast date filtering - filter bulletins by their associated alert's forecast_date
            if forecast_date_start_str or forecast_date_end_str:
                try:
                    # Build a filter condition that checks the forecast_date of the weather alert 
                    # associated with each bulletin's composite ID
                    weather_conditions = []
                    
                    if forecast_date_start_str:
                        start_date = date.fromisoformat(forecast_date_start_str)
                        logger.debug("Weather forecast start_date parsed: %s", start_date)
                        weather_conditions.append(
                            cast(WeatherForecastAlert.forecast_date, SQLDate) >= start_date
                        )
                    
                    if forecast_date_end_str:
                        end_date = date.fromisoformat(forecast_date_end_str)
                        logger.debug("Weather forecast end_date parsed: %s", end_date)
                        weather_conditions.append(
                            cast(WeatherForecastAlert.forecast_date, SQLDate) <= end_date
                        )
                    
                    if weather_conditions:
                        # Create a filter that:
                        # 1. Ensures bulletin has a weather_forecast_alert_composite_id
                        # 2. Joins with WeatherForecastAlert to check the forecast_date
                        # 3. Uses a subquery to match composite IDs with forecast_date criteria
                        
                        # Subquery to find weather alerts that meet the date criteria
                        weather_alerts_subquery = self.datamodel.session.query(
                            (WeatherForecastAlert.municipality_code + '_' + 
                             cast(WeatherForecastAlert.created_date, String) + '_' +
                             cast(WeatherForecastAlert.forecast_date, String) + '_' + 
                             WeatherForecastAlert.weather_parameter).label('composite_id')
                        ).filter(and_(*weather_conditions)).subquery()
                        
                        weather_forecast_filter = and_(
                            self.datamodel.obj.weather_forecast_alert_composite_id.isnot(None),
                            self.datamodel.obj.weather_forecast_alert_composite_id.in_(
                                self.datamodel.session.query(weather_alerts_subquery.c.composite_id)
                            )
                        )
                        
                        # Debug: Check how many bulletins this would match
                        debug_weather_bulletins = self.datamodel.session.query(self.datamodel.obj).filter(weather_forecast_filter).all()
                        logger.debug("Bulletins with weather alerts matching date criteria: %d", len(debug_weather_bulletins))
                        for bulletin in debug_weather_bulletins[:3]:
                            logger.debug("Weather Bulletin ID %s: composite_id=%s", bulletin.id, bulletin.weather_forecast_alert_composite_id)
                        
                        forecast_filters.append(weather_forecast_filter)
                        
                except ValueError as e:
                    logger.error("Error parsing weather forecast date: %s", e)
                    return self.response_400(message=f"Invalid date format: {e}")
            
            # Apply the forecast date filters (OR condition between disease and weather)
            if forecast_filters:
                logger.debug("Applying forecast filters (count: %d): %s", len(forecast_filters), forecast_filters)
                query = query.filter(or_(*forecast_filters))
                
                # Debug: Check what the query returns after applying forecast date filter
                debug_results_after_forecast_filter = query.all()
                logger.debug("Results after forecast date filter: %d bulletins", len(debug_results_after_forecast_filter))
                for bulletin in debug_results_after_forecast_filter[:3]:
                    logger.debug("Bulletin ID %s: title=%s, alert_id=%s", 
                               bulletin.id, bulletin.title, bulletin.disease_forecast_alert_id)
                    if bulletin.disease_forecast_alert:
                        logger.debug("  -> Alert forecast_date: %s", bulletin.disease_forecast_alert.forecast_date)

        logger.debug("[DEBUG] query %s", query)

        # Direct URL parameter filters for title and hashtags (contains search)
        if 'title' in request.args:
            title_filter = request.args['title']
            query = query.filter(self.datamodel.obj.title.ilike(f"%{title_filter}%"))
        
        if 'hashtags' in request.args:
            hashtags_filter = request.args['hashtags']
            query = query.filter(self.datamodel.obj.hashtags.ilike(f"%{hashtags_filter}%"))

        # Bulletin type filtering
        if 'bulletin_type' in request.args:
            bulletin_type = request.args['bulletin_type'].lower()
            if bulletin_type == 'disease':
                query = query.filter(self.datamodel.obj.disease_forecast_alert_id.isnot(None))
            elif bulletin_type == 'weather':
                query = query.filter(self.datamodel.obj.weather_forecast_alert_composite_id.isnot(None))
            else:
                return self.response_400(message=f"Invalid bulletin_type: {bulletin_type}. Must be 'disease' or 'weather'.")

        # Municipality code filtering (works for both alert types)
        if 'municipality_code' in request.args:
            municipality_code = request.args['municipality_code']
            
            # For disease alerts, filter by DiseaseForecastAlert.municipality_code
            disease_filter = and_(
                self.datamodel.obj.disease_forecast_alert_id.isnot(None),
                DiseaseForecastAlert.municipality_code == municipality_code
            )
            
            # For weather alerts, filter by parsing the composite ID
            weather_filter = and_(
                self.datamodel.obj.weather_forecast_alert_composite_id.isnot(None),
                self.datamodel.obj.weather_forecast_alert_composite_id.like(f"{municipality_code}_%")
            )
            
            query = query.filter(or_(disease_filter, weather_filter))

        # Municipality name filtering (works for both alert types)
        if 'municipality_name' in request.args:
            municipality_name = request.args['municipality_name']
            
            # For disease alerts, filter by DiseaseForecastAlert.municipality_name
            disease_filter = and_(
                self.datamodel.obj.disease_forecast_alert_id.isnot(None),
                DiseaseForecastAlert.municipality_name.ilike(f"%{municipality_name}%")
            )
            
            # For weather alerts, we need to join with the weather alerts table
            # Since we can't easily join on composite ID, we'll create a subquery
            weather_subquery = self.datamodel.session.query(WeatherForecastAlert.municipality_code, 
                                                           WeatherForecastAlert.forecast_date, 
                                                           WeatherForecastAlert.weather_parameter).filter(
                WeatherForecastAlert.municipality_name.ilike(f"%{municipality_name}%")
            ).subquery()
            
            # Build composite IDs from the subquery
            weather_composite_ids = self.datamodel.session.query(
                (weather_subquery.c.municipality_code + '_' + 
                 weather_subquery.c.forecast_date + '_' + 
                 weather_subquery.c.weather_parameter).label('composite_id')
            ).all()
            
            weather_composite_id_list = [row.composite_id for row in weather_composite_ids]
            
            weather_filter = and_(
                self.datamodel.obj.weather_forecast_alert_composite_id.isnot(None),
                self.datamodel.obj.weather_forecast_alert_composite_id.in_(weather_composite_id_list)
            ) if weather_composite_id_list else False
            
            query = query.filter(or_(disease_filter, weather_filter))

        # Parameter filtering (disease_type for disease alerts, weather_parameter for weather alerts)
        if 'parameter' in request.args:
            parameter = request.args['parameter']
            
            # For disease alerts, filter by DiseaseForecastAlert.disease_type
            disease_filter = and_(
                self.datamodel.obj.disease_forecast_alert_id.isnot(None),
                DiseaseForecastAlert.disease_type.ilike(f"%{parameter}%")
            )
            
            # For weather alerts, filter by parsing the composite ID
            weather_filter = and_(
                self.datamodel.obj.weather_forecast_alert_composite_id.isnot(None),
                self.datamodel.obj.weather_forecast_alert_composite_id.like(f"%_{parameter}")
            )
            
            query = query.filter(or_(disease_filter, weather_filter))

        # Handle Rison 'q' parameter
        rison_payload = kwargs.get("rison", {})
        if not isinstance(rison_payload, dict):
            rison_payload = {}

        rison_filters_list = rison_payload.get("filters")
        if rison_filters_list:
            fab_rison_filters = self.datamodel.get_filters(filter_columns_list=rison_filters_list)
            query = self.datamodel.apply_filters(query, fab_rison_filters)

        logger.debug("Final query before count: %s", query)
        item_count = query.count()
        logger.debug("Item count after all filters: %d", item_count)

        # Ordering
        order_column_name = rison_payload.get("order_column", "changed_on")
        order_direction = rison_payload.get("order_direction", "desc")
        if hasattr(self.datamodel.obj, order_column_name):
            column_attr = getattr(self.datamodel.obj, order_column_name)
            if order_direction == "desc":
                query = query.order_by(desc(column_attr))
            else:
                query = query.order_by(asc(column_attr))

        # Pagination
        page = rison_payload.get("page")
        page_size = rison_payload.get("page_size")
        if page is None: page = int(request.args.get("page", 0))
        if page_size is None: page_size = int(request.args.get("page_size", 25))

        total_pages = 0
        actual_page_size = page_size
        if page_size > 0:
            total_pages = (item_count + page_size - 1) // page_size
            offset = page * page_size
            query = query.limit(page_size).offset(offset)
        elif page_size == -1:
            total_pages = 1 if item_count > 0 else 0
            actual_page_size = item_count if item_count > 0 else 0

        result_objects = query.all()

        response_ids = [obj.id for obj in result_objects]
        
        # Use list_model_schema for serialization to match list columns
        response_data = self.list_model_schema.dump(result_objects, many=True)

        # Augment with presigned URLs and alert information
        for item_dict in response_data:
            self._augment_with_presigned_url(item_dict)
            self._augment_with_alert_info(item_dict)

        final_response = {
            "ids": response_ids, 
            "count": item_count,
            "result": response_data,
            "page": page,
            "page_size": actual_page_size,
            "total_pages": total_pages,
            "next_page_url": None,
            "prev_page_url": None,
        }

        if item_count > 0 and page_size > 0:
            base_url = request.base_url
            
            def build_url(target_page):
                params = request.args.copy()
                params["page"] = target_page
                params["page_size"] = actual_page_size
                if 'q' in params: del params['q'] # Avoid conflict if q was in args
                return f"{base_url}?{params.to_dict(flat=False)}"

            if (page + 1) < total_pages:
                final_response["next_page_url"] = build_url(page + 1)
            
            if page > 0 and total_pages > 0:
                final_response["prev_page_url"] = build_url(page - 1)
        
        return self.response(200, **final_response)

    @expose("/<int:bulletin_id>/pdf/", methods=("GET",))
    # @protect() # This decorator is already commented out or was never present
    @safe
    @statsd_metrics # Temporarily commented out for debugging
    # @permission_name("get") # Temporarily commented out for debugging
    def download_bulletin_pdf(self, bulletin_id: int) -> Response:
        """
        Downloads a bulletin as a PDF.
        ---
        get:
          summary: Download bulletin as PDF
          description: Downloads a bulletin as a PDF.
          parameters:
          - in: path
            name: bulletin_id
            schema:
              type: integer
            required: true
            description: The id of the bulletin
          responses:
            200:
              description: Bulletin PDF
              content:
                application/pdf:
                  schema:
                    type: string
                    format: binary
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              description: Bulletin not found
            500:
              description: Error generating PDF
        """
        bulletin = self.datamodel.get(bulletin_id)
        if not bulletin:
            return self.response_404()

        # Construct cache key
        # Ensure changed_on is in a consistent string format for the key
        changed_on_str = bulletin.changed_on.isoformat() if bulletin.changed_on else "no_changed_on"
        cache_key = f"bulletin_pdf_{bulletin_id}_{changed_on_str}"

        # Try to fetch from cache
        cached_pdf_data = cache_manager.data_cache.get(cache_key)

        if cached_pdf_data:
            pdf_buffer = BytesIO(cached_pdf_data)
            # pdf_buffer.seek(0) # BytesIO(data) is already at position 0
            is_preview = request.args.get('preview') == 'true'
            return send_file(
                pdf_buffer,
                mimetype="application/pdf",
                as_attachment=not is_preview, # Set as_attachment to False if preview=true
                download_name=f"bulletin_{bulletin.title.replace(' ', '_')}_{bulletin_id}.pdf"
            )

        # If not in cache, generate PDF
        try:
            pdf_buffer = generate_bulletin_pdf(bulletin)
            pdf_data = pdf_buffer.getvalue() # Get bytes once

            # Store in cache
            # Using default timeout from DATA_CACHE_CONFIG
            cache_manager.data_cache.set(cache_key, pdf_data)

            pdf_buffer.seek(0)  # Reset original buffer for send_file
            is_preview = request.args.get('preview') == 'true'
            return send_file(
                pdf_buffer, # Send the original buffer
                mimetype="application/pdf",
                as_attachment=not is_preview, # Set as_attachment to False if preview=true
                download_name=f"bulletin_{bulletin.title.replace(' ', '_')}_{bulletin_id}.pdf"
            )
        except Exception as e:
            # Consider logging the error more formally
            print(f"Error generating PDF for bulletin {bulletin_id}: {e}")
            return self.response_500(message="Error generating PDF")

    # --- Overriding POST to handle multipart/form-data --- 
    @expose("/", methods=["POST"])
    @protect()
    @statsd_metrics
    @permission_name("post")
    def post(self) -> Response:
        if not request.content_type.startswith("multipart/form-data"):
            return self.response_400(message="Request must be Multipart-FormData")

        form_data = request.form.to_dict()
        
        new_item = Bulletin()
        # Populate standard fields from self.add_columns
        for col_name in self.add_columns:
            if col_name not in form_data:
                 # For required fields, you might want to ensure they exist or rely on model validation
                pass # Or set to default, or raise error if mandatory and missing
            
            value = form_data.get(col_name)

            setattr(new_item, col_name, value) # Handles text fields

        try:
            # Set created_by_fk before adding
            if g.user:
                new_item.created_by_fk = g.user.id
            else: # Should not happen if @protect() is effective
                return self.response_401("User not authenticated")

            # Add the bulletin item first to get an ID
            db.session.add(new_item)
            db.session.flush() # Flush to get the new_item.id

            # Now handle image attachments
            self._handle_image_attachment_upload(new_item, is_update=False)

            db.session.commit() 
            
            # Serialize the created item, including its new attachments
            # This requires a schema that can handle the relationship.
            # For now, let's fetch it again to get attachments populated by _augment_with_presigned_url.
            # A more direct serialization is preferred.
            created_item_dict = self.show_model_schema.dump(new_item)
            self._augment_with_presigned_url(created_item_dict) # Add attachment URLs

            return self.response(201, result=created_item_dict)

        except Exception as e:
            current_app.logger.error(f"Error creating bulletin: {e}")
            db.session.rollback()
            return self.response_500(message=f"Error creating bulletin: {str(e)}")

    # --- Overriding PUT to handle multipart/form-data --- 
    @expose("/<pk>", methods=["PUT"])
    @protect()
    @statsd_metrics
    @permission_name("put")
    def put(self, pk: int) -> Response:
        if not request.content_type.startswith("multipart/form-data"):
            return self.response_400(message="Request must be Multipart-FormData")

        item = self.datamodel.get(pk, self._base_filters) # Use datamodel.get
        if not item:
            return self.response_404()

        # Check ownership for non-admins
        if item.created_by_fk != g.user.id and not self.appbuilder.sm.is_admin():
            return self.response_403(message="You can only edit bulletins that you created.")

        form_data = request.form.to_dict()
        
        # Update standard fields from self.edit_columns
        for col_name in self.edit_columns:
            if col_name in form_data: # Only process if field is in submitted form
                value = form_data.get(col_name)
                setattr(item, col_name, value)
            
        try:
            # Handle image attachments (add new, update captions, delete old)
            # _handle_image_attachment_upload now takes the bulletin item
            self._handle_image_attachment_upload(item, is_update=True)
            
            # item.changed_on = datetime.utcnow() # Handled by FAB/model
            db.session.merge(item) # Merge the item with updated fields and attachments
            db.session.commit()
            
            # Serialize the updated item
            # Similar to POST, fetch/augment for now.
            updated_item_dict = self.show_model_schema.dump(item)
            self._augment_with_presigned_url(updated_item_dict)

            return self.response(200, result=updated_item_dict)
        except Exception as e:
            current_app.logger.error(f"Error updating bulletin {pk}: {e}")
            db.session.rollback()
            return self.response_500(message=f"Error updating bulletin: {str(e)}")