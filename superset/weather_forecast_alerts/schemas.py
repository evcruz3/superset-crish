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
from typing import Any

from marshmallow import fields, Schema
from marshmallow.validate import Length, ValidationError

get_alert_ids_schema = {"type": "array", "items": {"type": "string"}}

municipality_code_description = "Municipality ISO code (e.g., TL-DI for Dili)."
municipality_name_description = "Full name of the municipality."
forecast_date_description = "The date for which the forecast is valid."
weather_parameter_description = "The weather parameter for which the alert is issued (e.g., Heat Index, Rainfall, Wind Speed)."
alert_level_description = "The severity level of the alert (e.g., Normal, Caution, Extreme Caution, Danger, Extreme Danger)."
alert_title_description = "A short title describing the alert."
alert_message_description = "A detailed message describing the alert conditions and recommended actions."
parameter_value_description = "The numerical value of the weather parameter that triggered the alert."

# Define the OpenAPI schema for the endpoints
openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a weather forecast alert"}},
    "get_list": {
        "get": {
            "summary": "Get a list of weather forecast alerts",
            "description": "Gets a list of weather forecast alerts, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}


class WeatherForecastAlertResponseSchema(Schema):
    id = fields.String()
    municipality_code = fields.String(metadata={"description": municipality_code_description})
    municipality_name = fields.String(metadata={"description": municipality_name_description})
    forecast_date = fields.String(metadata={"description": forecast_date_description})
    weather_parameter = fields.String(metadata={"description": weather_parameter_description})
    alert_level = fields.String(metadata={"description": alert_level_description})
    alert_title = fields.String(metadata={"description": alert_title_description})
    alert_message = fields.String(metadata={"description": alert_message_description})
    parameter_value = fields.Float(metadata={"description": parameter_value_description})


class WeatherForecastAlertPostSchema(Schema):
    municipality_code = fields.String(
        metadata={"description": municipality_code_description},
        required=True,
        validate=Length(1, 10),
    )
    municipality_name = fields.String(
        metadata={"description": municipality_name_description},
        required=False, 
        validate=Length(0, 100),
    )
    forecast_date = fields.String(
        metadata={"description": forecast_date_description},
        required=True,
    )
    weather_parameter = fields.String(
        metadata={"description": weather_parameter_description},
        required=True,
        validate=Length(1, 50),
    )
    alert_level = fields.String(
        metadata={"description": alert_level_description},
        required=True,
        validate=Length(1, 50),
    )
    alert_title = fields.String(
        metadata={"description": alert_title_description},
        required=True,
        validate=Length(1, 100),
    )
    alert_message = fields.String(
        metadata={"description": alert_message_description},
        required=True,
    )
    parameter_value = fields.Float(
        metadata={"description": parameter_value_description},
        required=True,
    )


class WeatherForecastAlertPutSchema(Schema):
    municipality_code = fields.String(
        metadata={"description": municipality_code_description},
        allow_none=True,
        validate=Length(1, 10),
    )
    municipality_name = fields.String(
        metadata={"description": municipality_name_description},
        allow_none=True,
        validate=Length(0, 100),
    )
    forecast_date = fields.String(
        metadata={"description": forecast_date_description},
        allow_none=True,
    )
    weather_parameter = fields.String(
        metadata={"description": weather_parameter_description},
        allow_none=True,
        validate=Length(1, 50),
    )
    alert_level = fields.String(
        metadata={"description": alert_level_description},
        allow_none=True,
        validate=Length(1, 50),
    )
    alert_title = fields.String(
        metadata={"description": alert_title_description},
        allow_none=True,
        validate=Length(1, 100),
    )
    alert_message = fields.String(
        metadata={"description": alert_message_description},
        allow_none=True,
    )
    parameter_value = fields.Float(
        metadata={"description": parameter_value_description},
        allow_none=True,
    ) 