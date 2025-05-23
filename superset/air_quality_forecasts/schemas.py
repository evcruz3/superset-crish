from marshmallow import Schema, fields
from flask_appbuilder.api import get_list_schema

class AirQualityForecastSchema(Schema):
    id = fields.Integer(dump_only=True)
    municipality_code = fields.String(required=True)
    municipality_name = fields.String(required=True)
    forecast_date = fields.Date(required=True)
    overall_aqi = fields.Integer(required=True)
    pm25 = fields.Float(allow_none=True)
    pm10 = fields.Float(allow_none=True)
    o3 = fields.Float(allow_none=True)
    no2 = fields.Float(allow_none=True)
    so2 = fields.Float(allow_none=True)
    co = fields.Float(allow_none=True)
    dominant_pollutant = fields.String(allow_none=True)
    health_advisory = fields.String(allow_none=True)

    class Meta:
        ordered = True

# Schema for the 'q' rison parameter in GET requests, even if not fully utilized by mock data
GetListSchema = get_list_schema 