import logging
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional, Type

from flask import request, Response, g
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.models.filters import Filters
from flask_appbuilder.models.sqla.filters import FilterEqual
from marshmallow import ValidationError
from sqlalchemy import and_, or_, func, cast, Date as SQLDate

from superset.extensions import db
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from superset.weather_forecasts.models import (
    WeatherForecast,
    WindSpeedDailyAvgRegion,
    HeatIndexDailyRegion,
    RainfallDailyWeightedAverage,
    RhDailyAvgRegion,
    TmaxDailyTmaxRegion,
    TminDailyTminRegion,
    BaseWeatherParameterModel
)
from superset.weather_forecasts.schemas import (
    # WeatherForecastListResponseSchema, # Removed
    # get_list_schema, # Removed
    openapi_spec_methods_override,
    WindSpeedDailyAvgRegionSchema,
    WindSpeedDailyAvgRegionPostSchema,
    HeatIndexDailyRegionSchema,
    HeatIndexDailyRegionPostSchema,
    RainfallDailyWeightedAverageSchema,
    RainfallDailyWeightedAveragePostSchema,
    RhDailyAvgRegionSchema,
    RhDailyAvgRegionPostSchema,
    TmaxDailyTmaxRegionSchema,
    TmaxDailyTmaxRegionPostSchema,
    TminDailyTminRegionSchema,
    TminDailyTminRegionPostSchema,
    WeatherParameterListResponseSchema,
    get_list_rison_schema,
    BaseWeatherParameterSchema
)

logger = logging.getLogger(__name__)


class WeatherForecastsApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(WeatherForecast)
    resource_name = "weather_forecasts" # Base resource name
    allow_browser_login = True
    class_permission_name = "WeatherForecast" # General permission for this group of APIs
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    openapi_spec_tag = "CRISH Weather Forecasts"
    # Define list_columns to avoid auto-detection issues
    list_columns = [
        "forecast_date",
        "municipality_code",
        "municipality_name",
        "day_name",
    ]

    # Define show_columns, add_columns, edit_columns to be explicit
    show_columns = list_columns
    add_columns = list_columns
    edit_columns = list_columns
    search_columns = list_columns # Basic search on the same columns

    # No datamodel at class level as it changes per endpoint
    # Schemas are also resolved per endpoint

    # --- Helper method for CRUD operations ---
    def _get_item_by_composite_key(self, model_class: Type[BaseWeatherParameterModel], mun_code: str, forecast_dt: date):
        return db.session.query(model_class).filter_by(
            municipality_code=mun_code,
            forecast_date=forecast_dt
        ).first()

    def _handle_get_list(self, model_class: Type[BaseWeatherParameterModel], schema_class: Type[BaseWeatherParameterSchema]):
        query = db.session.query(model_class)

        # Apply direct URL parameter filters
        direct_filters_map = {
            "municipality_code": "municipality_code",
            "municipality_name": "municipality_name",
        }
        for param_key, model_col in direct_filters_map.items():
            param_value = request.args.get(param_key)
            if param_value:
                query = query.filter(getattr(model_class, model_col) == param_value)
        
        # Apply date filters (forecast_date and days_range)
        forecast_date_str = request.args.get("forecast_date")
        days_range_str = request.args.get("days_range", "1")
        start_date = _parse_date_string(forecast_date_str) if forecast_date_str else None

        if start_date:
            days_range = int(days_range_str) if days_range_str.isdigit() and int(days_range_str) > 0 else 1
            end_date = start_date + timedelta(days=days_range - 1)
            query = query.filter(
                and_(
                    cast(getattr(model_class, "forecast_date"), SQLDate) >= start_date,
                    cast(getattr(model_class, "forecast_date"), SQLDate) <= end_date
                )
            )
        
        # Process Rison 'q' payload (filters, pagination, ordering)
        rison_args = request.args.get("q")
        if rison_args:
            try:
                # For FAB/Marshmallow to process Rison, it usually expects it in kwargs via @rison decorator
                # Here we manually parse and apply if needed, or adjust to use FAB's Rison handling more directly.
                # This part might need refinement based on direct Rison usage vs. FAB's built-in handling.
                # For now, let's assume simple Rison filter application:
                # This is a simplified placeholder. Proper Rison handling involves more.
                # It's often better to define a generic datamodel interface for SQLAInterface and use its methods.
                # However, without a class-level datamodel, this becomes tricky.
                # For full Rison support, we might need a different structure or pass it to a SQLAInterface instance.
                # For simplicity, focusing on direct params first, Rison can be enhanced.
                # Let's assume self.datamodel is temporarily set for Rison filter processing if FAB's utils are used.
                _sqla_interface = SQLAInterface(model_class)
                _filters = _sqla_interface.get_filters_from_rison(rison_args)
                query = _filters.apply_all(query)

            except Exception as e:
                logger.warning(f"Could not parse Rison query: {e}")
                # Potentially return 400 if Rison is malformed

        item_count = query.count()
        
        # Ordering (simplified, enhance with Rison payload if needed)
        # For now, default ordering or simple param; Rison should handle this ideally.
        query = query.order_by(getattr(model_class, "forecast_date").asc(), getattr(model_class, "municipality_code").asc())

        # Pagination (simplified, enhance with Rison payload)
        page = int(request.args.get("page", 0))
        page_size = int(request.args.get("page_size", 25))
        if page_size > 0:
            offset = page * page_size
            query = query.limit(page_size).offset(offset)

        results = query.all()
        schema = schema_class()
        list_response_schema = WeatherParameterListResponseSchema()
        return self.response(200, **list_response_schema.dump({"count": item_count, "result": schema.dump(results, many=True)}))

    # --- Wind Speed Endpoints ---
    @expose("/wind_speed", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_wind_speed_list")
    def get_wind_speed_list(self) -> Response:
        """
        ---
        get:
          summary: Get list of wind speed forecasts
          description: Retrieves a list of wind speed forecasts with filtering and pagination.
          parameters:
            - name: q
              in: query
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/get_list_rison_schema'
            - name: municipality_code
              in: query
              schema: { type: string }
            - name: municipality_name
              in: query
              schema: { type: string }
            - name: forecast_date
              in: query
              schema: { type: string, format: date }
            - name: days_range
              in: query
              schema: { type: integer, default: 1, minimum: 1 }
          responses:
            200:
              description: List of wind speed forecasts
              content:
                application/json:
                  schema: WeatherParameterListResponseSchema # This should refer to the component schema
            400: { $ref: '#/components/responses/400' }
            401: { $ref: '#/components/responses/401' }
            500: { $ref: '#/components/responses/500' }
        """
        return self._handle_get_list(WindSpeedDailyAvgRegion, WindSpeedDailyAvgRegionSchema)

    @expose("/wind_speed", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_wind_speed")
    def post_wind_speed(self) -> Response:
        """
        ---
        post:
          summary: Create a new wind speed forecast entry
          requestBody:
            required: true
            content:
              application/json:
                schema: WindSpeedDailyAvgRegionPostSchema
          responses:
            201:
              description: Wind speed forecast created
              content:
                application/json:
                  schema: WindSpeedDailyAvgRegionSchema
            400: { $ref: '#/components/responses/400' }
            409: { $ref: '#/components/responses/409' } # Conflict
            422: { $ref: '#/components/responses/422' }
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            schema = WindSpeedDailyAvgRegionPostSchema()
            item_data = schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=str(err.messages))

        # Derive day_name if not provided
        if isinstance(item_data.get('forecast_date'), date) and not item_data.get('day_name'):
            item_data['day_name'] = item_data['forecast_date'].strftime("%A")

        if self._get_item_by_composite_key(WindSpeedDailyAvgRegion, item_data['municipality_code'], item_data['forecast_date']):
            return self.response_409(message="Entry already exists for this municipality and date.")

        new_item = WindSpeedDailyAvgRegion(**item_data)
        try:
            db.session.add(new_item)
            db.session.commit()
            return self.response(201, **WindSpeedDailyAvgRegionSchema().dump(new_item))
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating wind speed forecast: {e}", exc_info=True)
            return self.response_422(message=f"Could not create entry: {str(e)}")

    @expose("/wind_speed/<string:mun_code>/<string:forecast_date_str>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_wind_speed_item")
    def get_wind_speed_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        get:
          summary: Get a specific wind speed forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200:
              description: Wind speed forecast entry
              content:
                application/json:
                  schema: WindSpeedDailyAvgRegionSchema
            404: { $ref: '#/components/responses/404' }
        """
        forecast_dt = _parse_date_string(forecast_date_str)
        if not forecast_dt:
            return self.response_400(message="Invalid date format. Use YYYY-MM-DD.")
        
        item = self._get_item_by_composite_key(WindSpeedDailyAvgRegion, mun_code, forecast_dt)
        if not item:
            return self.response_404()
        return self.response(200, **WindSpeedDailyAvgRegionSchema().dump(item))

    @expose("/wind_speed/<string:mun_code>/<string:forecast_date_str>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_wind_speed_item")
    def put_wind_speed_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        put:
          summary: Update a specific wind speed forecast entry
          parameters: # Path parameters are part of the @expose decorator
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          requestBody:
            required: true
            content:
              application/json:
                schema: WindSpeedDailyAvgRegionSchema # Full schema for update, partial=True will be used in load
          responses:
            200:
              description: Wind speed forecast updated
              content:
                application/json:
                  schema: WindSpeedDailyAvgRegionSchema
            400: { $ref: '#/components/responses/400' }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        forecast_dt = _parse_date_string(forecast_date_str)
        if not forecast_dt:
            return self.response_400(message="Invalid date format. Use YYYY-MM-DD.")

        item = self._get_item_by_composite_key(WindSpeedDailyAvgRegion, mun_code, forecast_dt)
        if not item:
            return self.response_404()

        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            # Use the main schema, marshmallow handles partial updates with partial=True
            schema = WindSpeedDailyAvgRegionSchema(partial=True) 
            item_data = schema.load(request.json)
        except ValidationError as err:
            return self.response_400(message=str(err.messages))

        # Cannot change primary key parts (municipality_code, forecast_date) via PUT
        if "municipality_code" in item_data and item_data["municipality_code"] != mun_code:
            return self.response_400(message="Cannot change municipality_code via PUT.")
        if "forecast_date" in item_data and _parse_date_string(str(item_data["forecast_date"])) != forecast_dt:
             return self.response_400(message="Cannot change forecast_date via PUT.")

        # Update day_name if forecast_date is being updated (though PK change is disallowed above)
        # Or if value is provided and day_name is missing/needs recalculation
        if 'forecast_date' in item_data and isinstance(item_data.get('forecast_date'), date):
            item_data['day_name'] = item_data['forecast_date'].strftime("%A")
        elif item.forecast_date and not item_data.get('day_name') and 'value' in item_data: # if value changes, ensure day name present
             item_data['day_name'] = item.forecast_date.strftime("%A")

        for key, value in item_data.items():
            setattr(item, key, value)
        
        try:
            db.session.commit()
            return self.response(200, **WindSpeedDailyAvgRegionSchema().dump(item))
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating wind speed forecast: {e}", exc_info=True)
            return self.response_422(message=f"Could not update entry: {str(e)}")

    @expose("/wind_speed/<string:mun_code>/<string:forecast_date_str>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_wind_speed_item")
    def delete_wind_speed_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        delete:
          summary: Delete a specific wind speed forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200: { description: "Wind speed forecast deleted" }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_delete_item(WindSpeedDailyAvgRegion, mun_code, forecast_date_str)

    # --- Heat Index Endpoints ---
    @expose("/heat_index", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_heat_index_list")
    def get_heat_index_list(self) -> Response:
        """
        ---
        get:
          summary: Get list of heat index forecasts
          description: Retrieves a list of heat index forecasts with filtering and pagination.
          parameters:
            - name: q
              in: query
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/get_list_rison_schema'
            - name: municipality_code
              in: query
              schema: { type: string }
            - name: municipality_name
              in: query
              schema: { type: string }
            - name: forecast_date
              in: query
              schema: { type: string, format: date }
            - name: days_range
              in: query
              schema: { type: integer, default: 1, minimum: 1 }
          responses:
            200:
              description: List of heat index forecasts
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/WeatherParameterListResponseSchema'
            400: { $ref: '#/components/responses/400' }
            401: { $ref: '#/components/responses/401' }
            500: { $ref: '#/components/responses/500' }
        """
        return self._handle_get_list(HeatIndexDailyRegion, HeatIndexDailyRegionSchema)

    @expose("/heat_index", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_heat_index")
    def post_heat_index(self) -> Response:
        """
        ---
        post:
          summary: Create a new heat index forecast entry
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/HeatIndexDailyRegionPostSchema'
          responses:
            201:
              description: Heat index forecast created
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/HeatIndexDailyRegionSchema'
            400: { $ref: '#/components/responses/400' }
            409: { $ref: '#/components/responses/409' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_post_item(HeatIndexDailyRegion, HeatIndexDailyRegionPostSchema, HeatIndexDailyRegionSchema)

    @expose("/heat_index/<string:mun_code>/<string:forecast_date_str>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_heat_index_item")
    def get_heat_index_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        get:
          summary: Get a specific heat index forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200:
              description: Heat index forecast entry
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/HeatIndexDailyRegionSchema'
            404: { $ref: '#/components/responses/404' }
        """
        return self._handle_get_item(HeatIndexDailyRegion, HeatIndexDailyRegionSchema, mun_code, forecast_date_str)

    @expose("/heat_index/<string:mun_code>/<string:forecast_date_str>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_heat_index_item")
    def put_heat_index_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        put:
          summary: Update a specific heat index forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/HeatIndexDailyRegionSchema'
          responses:
            200:
              description: Heat index forecast updated
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/HeatIndexDailyRegionSchema'
            400: { $ref: '#/components/responses/400' }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_put_item(HeatIndexDailyRegion, HeatIndexDailyRegionSchema, mun_code, forecast_date_str)

    @expose("/heat_index/<string:mun_code>/<string:forecast_date_str>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_heat_index_item")
    def delete_heat_index_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        delete:
          summary: Delete a specific heat index forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200: { description: "Heat index forecast deleted" }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_delete_item(HeatIndexDailyRegion, mun_code, forecast_date_str)

    # --- Rainfall Endpoints ---
    @expose("/rainfall", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_rainfall_list")
    def get_rainfall_list(self) -> Response:
        """
        ---
        get:
          summary: Get list of rainfall forecasts
          description: Retrieves a list of rainfall forecasts with filtering and pagination.
          parameters:
            - name: q
              in: query
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/get_list_rison_schema'
            - name: municipality_code
              in: query
              schema: { type: string }
            - name: municipality_name
              in: query
              schema: { type: string }
            - name: forecast_date
              in: query
              schema: { type: string, format: date }
            - name: days_range
              in: query
              schema: { type: integer, default: 1, minimum: 1 }
          responses:
            200:
              description: List of rainfall forecasts
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/WeatherParameterListResponseSchema'
            400: { $ref: '#/components/responses/400' }
            401: { $ref: '#/components/responses/401' }
            500: { $ref: '#/components/responses/500' }
        """
        return self._handle_get_list(RainfallDailyWeightedAverage, RainfallDailyWeightedAverageSchema)

    @expose("/rainfall", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_rainfall")
    def post_rainfall(self) -> Response:
        """
        ---
        post:
          summary: Create a new rainfall forecast entry
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/RainfallDailyWeightedAveragePostSchema'
          responses:
            201:
              description: Rainfall forecast created
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/RainfallDailyWeightedAverageSchema'
            400: { $ref: '#/components/responses/400' }
            409: { $ref: '#/components/responses/409' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_post_item(RainfallDailyWeightedAverage, RainfallDailyWeightedAveragePostSchema, RainfallDailyWeightedAverageSchema)

    @expose("/rainfall/<string:mun_code>/<string:forecast_date_str>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_rainfall_item")
    def get_rainfall_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        get:
          summary: Get a specific rainfall forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200:
              description: Rainfall forecast entry
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/RainfallDailyWeightedAverageSchema'
            404: { $ref: '#/components/responses/404' }
        """
        return self._handle_get_item(RainfallDailyWeightedAverage, RainfallDailyWeightedAverageSchema, mun_code, forecast_date_str)

    @expose("/rainfall/<string:mun_code>/<string:forecast_date_str>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_rainfall_item")
    def put_rainfall_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        put:
          summary: Update a specific rainfall forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/RainfallDailyWeightedAverageSchema'
          responses:
            200:
              description: Rainfall forecast updated
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/RainfallDailyWeightedAverageSchema'
            400: { $ref: '#/components/responses/400' }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_put_item(RainfallDailyWeightedAverage, RainfallDailyWeightedAverageSchema, mun_code, forecast_date_str)

    @expose("/rainfall/<string:mun_code>/<string:forecast_date_str>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_rainfall_item")
    def delete_rainfall_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        delete:
          summary: Delete a specific rainfall forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200: { description: "Rainfall forecast deleted" }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_delete_item(RainfallDailyWeightedAverage, mun_code, forecast_date_str)

    # --- Humidity (Rh) Endpoints ---
    @expose("/humidity", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_humidity_list")
    def get_humidity_list(self) -> Response:
        """
        ---
        get:
          summary: Get list of relative humidity forecasts
          description: Retrieves a list of relative humidity forecasts with filtering and pagination.
          parameters:
            - name: q
              in: query
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/get_list_rison_schema'
            - name: municipality_code
              in: query
              schema: { type: string }
            - name: municipality_name
              in: query
              schema: { type: string }
            - name: forecast_date
              in: query
              schema: { type: string, format: date }
            - name: days_range
              in: query
              schema: { type: integer, default: 1, minimum: 1 }
          responses:
            200:
              description: List of relative humidity forecasts
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/WeatherParameterListResponseSchema'
            400: { $ref: '#/components/responses/400' }
            401: { $ref: '#/components/responses/401' }
            500: { $ref: '#/components/responses/500' }
        """
        return self._handle_get_list(RhDailyAvgRegion, RhDailyAvgRegionSchema)

    @expose("/humidity", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_humidity")
    def post_humidity(self) -> Response:
        """
        ---
        post:
          summary: Create a new relative humidity forecast entry
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/RhDailyAvgRegionPostSchema'
          responses:
            201:
              description: Relative humidity forecast created
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/RhDailyAvgRegionSchema'
            400: { $ref: '#/components/responses/400' }
            409: { $ref: '#/components/responses/409' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_post_item(RhDailyAvgRegion, RhDailyAvgRegionPostSchema, RhDailyAvgRegionSchema)

    @expose("/humidity/<string:mun_code>/<string:forecast_date_str>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_humidity_item")
    def get_humidity_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        get:
          summary: Get a specific relative humidity forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200:
              description: Relative humidity forecast entry
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/RhDailyAvgRegionSchema'
            404: { $ref: '#/components/responses/404' }
        """
        return self._handle_get_item(RhDailyAvgRegion, RhDailyAvgRegionSchema, mun_code, forecast_date_str)

    @expose("/humidity/<string:mun_code>/<string:forecast_date_str>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_humidity_item")
    def put_humidity_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        put:
          summary: Update a specific relative humidity forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/RhDailyAvgRegionSchema'
          responses:
            200:
              description: Relative humidity forecast updated
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/RhDailyAvgRegionSchema'
            400: { $ref: '#/components/responses/400' }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_put_item(RhDailyAvgRegion, RhDailyAvgRegionSchema, mun_code, forecast_date_str)

    @expose("/humidity/<string:mun_code>/<string:forecast_date_str>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_humidity_item")
    def delete_humidity_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        delete:
          summary: Delete a specific relative humidity forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200: { description: "Relative humidity forecast deleted" }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_delete_item(RhDailyAvgRegion, mun_code, forecast_date_str)

    # --- Max Temperature Endpoints ---
    @expose("/temp_max", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_temp_max_list")
    def get_temp_max_list(self) -> Response:
        """
        ---
        get:
          summary: Get list of max temperature forecasts
          description: Retrieves a list of max temperature forecasts with filtering and pagination.
          parameters:
            - name: q
              in: query
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/get_list_rison_schema'
            - name: municipality_code
              in: query
              schema: { type: string }
            - name: municipality_name
              in: query
              schema: { type: string }
            - name: forecast_date
              in: query
              schema: { type: string, format: date }
            - name: days_range
              in: query
              schema: { type: integer, default: 1, minimum: 1 }
          responses:
            200:
              description: List of max temperature forecasts
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/WeatherParameterListResponseSchema'
            400: { $ref: '#/components/responses/400' }
            401: { $ref: '#/components/responses/401' }
            500: { $ref: '#/components/responses/500' }
        """
        return self._handle_get_list(TmaxDailyTmaxRegion, TmaxDailyTmaxRegionSchema)

    @expose("/temp_max", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_temp_max")
    def post_temp_max(self) -> Response:
        """
        ---
        post:
          summary: Create a new max temperature forecast entry
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/TmaxDailyTmaxRegionPostSchema'
          responses:
            201:
              description: Max temperature forecast created
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/TmaxDailyTmaxRegionSchema'
            400: { $ref: '#/components/responses/400' }
            409: { $ref: '#/components/responses/409' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_post_item(TmaxDailyTmaxRegion, TmaxDailyTmaxRegionPostSchema, TmaxDailyTmaxRegionSchema)

    @expose("/temp_max/<string:mun_code>/<string:forecast_date_str>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_temp_max_item")
    def get_temp_max_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        get:
          summary: Get a specific max temperature forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200:
              description: Max temperature forecast entry
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/TmaxDailyTmaxRegionSchema'
            404: { $ref: '#/components/responses/404' }
        """
        return self._handle_get_item(TmaxDailyTmaxRegion, TmaxDailyTmaxRegionSchema, mun_code, forecast_date_str)

    @expose("/temp_max/<string:mun_code>/<string:forecast_date_str>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_temp_max_item")
    def put_temp_max_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        put:
          summary: Update a specific max temperature forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/TmaxDailyTmaxRegionSchema'
          responses:
            200:
              description: Max temperature forecast updated
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/TmaxDailyTmaxRegionSchema'
            400: { $ref: '#/components/responses/400' }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_put_item(TmaxDailyTmaxRegion, TmaxDailyTmaxRegionSchema, mun_code, forecast_date_str)

    @expose("/temp_max/<string:mun_code>/<string:forecast_date_str>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_temp_max_item")
    def delete_temp_max_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        delete:
          summary: Delete a specific max temperature forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200: { description: "Max temperature forecast deleted" }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_delete_item(TmaxDailyTmaxRegion, mun_code, forecast_date_str)

    # --- Min Temperature Endpoints ---
    @expose("/temp_min", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_temp_min_list")
    def get_temp_min_list(self) -> Response:
        """
        ---
        get:
          summary: Get list of min temperature forecasts
          description: Retrieves a list of min temperature forecasts with filtering and pagination.
          parameters:
            - name: q
              in: query
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/get_list_rison_schema'
            - name: municipality_code
              in: query
              schema: { type: string }
            - name: municipality_name
              in: query
              schema: { type: string }
            - name: forecast_date
              in: query
              schema: { type: string, format: date }
            - name: days_range
              in: query
              schema: { type: integer, default: 1, minimum: 1 }
          responses:
            200:
              description: List of min temperature forecasts
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/WeatherParameterListResponseSchema'
            400: { $ref: '#/components/responses/400' }
            401: { $ref: '#/components/responses/401' }
            500: { $ref: '#/components/responses/500' }
        """
        return self._handle_get_list(TminDailyTminRegion, TminDailyTminRegionSchema)

    @expose("/temp_min", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_temp_min")
    def post_temp_min(self) -> Response:
        """
        ---
        post:
          summary: Create a new min temperature forecast entry
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/TminDailyTminRegionPostSchema'
          responses:
            201:
              description: Min temperature forecast created
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/TminDailyTminRegionSchema'
            400: { $ref: '#/components/responses/400' }
            409: { $ref: '#/components/responses/409' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_post_item(TminDailyTminRegion, TminDailyTminRegionPostSchema, TminDailyTminRegionSchema)

    @expose("/temp_min/<string:mun_code>/<string:forecast_date_str>", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_temp_min_item")
    def get_temp_min_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        get:
          summary: Get a specific min temperature forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200:
              description: Min temperature forecast entry
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/TminDailyTminRegionSchema'
            404: { $ref: '#/components/responses/404' }
        """
        return self._handle_get_item(TminDailyTminRegion, TminDailyTminRegionSchema, mun_code, forecast_date_str)

    @expose("/temp_min/<string:mun_code>/<string:forecast_date_str>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_temp_min_item")
    def put_temp_min_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        put:
          summary: Update a specific min temperature forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          requestBody:
            required: true
            content:
              application/json:
                schema: 
                  $ref: '#/components/schemas/TminDailyTminRegionSchema'
          responses:
            200:
              description: Min temperature forecast updated
              content:
                application/json:
                  schema: 
                    $ref: '#/components/schemas/TminDailyTminRegionSchema'
            400: { $ref: '#/components/responses/400' }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_put_item(TminDailyTminRegion, TminDailyTminRegionSchema, mun_code, forecast_date_str)

    @expose("/temp_min/<string:mun_code>/<string:forecast_date_str>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_temp_min_item")
    def delete_temp_min_item(self, mun_code: str, forecast_date_str: str) -> Response:
        """
        ---
        delete:
          summary: Delete a specific min temperature forecast entry
          parameters:
            - name: mun_code
              in: path
              required: true
              schema: { type: string }
            - name: forecast_date_str
              in: path
              required: true
              description: Date in YYYY-MM-DD format
              schema: { type: string, format: date }
          responses:
            200: { description: "Min temperature forecast deleted" }
            404: { $ref: '#/components/responses/404' }
            422: { $ref: '#/components/responses/422' }
        """
        return self._handle_delete_item(TminDailyTminRegion, mun_code, forecast_date_str)

    # This is needed for FAB to correctly build OpenAPI spec for component schemas
    openapi_spec_component_schemas = (
        WindSpeedDailyAvgRegionSchema, WindSpeedDailyAvgRegionPostSchema,
        HeatIndexDailyRegionSchema, HeatIndexDailyRegionPostSchema,
        RainfallDailyWeightedAverageSchema, RainfallDailyWeightedAveragePostSchema,
        RhDailyAvgRegionSchema, RhDailyAvgRegionPostSchema,
        TmaxDailyTmaxRegionSchema, TmaxDailyTmaxRegionPostSchema,
        TminDailyTminRegionSchema, TminDailyTminRegionPostSchema,
        WeatherParameterListResponseSchema,
    )

# Helper to parse date string, returning None if invalid
def _parse_date_string(date_str: str) -> date | None:
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None 