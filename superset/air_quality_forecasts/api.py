import logging
from datetime import datetime, date, timedelta
import random
import math
from typing import Any, Dict, List
import json

from flask import request, Response, current_app
from flask_appbuilder.api import expose, protect, safe, permission_name
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics
from .models import AirQualityForecast
from .schemas import AirQualityForecastSchema

logger = logging.getLogger(__name__)

# Mock stations data for Timor-Leste
MOCK_STATIONS = [
    {
        "id": "1",
        "station_name": "Dili Environmental Station",
        "city_name": "Dili",
        "latitude": "-8.5569",
        "longitude": "125.5603"
    },
    {
        "id": "2", 
        "station_name": "Baucau MET Office",
        "city_name": "Baucau",
        "latitude": "-8.4714",
        "longitude": "126.3989"
    },
    {
        "id": "3",
        "station_name": "Manatuto Monitoring Station",
        "city_name": "Manatuto",
        "latitude": "-8.5211",
        "longitude": "126.0147"
    },
    {
        "id": "4",
        "station_name": "Viqueque Environmental Office",
        "city_name": "Viqueque", 
        "latitude": "-8.8653",
        "longitude": "126.3639"
    },
    {
        "id": "5",
        "station_name": "Aileu Highland Station",
        "city_name": "Aileu",
        "latitude": "-8.7281",
        "longitude": "125.5664"
    }
]

def get_pollutant_status(value: float, pollutant_type: str) -> Dict[str, Any]:
    """Determine status and color based on pollutant value and type."""
    
    if pollutant_type == "pm1":
        if value <= 10:
            return {"status": "Good", "color": "#2ecc40"}
        elif value <= 20:
            return {"status": "Moderate", "color": "#f3eb12"}
        elif value <= 30:
            return {"status": "Unhealthy for Sensitive Groups", "color": "#f39a3a"}
        elif value <= 40:
            return {"status": "Unhealthy", "color": "#e62d39"}
        else:
            return {"status": "Very Unhealthy", "color": "#8b008b"}
    
    elif pollutant_type == "pm25":
        if value <= 50:
            return {"status": "Good", "color": "#2ecc40"}
        elif value <= 100:
            return {"status": "Moderate", "color": "#f3eb12"}
        elif value <= 150:
            return {"status": "Unhealthy for Sensitive Groups", "color": "#f39a3a"}
        elif value <= 200:
            return {"status": "Unhealthy", "color": "#e62d39"}
        elif value <= 300:
            return {"status": "Very Unhealthy", "color": "#8b008b"}
        else:
            return {"status": "Hazardous", "color": "#7e0023"}
    
    elif pollutant_type == "pm10":
        if value <= 50:
            return {"status": "Good", "color": "#2ecc40"}
        elif value <= 100:
            return {"status": "Moderate", "color": "#f3eb12"}
        elif value <= 150:
            return {"status": "Unhealthy for Sensitive Groups", "color": "#f39a3a"}
        elif value <= 200:
            return {"status": "Unhealthy", "color": "#e62d39"}
        elif value <= 300:
            return {"status": "Very Unhealthy", "color": "#8b008b"}
        else:
            return {"status": "Hazardous", "color": "#7e0023"}
    
    elif pollutant_type == "co2":
        if value <= 400:
            return {"status": "Normal", "color": "#2ecc40"}
        elif value <= 600:
            return {"status": "Moderate", "color": "#f3eb12"}
        elif value <= 1000:
            return {"status": "Poor", "color": "#f39a3a"}
        else:
            return {"status": "Very Poor", "color": "#e62d39"}
    
    return {"status": "Unknown", "color": "#808080"}

