from flask import redirect
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _

from superset.views.base import BaseSupersetView

class AirQualityForecastView(BaseSupersetView):
    """View that renders the air quality forecast page"""

    route_base = "/air-quality-forecasts"
    default_view = "air_quality_forecasts"

    @expose("/")
    @has_access
    def air_quality_forecasts(self):
        """Renders the air quality forecast page"""
        return super().render_app_template() 