from flask import redirect
from flask_appbuilder import BaseView, expose
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _


class BulletinsAndAdvisoriesView(BaseView):
    """View that redirects to the bulletins and advisories dashboard"""
    
    route_base = "/bulletins_and_advisories"
    default_view = "bulletins_and_advisories"

    @expose("/")
    @has_access
    def bulletins_and_advisories(self):
        """Redirects to the bulletins and advisories dashboard"""
        return redirect(f"/superset/welcome/") 