def generate_pollutant_data(pollutant_type: str, base_value: float = None) -> Dict[str, Any]:
    """Generate pollutant data with status, color, and value."""
    if base_value is None:
        # Generate random values based on pollutant type
        if pollutant_type == "pm1":
            value = round(random.uniform(2, 35), 1)
        elif pollutant_type == "pm25":
            value = round(random.uniform(20, 120), 0)
        elif pollutant_type == "pm10":
            value = round(random.uniform(10, 80), 0)
        elif pollutant_type == "co2":
            value = round(random.uniform(380, 450), 1)
        else:
            value = 0
    else:
        # Add some variation to base value
        variation = base_value * random.uniform(-0.2, 0.2)
        value = round(base_value + variation, 1)
    
    status_info = get_pollutant_status(value, pollutant_type)
    return {
        "status": status_info["status"],
        "color": status_info["color"],
        "value": value
    }

def generate_mock_current_data() -> List[Dict[str, Any]]:
    """Generate mock current air quality data for all stations."""
    current_time = datetime.utcnow()
    data = []
    
    for station in MOCK_STATIONS:
        data.append({
            "pm25": generate_pollutant_data("pm25"),
            "pm10": generate_pollutant_data("pm10"),
            "pm1": generate_pollutant_data("pm1"),
            "co2": generate_pollutant_data("co2"),
            "station_name": station["station_name"],
            "city_name": station["city_name"],
            "latitude": station["latitude"],
            "longitude": station["longitude"],
            "id": station["id"],
            "ts": {
                "date": current_time.strftime("%Y-%m-%d %H:%M:%S.000000"),
                "timezone_type": 2,
                "timezone": "Z"
            }
        })
    
    return data

def generate_mock_daily_data(days: int = 30) -> List[Dict[str, Any]]:
    """Generate mock daily historical air quality data."""
    data = []
    today = date.today()
    
    # Generate base values for each station to maintain some consistency
    station_base_values = {}
    for station in MOCK_STATIONS:
        station_base_values[station["id"]] = {
            "pm1": random.uniform(4, 15),
            "pm25": random.uniform(40, 80),
            "pm10": random.uniform(15, 40),
            "co2": random.uniform(395, 420)
        }
    
    for station in MOCK_STATIONS:
        base_values = station_base_values[station["id"]]
        
        for i in range(days):
            current_date = today - timedelta(days=i)
            
            # Add some daily variation
            daily_factor = 1 + (0.1 * math.sin(i * 0.5))
            
            data.append({
                "pm25": generate_pollutant_data("pm25", base_values["pm25"] * daily_factor),
                "pm10": generate_pollutant_data("pm10", base_values["pm10"] * daily_factor),
                "pm1": generate_pollutant_data("pm1", base_values["pm1"] * daily_factor),
                "co2": generate_pollutant_data("co2", base_values["co2"] * daily_factor),
                "station_name": station["station_name"],
                "city_name": station["city_name"],
                "latitude": station["latitude"],
                "longitude": station["longitude"],
                "id": station["id"],
                "ts": {
                    "date": current_date.strftime("%Y-%m-%d 00:00:00.000000"),
                    "timezone_type": 2,
                    "timezone": "Z"
                }
            })
    
    return data

def generate_mock_forecast_data(station_id: str = None, days: int = 10) -> List[Dict[str, Any]]:
    """Generate mock forecast data for a specific station or all stations."""
    data = []
    today = date.today()
    
    stations = MOCK_STATIONS
    if station_id:
        stations = [s for s in MOCK_STATIONS if s["id"] == station_id]
    
    for station in stations:
        # Generate base values for consistency
        base_values = {
            "pm1": random.uniform(4, 15),
            "pm25": random.uniform(40, 80),
            "pm10": random.uniform(15, 40),
            "co2": random.uniform(395, 420)
        }
        
        for i in range(days):
            forecast_date = today + timedelta(days=i)
            
            # Add some variation for forecasts
            forecast_factor = 1 + (0.15 * math.sin(i * 0.3))
            
            data.append({
                "pm25": generate_pollutant_data("pm25", base_values["pm25"] * forecast_factor),
                "pm10": generate_pollutant_data("pm10", base_values["pm10"] * forecast_factor),
                "pm1": generate_pollutant_data("pm1", base_values["pm1"] * forecast_factor),
                "co2": generate_pollutant_data("co2", base_values["co2"] * forecast_factor),
                "station_name": station["station_name"],
                "city_name": station["city_name"],
                "latitude": station["latitude"],
                "longitude": station["longitude"],
                "id": station["id"],
                "ts": {
                    "date": forecast_date.strftime("%Y-%m-%d 00:00:00.000000"),
                    "timezone_type": 2,
                    "timezone": "Z"
                }
            })
    
    return data

class AirQualityForecastRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(AirQualityForecast)
    resource_name = "air_quality_forecast"
    allow_browser_login = True
    class_permission_name = "AirQualityForecast"

    openapi_spec_tag = "CRISH Air Quality Forecasts"
    openapi_spec_component_schemas = (AirQualityForecastSchema,)

    @expose("/current", methods=["GET"])
    # @protect()
    @safe
    @permission_name("get")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_current",
        log_to_statsd=False,
    )
    def get_current(self) -> Response:
        """
        Get current air quality data from all stations.
        ---
        get:
          summary: Get current air quality readings
          description: Returns the latest air quality measurements from all monitoring stations
          responses:
            200:
              description: Current air quality data
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                        example: "success"
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/AirQualityForecastSchema'
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            data = generate_mock_current_data()
            return self.response(200, status="success", data=data)
        except Exception as e:
            logger.error(f"Error generating current air quality data: {str(e)}")
            return self.response_500(message=str(e))

    @expose("/daily", methods=["GET"])
    # @protect()
    @safe
    @permission_name("get")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_daily",
        log_to_statsd=False,
    )
    def get_daily(self) -> Response:
        """
        Get daily historical air quality data.
        ---
        get:
          summary: Get daily air quality data
          description: Returns historical daily air quality measurements
          parameters:
          - name: days
            in: query
            required: false
            schema:
              type: integer
              default: 30
            description: Number of days of historical data to return
          responses:
            200:
              description: Daily air quality data
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                        example: "success"
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/AirQualityForecastSchema'
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            days = request.args.get("days", 30, type=int)
            data = generate_mock_daily_data(days)
            return self.response(200, status="success", data=data)
        except Exception as e:
            logger.error(f"Error generating daily air quality data: {str(e)}")
            return self.response_500(message=str(e))

    @expose("/forecast", methods=["GET"])
    # @protect()
    @safe
    @permission_name("get")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_forecast",
        log_to_statsd=False,
    )
    def get_forecast(self) -> Response:
        """
        Get air quality forecast data.
        ---
        get:
          summary: Get air quality forecast
          description: Returns air quality forecast for the next several days
          parameters:
          - name: station_id
            in: query
            required: false
            schema:
              type: string
            description: Station ID to get forecast for (returns all stations if not specified)
          - name: days
            in: query
            required: false
            schema:
              type: integer
              default: 10
            description: Number of forecast days
          responses:
            200:
              description: Forecast data
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                        example: "success"
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/AirQualityForecastSchema'
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            station_id = request.args.get("station_id")
            days = request.args.get("days", 10, type=int)
            data = generate_mock_forecast_data(station_id, days)
            return self.response(200, status="success", data=data)
        except Exception as e:
            logger.error(f"Error generating forecast data: {str(e)}")
            return self.response_500(message=str(e))

    # Legacy endpoints for backward compatibility
    @expose("/map", methods=["GET"])
    # @protect()
    @safe
    @permission_name("get")
    def get_map_data(self) -> Response:
        """Legacy endpoint - redirects to /current"""
        return self.get_current()

    @expose("/trends", methods=["GET"])
    # @protect()
    @safe
    @permission_name("get")
    def get_trend_data(self) -> Response:
        """Legacy endpoint - redirects to /daily"""
        return self.get_daily()

    @expose("/forecasts", methods=["GET"])
    # @protect()
    @safe
    @permission_name("get")
    def get_forecast_cards(self) -> Response:
        """Legacy endpoint - redirects to /forecast"""
        return self.get_forecast()