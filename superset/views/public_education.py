import os
import logging
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from flask import redirect, send_file, request, Response, g
from flask_appbuilder import expose, has_access
from flask_appbuilder.api import BaseApi, expose, permission_name, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access_api
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import or_
from werkzeug.utils import secure_filename
from werkzeug.wrappers import Response as WerkzeugResponse

from superset.views.base import BaseSupersetView
from superset.extensions import db
from superset.models.public_education import PublicEducationPost, PublicEducationAttachment
from superset.views.base_api import BaseSupersetModelRestApi
from flask_appbuilder import ModelRestApi
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.utils.urls import get_url_path

logger = logging.getLogger(__name__)

UPLOAD_FOLDER = "public_education_files"
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

class PublicEducationView(BaseSupersetView):
    route_base = "/public_education"
    class_permission_name = "PublicEducation"
    
    @expose("/")
    @has_access
    def list(self) -> Response:
        return self.render_app_template()

class PublicEducationRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(PublicEducationPost)
    resource_name = "public_education"
    allow_browser_login = True
    openapi_spec_tag = "Public Education"
    class_permission_name = "PublicEducation"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = {"get_list", "info", "create", "download_attachment", "get_attachment"}
    list_columns = [
        "id",
        "title",
        "message",
        "hashtags",
        "created_by.first_name",
        "created_by.last_name",
        "created_on",
        "changed_on",
        "attachments",
    ]
    show_columns = list_columns
    list_select_columns = list_columns
    add_columns = ["title", "message", "hashtags"]
    edit_columns = add_columns

    # Add a property to specify how to serialize relationships
    order_columns = [
        "changed_on",
        "created_on",
        "title",
    ]

    # Define how to format the attachments in the response
    def pre_process_list_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare the result before sending it to the response"""
        for item in result["result"]:
            if "attachments" in item and item["attachments"]:
                attachments = []
                for attachment in item["attachments"]:
                    attachment_dict = {
                        "id": attachment.id,
                        "file_name": attachment.file_name,
                        "file_type": attachment.file_type,
                        "created_on": attachment.created_on.isoformat(),
                        "file_url": get_url_path(
                            "PublicEducationRestApi.download_attachment",
                            attachment_id=attachment.id,
                        ),
                    }
                    if attachment.file_type == "image":
                        attachment_dict["thumbnail_url"] = get_url_path(
                            "PublicEducationRestApi.download_attachment",
                            attachment_id=attachment.id,
                        )
                    else:
                        attachment_dict["thumbnail_url"] = None
                    attachments.append(attachment_dict)
                item["attachments"] = attachments
        return result

    @expose("/create/", methods=["POST"])
    @protect()
    @safe
    def create(self) -> Response:
        """Create a new public education post"""
        logger.info("Received create request")
        logger.info(f"Files in request: {request.files}")
        logger.info(f"Form data in request: {request.form}")
        logger.info(f"Content type: {request.content_type}")
        
        if not request.files or not request.form:
            logger.error("No data provided - files: %s, form: %s", bool(request.files), bool(request.form))
            return self.response(400, message="No data provided")

        try:
            # Create upload directory if it doesn't exist
            upload_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), UPLOAD_FOLDER)
            os.makedirs(upload_path, exist_ok=True)

            # Create post
            post = PublicEducationPost(
                title=request.form["title"],
                message=request.form["message"],
                hashtags=request.form["hashtags"],
                created_by=g.user,
            )
            db.session.add(post)
            db.session.flush()  # Get post ID

            # Handle file uploads
            files = request.files.getlist("attachments")
            for file in files:
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(upload_path, f"{post.id}_{filename}")
                    file.save(file_path)

                    # Create attachment record
                    file_type = "pdf" if filename.lower().endswith(".pdf") else "image"
                    attachment = PublicEducationAttachment(
                        post_id=post.id,
                        file_name=filename,
                        file_type=file_type,
                        file_path=file_path,
                    )
                    db.session.add(attachment)

            db.session.commit()
            return self.response(201, message="Post created successfully")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating public education post: {e}")
            return self.response(500, message=str(e))

    @expose("/attachment/<int:attachment_id>", methods=["GET"])
    @protect()
    @safe
    @has_access_api
    def get_attachment(self, attachment_id: int) -> WerkzeugResponse:
        """Get an attachment file"""
        attachment = db.session.query(PublicEducationAttachment).get(attachment_id)
        if not attachment:
            return self.response(404, message="Attachment not found")

        try:
            return send_file(
                attachment.file_path,
                mimetype="image/*" if attachment.file_type == "image" else "application/pdf",
                as_attachment=False,
            )
        except Exception as e:
            logger.error(f"Error serving attachment: {e}")
            return self.response(500, message=str(e))

    @expose("/attachment/<int:attachment_id>/download", methods=["GET"])
    @protect()
    @safe
    @has_access_api
    def download_attachment(self, attachment_id: int) -> WerkzeugResponse:
        """Download an attachment"""
        attachment = db.session.query(PublicEducationAttachment).get(attachment_id)
        if not attachment:
            return self.response(404, message="Attachment not found")

        try:
            return send_file(
                attachment.file_path,
                as_attachment=True,
                download_name=attachment.file_name,
            )
        except Exception as e:
            logger.error(f"Error downloading attachment: {e}")
            return self.response(500, message=str(e)) 