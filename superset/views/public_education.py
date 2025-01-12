# implement similar to bulletins and advisories

from flask import redirect
from flask_appbuilder import expose, BaseView
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from superset.views.base import (
    BaseSupersetView,
)

class PublicEducationView(BaseSupersetView):
    """View that redirects to the public education dashboard"""
    
    route_base = "/public_education"
    default_view = "public_education"

    @expose("/")
    @has_access
    def public_education(self):
        """Redirects to the public education dashboard"""
        # return super().render_app_template() 
        return redirect(f"/superset/welcome/") 