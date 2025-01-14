from flask import request, g, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.security.decorators import has_access_api
from superset.views.base_api import BaseSupersetModelRestApi, RelatedFieldFilter
from superset.extensions import db
from superset.models.bulletins import Bulletin
from flask_appbuilder.models.sqla.interface import SQLAInterface
from typing import Any, Dict
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from werkzeug.wrappers import Response as WerkzeugResponse
from marshmallow import ValidationError
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners

class BulletinsRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Bulletin)
    resource_name = "bulletins_and_advisories"
    allow_browser_login = True
    class_permission_name = "BulletinsAndAdvisories"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = {"get_list", "info", "create"}

    list_columns = [
        "id",
        "title",
        "message",
        "hashtags",
        "chart_id",
        "created_by.first_name",
        "created_by.last_name",
        "created_on",
        "changed_on",
    ]
    show_columns = list_columns
    list_select_columns = list_columns
    add_columns = ["title", "message", "hashtags", "chart_id"]
    edit_columns = add_columns

    order_columns = [
        "changed_on",
        "created_on",
        "title",
    ]

    def pre_add(self, item: Bulletin) -> None:
        """Set the created_by user before adding"""
        item.created_by_fk = g.user.id

    @expose("/create/", methods=["POST"])
    @protect()
    @safe
    @has_access_api
    def create(self) -> WerkzeugResponse:
        """Creates a new bulletin
        ---
        post:
          description: >-
            Create a new bulletin
          requestBody:
            description: Bulletin schema
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    title:
                      type: string
                    message:
                      type: string
                    hashtags:
                      type: string
                    chartId:
                      type: integer
          responses:
            201:
              description: Bulletin added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        type: object
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            # Get the JSON data
            data = request.json
            
            # Validate required fields
            required_fields = ['title', 'message', 'hashtags']
            for field in required_fields:
                if not data.get(field):
                    return self.response_400(message=f"{field} is required")
                if not isinstance(data[field], str):
                    return self.response_400(message=f"{field} must be a string")
            
            # Handle chart_id
            chart_id = data.get('chartId')
            print(f"Received chartId: {chart_id}")
            if chart_id:
                if isinstance(chart_id, dict):
                    chart_id = chart_id.get('value')
                    print(f"Extracted chart_id from dict: {chart_id}")
                if not isinstance(chart_id, (int, type(None))):
                    return self.response_400(message="chartId must be an integer or null")
                print(f"Final chart_id value: {chart_id}")
            
            # Create bulletin with validated data
            bulletin = Bulletin(
                title=data['title'],
                message=data['message'],
                hashtags=data['hashtags'],
                chart_id=chart_id,
                created_by_fk=g.user.id
            )
            
            db.session.add(bulletin)
            db.session.commit()
            
            return self.response(201, id=bulletin.id, result=data)
        except ValidationError as err:
            return self.response_400(message=str(err.messages))
        except Exception as ex:
            db.session.rollback()
            return self.response_422(message=str(ex)) 