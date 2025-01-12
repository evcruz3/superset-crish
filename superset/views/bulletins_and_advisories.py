from flask import Response
from flask_appbuilder import expose, has_access
from flask_babel import lazy_gettext as _
from superset.views.base import BaseSupersetView

class BulletinsAndAdvisoriesView(BaseSupersetView):
    route_base = "/bulletins_and_advisories"
    class_permission_name = "BulletinsAndAdvisories"
    
    @expose("/")
    @has_access
    def list(self) -> Response:
        return self.render_app_template()