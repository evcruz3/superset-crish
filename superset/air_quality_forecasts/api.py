import logging
from datetime import datetime, date, timedelta
import random
from typing import Any, Dict, List
import json

from flask import request, Response, current_app
from flask_appbuilder.api import expose, protect, safe, rison
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from .models import AirQualityForecast

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

def generate_mock_trendline_data(municipality_codes: List[str], pollutant_keys: List[str], days: int = 7) -> List[Dict[str, Any]]:
    """Generates mock trendline data for specified municipalities and pollutants over a number of days."""
    trend_data = []
    today = date.today()
    
    # Simplified pollutant generation for trends
    pollutant_ranges = {
        "pm25": (5, 150), # µg/m³
        "pm10": (10, 200), # µg/m³
        "o3": (0.01, 0.1), # ppm
        "no2": (0.005, 0.05), # ppm
        "so2": (0.002, 0.04), # ppm
        "co": (0.1, 5) # ppm
    }

    for mun_code in municipality_codes:
        municipality_name = next((name for name, iso in HARDCODED_MUNICIPALITIES.items() if iso == mun_code), mun_code)
        for poll_key in pollutant_keys:
            if poll_key not in pollutant_ranges:
                continue # Skip if pollutant key is not defined for trends
            
            series_id = f"{poll_key.upper()} - {municipality_name}"
            series_data = []
            min_val, max_val = pollutant_ranges[poll_key]
            
            for i in range(days -1, -1, -1): # Go from (days-1) days ago to today
                current_date = today - timedelta(days=i)
                # Simulate some daily variation
                val = round(random.uniform(min_val, max_val) * (1 + random.uniform(-0.2, 0.2)), 2 if poll_key not in ["pm25", "pm10"] else 1)
                series_data.append({"x": current_date.isoformat(), "y": val})
            
            trend_data.append({"id": series_id, "data": series_data})
            
    return trend_data

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
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    list_columns = [
        "id", "municipality_code", "municipality_name", "forecast_date", "overall_aqi",
        "pm25", "pm10", "o3", "no2", "so2", "co", "dominant_pollutant", "health_advisory"
    ]
    show_columns = list_columns
    edit_columns = list_columns
    add_columns = list_columns

    openapi_spec_tag = "Air Quality Forecasts"
    openapi_spec_component_schemas = (AirQualityForecast,)

    @expose("/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_list",
        log_to_statsd=False,
    )
    def get_list(self, **kwargs: Any) -> Response:
        """Get list of air quality forecasts.
        Handles requests for map data, 10-day forecast cards, or trendline data.
        """
        is_map_data_request = request.args.get("map_data", "false").lower() == "true"
        is_trendline_request = request.args.get("data_type", "").lower() == "trendline"

        if is_map_data_request:
            target_date_str = request.args.get("forecast_date")
            data = generate_mock_air_quality_data_for_map(target_date_str=target_date_str)
            return self.response(200, result=data, count=len(data))
        elif is_trendline_request:
            mun_codes_str = request.args.get("municipalities", "TL-DI,TL-BA")
            pollutants_str = request.args.get("pollutants", "pm25,pm10")
            days_str = request.args.get("days", "7")
            
            mun_codes = [code.strip() for code in mun_codes_str.split(',') if code.strip()]
            pollutants = [poll.strip() for poll in pollutants_str.split(',') if poll.strip()]
            days = int(days_str) if days_str.isdigit() else 7
            
            data = generate_mock_trendline_data_recharts(mun_codes, pollutants, days)
            return self.response(200, result=data, count=len(data))
        else: 
            # Default to 10-day forecast for a specific municipality (cards data)
            municipality_code = request.args.get("municipality_code", "TL-DI")
            municipality_name = "Dili" # Default name
            for name, code in HARDCODED_MUNICIPALITIES.items():
                if code == municipality_code:
                    municipality_name = name
                    break
            forecast_days = int(request.args.get("days", "10"))
            data = generate_mock_air_quality_data(municipality_code, municipality_name, forecast_days)
            return self.response(200, result=data, count=len(data))

    # You can add POST/PUT/DELETE methods here later if needed to manage the data via API
    # For now, we assume data is ingested via other ETL processes, and this API is for reading. 