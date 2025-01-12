from flask import request, g
from flask_appbuilder.api import expose as expose_api, protect, safe
from flask_appbuilder.security.decorators import permission_name
from superset.views.base_api import BaseSupersetApi
from superset.extensions import db
from superset.models.bulletins import Bulletin
from typing import Any, Dict
import simplejson as json

class BulletinsRestApi(BaseSupersetApi):
    resource_name = "bulletins_and_advisories"
    allow_browser_login = True
    class_permission_name = "BulletinsAndAdvisories"
    base_permissions = [
        'can_list',
        'can_show',
        'can_add',
        'can_write',
        'can_read',
        'menu_access'
    ]

    @expose_api("/", methods=["GET"])
    @protect()
    @safe
    @permission_name("list")
    def list(self) -> Dict[str, Any]:
        """Get list of bulletins
        ---
        get:
          summary: Get all bulletins
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    page:
                      type: integer
                    page_size:
                      type: integer
                    order_column:
                      type: string
                    order_direction:
                      type: string
                      enum: [asc, desc]
          responses:
            200:
              description: List of bulletins
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: integer
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/BulletinResponseModel'
        """
        # Get query parameters
        qparams = request.args.get("q", "{}")
        try:
            params = json.loads(qparams)
        except json.JSONDecodeError:
            params = {}

        # Extract pagination params
        page = params.get("page", 0)
        page_size = params.get("page_size", 25)
        
        # Extract sorting params
        order_column = params.get("order_column", "created_on")
        order_direction = params.get("order_direction", "desc")
        
        # Build query
        query = db.session.query(Bulletin)
        
        # Apply sorting
        if hasattr(Bulletin, order_column):
            order_col = getattr(Bulletin, order_column)
            if order_direction == "desc":
                query = query.order_by(order_col.desc())
            else:
                query = query.order_by(order_col.asc())
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply pagination
        query = query.offset(page * page_size).limit(page_size)
        
        bulletins = query.all()
        
        payload = {
            "result": [
                {
                    "id": bulletin.id,
                    "title": bulletin.title,
                    "message": bulletin.message,
                    "hashtags": bulletin.hashtags,
                    "chart_id": bulletin.chart_id,
                    "created_by": bulletin.created_by.username,
                    "created_on": bulletin.created_on.isoformat(),
                }
                for bulletin in bulletins
            ],
            "count": total_count,
        }
        
        return self.response(200, **payload)

    @expose_api("/create/", methods=["POST"])
    @protect()
    @safe
    @permission_name("add")
    def create(self) -> dict:
        """Create a new bulletin
        ---
        post:
          summary: Create a new bulletin
          requestBody:
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
              description: Bulletin created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            data = request.json
            # Extract chart_id value if it's a dict
            chart_id = data.get("chartId")
            if isinstance(chart_id, dict):
                chart_id = chart_id.get("value")
            
            bulletin = Bulletin(
                title=data["title"],
                message=data["message"],
                hashtags=data["hashtags"],
                chart_id=chart_id,
                created_by_fk=g.user.id,
            )
            db.session.add(bulletin)
            db.session.commit()
            return self.response(201, id=bulletin.id)
        except KeyError as ex:
            return self.response(422, message=f"Missing required field: {ex}")
        except Exception as ex:
            return self.response(500, message=str(ex)) 