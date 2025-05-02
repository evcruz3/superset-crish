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
from marshmallow import ValidationError, Schema, fields

from superset import db
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
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
    
    base_order = ("forecast_date", "desc")
    
    add_model_schema = WeatherForecastAlertPostSchema()
    edit_model_schema = WeatherForecastAlertPutSchema()
    
    response_schema = WeatherForecastAlertResponseSchema()
    
    apispec_parameter_schemas = {
        "get_alert_ids_schema": get_alert_ids_schema,
    }
    
    openapi_spec_tag = "Weather Forecast Alerts"
    openapi_spec_methods = openapi_spec_methods_override
    
    # Customize get_list to handle composite primary key
    @expose("/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_list",
        log_to_statsd=False,
    )
    def get_list(self, **kwargs):
        """Get list of weather forecast alerts."""
        # Use standard get_list but add custom id field
        print("[Weather Forecast Alerts] get_list", kwargs)
        
        # Check if we're filtering by weather_parameter
        if 'filters' in kwargs:
            print("[Weather Forecast Alerts] filters:", kwargs['filters'])
        
        # Get all alerts to analyze
        all_alerts = db.session.query(WeatherForecastAlert).all()
        
        # Count alerts by weather parameter
        heat_index_count = sum(1 for a in all_alerts if a.weather_parameter == 'Heat Index')
        rainfall_count = sum(1 for a in all_alerts if a.weather_parameter == 'Rainfall')
        wind_speed_count = sum(1 for a in all_alerts if a.weather_parameter == 'Wind Speed')
        
        # Now get the response from the parent method
        response = super().get_list(**kwargs)
        
        # Process the response to add ID if needed
        if isinstance(response, Response) and response.status_code == 200:
            try:
                result = response.json
                if 'result' in result:
                    # Add id property for frontend compatibility
                    for item in result['result']:
                        if 'id' not in item:
                            # Generate composite id
                            item['id'] = f"{item['municipality_code']}_{item['forecast_date']}_{item['weather_parameter']}"
                    response.json = result
                    response.set_data(response.json)
            except Exception as e:
                logger.error(f"Error processing alerts: {e}")
        
        return response
    
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
    
    openapi_spec_tag = "Weather Data Pull History"
    
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