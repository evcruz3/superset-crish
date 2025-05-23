from flask import g, Response
from flask_appbuilder.api import expose, protect, safe, rison
from flask_appbuilder.models.sqla.interface import SQLAInterface
from typing import Any
import logging

from superset.models.dissemination import EmailGroup
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.commands.exceptions import DeleteFailedError
from superset.dissemination.schemas import EmailGroupSchema, DisseminationUserSchema

class EmailGroupsRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(EmailGroup)
    resource_name = "email_groups"
    openapi_spec_tag = "CRISH Email Groups"
    allow_browser_login = True
    class_permission_name = "EmailGroups"  # New permission name
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "bulk_delete",
    }

    list_columns = [
        "id",
        "name",
        "description",
        "emails",
        "created_by.id",
        "created_by.first_name",
        "created_by.last_name",
        "created_on",
        "changed_by.id",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_on",
    ]
    show_columns = list_columns
    add_columns = ["name", "description", "emails"]
    edit_columns = ["id", "name", "description", "emails"]

    # Define explicit schemas for responses
    show_model_schema = EmailGroupSchema()
    list_model_schema = EmailGroupSchema() # For single item in list, FAB handles `many=True` for actual list response

    order_columns = [
        "name",
        "changed_on",
        "created_on",
    ]

    def pre_add(self, item: EmailGroup) -> None:
        if g.user:
            item.created_by_fk = g.user.id
            item.changed_by_fk = g.user.id

    def pre_update(self, item: EmailGroup) -> None:
        if g.user:
            item.changed_by_fk = g.user.id
            
    def pre_delete(self, item: EmailGroup) -> None:
        # Example: Add any pre-delete validation if necessary.
        # For now, we'll rely on a generic check or specific role permissions.
        # If only owners or admins can delete:
        # if item.created_by_fk != g.user.id and not self.appbuilder.sm.is_admin():
        #     raise DeleteFailedError("You can only delete email groups that you created or if you are an admin.")
        pass # No specific pre-delete check beyond role permissions for now

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(schema={"type": "array", "items": {"type": "integer"}})
    def bulk_delete(self, **kwargs: Any) -> Response:
        item_ids = kwargs["rison"]
        try:

            items = self.datamodel.session.query(EmailGroup).filter(
                EmailGroup.id.in_(item_ids)
            ).all()

            if not items:
                return self.response_404() # 404 usually doesn't need a custom message in body

            for item in items:
                try:
                    self.pre_delete(item) 
                    self.datamodel.delete(item)
                except DeleteFailedError as ex:
                    self.datamodel.session.rollback()
                    return self.response(403, message=str(ex))
            
            self.datamodel.session.commit()
            return self.response(
                200,
                message=f"Deleted {len(items)} email groups",
            )
        except Exception as ex:
            self.datamodel.session.rollback()
            # For a generic 500, it's often better to log the full ex and return a generic error message
            # to the client, but BaseSupersetModelRestApi.response_500 might handle this.
            # If response_500 does not take message, then use self.response(500, ...)
            # For now, let's assume response_500 from the base class is standard.
            # If it also causes issues, we'll change it to self.response(500, message=...)
            # Checking BaseSupersetModelRestApi, response_500 indeed does not take message.
            # So, we must use self.response(500, message=str(ex)) if we want to pass it.
            # However, for 500, it might be better to pass a generic message to the user.
            logging.exception("Error during bulk delete of email groups") # Log the full error
            return self.response(500, message="An internal server error occurred.") 