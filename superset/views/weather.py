from flask import redirect
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from superset.views.base import (
    BaseSupersetView,
)

class WeatherForecastView(BaseSupersetView):
    """View that redirects to the weather forecast dashboard"""
    
    route_base = "/weather"
    default_view = "weather"

    @expose("/")
    @has_access
    def weather(self):
        """Redirects to the weather forecast dashboard"""
        return super().render_app_template()