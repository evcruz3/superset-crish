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
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.models.filters import Filters
from marshmallow import ValidationError, Schema, fields
import json
from flask_appbuilder.models.sqla.filters import FilterEqual
from sqlalchemy import asc, desc

from superset import db
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from flask_appbuilder.api import get_list_schema
from superset.weather_forecast_alerts.models import WeatherForecastAlert, WeatherDataPullHistory
from superset.weather_forecast_alerts.schemas import (
    get_alert_ids_schema,
    openapi_spec_methods_override,
    WeatherForecastAlertPutSchema,
    WeatherForecastAlertPostSchema,
    WeatherForecastAlertResponseSchema,
)

logger = logging.getLogger(__name__)


class WeatherForecastAlertRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(WeatherForecastAlert)
    resource_name = "weather_forecast_alert"
    allow_browser_login = True

    class_permission_name = "WeatherForecastAlert"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {"bulk_delete"}
    
    list_columns = [
        "municipality_code",
        "municipality_name",
        "forecast_date",
        "weather_parameter",
        "alert_level",
        "alert_title",
        "alert_message",
        "parameter_value",
    ]
    
    show_columns = list_columns
    
    add_columns = [
        "municipality_code",
        "municipality_name",
        "forecast_date", 
        "weather_parameter",
        "alert_level",
        "alert_title",
        "alert_message",
        "parameter_value",
    ]
    
    edit_columns = add_columns
    
    search_columns = [
        "municipality_code",
        "municipality_name",
        "forecast_date",
        "weather_parameter",
        "alert_level",
    ]
    
    # This is critical for SQLAInterface to know HOW to apply filters for these columns
    # whether they come from Rison 'q' parameter or from base_filters.
    search_filters = {
        "municipality_name": [FilterEqual],
        "weather_parameter": [FilterEqual],
        "municipality_code": [FilterEqual],
        "alert_level": [FilterEqual],
        "forecast_date": [FilterEqual],
    }

    # Helper static method to get args, returns None if not found.
    # This needs to be defined before base_filters uses it.
    @staticmethod
    def _get_arg_for_filter(arg_name: str) -> str | None:
        # Ensure request is in context when this is called by the lambda
        if request:
            return request.args.get(arg_name)
        return None

    # Class attribute base_filters. Lambdas will be called by SQLAInterface.
    # FilterEqual should not apply a filter if the lambda returns None.
    base_filters = [
        ["municipality_name", FilterEqual, lambda: WeatherForecastAlertRestApi._get_arg_for_filter("municipality_name")],
        ["weather_parameter", FilterEqual, lambda: WeatherForecastAlertRestApi._get_arg_for_filter("weather_parameter")],
        ["municipality_code", FilterEqual, lambda: WeatherForecastAlertRestApi._get_arg_for_filter("municipality_code")],
        ["alert_level", FilterEqual, lambda: WeatherForecastAlertRestApi._get_arg_for_filter("alert_level")],
        ["forecast_date", FilterEqual, lambda: WeatherForecastAlertRestApi._get_arg_for_filter("forecast_date")],
    ]
    
    base_order = ("forecast_date", "desc")
    
    add_model_schema = WeatherForecastAlertPostSchema()
    edit_model_schema = WeatherForecastAlertPutSchema()
    
    response_schema = WeatherForecastAlertResponseSchema()
    
    apispec_parameter_schemas = {
        "get_alert_ids_schema": get_alert_ids_schema,
    }
    
    openapi_spec_tag = "CRISH Weather Forecast Alerts"
    openapi_spec_methods = openapi_spec_methods_override

    @expose("/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_list",
        log_to_statsd=False,
    )
    def get_list(self, **kwargs):
        """Get list of weather forecast alerts.
        Supports filtering via direct query parameters (e.g., weather_parameter=Rainfall)
        and/or the 'q' rison parameter for complex queries.

        --- 
        get:
          summary: Get a list of weather forecast alerts
          description: |
            Retrieves a list of weather forecast alerts. 
            Supports pagination, sorting, and filtering. 
            Filters can be applied using the 'q' parameter with a Rison-encoded JSON object 
            (for complex queries like 'in', 'sw', 'ct', and for pagination/sorting) 
            or via direct query parameters for simple equality checks on specific fields (e.g., 
            'weather_parameter=Rainfall', 'alert_level=Danger'). 
            Direct query parameters are ANDed with any filters specified in 'q'.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_list_schema'
            description: |
              A Rison-encoded query for comprehensive filtering, sorting, and pagination. 
              Example for filtering by Rainfall and first page: 
              q=(filters:!((col:weather_parameter,opr:eq,value:Rainfall)),page:0,page_size:25)
          - name: weather_parameter
            in: query
            required: false
            schema:
              type: string
            description: Filter by exact weather parameter (e.g., Rainfall, Wind Speed, Heat Index).
          - name: municipality_code
            in: query
            required: false
            schema:
              type: string
            description: Filter by exact municipality code.
          - name: municipality_name
            in: query
            required: false
            schema:
              type: string
            description: Filter by exact municipality name (case-sensitive).
          - name: alert_level
            in: query
            required: false
            schema:
              type: string
            description: Filter by exact alert level (e.g., Danger, Extreme Caution).
          - name: forecast_date
            in: query
            required: false
            schema:
              type: string
            description: Filter by exact forecast date (YYYY-MM-DD).
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
              default: 25 # Default page size used by FAB/this API if not in q
            description: "Number of results per page. Used if not specified in 'q'. Set to -1 to attempt to retrieve all results (may be capped by server)."
          responses:
            200:
              description: A list of weather forecast alerts
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      ids:
                        type: array
                        items:
                          type: string
                        description: A list of alert IDs (composite keys)
                      count:
                        type: integer
                        description: The total number of alerts found
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
                      page:
                        type: integer
                        description: Current page number.
                      page_size:
                        type: integer
                        description: Number of items per page.
                      total_pages:
                        type: integer
                        description: Total number of pages.
                      next_page_url:
                        type: [string, "null"]
                        description: URL for the next page, if any.
                      prev_page_url:
                        type: [string, "null"]
                        description: URL for the previous page, if any.
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        logger.debug(f"Original kwargs from framework/rison (from 'q' param): {kwargs.get('rison')}")
        logger.debug(f"Request args (for direct filters): {request.args}")

        # 1. Start with a base SQLAlchemy query
        query = self.datamodel.session.query(self.datamodel.obj)

        # 2. Apply direct URL parameter filters using SQLAlchemy
        direct_query_params_mapping = {
            "weather_parameter": "weather_parameter",
            "municipality_code": "municipality_code",
            "municipality_name": "municipality_name",
            "alert_level": "alert_level",
            "forecast_date": "forecast_date",
        }
        for query_param_key, model_column_name in direct_query_params_mapping.items():
            if query_param_key in request.args:
                param_value = request.args.get(query_param_key)
                if param_value is not None and query_param_key.lower() not in ['q', 'page', 'page_size', 'order_column', 'order_direction', 'keys', 'columns']:
                    logger.info(f"Applying direct URL filter to SQLAlchemy query: {model_column_name} == {param_value}")
                    query = query.filter(getattr(self.datamodel.obj, model_column_name) == param_value)
        
        # 3. Handle Rison 'q' parameter (filters, pagination, ordering)
        rison_payload = kwargs.get("rison", {})
        if not isinstance(rison_payload, dict):
            rison_payload = {}

        # 3a. Apply filters from Rison 'q' parameter
        # Get the Rison structure for filters (e.g., [{col:, opr:, value:}])
        rison_filters_list = rison_payload.get("filters") 
        if rison_filters_list:
            # Convert Rison filter list to a FAB Filters object
            # The get_filters method takes a list of Rison filter dictionaries
            fab_rison_filters = self.datamodel.get_filters(filter_columns_list=rison_filters_list)
            logger.debug(f"Applying Rison filters (from q param) to SQLAlchemy query: {rison_filters_list}")
            query = self.datamodel.apply_filters(query, fab_rison_filters) # apply_filters expects Filters object
        else:
            logger.debug("No Rison filters (from q param) to apply.")

        # 4. Get the count AFTER all filters are applied
        logger.debug("Executing count query on filtered SQLAlchemy query.")
        item_count = query.count()

        # 5. Apply pagination and ordering from Rison payload to the filtered query
        logger.debug(f"Applying Rison pagination/ordering to SQLAlchemy query: {rison_payload}")
        # query = self.datamodel.query_apply_pagination_ordering(query, rison_payload) # This was causing error

        # Manual application of ordering
        order_column_name = rison_payload.get("order_column")
        order_direction = rison_payload.get("order_direction")
        if order_column_name and hasattr(self.datamodel.obj, order_column_name):
            column_attr = getattr(self.datamodel.obj, order_column_name)
            logger.debug(f"Applying ordering: {order_column_name} {order_direction}")
            if order_direction == "desc":
                query = query.order_by(desc(column_attr))
            else:
                query = query.order_by(asc(column_attr))
        elif not order_column_name and self.base_order: # Apply default base_order if no order_column in Rison
            # base_order is typically (column_name_str, "asc"/"desc")
            if hasattr(self.datamodel.obj, self.base_order[0]):
                column_attr = getattr(self.datamodel.obj, self.base_order[0])
                logger.debug(f"Applying default base_order: {self.base_order[0]} {self.base_order[1]}")
                if self.base_order[1] == "desc":
                    query = query.order_by(desc(column_attr))
                else:
                    query = query.order_by(asc(column_attr))

        # Manual application of pagination
        page = rison_payload.get("page")
        page_size = rison_payload.get("page_size")

        # If not in Rison, try direct query args
        if page is None:
            page = int(request.args.get("page", 0))
        if page_size is None:
            page_size_str = request.args.get("page_size", str(self.page_size or 25)) # Use self.page_size or default
            try:
                page_size = int(page_size_str)
            except ValueError:
                page_size = self.page_size or 25

        actual_page_size = page_size
        total_pages = 0

        if page_size > 0:
            logger.debug(f"Applying pagination: page {page}, page_size {page_size}")
            total_pages = (item_count + page_size - 1) // page_size # Ceiling division
            offset = page * page_size
            query = query.limit(page_size).offset(offset)
            actual_page_size = page_size
        elif page_size == -1: # Requesting all items
            logger.debug(f"Attempting to retrieve all items (page_size: -1)")
            total_pages = 1 if item_count > 0 else 0
            actual_page_size = item_count if item_count > 0 else 0 
            # No limit/offset applied if page_size is -1, assuming all items are fetched
        elif self.page_size and self.page_size > 0 and page_size is None: # Fallback to default if not specified and valid
            logger.debug(f"Applying default API page_size: {self.page_size}")
            total_pages = (item_count + self.page_size - 1) // self.page_size
            offset = (page or 0) * self.page_size # page might be None if not from Rison or direct
            query = query.limit(self.page_size).offset(offset)
            actual_page_size = self.page_size
        # else: page_size is 0 or invalid, no pagination applied beyond defaults or Rison direct control

        # 6. Execute the final query to get results
        logger.debug("Executing final data query on filtered, ordered, paginated SQLAlchemy query.")
        result = query.all()

        # 7. Prepare response
        pks = [self.datamodel.get_pk_value(item) for item in result] # Should handle composite PKs
        response_data = self.response_schema.dump(result, many=True)

        # Add synthetic 'id' to each result item for frontend compatibility
        for i, item_dict in enumerate(response_data):
            original_item = result[i]
            if isinstance(original_item, self.datamodel.obj) and 'id' not in item_dict:
                try:
                    mc = getattr(original_item, 'municipality_code')
                    fd = getattr(original_item, 'forecast_date')
                    wp = getattr(original_item, 'weather_parameter')
                    item_dict['id'] = f"{mc}_{fd}_{wp}"
                except AttributeError as e_attr:
                    logger.warning(f"Could not generate composite ID for item due to AttributeError {e_attr}: {item_dict}")

        final_response = {
            "ids": pks, 
            "count": item_count,
            "result": response_data,
            "page": page if page is not None else 0, # Ensure page is not None
            "page_size": actual_page_size,
            "total_pages": total_pages,
            "next_page_url": None,
            "prev_page_url": None,
        }

        # Generate prev/next URLs
        if item_count > 0 and page_size > 0: # Only generate if paginating
            base_url = request.base_url
            # Preserve existing Rison params if any, or build from scratch
            current_rison_params = rison_payload.copy() if rison_payload else {}
            # Preserve other direct query params not handled by Rison or pagination
            other_direct_params = { 
                k: v for k, v in request.args.items() 
                if k not in ['q', 'page', 'page_size'] 
            }

            def build_url_with_params(target_page):
                # Params for next/prev URL construction
                next_prev_params = {}
                
                # If Rison was used for original pagination, update Rison for next/prev links
                if "page" in rison_payload or "page_size" in rison_payload:
                    updated_rison = current_rison_params.copy()
                    updated_rison["page"] = target_page
                    updated_rison["page_size"] = page_size # Use the determined page_size
                    # Ensure other Rison params are kept
                    for key, val in rison_payload.items():
                        if key not in ["page", "page_size"]:
                            updated_rison[key] = val
                    # Rison encoding needed here for the q param
                    # This is a placeholder for actual Rison encoding. 
                    # For simplicity, showing as dict, but real Rison encoding needed for 'q'
                    # from superset.utils import rison # Potential import
                    # next_prev_params['q'] = rison.dumps(updated_rison) # if rison library is available and works like this
                    # For now, string representation for concept, replace with actual Rison encoding
                    # This part is complex because we need to re-encode Rison. 
                    # A simpler approach for now might be to just use direct query params for next/prev if Rison is not easily re-encoded here.
                    # For robust Rison link generation, one might need to parse and reconstruct 'q' carefully.
                    # Let's assume for now, if 'q' was present, it's complex to modify it for next/prev links reliably here without a Rison lib.
                    # So, we will prefer direct params for link generation if page/page_size were not in Rison initially.
                    # If they were, this part needs a robust Rison manipulation strategy.
                    # Simplified: if q was used, this logic needs to be smarter about q param generation for next/prev.
                    # Given the existing structure mostly uses direct args or parses Rison manually for pagination, we'll stick to that for link gen.
                    
                    # Sticking to query parameters for next/prev link as it's simpler than Rison re-encoding here.
                    temp_query_params = request.args.copy() # Start with all original args
                    temp_query_params["page"] = target_page
                    temp_query_params["page_size"] = page_size
                    if 'q' in temp_query_params: del temp_query_params['q'] # Avoid conflicting with Rison if it was there
                    # Add back other direct params not part of pagination, if any
                    for k, v in other_direct_params.items():
                         temp_query_params[k] = v
                    return f"{base_url}?{temp_query_params.to_dict(flat=False)}"
                else:
                    # If Rison was not used for pagination, use direct query params
                    temp_query_params = request.args.copy()
                    temp_query_params["page"] = target_page
                    temp_query_params["page_size"] = page_size
                    if 'q' in temp_query_params: del temp_query_params['q'] # Avoid conflict
                    # Add back other direct params
                    for k, v in other_direct_params.items():
                         temp_query_params[k] = v
                    return f"{base_url}?{temp_query_params.to_dict(flat=False)}"

            current_page_for_logic = page if page is not None else 0
            if (current_page_for_logic + 1) < total_pages:
                final_response["next_page_url"] = build_url_with_params(current_page_for_logic + 1)
            
            if current_page_for_logic > 0 and total_pages > 0:
                final_response["prev_page_url"] = build_url_with_params(current_page_for_logic - 1)
        
        return self.response(200, **final_response)
    
    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Creates a new weather forecast alert."""
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
            
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=str(err))
            
        # Create the weather forecast alert
        new_alert = WeatherForecastAlert()
        for key, value in item.items():
            setattr(new_alert, key, value)
            
        db.session.add(new_alert)
        db.session.commit()
        
        # Generate composite id for response
        composite_id = f"{new_alert.municipality_code}_{new_alert.forecast_date}_{new_alert.weather_parameter}"
        return self.response(201, id=composite_id)
        
    @expose("/<composite_id>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, composite_id: str) -> Response:
        """Updates an existing weather forecast alert using composite ID."""
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
            
        try:
            # Parse composite ID
            try:
                municipality_code, forecast_date_part, weather_parameter = composite_id.split('_', 2)
            except ValueError:
                return self.response_400(message="Invalid composite ID format. Expected format: municipality_code_date_parameter")
                
            # Get the alert using composite key
            alert = db.session.query(WeatherForecastAlert).filter_by(
                municipality_code=municipality_code,
                forecast_date=forecast_date_part,
                weather_parameter=weather_parameter
            ).first()
            
            if not alert:
                return self.response_404()
                
            # Parse request data  
            item = self.edit_model_schema.load(request.json)
                
            # Update the weather forecast alert
            for key, value in item.items():
                if value is not None:
                    setattr(alert, key, value)
                    
            db.session.commit()
            
            return self.response(200, id=composite_id)
            
        except Exception as e:
            logger.error(f"Error updating alert: {e}")
            return self.response_422(message=str(e))
        
    @expose("/<composite_id>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, composite_id: str) -> Response:
        """Deletes a weather forecast alert using composite ID."""
        try:
            # Parse composite ID
            municipality_code, forecast_date_part, weather_parameter = composite_id.split('_', 2)
            
            # Get the alert using composite key
            alert = db.session.query(WeatherForecastAlert).filter_by(
                municipality_code=municipality_code, 
                forecast_date=forecast_date_part,
                weather_parameter=weather_parameter
            ).first()
            
            if not alert:
                return self.response_404()
                
            db.session.delete(alert)
            db.session.commit()
            
            return self.response(200, message="Weather forecast alert deleted")
            
        except Exception as e:
            logger.error(f"Error deleting alert: {e}")
            return self.response_422(message=str(e))
        
    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_alert_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Deletes multiple weather forecast alerts by composite IDs."""
        composite_ids = kwargs["rison"]
        if not composite_ids:
            return self.response_400(message="No composite IDs provided for bulk deletion")
        
        deleted_count = 0
        for composite_id in composite_ids:
            try:
                # Parse composite ID
                municipality_code, forecast_date_part, weather_parameter = composite_id.split('_', 2)
                
                # Find and delete the alert
                alert = db.session.query(WeatherForecastAlert).filter_by(
                    municipality_code=municipality_code,
                    forecast_date=forecast_date_part, 
                    weather_parameter=weather_parameter
                ).first()
                
                if alert:
                    db.session.delete(alert)
                    deleted_count += 1
            except Exception as e:
                logger.error(f"Error processing deletion for {composite_id}: {e}")
                
        if deleted_count == 0:
            return self.response_404()
            
        db.session.commit()
        return self.response(200, message=f"Deleted {deleted_count} weather forecast alerts")


class WeatherDataPullSchema(Schema):
    """Schema for weather data pull request."""
    parameters_pulled = fields.String(required=True)
    pull_status = fields.String(required=True)
    details = fields.String(required=False, allow_none=True)


class WeatherDataPullRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(WeatherDataPullHistory)
    resource_name = "weather_data_pull"
    allow_browser_login = True

    class_permission_name = "WeatherDataPullHistory"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {"last_pull"}
    
    list_columns = [
        "id",
        "pulled_at",
        "parameters_pulled",
        "pull_status",
        "details",
    ]
    
    show_columns = list_columns
    
    add_columns = [
        "parameters_pulled",
        "pull_status",
        "details",
    ]
    
    edit_columns = add_columns
    
    search_columns = [
        "pull_status",
    ]
    
    base_order = ("pulled_at", "desc")
    
    openapi_spec_tag = "CRISH Weather Data Pull History"
    
    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Records a new weather data pull history entry."""
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
            
        try:
            schema = WeatherDataPullSchema()
            item = schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=str(err))
            
        # Create the weather data pull history
        new_history = WeatherDataPullHistory(
            pulled_at=datetime.now(),
            parameters_pulled=item["parameters_pulled"],
            pull_status=item["pull_status"],
            details=item.get("details")
        )
            
        db.session.add(new_history)
        db.session.commit()
        
        return self.response(201, id=new_history.id)
    
    @expose("/last_pull", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.last_pull",
        log_to_statsd=False,
    )
    def last_pull(self) -> Response:
        """Get the latest successful weather data pull."""
        try:
            # Find the most recent successful pull
            latest_pull = db.session.query(WeatherDataPullHistory)\
                .filter(WeatherDataPullHistory.pull_status == "Success")\
                .order_by(WeatherDataPullHistory.pulled_at.desc())\
                .first()
                
            if not latest_pull:
                logger.warning("No successful weather data pulls found in history")
                return self.response(404, message="No successful weather data pull history found")
                
            # Format the response
            result = {
                "id": latest_pull.id,
                "pulled_at": latest_pull.pulled_at.isoformat(),
                "parameters_pulled": latest_pull.parameters_pulled,
                "pull_status": latest_pull.pull_status,
                "details": latest_pull.details
            }
                
            return self.response(200, result=result)
                
        except Exception as e:
            logger.error(f"Error retrieving last pull: {e}")
            return self.response_422(message=str(e)) 