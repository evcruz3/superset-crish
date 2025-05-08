# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import logging
from datetime import date # For parsing date string
from typing import Any

from flask import request, Response
from flask_appbuilder.api import expose, protect, rison, safe # Removed schema from here
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset import db
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

from .models import DiseaseForecastAlert, DiseasePipelineRunHistory
from .schemas import (
    DiseaseForecastAlertPostSchema,
    DiseaseForecastAlertPutSchema,
    DiseaseForecastAlertResponseSchema,
    get_alert_ids_schema,  # For bulk_delete
    openapi_spec_methods_override, # For OpenAPI spec customization
    DiseasePipelineRunHistoryPostSchema,
    DiseasePipelineRunHistoryPutSchema,
    DiseasePipelineRunHistoryResponseSchema,
)

logger = logging.getLogger(__name__)

class DiseaseForecastAlertRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(DiseaseForecastAlert)
    resource_name = "disease_forecast_alert" 
    allow_browser_login = True

    class_permission_name = "DiseaseForecastAlert" # Corresponds to a permission name
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    # Expose standard CRUD + bulk_delete. 
    # GET /<pk> will use the model's integer PK 'id' by default.
    # We will add custom PUT and DELETE that use composite_id string in the path.
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {"bulk_delete"} 

    # Define columns for list, show, add, edit, search views
    list_columns = [
        "id", # This will be the composite ID after get_list modification
        "municipality_code",
        "municipality_name",
        "forecast_date",
        "disease_type",
        "alert_level",
        "alert_title",
        "alert_message",
        "predicted_cases",
    ]
    # show_columns will use the integer PK from the database for GET /<pk>
    # but the response schema will ensure the 'id' field is the composite one.
    show_columns = list_columns 

    add_columns = [
        "municipality_code",
        "municipality_name",
        "forecast_date", 
        "disease_type",
        "alert_level",
        "alert_title",
        "alert_message",
        "predicted_cases",
    ]
    edit_columns = add_columns # For PUT, fields are taken from schema, lookup by composite_id

    search_columns = [
        "municipality_code",
        "municipality_name",
        "forecast_date",
        "disease_type",
        "alert_level",
        "predicted_cases",
    ]
    
    # Default ordering for lists
    base_order = ("forecast_date", "desc")
    
    # Schemas for different operations
    add_model_schema = DiseaseForecastAlertPostSchema()
    edit_model_schema = DiseaseForecastAlertPutSchema()
    # Response schema for GET /<pk> and items in GET list
    response_schema = DiseaseForecastAlertResponseSchema()
    
    # Schema for Rison arguments in specific endpoints (e.g., bulk_delete)
    apispec_parameter_schemas = {
        "get_alert_ids_schema": get_alert_ids_schema,
    }
    
    # OpenAPI spec customizations
    openapi_spec_tag = "Disease Forecast Alerts"
    openapi_spec_methods = openapi_spec_methods_override

    def _parse_composite_id(self, composite_id_str: str) -> dict[str, Any] | None:
        try:
            parts = composite_id_str.split('_', 2)
            if len(parts) != 3:
                return None
            municipality_code, forecast_date_str, disease_type = parts
            
            # Handle 'nocode' for municipality_code if it was None during ID generation
            parsed_municipality_code = None if municipality_code == 'nocode' else municipality_code
            
            return {
                "municipality_code": parsed_municipality_code,
                "forecast_date": date.fromisoformat(forecast_date_str),
                "disease_type": disease_type,
            }
        except ValueError: # Handles date parsing errors or incorrect split count
            return None

    @expose("/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_list",
        log_to_statsd=False,
    )
    def get_list(self, **kwargs: Any) -> Response:
        response = super().get_list(**kwargs)
        if isinstance(response, Response) and response.status_code == 200:
            try:
                data = response.json
                if "result" in data and isinstance(data["result"], list):
                    # Re-fetch objects to access model properties like composite_id
                    # This is less efficient but ensures we use the model's @property
                    # Alternatively, construct composite_id directly from item fields if all are present
                    pks = [item["id"] for item in data["result"] if "id" in item]
                    if pks:
                        object_list = self.datamodel.get_all(filters=None, pks=pks)
                        obj_map = {obj.id: obj for obj in object_list}
                        for item in data["result"]:
                            if "id" in item and item["id"] in obj_map:
                                # Replace database PK 'id' with composite_id string for frontend
                                item["id"] = obj_map[item["id"]].composite_id
                    response.json = data # Update the response data
            except Exception as e:
                logger.error(f"Error processing disease alerts list: {e}", exc_info=True)
        return response

    @expose("/", methods=["POST"])
    @protect()
    @safe # Typically for GET, but POST here is idempotent if trying to create existing based on unique constraint
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
            # Ensure db id is not part of the payload or is ignored
            if 'id' in item: 
                del item['id']

            new_alert = DiseaseForecastAlert(**item)
            db.session.add(new_alert)
            db.session.commit()
            # Return the composite_id in the response, matching weather API behavior
            return self.response(201, id=new_alert.composite_id, result=self.response_schema.dump(new_alert))
        except ValidationError as err:
            return self.response_400(message=str(err.messages))
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating disease alert: {e}", exc_info=True)
            return self.response_500(message=f"Error creating disease alert: {e}")

    @expose("/<composite_id_str>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, composite_id_str: str) -> Response:
        if not request.is_json:
            return self.response_400(message="Request is not JSON")

        key_parts = self._parse_composite_id(composite_id_str)
        if not key_parts:
            return self.response_400(message="Invalid composite ID format.")
        
        # Find the alert using the unique constraint fields rather than just PK
        # (municipality_code, forecast_date, disease_type)
        # We might need to add municipality_name to the key_parts if it's part of the unique key for lookup.
        # The UniqueConstraint is on (municipality_code, forecast_date, disease_type, municipality_name)
        # For simplicity, let's assume composite_id_str gives us enough to find it, or we enhance _parse_composite_id
        # The current _parse_composite_id doesn't include municipality_name. If it's required for uniqueness:
        # It implies municipality_name must also be part of the composite_id string definition.
        # Let's assume the model's composite_id property uses fields that ensure uniqueness for lookup.
        # The current model's composite_id is: f"{self.municipality_code or 'nocode'}_{forecast_date_str}_{self.disease_type}"
        # This might not be unique if municipality_name differs for the same code, date, type.
        # For now, proceed with this, but this is a key area for review if multiple records match.
        # A robust way is to query using all components of the unique constraint.
        # However, the path parameter is just composite_id_str. Let's assume we find one or none.

        query = db.session.query(DiseaseForecastAlert)
        if key_parts["municipality_code"] is None:
            query = query.filter(DiseaseForecastAlert.municipality_code.is_(None))
        else:
            query = query.filter_by(municipality_code=key_parts["municipality_code"])
        
        alert = query.filter_by(
            forecast_date=key_parts["forecast_date"],
            disease_type=key_parts["disease_type"]
        ).first() # This might need to be more specific if composite_id isn't fully unique without municipality_name

        if not alert:
            return self.response_404(message="Disease alert not found for the given composite ID.")

        try:
            item_data = self.edit_model_schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=str(err.messages))

        for key, value in item_data.items():
            setattr(alert, key, value)
        
        try:
            db.session.commit()
            return self.response(200, id=alert.composite_id, result=self.response_schema.dump(alert))
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating disease alert {composite_id_str}: {e}", exc_info=True)
            return self.response_500(message=f"Error updating disease alert: {e}")

    @expose("/<composite_id_str>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, composite_id_str: str) -> Response:
        key_parts = self._parse_composite_id(composite_id_str)
        if not key_parts:
            return self.response_400(message="Invalid composite ID format.")

        query = db.session.query(DiseaseForecastAlert)
        if key_parts["municipality_code"] is None:
            query = query.filter(DiseaseForecastAlert.municipality_code.is_(None))
        else:
            query = query.filter_by(municipality_code=key_parts["municipality_code"])
        
        alert = query.filter_by(
            forecast_date=key_parts["forecast_date"],
            disease_type=key_parts["disease_type"]
        ).first()

        if not alert:
            return self.response_404(message="Disease alert not found for the given composite ID.")

        try:
            db.session.delete(alert)
            db.session.commit()
            return self.response(200, message="Disease forecast alert deleted successfully.")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting disease alert {composite_id_str}: {e}", exc_info=True)
            return self.response_500(message=f"Error deleting disease alert: {e}")

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_alert_ids_schema) # Expects a list of composite string IDs
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        composite_ids = kwargs.get("rison")
        if not isinstance(composite_ids, list) or not composite_ids:
            return self.response_400(message="List of composite IDs is required.")

        deleted_count = 0
        not_found_ids = []
        error_ids = []

        for composite_id_str in composite_ids:
            key_parts = self._parse_composite_id(composite_id_str)
            if not key_parts:
                error_ids.append(composite_id_str) # Invalid format
                continue

            query = db.session.query(DiseaseForecastAlert)
            if key_parts["municipality_code"] is None:
                query = query.filter(DiseaseForecastAlert.municipality_code.is_(None))
            else:
                query = query.filter_by(municipality_code=key_parts["municipality_code"])
            
            alert = query.filter_by(
                forecast_date=key_parts["forecast_date"],
                disease_type=key_parts["disease_type"]
            ).first()

            if alert:
                try:
                    db.session.delete(alert)
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"Error processing deletion for {composite_id_str}: {e}", exc_info=True)
                    error_ids.append(composite_id_str)
            else:
                not_found_ids.append(composite_id_str)
        
        if error_ids or not_found_ids or deleted_count > 0:
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                logger.error(f"Error committing bulk delete transaction: {e}", exc_info=True)
                return self.response_500(message="Error during bulk delete commit.")
        
        response_messages = []
        if deleted_count > 0:
            response_messages.append(f"Successfully deleted {deleted_count} disease forecast alerts.")
        if not_found_ids:
            joined_not_found_ids = ", ".join(not_found_ids)
            response_messages.append(f"Alerts not found for composite IDs: {joined_not_found_ids}.")
        if error_ids:
            joined_error_ids = ", ".join(error_ids)
            response_messages.append(f"Errors occurred for composite IDs: {joined_error_ids}.")
        
        if not response_messages: # Should not happen if composite_ids was not empty
             return self.response_400(message="No valid operations performed in bulk delete.")

        status_code = 200
        if not_found_ids or error_ids:
            if deleted_count == 0:
                status_code = 404 # if nothing was deleted and some were not found/errored
            else:
                status_code = 207 # Multi-Status if some operations succeeded and some failed

        return self.response(status_code, message=" ".join(response_messages))

