from flask import request, g, Response
from flask_appbuilder.api import expose, protect, safe, rison
from flask_appbuilder.security.decorators import has_access_api
from superset.views.base_api import BaseSupersetModelRestApi, RelatedFieldFilter
from superset.extensions import db
from superset.models.bulletins import Bulletin
from flask_appbuilder.models.sqla.interface import SQLAInterface
from typing import Any, Dict
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from werkzeug.wrappers import Response as WerkzeugResponse
from marshmallow import ValidationError
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners
import json
from superset.views.base_api import requires_json, statsd_metrics
from superset.commands.exceptions import DeleteFailedError

class BulletinsRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Bulletin)
    resource_name = "bulletins_and_advisories"
    allow_browser_login = True
    class_permission_name = "BulletinsAndAdvisories"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "bulk_delete",  # not using RouteMethod since locally defined
    }

    list_columns = [
        "id",
        "title",
        "advisory",
        "risks",
        "safety_tips",
        "hashtags",
        "chart_id",
        "created_by.first_name",
        "created_by.last_name",
        "created_on",
        "changed_on",
    ]
    show_columns = list_columns
    list_select_columns = list_columns
    add_columns = ["title", "advisory", "risks", "safety_tips", "hashtags", "chart_id"]
    edit_columns = add_columns

    order_columns = [
        "changed_on",
        "created_on",
        "title",
    ]

    def pre_add(self, item: Bulletin) -> None:
        """Set the created_by user before adding"""
        item.created_by_fk = g.user.id

    def pre_delete(self, item: Bulletin) -> None:
        """Check permissions before deleting"""
        if item.created_by_fk != g.user.id and not self.appbuilder.sm.is_admin():
            raise DeleteFailedError("You can only delete bulletins that you created")

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(schema={"type": "array", "items": {"type": "integer"}})
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk bulletins
        ---
        delete:
          description: >-
            Deletes multiple bulletins in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: integer
          responses:
            200:
              description: Bulletins deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            # Check if user has permission to delete
            if not self.appbuilder.sm.has_access('can_write', self.class_permission_name):
                return self.response_403()

            # Get bulletins
            bulletins = self.datamodel.session.query(Bulletin).filter(
                Bulletin.id.in_(item_ids)
            ).all()

            if not bulletins:
                return self.response_404()

            # Check if user has permission to delete each bulletin
            for bulletin in bulletins:
                try:
                    self.pre_delete(bulletin)
                except DeleteFailedError as ex:
                    return self.response_403(message=str(ex))

            # Delete bulletins
            for bulletin in bulletins:
                self.datamodel.delete(bulletin)

            return self.response(
                200,
                message=f"Deleted {len(bulletins)} bulletins",
            )
        except Exception as ex:
            return self.response_422(message=str(ex))

    @expose("/create/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @requires_json
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
                    advisory:
                      type: string
                    risks:
                      type: string
                    safety_tips:
                      type: string
                    hashtags:
                      type: string
                    chart_id:
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
            required_fields = ['title', 'advisory', 'risks', 'safety_tips', 'hashtags']
            for field in required_fields:
                if not data.get(field):
                    return self.response_400(message=f"{field} is required")
                if not isinstance(data[field], str):
                    return self.response_400(message=f"{field} must be a string")
            
            # Handle chart_id
            chart_id = data.get('chart_id')
            if chart_id is None:
                # For backward compatibility, try 'chartId' if 'chart_id' is not present
                chart_id = data.get('chartId')
                
            print(f"Received chart_id: {chart_id}")
            if chart_id:
                if isinstance(chart_id, dict):
                    chart_id = chart_id.get('value')
                    print(f"Extracted chart_id from dict: {chart_id}")
                if not isinstance(chart_id, (int, type(None))):
                    return self.response_400(message="chart_id must be an integer or null")
                print(f"Final chart_id value: {chart_id}")
            
            # Create bulletin with validated data
            bulletin = Bulletin(
                title=data['title'],
                advisory=data['advisory'],
                risks=data['risks'],
                safety_tips=data['safety_tips'],
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

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    def update(self, pk: int) -> WerkzeugResponse:
        """Update a bulletin
        ---
        put:
          description: >-
            Update a bulletin
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The bulletin id
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
                    advisory:
                      type: string
                    risks:
                      type: string
                    safety_tips:
                      type: string
                    hashtags:
                      type: string
                    chart_id:
                      type: integer
          responses:
            200:
              description: Bulletin updated
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
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            # Get the bulletin by id
            bulletin = self.datamodel.get(pk, self._base_filters)
            if not bulletin:
                return self.response_404()
                
            # Check if user has permission to edit
            if not self.appbuilder.sm.has_access('can_write', self.class_permission_name):
                return self.response_403()
                
            # Check if user is the creator or has admin rights
            if bulletin.created_by_fk != g.user.id and not self.appbuilder.sm.is_admin():
                return self.response_403(message="You can only edit bulletins that you created")
                
            # Get the JSON data
            data = request.json
            
            # Validate required fields
            required_fields = ['title', 'advisory', 'risks', 'safety_tips', 'hashtags']
            for field in required_fields:
                if not data.get(field):
                    return self.response_400(message=f"{field} is required")
                if not isinstance(data[field], str):
                    return self.response_400(message=f"{field} must be a string")
            
            # Handle chart_id
            chart_id = data.get('chart_id')
            if chart_id is None:
                # For backward compatibility, try 'chartId' if 'chart_id' is not present
                chart_id = data.get('chartId')
                
            if chart_id:
                if isinstance(chart_id, dict):
                    chart_id = chart_id.get('value')
                if not isinstance(chart_id, (int, type(None))):
                    return self.response_400(message="chart_id must be an integer or null")
            
            # Update bulletin with validated data
            bulletin.title = data['title']
            bulletin.advisory = data['advisory']
            bulletin.risks = data['risks']
            bulletin.safety_tips = data['safety_tips']
            bulletin.hashtags = data['hashtags']
            bulletin.chart_id = chart_id
            
            db.session.commit()
            
            return self.response(200, id=bulletin.id, result=data)
        except ValidationError as err:
            return self.response_400(message=str(err.messages))
        except Exception as ex:
            db.session.rollback()
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    def delete(self, pk: int) -> Response:
        """Delete a bulletin
        ---
        delete:
          description: >-
            Delete a bulletin
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The bulletin id
          responses:
            200:
              description: Bulletin deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            bulletin = self.datamodel.get(pk, self._base_filters)
            if not bulletin:
                return self.response_404()

            # Check if user has permission to delete
            if not self.appbuilder.sm.has_access('can_write', self.class_permission_name):
                return self.response_403()

            # Check if user is the creator or has admin rights
            if bulletin.created_by_fk != g.user.id and not self.appbuilder.sm.is_admin():
                return self.response_403()

            self.datamodel.delete(bulletin)
            return self.response(200, message="OK")
        except Exception as ex:
            return self.response_422(message=str(ex)) 