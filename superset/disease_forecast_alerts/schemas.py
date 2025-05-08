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

from marshmallow import fields, Schema, validate
from marshmallow.validate import Length

# Schema for responses (GET individual, items in GET list)
class DiseaseForecastAlertResponseSchema(Schema):
    # This 'id' will be the composite string ID populated by the API's get_list method
    id = fields.String(description="Composite ID (municipality_code_forecast_date_disease_type)")
    # The actual database primary key (integer) can also be included if useful for client
    # db_id = fields.Integer(attribute="id", dump_only=True, description="Database Primary Key ID") 
    municipality_code = fields.String(allow_none=True)
    municipality_name = fields.String()
    forecast_date = fields.Date()
    disease_type = fields.String()
    alert_level = fields.String()
    alert_title = fields.String()
    alert_message = fields.String()
    predicted_cases = fields.Integer()

# Schema for POST requests (creating new alerts)
class DiseaseForecastAlertPostSchema(Schema):
    municipality_code = fields.String(required=False, allow_none=True, validate=Length(max=50))
    municipality_name = fields.String(required=True, validate=Length(max=255))
    forecast_date = fields.Date(required=True)
    disease_type = fields.String(required=True, validate=Length(max=100))
    alert_level = fields.String(required=True, validate=Length(max=100))
    alert_title = fields.String(required=True, validate=Length(max=500))
    alert_message = fields.String(required=True)
    predicted_cases = fields.Integer(required=True)

# Schema for PUT requests (updating existing alerts)
class DiseaseForecastAlertPutSchema(Schema):
    # Note: For PUT, the key fields (municipality_code, forecast_date, disease_type, municipality_name)
    # are part of the composite_id in the URL and typically not in the request body for update.
    # If they are in the body, they are usually ignored or used for validation only.
    # We allow updating other fields.
    municipality_code = fields.String(allow_none=True, validate=Length(max=50)) # In case it needs to be corrected
    municipality_name = fields.String(validate=Length(max=255))
    forecast_date = fields.Date() # Potentially updatable if part of the unique key wasn't municipality_name
    disease_type = fields.String(validate=Length(max=100))
    alert_level = fields.String(validate=Length(max=100))
    alert_title = fields.String(validate=Length(max=500))
    alert_message = fields.String()
    predicted_cases = fields.Integer()

# Schema for Rison argument in bulk_delete endpoint (list of composite string IDs)
get_alert_ids_schema = {
    "type": "array",
    "items": {"type": "string"},
}

# OpenAPI_spec_methods_override
# Used to override the default OpenAPI auto-generated properties for an API.
# Here, we customize summaries and parameter descriptions for clarity,
# especially for methods using composite IDs.
openapi_spec_methods_override = {
    "get_list": {
        "get": {
            "summary": "Get a list of disease forecast alerts",
            "description": "Returns a list of disease forecast alerts, potentially with a composite ID for frontend use.",
        }
    },
    "get": {
        "get": {
            "summary": "Get a disease forecast alert by its database ID",
            "description": "Fetches a single disease forecast alert using its integer primary key.",
        }
    },
    "post": {
        "post": {
            "summary": "Create a new disease forecast alert",
            "description": "Adds a new disease forecast alert to the system. The response will include the composite ID.",
        }
    },
    "put": {
        "put": {
            "summary": "Update a disease forecast alert by composite ID",
            "description": "Updates an existing disease forecast alert identified by its composite ID (e.g., TL-DI_2023-10-16_Dengue).",
            "parameters": [
                {
                    "name": "composite_id",
                    "in": "path",
                    "required": True,
                    "description": "Composite ID of the disease alert (format: municipality_code_forecast_date_disease_type)",
                    "schema": {"type": "string"},
                }
            ],
        }
    },
    "delete": {
        "delete": {
            "summary": "Delete a disease forecast alert by composite ID",
            "description": "Deletes a disease forecast alert identified by its composite ID (e.g., TL-DI_2023-10-16_Dengue).",
            "parameters": [
                {
                    "name": "composite_id",
                    "in": "path",
                    "required": True,
                    "description": "Composite ID of the disease alert (format: municipality_code_forecast_date_disease_type)",
                    "schema": {"type": "string"},
                }
            ],
        }
    },
    "bulk_delete": {
        "delete": {
            "summary": "Delete multiple disease forecast alerts by composite IDs",
            "description": "Deletes a list of disease forecast alerts identified by their composite IDs.",
        }
    },
}

# --- Schemas for DiseasePipelineRunHistory --- #

class DiseasePipelineRunHistoryResponseSchema(Schema):
    id = fields.Integer(dump_only=True)
    ran_at = fields.DateTime(dump_only=True)
    pipeline_name = fields.String()
    status = fields.String()
    details = fields.String(allow_none=True)
    municipalities_processed_count = fields.Integer()
    alerts_generated_count = fields.Integer()
    bulletins_created_count = fields.Integer()

class DiseasePipelineRunHistoryPostSchema(Schema):
    # ran_at is typically set by default in the model or DB
    pipeline_name = fields.String(required=True, validate=Length(min=1, max=255))
    status = fields.String(required=True, validate=Length(min=1, max=50))
    details = fields.String(required=False, allow_none=True)
    municipalities_processed_count = fields.Integer(required=False, allow_none=True, validate=validate.Range(min=0))
    alerts_generated_count = fields.Integer(required=False, allow_none=True, validate=validate.Range(min=0))
    bulletins_created_count = fields.Integer(required=False, allow_none=True, validate=validate.Range(min=0))

class DiseasePipelineRunHistoryPutSchema(Schema):
    # Allow updating status, details, and counts. pipeline_name and ran_at are usually not changed.
    pipeline_name = fields.String(validate=Length(min=1, max=255))
    status = fields.String(validate=Length(min=1, max=50))
    details = fields.String(allow_none=True)
    municipalities_processed_count = fields.Integer(allow_none=True, validate=validate.Range(min=0))
    alerts_generated_count = fields.Integer(allow_none=True, validate=validate.Range(min=0))
    bulletins_created_count = fields.Integer(allow_none=True, validate=validate.Range(min=0)) 