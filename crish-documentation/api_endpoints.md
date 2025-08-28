## API GET Endpoints

Below is a list of GET and GET list endpoints for various functionalities:

*   **Weekly/Daily Disease Count (specified by municipality)**:
    *   `GET /api/v1/disease_data/`: Fetches a list of disease data entries.
        *   Supports filtering by: `year`, `week_number`, `disease`, `municipality_code`, `municipality`.
        *   Source: `superset/views/diseases/api.py`, `superset/views/diseases/schemas.py`
    *   `GET /api/v1/disease_data/<pk_string>`: Fetches a single disease data entry.
        *   `<pk_string>` is a composite key: `year_week_number_disease_municipality_code`.
        *   Source: `superset/views/diseases/api.py`

*   **Heat Index Forecast (by municipality)**:
    *   `GET /api/v1/weather_forecasts/heat_index`: Fetches a list of heat index forecasts.
        *   Supports filtering by: `municipality_code`, `municipality_name`, `forecast_date`, `days_range`.
        *   Source: `superset/weather_forecasts/api.py`
    *   `GET /api/v1/weather_forecasts/heat_index/<string:mun_code>/<string:forecast_date_str>`: Fetches a specific heat index forecast.
        *   `<mun_code>`: Municipality code.
        *   `<forecast_date_str>`: Forecast date.
        *   Source: `superset/weather_forecasts/api.py`

*   **Heat Index Alerts (by municipality)**:
    *   `GET /api/v1/weather_forecast_alert/`: Fetches a list of weather forecast alerts.
        *   Supports filtering by: `weather_parameter`, `municipality_code`, `municipality_name`, `alert_level`, `forecast_date`.
        *   Source: `superset/weather_forecast_alerts/api.py`
    *   `GET /api/v1/weather_forecast_alert/<pk>`: Fetches a single weather forecast alert.
        *   `<pk>`: Primary key (likely integer ID). Response also includes a composite ID: `municipality_code_forecast_date_weather_parameter`.
        *   Source: `superset/weather_forecast_alerts/api.py`, `superset/weather_forecast_alerts/schemas.py`

*   **Disease Prediction (Alerts)**:
    *   `GET /api/v1/disease_forecast_alert/`: Fetches a list of disease forecast alerts.
        *   Supports filtering by: `municipality_name`, `municipality_code`, `disease_type`, `alert_level`, `forecast_date`.
        *   Source: `superset/disease_forecast_alerts/api.py`
    *   `GET /api/v1/disease_forecast_alert/<pk>`: Fetches a single disease forecast alert.
        *   `<pk>`: Database ID (integer). Response includes a composite ID: `municipality_code_forecast_date_disease_type`.
        *   Source: `superset/disease_forecast_alerts/api.py`, `superset/disease_forecast_alerts/schemas.py`

*   **Bulletins**:
    *   `GET /api/v1/bulletins_and_advisories/`: Fetches a list of bulletins.
        *   Source: `superset/bulletins/api.py`
    *   `GET /api/v1/bulletins_and_advisories/<int:pk>`: Fetches a single bulletin.
        *   `<pk>`: Integer primary key.
        *   Source: `superset/bulletins/api.py`
    *   `GET /api/v1/bulletins_and_advisories/<int:bulletin_id>/pdf/`: Downloads a specific bulletin as a PDF.
        *   `<bulletin_id>`: Integer ID of the bulletin.
        *   Source: `superset/bulletins/api.py` 