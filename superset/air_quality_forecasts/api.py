import logging
from datetime import datetime, date, timedelta
import random
from typing import Any, Dict, List
import json

from flask import request, Response, current_app
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from .models import AirQualityForecast
from .schemas import AirQualityForecastSchema

logger = logging.getLogger(__name__)

HARDCODED_MUNICIPALITIES: Dict[str, str] = {
    "Aileu": "TL-AL",
    "Ainaro": "TL-AN",
    "Atauro": "TL-AT",
    "Baucau": "TL-BA",
    "Bobonaro": "TL-BO",
    "Covalima": "TL-CO",
    "Dili": "TL-DI",
    "Ermera": "TL-ER",
    "Manatuto": "TL-MT",
    "Manufahi": "TL-MF",
    "Lautem": "TL-LA",
    "Liquica": "TL-LI",
    "Raeoa": "TL-OE", # Oecusse (Special Administrative Region Oecusse-Ambeno)
    "Viqueque": "TL-VI"
}

def generate_mock_air_quality_data_for_map(target_date_str: str | None = None) -> List[Dict[str, Any]]:
    """Generates mock air quality data for all hardcoded Timor Leste municipalities for the map for a specific date or today."""
    all_forecasts = []
    
    if target_date_str:
        try:
            target_date = date.fromisoformat(target_date_str)
        except ValueError:
            # Default to today if the date string is invalid
            target_date = date.today()
    else:
        target_date = date.today()

    aqi_levels = [
        (0, 50, "Good", "No health advisory.", ["PM2.5", "O3"]),
        (51, 100, "Moderate", "Unusually sensitive individuals should consider limiting prolonged outdoor exertion.", ["PM2.5", "O3", "PM10"]),
        (101, 150, "Unhealthy for Sensitive Groups", "People with heart or lung disease, older adults, and children should reduce prolonged outdoor exertion.", ["PM10", "O3", "NO2"]),
        (151, 200, "Unhealthy", "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.", ["NO2", "SO2", "PM2.5"]),
        (201, 300, "Very Unhealthy", "Health alert: everyone may experience more serious health effects.", ["SO2", "CO"]),
        (301, 500, "Hazardous", "Health warnings of emergency conditions. The entire population is more likely to be affected.", ["CO", "PM10"])
    ]

    for name, iso_code in HARDCODED_MUNICIPALITIES.items():
        # For map, we usually want a single data point per municipality for the selected date
        aqi_min, aqi_max, _, health_base, pollutants = random.choice(aqi_levels)
        overall_aqi = random.randint(aqi_min, aqi_max)
        dominant_pollutant = random.choice(pollutants)
        health_advisory = f"{health_base} Current AQI: {overall_aqi} on {target_date.strftime('%Y-%m-%d')}. Dominant pollutant: {dominant_pollutant}."

        all_forecasts.append({
            "municipality_code": iso_code,
            "municipality_name": name,
            "forecast_date": target_date.isoformat(),
            "overall_aqi": overall_aqi,
            "pm25": round(random.uniform(0, 500), 1) if "PM2.5" in pollutants or dominant_pollutant == "PM2.5" else None,
            "pm10": round(random.uniform(0, 600), 1) if "PM10" in pollutants or dominant_pollutant == "PM10" else None,
            "o3": round(random.uniform(0, 0.2), 3) if "O3" in pollutants or dominant_pollutant == "O3" else None,
            "no2": round(random.uniform(0, 1), 3) if "NO2" in pollutants or dominant_pollutant == "NO2" else None,
            "so2": round(random.uniform(0, 1), 3) if "SO2" in pollutants or dominant_pollutant == "SO2" else None,
            "co": round(random.uniform(0, 50), 1) if "CO" in pollutants or dominant_pollutant == "CO" else None,
            "dominant_pollutant": dominant_pollutant,
            "health_advisory": health_advisory
        })
    return all_forecasts

