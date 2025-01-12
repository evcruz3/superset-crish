from flask import redirect
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from superset.views.base import BaseSupersetView

class DiseasesView(BaseSupersetView):
    """View for Diseases dashboard and related disease-specific views"""
    
    route_base = "/diseases"
    default_view = "diseases"

    @expose("/")
    @has_access
    def diseases(self):
        """Main diseases dashboard view"""
        return super().render_app_template()

    @expose("/dengue/")
    @has_access
    def dengue(self):
        """Dengue specific dashboard"""
        return super().render_app_template()

    @expose("/diarrhea/")
    @has_access
    def diarrhea(self):
        """Diarrhea specific dashboard"""
        return super().render_app_template()

    @expose("/ari/")
    @has_access
    def ari(self):
        """Acute Respiratory Infection dashboard"""
        return super().render_app_template()

    @expose("/update/")
    # @has_access
    def update(self):
        """View for uploading case reports data"""
        return super().render_app_template()