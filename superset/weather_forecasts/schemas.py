from marshmallow import fields, Schema, validates_schema, ValidationError, pre_load, post_dump
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, auto_field
from superset.weather_forecasts.models import (
    WindSpeedDailyAvgRegion,
    HeatIndexDailyRegion,
    RainfallDailyWeightedAverage,
    RhDailyAvgRegion,
    TmaxDailyTmaxRegion,
    TminDailyTminRegion,
    BaseWeatherParameterModel
)
from typing import Dict, Any, List
from flask_appbuilder.api import Schema as FABSchema # Alias to avoid confusion
from flask_babel import lazy_gettext as _
from datetime import date

# Base Schema for common fields and to handle the composite ID
class BaseWeatherParameterSchema(FABSchema):
    # For GET responses, we'll add a synthetic 'id' field
    id = fields.String(dump_only=True, description="Composite ID (municipality_code_forecast_date)")
    
    # Explicitly defined fields instead of auto_field
    value = fields.Float(required=True) 
    forecast_date = fields.Date(required=True)
    municipality_code = fields.String(required=True)
    day_name = fields.String()
    municipality_name = fields.String()

    @post_dump
    def create_composite_id(self, data, **kwargs):
        if "municipality_code" in data and "forecast_date" in data:
            # Ensure forecast_date is in string ISO format for the ID
            forecast_date_str = data["forecast_date"]
            if isinstance(data["forecast_date"], date):
                forecast_date_str = data["forecast_date"].isoformat()
            data["id"] = f"{data['municipality_code']}_{forecast_date_str}"
        return data

# --- Schemas for each specific weather parameter ---_-

class WindSpeedDailyAvgRegionSchema(BaseWeatherParameterSchema):
    class Meta:
        model = WindSpeedDailyAvgRegion
        load_instance = True
        # For POST, exclude the synthetic id. Day name can be derived or optional.
        # Municipality name often comes from code or is less critical for POST.
        exclude_for_post = ("id", "day_name", "municipality_name")

class HeatIndexDailyRegionSchema(BaseWeatherParameterSchema):
    class Meta:
        model = HeatIndexDailyRegion
        load_instance = True
        exclude_for_post = ("id", "day_name", "municipality_name")

class RainfallDailyWeightedAverageSchema(BaseWeatherParameterSchema):
    class Meta:
        model = RainfallDailyWeightedAverage
        load_instance = True
        exclude_for_post = ("id", "day_name", "municipality_name")

class RhDailyAvgRegionSchema(BaseWeatherParameterSchema):
    class Meta:
        model = RhDailyAvgRegion
        load_instance = True
        exclude_for_post = ("id", "day_name", "municipality_name")

class TmaxDailyTmaxRegionSchema(BaseWeatherParameterSchema):
    class Meta:
        model = TmaxDailyTmaxRegion
        load_instance = True
        exclude_for_post = ("id", "day_name", "municipality_name")

class TminDailyTminRegionSchema(BaseWeatherParameterSchema):
    class Meta:
        model = TminDailyTminRegion
        load_instance = True
        exclude_for_post = ("id", "day_name", "municipality_name")

# --- Schemas for POST (create) operations --- (Often similar to main, but can exclude fields)
# We can use exclude_for_post in Meta for simplicity, or define separate Post schemas if more customization is needed.

class WindSpeedDailyAvgRegionPostSchema(WindSpeedDailyAvgRegionSchema):
    class Meta(WindSpeedDailyAvgRegionSchema.Meta):
        exclude = WindSpeedDailyAvgRegionSchema.Meta.exclude_for_post

class HeatIndexDailyRegionPostSchema(HeatIndexDailyRegionSchema):
    class Meta(HeatIndexDailyRegionSchema.Meta):
        exclude = HeatIndexDailyRegionSchema.Meta.exclude_for_post

class RainfallDailyWeightedAveragePostSchema(RainfallDailyWeightedAverageSchema):
    class Meta(RainfallDailyWeightedAverageSchema.Meta):
        exclude = RainfallDailyWeightedAverageSchema.Meta.exclude_for_post

class RhDailyAvgRegionPostSchema(RhDailyAvgRegionSchema):
    class Meta(RhDailyAvgRegionSchema.Meta):
        exclude = RhDailyAvgRegionSchema.Meta.exclude_for_post

class TmaxDailyTmaxRegionPostSchema(TmaxDailyTmaxRegionSchema):
    class Meta(TmaxDailyTmaxRegionSchema.Meta):
        exclude = TmaxDailyTmaxRegionSchema.Meta.exclude_for_post

class TminDailyTminRegionPostSchema(TminDailyTminRegionSchema):
    class Meta(TminDailyTminRegionSchema.Meta):
        exclude = TminDailyTminRegionSchema.Meta.exclude_for_post


# --- Schemas for PUT (update) operations --- (Fields are typically optional)
# For PUT, we can make fields optional on the base schema or create specific PUT schemas.
# Using one schema and relying on partial=True during load is common for PUT.
# If specific fields should NOT be updatable, they can be excluded here.
# For now, the default SQLAlchemyAutoSchema fields are implicitly optional for partial updates.