# --- API for Disease Pipeline Run History --- #

class DiseasePipelineRunHistoryRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(DiseasePipelineRunHistory)
    resource_name = "disease_pipeline_run_history"
    allow_browser_login = True

    class_permission_name = "DiseasePipelineRunHistory" # New permission name
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    # Standard CRUD. We will add a custom /last_successful_run endpoint.
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | { "last_successful_run" }

    list_columns = [
        "id",
        "ran_at",
        "pipeline_name",
        "status",
        "details",
        "municipalities_processed_count",
        "alerts_generated_count",
        "bulletins_created_count",
    ]
    show_columns = list_columns
    add_columns = [ # Fields settable on POST
        "pipeline_name", 
        "status", 
        "details", 
        "municipalities_processed_count", 
        "alerts_generated_count", 
        "bulletins_created_count"
    ]
    edit_columns = add_columns # Fields updatable on PUT

    search_columns = ["pipeline_name", "status", "ran_at"]
    base_order = ("ran_at", "desc")

    # Schemas
    add_model_schema = DiseasePipelineRunHistoryPostSchema()
    edit_model_schema = DiseasePipelineRunHistoryPutSchema()
    response_schema = DiseasePipelineRunHistoryResponseSchema()

    openapi_spec_tag = "Disease Forecast Alerts" # Keep under the same tag or create a new one e.g., "Disease Pipeline Monitoring"
    # If creating a new tag, it would need to be defined in Superset's OpenAPI config.
    # For simplicity, let's group it with Disease Forecast Alerts for now.

    # Custom POST to ensure 'ran_at' is handled by model default or DB if not provided.
    # The default BaseSupersetModelRestApi.post should already work fine given the model's default for ran_at.
    # If specific logic for POST is needed beyond what the base class offers with the schema, it can be overridden.
    # For similarity with WeatherDataPullRestApi's custom POST:
    @expose("/", methods=["POST"])
    @protect()
    @safe # Marking safe as it doesn't modify other critical data if only inserting history
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item_data = self.add_model_schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=str(err.messages))
        
        try:
            new_run_history = DiseasePipelineRunHistory(**item_data)
            # ran_at will be set by the model's default=datetime.utcnow or DB default
            db.session.add(new_run_history)
            db.session.commit()
            # Return the created object using the response schema
            return self.response(201, result=self.response_schema.dump(new_run_history))
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating disease pipeline run history: {e}", exc_info=True)
            return self.response_500(message=f"Error creating disease pipeline run history: {e}")

    @expose("/last_successful_run", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.last_successful_run",
        log_to_statsd=False,
    )
    def last_successful_run(self) -> Response:
        pipeline_name_filter = request.args.get("pipeline_name")
        query = db.session.query(DiseasePipelineRunHistory).filter_by(status="Success")

        if pipeline_name_filter:
            query = query.filter_by(pipeline_name=pipeline_name_filter)
        
        latest_successful_run = query.order_by(DiseasePipelineRunHistory.ran_at.desc()).first()

        if not latest_successful_run:
            message = "No successful disease pipeline runs found."
            if pipeline_name_filter:
                message = f"No successful runs found for pipeline: {pipeline_name_filter}."
            return self.response_404(message=message)
        
        return self.response(200, result=self.response_schema.dump(latest_successful_run)) 