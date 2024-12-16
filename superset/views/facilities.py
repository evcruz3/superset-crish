from flask import redirect
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from superset.views.base import (
    BaseSupersetView,
)


class FacilitiesView(BaseSupersetView):
    """View that redirects to the facilities dashboard"""
    
    route_base = "/facilities"
    default_view = "facilities"

    @expose("/")
    @has_access
    def facilities(self):
        """Redirects to the facilities dashboard"""
        return super().render_app_template()