# --- Schema for List Responses (common structure) ---
class WeatherParameterListResponseSchema(FABSchema):
    count = fields.Integer(description="Total number of records found.")
    # `ids` might not be needed if `id` is part of each result item.
    # ids = fields.List(fields.String(), description="List of composite record IDs.")
    # `result` will be a list of one of the specific parameter schemas, handled in API method.
    # This schema is generic; actual item schema varies.
    result = fields.List(fields.Dict(), description="List of weather parameter records.")

# --- Rison schema for `q` parameter in GET list requests ---
# This can be common for all parameter types if filtering fields are the same.
get_list_rison_schema = {
    "type": "object",
    "properties": {
        "page": {"type": "integer", "default": 0, "minimum": 0},
        "page_size": {"type": "integer", "default": 25, "minimum": 1, "maximum": 200},
        "order_column": {
            "type": "string",
            "enum": ["forecast_date", "municipality_code", "municipality_name", "day_name", "value"],
            "default": "forecast_date"
        },
        "order_direction": {"type": "string", "enum": ["asc", "desc"], "default": "desc"},
        "filters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "col": {"type": "string"}, # e.g., municipality_code, forecast_date, value
                    "opr": {"type": "string"}, # e.g., eq, gt, lt, date_eq, date_gt, date_lt
                    "value": {"type": ["string", "integer", "number", "boolean", "array"]}
                },
                "required": ["col", "opr", "value"]
            }
        }
    }
}

# Overrides for OpenAPI spec generation if needed (e.g., for custom actions)
openapi_spec_methods_override = {
    # "get_list": { # This will be removed, spec is now in api.py docstring
    #     "get": {
    #         "summary": "Get a list of weather forecasts",
    #         "description": (
    #             "Retrieves a list of weather forecasts. Supports pagination, sorting, and filtering. "
    #             "Filters can be applied via direct query parameters (e.g., `municipality_code=TL-DI`) "
    #             "or using the `q` parameter with a Rison-encoded JSON object for more complex queries. "
    #             "A `days_range` query parameter can specify the number of days from `forecast_date`."
    #         ),
    #         "parameters": [
    #             {
    #                 "name": "q",
    #                 "in": "query",
    #                 "content": {
    #                     "application/json": {
    #                         "schema": get_list_schema
    #                     }
    #                 },
    #                 "description": "Rison-encoded query for comprehensive filtering, sorting, and pagination."
    #             },
    #             {
    #                 "name": "municipality_code",
    #                 "in": "query",
    #                 "required": False,
    #                 "schema": {"type": "string"},
    #                 "description": "Filter by exact municipality code (e.g., TL-DI)."
    #             },
    #             {
    #                 "name": "municipality_name",
    #                 "in": "query",
    #                 "required": False,
    #                 "schema": {"type": "string"},
    #                 "description": "Filter by exact municipality name (case-sensitive)."
    #             },
    #             {
    #                 "name": "forecast_date",
    #                 "in": "query",
    #                 "required": False,
    #                 "schema": {"type": "string", "format": "date"},
    #                 "description": "Filter by exact forecast start date (YYYY-MM-DD)."
    #             },
    #             {
    #                 "name": "days_range",
    #                 "in": "query",
    #                 "required": False,
    #                 "schema": {"type": "integer", "default": 1, "minimum": 1},
    #                 "description": "Number of days of forecast data to retrieve, starting from forecast_date (if specified, otherwise from today)."
    #             }
    #             # Add other direct filter parameters if desired (e.g., for specific weather parameters)
    #         ],
    #         "responses": {
    #             "200": {
    #                 "description": "A list of weather forecasts",
    #                 "content": {
    #                     "application/json": {
    #                         "schema": WeatherForecastListResponseSchema
    #                     }
    #                 }
    #             },
    #             "400": {"$ref": "#/components/responses/400"},
    #             "401": {"$ref": "#/components/responses/401"},
    #             "422": {"$ref": "#/components/responses/422"},
    #             "500": {"$ref": "#/components/responses/500"}
    #         }
    #     }
    # }
    # Add overrides for post, put, delete as needed, similar to WeatherForecastAlerts
    # For example, if you want to customize the POST request body or response:
    # "post": {
    #     "post": {
    #         "summary": "Create a new weather forecast",
    #         "requestBody": {
    #             "description": "Weather forecast object that needs to be added to the store",
    #             "content": {
    #                 "application/json": {
    #                     "schema": {"$ref": "#/components/schemas/WeatherForecastPostSchema"}
    #                 }
    #             },
    #             "required": True
    #         },
    #         "responses": {
    #             "201": {
    #                 "description": "Weather forecast created successfully",
    #                 "content": {
    #                     "application/json": {
    #                         "schema": {"$ref": "#/components/schemas/WeatherForecastSchema"}
    #                     }
    #                 }
    #             },
    #             "400": {"$ref": "#/components/responses/400"},
    #             "409": {"$ref": "#/components/responses/409"}, # Conflict
    #             "422": {"$ref": "#/components/responses/422"}
    #         }
    #     }
    # }
}

# Example if you had a custom action like "get_summary"
# class WeatherForecastSummarySchema(Schema):
#     avg_temp_max = fields.Float()
#     total_rainfall = fields.Float()

# openapi_spec_methods_override["get_summary"] = {
#     "get": {
#         "summary": "Get a summary of weather forecasts for a period",
#         "responses": {
#             "200": {
#                 "description": "Weather forecast summary",
#                 "content": {"application/json": {"schema": WeatherForecastSummarySchema}}
#             }
#         }
#     }
# } 