def generate_mock_air_quality_data(municipality_code: str, municipality_name: str, forecast_days: int = 10):
    """Generates mock air quality data for a given number of days."""
    today = date.today()
    forecasts = []
    aqi_levels = [
        (0, 50, "Good", "No health advisory.", ["PM2.5", "O3"]),
        (51, 100, "Moderate", "Unusually sensitive individuals should consider limiting prolonged outdoor exertion.", ["PM2.5", "O3", "PM10"]),
        (101, 150, "Unhealthy for Sensitive Groups", "People with heart or lung disease, older adults, and children should reduce prolonged outdoor exertion.", ["PM10", "O3", "NO2"]),
        (151, 200, "Unhealthy", "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.", ["NO2", "SO2", "PM2.5"]),
        (201, 300, "Very Unhealthy", "Health alert: everyone may experience more serious health effects.", ["SO2", "CO"]),
        (301, 500, "Hazardous", "Health warnings of emergency conditions. The entire population is more likely to be affected.", ["CO", "PM10"])
    ]

    for i in range(forecast_days):
        current_date = today + timedelta(days=i)
        aqi_min, aqi_max, _, health_base, pollutants = random.choice(aqi_levels)
        overall_aqi = random.randint(aqi_min, aqi_max)
        dominant_pollutant = random.choice(pollutants)
        health_advisory = f"{health_base} Current AQI: {overall_aqi}. Dominant pollutant: {dominant_pollutant}."

        forecasts.append({
            "municipality_code": municipality_code,
            "municipality_name": municipality_name,
            "forecast_date": current_date.isoformat(),
            "overall_aqi": overall_aqi,
            "pm25": round(random.uniform(0, 500), 1) if "PM2.5" in pollutants or dominant_pollutant == "PM2.5" else None,
            "pm10": round(random.uniform(0, 600), 1) if "PM10" in pollutants or dominant_pollutant == "PM10" else None,
            "o3": round(random.uniform(0, 0.2), 3) if "O3" in pollutants or dominant_pollutant == "O3" else None, # ppm
            "no2": round(random.uniform(0, 1), 3) if "NO2" in pollutants or dominant_pollutant == "NO2" else None, # ppm
            "so2": round(random.uniform(0, 1), 3) if "SO2" in pollutants or dominant_pollutant == "SO2" else None, # ppm
            "co": round(random.uniform(0, 50), 1) if "CO" in pollutants or dominant_pollutant == "CO" else None,   # ppm
            "dominant_pollutant": dominant_pollutant,
            "health_advisory": health_advisory
        })
    return forecasts

def generate_mock_trendline_data_recharts(municipality_codes: List[str], pollutant_keys: List[str], days: int = 7) -> List[Dict[str, Any]]:
    """Generates mock trendline data formatted for Recharts.
       Returns a list of data points, where each point is an object with a date and series values.
    """
    today = date.today()
    recharts_data: List[Dict[str, Any]] = []

    pollutant_ranges = {
        "pm25": (5, 150), "pm10": (10, 200), "o3": (0.01, 0.1),
        "no2": (0.005, 0.05), "so2": (0.002, 0.04), "co": (0.1, 5)
    }

    # Generate data for each day
    for i in range(days - 1, -1, -1): # Dates from (days-1) ago to today
        current_date_iso = (today - timedelta(days=i)).isoformat()
        day_data_point: Dict[str, Any] = {"date": current_date_iso}

        for mun_code in municipality_codes:
            municipality_name = next((name for name, iso in HARDCODED_MUNICIPALITIES.items() if iso == mun_code), mun_code)
            for poll_key in pollutant_keys:
                if poll_key not in pollutant_ranges:
                    continue
                
                series_key = f"{poll_key.upper()}_{mun_code.replace('-', '')}" # e.g., PM25_TLDI, for valid object keys
                                                                         # More descriptive: f"{poll_key.upper()} - {municipality_name}"
                min_val, max_val = pollutant_ranges[poll_key]
                val = round(random.uniform(min_val, max_val) * (1 + random.uniform(-0.2, 0.2)), 2 if poll_key not in ["pm25", "pm10"] else 1)
                day_data_point[series_key] = val
        
        recharts_data.append(day_data_point)
            
    return recharts_data

class AirQualityForecastRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(AirQualityForecast)
    resource_name = "air_quality_forecast"
    allow_browser_login = True
    class_permission_name = "AirQualityForecast"

    openapi_spec_tag = "CRISH Air Quality Forecasts"
    openapi_spec_component_schemas = (AirQualityForecastSchema,)

    @expose("/map", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_map_data",
        log_to_statsd=False,
    )
    def get_map_data(self) -> Response:
        """
        ---
        get:
          summary: Get Air Quality Data for Map View
          description: |
            Retrieves mock air quality data for all hardcoded Timor Leste municipalities,
            suitable for displaying on a map for a specific date (or today if no date is provided).
          parameters:
          - name: forecast_date
            in: query
            required: false
            schema:
              type: string
              format: date
            description: Target date (YYYY-MM-DD) for the map data. Defaults to today if not provided.
          responses:
            200:
              description: Air quality data for the map.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/AirQualityForecastSchema'
                      count:
                        type: integer
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        target_date_str = request.args.get("forecast_date")
        data = generate_mock_air_quality_data_for_map(target_date_str=target_date_str)
        return self.response(200, result=data, count=len(data))

    @expose("/trends", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_trend_data",
        log_to_statsd=False,
    )
    def get_trend_data(self) -> Response:
        """
        ---
        get:
          summary: Get Air Quality Trendline Data
          description: |
            Retrieves mock time-series data for specified municipalities and pollutants,
            formatted for Recharts trendlines.
          parameters:
          - name: municipalities
            in: query
            required: true
            schema:
              type: string
            description: Comma-separated list of municipality codes (e.g., TL-DI,TL-BA).
          - name: pollutants
            in: query
            required: true
            schema:
              type: string
            description: Comma-separated list of pollutant keys (e.g., pm25,o3).
          - name: days
            in: query
            required: false
            schema:
              type: integer
              default: 7
            description: Number of past days for which to generate trendline data. Defaults to 7.
          responses:
            200:
              description: Trendline data for specified parameters.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array # The actual structure of trendline data might be different
                                   # For now, let's assume it's a list of objects, schema needs verification.
                        items:
                          type: object # Define more specifically if possible, or use a generic object
                      count:
                        type: integer
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        mun_codes_str = request.args.get("municipalities")
        pollutants_str = request.args.get("pollutants")
        
        if not mun_codes_str or not pollutants_str:
            return self.response_400(message="Missing required query parameters: municipalities, pollutants")

        days_str = request.args.get("days", "7")
        
        mun_codes = [code.strip() for code in mun_codes_str.split(',') if code.strip()]
        pollutants = [poll.strip() for poll in pollutants_str.split(',') if poll.strip()]
        days = int(days_str) if days_str.isdigit() and int(days_str) > 0 else 7
            
        data = generate_mock_trendline_data_recharts(mun_codes, pollutants, days)
        # The trendline data from generate_mock_trendline_data_recharts is a list of dictionaries,
        # where each dictionary is a data point for Recharts.
        # Example: [{"date": "2023-01-01", "PM25_TLDI": 50, "O3_TLDI": 0.03}, ...]
        return self.response(200, result=data, count=len(data))

    @expose("/forecasts", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_forecast_cards",
        log_to_statsd=False,
    )
    def get_forecast_cards(self) -> Response:
        """
        ---
        get:
          summary: Get Multi-Day Air Quality Forecast for a Municipality
          description: |
            Retrieves a multi-day (default 10 days) mock air quality forecast 
            for a specific municipality, suitable for forecast cards.
          parameters:
          - name: municipality_code
            in: query
            required: true
            schema:
              type: string
            description: Municipality code (e.g., TL-DI) for which to fetch the forecast.
          - name: days
            in: query
            required: false
            schema:
              type: integer
              default: 10
            description: Number of future days for which to generate forecast data. Defaults to 10.
          responses:
            200:
              description: Multi-day forecast data for the municipality.
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/AirQualityForecastSchema'
                      count:
                        type: integer
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        municipality_code = request.args.get("municipality_code")
        if not municipality_code:
            return self.response_400(message="Missing required query parameter: municipality_code")

        municipality_name = "Unknown" # Default name
        for name, code in HARDCODED_MUNICIPALITIES.items():
            if code == municipality_code:
                municipality_name = name
                break
        
        forecast_days_str = request.args.get("days", "10")
        forecast_days = int(forecast_days_str) if forecast_days_str.isdigit() and int(forecast_days_str) > 0 else 10
        
        data = generate_mock_air_quality_data(municipality_code, municipality_name, forecast_days)
        return self.response(200, result=data, count=len(data))

    # POST/PUT/DELETE methods can be added later if needed. 