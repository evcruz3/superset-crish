from flask import request, g, Response, send_file
from flask_appbuilder.api import expose, protect, safe, rison, permission_name
from flask_appbuilder.api.schemas import get_item_schema
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
from superset.utils.pdf import generate_bulletin_pdf
from superset.extensions import cache_manager
from io import BytesIO

class BulletinsRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Bulletin)
    resource_name = "bulletins_and_advisories"
    allow_browser_login = True
    class_permission_name = "BulletinsAndAdvisories"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "bulk_delete",  # not using RouteMethod since locally defined
        "download_bulletin_pdf"
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

    @expose("/<int:bulletin_id>/pdf/", methods=("GET",))
    # @protect() # Temporarily commented out for debugging
    @safe # Temporarily commented out for debugging
    @statsd_metrics # Temporarily commented out for debugging
    # @permission_name("get") # Temporarily commented out for debugging
    def download_bulletin_pdf(self, bulletin_id: int) -> Response:
        """
        Downloads a bulletin as a PDF.
        ---
        get:
          summary: Download bulletin as PDF
          description: Downloads a bulletin as a PDF.
          parameters:
          - in: path
            name: bulletin_id
            schema:
              type: integer
            required: true
            description: The id of the bulletin
          responses:
            200:
              description: Bulletin PDF
              content:
                application/pdf:
                  schema:
                    type: string
                    format: binary
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              description: Bulletin not found
            500:
              description: Error generating PDF
        """
        bulletin = self.datamodel.get(bulletin_id)
        if not bulletin:
            return self.response_404()

        # Construct cache key
        # Ensure changed_on is in a consistent string format for the key
        changed_on_str = bulletin.changed_on.isoformat() if bulletin.changed_on else "no_changed_on"
        cache_key = f"bulletin_pdf_{bulletin_id}_{changed_on_str}"

        # Try to fetch from cache
        cached_pdf_data = cache_manager.data_cache.get(cache_key)

        if cached_pdf_data:
            pdf_buffer = BytesIO(cached_pdf_data)
            # pdf_buffer.seek(0) # BytesIO(data) is already at position 0
            is_preview = request.args.get('preview') == 'true'
            return send_file(
                pdf_buffer,
                mimetype="application/pdf",
                as_attachment=not is_preview, # Set as_attachment to False if preview=true
                download_name=f"bulletin_{bulletin.title.replace(' ', '_')}_{bulletin_id}.pdf"
            )

        # If not in cache, generate PDF
        try:
            pdf_buffer = generate_bulletin_pdf(bulletin)
            pdf_data = pdf_buffer.getvalue() # Get bytes once

            # Store in cache
            # Using default timeout from DATA_CACHE_CONFIG
            cache_manager.data_cache.set(cache_key, pdf_data)

            pdf_buffer.seek(0)  # Reset original buffer for send_file
            is_preview = request.args.get('preview') == 'true'
            return send_file(
                pdf_buffer, # Send the original buffer
                mimetype="application/pdf",
                as_attachment=not is_preview, # Set as_attachment to False if preview=true
                download_name=f"bulletin_{bulletin.title.replace(' ', '_')}_{bulletin_id}.pdf"
            )
        except Exception as e:
            # Consider logging the error more formally
            print(f"Error generating PDF for bulletin {bulletin_id}: {e}")
            return self.response_500(message="Error generating PDF")