from marshmallow import Schema, fields
from flask_appbuilder.api import get_list_schema

class PollutantDataSchema(Schema):
    status = fields.String(required=True)
    color = fields.String(required=True)
    value = fields.Float(required=True)

class TimestampSchema(Schema):
    date = fields.String(required=True)
    timezone_type = fields.Integer(required=True)
    timezone = fields.String(required=True)

class AirQualityForecastSchema(Schema):
    id = fields.String(dump_only=True)
    station_id = fields.String(allow_none=True)
    station_name = fields.String(required=True)
    city_name = fields.String(required=True)
    latitude = fields.String(allow_none=True)
    longitude = fields.String(allow_none=True)
    pm1 = fields.Nested(PollutantDataSchema, allow_none=True)
    pm25 = fields.Nested(PollutantDataSchema, allow_none=True)
    pm10 = fields.Nested(PollutantDataSchema, allow_none=True)
    co2 = fields.Nested(PollutantDataSchema, allow_none=True)
    ts = fields.Nested(TimestampSchema, required=True)

    class Meta:
        ordered = True

# Schema for the 'q' rison parameter in GET requests, even if not fully utilized by mock data
GetListSchema = get_list_schema 