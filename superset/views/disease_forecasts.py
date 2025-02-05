from flask import redirect
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from superset.views.base import BaseSupersetView

class DiseaseForecastView(BaseSupersetView):
    """View that redirects to the disease forecast dashboard"""
    
    route_base = "/disease-forecasts"
    default_view = "disease_forecasts"

    @expose("/")
    @has_access
    def disease_forecasts(self):
        """Redirects to the disease forecast dashboard"""
        return super().render_app_template() 