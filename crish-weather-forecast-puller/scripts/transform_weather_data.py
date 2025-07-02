import json
from datetime import datetime, timedelta
from pathlib import Path
import os
import polars as pl
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values
import matplotlib.pyplot as plt
import geopandas
import io
import boto3 # Uncommented boto3

# Load environment variables
load_dotenv()

# S3 Configuration from environment variables
S3_BUCKET_NAME = os.getenv("S3_BUCKET")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")
S3_ACCESS_KEY = os.getenv("MINIO_ROOT_USER") # Or specific S3 access key if not MinIO root
S3_SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD") # Or specific S3 secret key
S3_ADDRESSING_STYLE = os.getenv("S3_ADDRESSING_STYLE", "auto") # Default to auto, but path for MinIO

s3_client = None
if S3_BUCKET_NAME and S3_ENDPOINT_URL and S3_ACCESS_KEY and S3_SECRET_KEY:
    s3_client = boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=boto3.session.Config(s3={'addressing_style': S3_ADDRESSING_STYLE})
    )
    print(f"S3 client initialized for endpoint: {S3_ENDPOINT_URL}, bucket: {S3_BUCKET_NAME}")
elif S3_BUCKET_NAME: # If only bucket is defined, assume standard AWS S3 with IAM role or env vars
    s3_client = boto3.client('s3')
    print(f"S3 client initialized for AWS (standard, bucket: {S3_BUCKET_NAME})")
else:
    print("S3 client not initialized. Missing S3_BUCKET or other S3 configuration variables.")

# WMO-inspired alert level color mapping
ALERT_LEVEL_COLORS = {
    'Extreme Danger': '#FF0000',  # Red
    'Danger': '#FFA500',          # Orange
    'Extreme Caution': '#FFFF00', # Yellow
    'Normal': '#008000',          # Green
    'Missing data': '#D3D3D3'     # Light grey for missing data
}

# --- Weather Parameter Threshold Constants ---
# Heat Index (°C)
HEAT_INDEX_EXTREME_DANGER = 42
HEAT_INDEX_DANGER = 40
HEAT_INDEX_EXTREME_CAUTION = 36

# Rainfall (mm)
RAINFALL_EXTREME_DANGER = 100
RAINFALL_DANGER = 50
RAINFALL_EXTREME_CAUTION = 20

# Wind Speed (km/h)
WIND_SPEED_EXTREME_DANGER = 25
WIND_SPEED_DANGER = 20
WIND_SPEED_EXTREME_CAUTION = 15

# --- Define GeoJSON path ---
# Standard in-container path
CONTAINER_GEOJSON_PATH = Path("/app/config/timorleste.geojson")

# Development/fallback path (adjust if your dev structure is different)
# This assumes the script is in crish-weather-forecast-puller/scripts
# and the workspace root is /Users/ericksoncruz/Documents/RIMES/superset/
DEV_GEOJSON_PATH = Path(__file__).resolve().parent.parent.parent / "superset-frontend/plugins/preset-chart-deckgl-osm/src/layers/Country/countries/timorleste.geojson"

GEOJSON_FILE_PATH = None
if CONTAINER_GEOJSON_PATH.exists():
    GEOJSON_FILE_PATH = str(CONTAINER_GEOJSON_PATH)
    print(f"Using GeoJSON from container path: {GEOJSON_FILE_PATH}")
elif DEV_GEOJSON_PATH.exists():
    GEOJSON_FILE_PATH = str(DEV_GEOJSON_PATH)
    print(f"Using GeoJSON from development path: {GEOJSON_FILE_PATH}")
else:
    print(f"ERROR: GeoJSON file not found at container path ({CONTAINER_GEOJSON_PATH}) or development path ({DEV_GEOJSON_PATH}). Maps cannot be generated.")

def get_day_name(date_str):
    """Convert ISO date string to day name."""
    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    return dt.strftime('%A')

def get_table_name(json_file):
    """Extract table name from JSON filename."""
    # Remove _data.json and return the base name
    return os.path.basename(json_file).replace('_data.json', '')

def calculate_heat_index(tmax_df, rh_df):
    """Calculate heat index using temperature and relative humidity data."""
    # Merge temperature and humidity data
    merged_df = tmax_df.join(
        rh_df,
        on=['forecast_date', 'municipality_code'],
        how='inner',
        suffix='_rh'
    )
    
    # Calculate heat index using the formula
    heat_index_df = merged_df.with_columns([
        # Convert Celsius to Fahrenheit for the formula
        (pl.col('value') * 9 / 5 + 32).alias('t_fahrenheit'),
        pl.col('value_rh').alias('rh_value')
    ]).with_columns([
        # Heat Index formula
        (-42.379 +
         2.04901523 * pl.col('t_fahrenheit') +
         10.14333127 * pl.col('rh_value') -
         0.22475541 * pl.col('t_fahrenheit') * pl.col('rh_value') -
         0.00683783 * pl.col('t_fahrenheit').pow(2) -
         0.05481717 * pl.col('rh_value').pow(2) +
         0.00122874 * pl.col('t_fahrenheit').pow(2) * pl.col('rh_value') +
         0.00085282 * pl.col('t_fahrenheit') * pl.col('rh_value').pow(2) -
         0.00000199 * pl.col('t_fahrenheit').pow(2) * pl.col('rh_value').pow(2)
        ).alias('heat_index_f')
    ]).with_columns([
        # Convert back to Celsius
        ((pl.col('heat_index_f') - 32) * 5 / 9).alias('value')
    ])
    
    # Select and rename columns to match schema
    return heat_index_df.select([
        'forecast_date',
        'day_name',
        'value',
        'municipality_code',
        'municipality_name'
    ])

def get_alert_level_for_value(parameter_name, value):
    """Determines the alert level based on parameter name and value."""
    if parameter_name == 'Heat Index':
        if value > HEAT_INDEX_EXTREME_DANGER: return 'Extreme Danger'
        if value > HEAT_INDEX_DANGER: return 'Danger'
        if value >= HEAT_INDEX_EXTREME_CAUTION: return 'Extreme Caution'
    elif parameter_name == 'Rainfall':
        if value > RAINFALL_EXTREME_DANGER: return 'Extreme Danger'
        if value >= RAINFALL_DANGER: return 'Danger'
        if value >= RAINFALL_EXTREME_CAUTION: return 'Extreme Caution'
    elif parameter_name == 'Wind Speed':
        if value > WIND_SPEED_EXTREME_DANGER: return 'Extreme Danger'
        if value >= WIND_SPEED_DANGER: return 'Danger'
        if value >= WIND_SPEED_EXTREME_CAUTION: return 'Extreme Caution'
    return 'Normal'

def transform_weather_data(input_file):
    """Transform weather JSON data into database-friendly format using Polars."""
    # Read JSON file
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Municipality codes mapping
    municipality_codes = {
        'Atauro': 'TL-AT',
        'Aileu': 'TL-AL',
        'Ainaro': 'TL-AN',
        'Baucau': 'TL-BA',
        'Bobonaro': 'TL-BO',
        'Covalima': 'TL-CO',
        'Dili': 'TL-DI',
        'Ermera': 'TL-ER',
        'Lautém': 'TL-LA',
        'Liquica': 'TL-LI',
        'Liquiçá': 'TL-LI',
        'Manatuto': 'TL-MT',
        'Manufahi': 'TL-MF',
        'Oecusse': 'TL-OE',
        'Viqueque': 'TL-VI'
    }

    # Create lists to store the data
    rows = []
    for municipality_name, data_obj in data['r_data'].items():
        for time_period, value in zip(data_obj['time'], data_obj['value']):
            forecast_date = time_period[0]  # Using start date of the period
            rows.append({
                'forecast_date': forecast_date,
                'day_name': get_day_name(forecast_date),
                'value': value,
                'municipality_code': municipality_codes.get(municipality_name, ''),
                'municipality_name': municipality_name
            })
    
    # Create Polars DataFrame
    df = pl.DataFrame(rows)
    
    # Transform the date format to remove time component
    df = df.with_columns([
        pl.col('forecast_date').str.slice(0, 10).alias('forecast_date')
    ])
    
    return df

def generate_weather_alerts(dataframes):
    """Generate weather alerts from weather parameter data."""
    # Check if we have all required dataframes
    required_dfs = ['heat_index_daily_region', 'rainfall_daily_weighted_average', 'ws_daily_avg_region']
    if not all(df_name in dataframes for df_name in required_dfs):
        print("Warning: Not all required weather parameters available for alert generation")
        return None
    
    # Heat Index Alerts
    heat_index_alerts = dataframes['heat_index_daily_region'].with_columns([
        pl.lit('Heat Index').alias('weather_parameter'),
        pl.when(pl.col('value') > HEAT_INDEX_EXTREME_DANGER).then(pl.lit('Extreme Danger'))
          .when(pl.col('value') > HEAT_INDEX_DANGER).then(pl.lit('Danger'))
          .when(pl.col('value') >= HEAT_INDEX_EXTREME_CAUTION).then(pl.lit('Extreme Caution'))
          .otherwise(pl.lit('Normal')).alias('alert_level'),
        pl.when(pl.col('value') > HEAT_INDEX_EXTREME_DANGER).then(pl.lit('Extreme Heat Index Alert'))
          .when(pl.col('value') > HEAT_INDEX_DANGER).then(pl.lit('Dangerous Heat Index Alert'))
          .when(pl.col('value') >= HEAT_INDEX_EXTREME_CAUTION).then(pl.lit('High Heat Index Warning'))
          .otherwise(pl.lit('Normal Conditions')).alias('alert_title'),
        pl.when(pl.col('value') > HEAT_INDEX_EXTREME_DANGER).then(pl.lit('Heat stroke imminent. Avoid any outdoor activities.'))
          .when(pl.col('value') > HEAT_INDEX_DANGER).then(pl.lit('Heat cramps and heat exhaustion likely; heat stroke probable with continued exposure.'))
          .when(pl.col('value') >= HEAT_INDEX_EXTREME_CAUTION).then(pl.lit('Heat cramps and heat exhaustion possible; continuing activity could result in heat stroke.'))
          .otherwise(pl.lit('No heat index alerts at this time.')).alias('alert_message'),
        pl.col('value').alias('parameter_value')
    ])

    # Rainfall Alerts
    rainfall_alerts = dataframes['rainfall_daily_weighted_average'].with_columns([
        pl.lit('Rainfall').alias('weather_parameter'),
        pl.when(pl.col('value') > RAINFALL_EXTREME_DANGER).then(pl.lit('Extreme Danger'))
          .when(pl.col('value') >= RAINFALL_DANGER).then(pl.lit('Danger'))
          .when(pl.col('value') >= RAINFALL_EXTREME_CAUTION).then(pl.lit('Extreme Caution'))
          .otherwise(pl.lit('Normal')).alias('alert_level'),
        pl.when(pl.col('value') > RAINFALL_EXTREME_DANGER).then(pl.lit('Severe Rainfall Alert'))
          .when(pl.col('value') >= RAINFALL_DANGER).then(pl.lit('Special Rainfall Attention'))
          .when(pl.col('value') >= RAINFALL_EXTREME_CAUTION).then(pl.lit('Rainfall Advisory'))
          .otherwise(pl.lit('Normal Rainfall Conditions')).alias('alert_title'),
        pl.when(pl.col('value') > RAINFALL_EXTREME_DANGER).then(pl.lit('Severe rainfall expected. High risk of flooding and landslides.'))
          .when(pl.col('value') >= RAINFALL_DANGER).then(pl.lit('Significant rainfall expected. Be vigilant of local alerts.'))
          .when(pl.col('value') >= RAINFALL_EXTREME_CAUTION).then(pl.lit('Moderate rainfall expected. Exercise caution.'))
          .otherwise(pl.lit('No significant rainfall expected.')).alias('alert_message'),
        pl.col('value').alias('parameter_value')
    ])

    # Wind Alerts
    wind_alerts = dataframes['ws_daily_avg_region'].with_columns([
        pl.lit('Wind Speed').alias('weather_parameter'),
        pl.when(pl.col('value') > WIND_SPEED_EXTREME_DANGER).then(pl.lit('Extreme Danger'))
          .when(pl.col('value') >= WIND_SPEED_DANGER).then(pl.lit('Danger'))
          .when(pl.col('value') >= WIND_SPEED_EXTREME_CAUTION).then(pl.lit('Extreme Caution'))
          .otherwise(pl.lit('Normal')).alias('alert_level'),
        pl.when(pl.col('value') > WIND_SPEED_EXTREME_DANGER).then(pl.lit('Severe Wind Alert'))
          .when(pl.col('value') >= WIND_SPEED_DANGER).then(pl.lit('Strong Wind Warning'))
          .when(pl.col('value') >= WIND_SPEED_EXTREME_CAUTION).then(pl.lit('Wind Speed Extreme Caution'))
          .otherwise(pl.lit('Calm Conditions')).alias('alert_title'),
        pl.when(pl.col('value') > WIND_SPEED_EXTREME_DANGER).then(pl.lit('Extremely strong winds expected. Major damage possible.'))
          .when(pl.col('value') >= WIND_SPEED_DANGER).then(pl.lit('Strong winds expected. Secure loose objects and take precautions.'))
          .when(pl.col('value') >= WIND_SPEED_EXTREME_CAUTION).then(pl.lit('Moderate winds expected. Stay alert for possible disruptions.'))
          .otherwise(pl.lit('Calm wind conditions expected.')).alias('alert_message'),
        pl.col('value').alias('parameter_value')
    ])

    # Debug the raw alerts before filtering
    print(f"\nRaw Heat Index alerts count: {heat_index_alerts.shape[0]}")
    print(f"Raw Rainfall alerts count: {rainfall_alerts.shape[0]}")
    print(f"Raw Wind Speed alerts count: {wind_alerts.shape[0]}")

    # Generate some basic statistics for rainfall
    if rainfall_alerts.shape[0] > 0:
        min_rainfall = rainfall_alerts['value'].min()
        max_rainfall = rainfall_alerts['value'].max()
        print(f"\nRainfall value range: min={min_rainfall}, max={max_rainfall}")
        
        # Count by alert level before filtering
        rainfall_by_level = rainfall_alerts.group_by('alert_level').agg(pl.count())
        print("Rainfall alerts by level (before filtering):")
        print(rainfall_by_level)

    # Filter out normal conditions
    heat_index_alerts = heat_index_alerts.filter(pl.col('alert_level') != pl.lit('Normal'))
    rainfall_alerts = rainfall_alerts.filter(pl.col('alert_level') != pl.lit('Normal'))
    wind_alerts = wind_alerts.filter(pl.col('alert_level') != pl.lit('Normal'))

    # Debug filtered alerts
    print(f"\nFiltered Heat Index alerts count: {heat_index_alerts.shape[0]}")
    print(f"Filtered Rainfall alerts count: {rainfall_alerts.shape[0]}")
    print(f"Filtered Wind Speed alerts count: {wind_alerts.shape[0]}")

    # Concatenate all alerts
    all_alerts = pl.concat([heat_index_alerts, rainfall_alerts, wind_alerts])
    
    # Select and order columns to match final schema
    alerts_df = all_alerts.select([
        'municipality_code',
        'forecast_date',
        'weather_parameter',
        'alert_level',
        'alert_title',
        'alert_message',
        'parameter_value',
        'municipality_name'
    ])
    
    # Debug final alerts composition
    alerts_by_type = alerts_df.group_by('weather_parameter').agg(pl.count())
    print("\nFinal alerts by weather parameter:")
    print(alerts_by_type)
    
    # Sort by forecast_date and alert_level severity
    return alerts_df.with_columns([
        pl.when(pl.col('alert_level') == pl.lit('Extreme Danger')).then(pl.lit(1))
          .when(pl.col('alert_level') == pl.lit('Danger')).then(pl.lit(2))
          .when(pl.col('alert_level') == pl.lit('Extreme Caution')).then(pl.lit(3))
          .otherwise(pl.lit(4)).alias('alert_priority')
    ]).sort([
        'forecast_date',
        'alert_priority',
        'weather_parameter',
        'municipality_code'
    ]).drop('alert_priority')

def process_weather_files():
    """Process all weather parameter files in the data directory using Polars."""
    data_dir = Path(__file__).parent.parent / 'data'
    weather_files = [
        'rainfall_daily_weighted_average_data.json',
        'rh_daily_avg_region_data.json',
        'tmax_daily_tmax_region_data.json',
        'ws_daily_avg_region_data.json',
        'tmin_daily_tmin_region_data.json'
    ]
    
    dataframes = {}  # Store DataFrames for each weather parameter
    
    for filename in weather_files:
        input_file = data_dir / filename
        if input_file.exists():
            # Transform the data
            df = transform_weather_data(input_file)
            table_name = get_table_name(filename)
            dataframes[table_name] = df
    
    # Calculate heat index if we have both temperature and humidity data
    if 'tmax_daily_tmax_region' in dataframes and 'rh_daily_avg_region' in dataframes:
        heat_index_df = calculate_heat_index(
            dataframes['tmax_daily_tmax_region'],
            dataframes['rh_daily_avg_region']
        )
        dataframes['heat_index_daily_region'] = heat_index_df
    
    # Generate weather alerts
    alerts_df = generate_weather_alerts(dataframes)
    if alerts_df is not None:
        dataframes['weather_forecast_alerts'] = alerts_df
    
    return dataframes

def generate_forecast_map_image(forecast_df, parameter_name, forecast_date_str, municipality_name, municipality_code, geojson_path, alert_value, parameter_unit):
    """
    Generates a choropleth map image of the forecast for a specific parameter and date.
    Colors municipalities by alert level.
    """
    try:
        gdf = geopandas.read_file(geojson_path)
        daily_forecast_df = forecast_df.filter(pl.col("forecast_date") == forecast_date_str)
        
        if 'value' not in daily_forecast_df.columns:
            print(f"Error: 'value' column not found in daily_forecast_df for map generation of {parameter_name}.")
            return None
        if 'weather_parameter' not in daily_forecast_df.columns:
            print(f"Error: 'weather_parameter' column not found in daily_forecast_df for map generation of {parameter_name}.")
            return None

        # Apply the get_alert_level_for_value function row-wise
        # Ensure that the function is robust and handles potential errors if a row doesn't have expected fields.
        alert_levels_calculated = []
        for row in daily_forecast_df.iter_rows(named=True):
            # iter_rows(named=True) requires Polars >= 0.19.3. If older, use .to_dicts() and iterate.
            # Assuming 'weather_parameter' and 'value' are present as ensured by checks above.
            alert_levels_calculated.append(get_alert_level_for_value(row['weather_parameter'], row['value']))
        
        daily_forecast_with_levels_df = daily_forecast_df.with_columns([
            pl.Series("alert_level_calculated", alert_levels_calculated)
        ])

        daily_forecast_pd_df = daily_forecast_with_levels_df.to_pandas()
        merged_gdf = gdf.merge(daily_forecast_pd_df, left_on='ISO', right_on='municipality_code', how='left')

        merged_gdf['color'] = merged_gdf['alert_level_calculated'].map(lambda x: ALERT_LEVEL_COLORS.get(x, ALERT_LEVEL_COLORS['Missing data']))

        fig, ax = plt.subplots(1, 1, figsize=(12, 10))
        merged_gdf.plot(color=merged_gdf['color'], ax=ax, edgecolor='black', linewidth=0.5)
        
        legend_handles = []
        unit = ""
        threshold_details = {} # To store {level: text_for_level}

        if parameter_name == 'Heat Index':
            unit = '°C'
            threshold_details = {
                'Extreme Danger': f'> {HEAT_INDEX_EXTREME_DANGER}',
                'Danger': f'> {HEAT_INDEX_DANGER}',
                'Extreme Caution': f'>= {HEAT_INDEX_EXTREME_CAUTION}',
                'Normal': f'< {HEAT_INDEX_EXTREME_CAUTION}'
            }
        elif parameter_name == 'Rainfall':
            unit = 'mm'
            threshold_details = {
                'Extreme Danger': f'> {RAINFALL_EXTREME_DANGER}',
                'Danger': f'>= {RAINFALL_DANGER}',
                'Extreme Caution': f'>= {RAINFALL_EXTREME_CAUTION}',
                'Normal': f'< {RAINFALL_EXTREME_CAUTION}'
            }
        elif parameter_name == 'Wind Speed':
            unit = 'km/h'
            threshold_details = {
                'Extreme Danger': f'> {WIND_SPEED_EXTREME_DANGER}',
                'Danger': f'>= {WIND_SPEED_DANGER}',
                'Extreme Caution': f'>= {WIND_SPEED_EXTREME_CAUTION}',
                'Normal': f'< {WIND_SPEED_EXTREME_CAUTION}'
            }

        for level, color_val in ALERT_LEVEL_COLORS.items():
            if level == 'Missing data':
                continue # Handled separately

            label_text = level
            if level in threshold_details and unit: # Ensure unit is set
                label_text = f"{level} ({threshold_details[level]} {unit})"
            elif level in threshold_details: # Fallback if unit somehow not set but details exist
                 label_text = f"{level} ({threshold_details[level]})"
            
            legend_handles.append(plt.Rectangle((0,0),1,1, color=color_val, label=label_text))

        # Add 'Missing data' to legend if relevant (condition from original code)
        missing_data_color = ALERT_LEVEL_COLORS.get('Missing data')
        if missing_data_color and merged_gdf['value'].isnull().any():
             legend_handles.append(
                 plt.Rectangle((0,0),1,1, 
                               color=missing_data_color, 
                               label='Missing data')
            )

        ax.legend(handles=legend_handles, title=f"{parameter_name} Alert Levels & Thresholds", loc="lower right")

        highlight_gdf = merged_gdf[merged_gdf['ISO'] == municipality_code]
        if not highlight_gdf.empty:
            highlight_gdf.plot(ax=ax, facecolor='none', edgecolor='blue', linewidth=2.5, linestyle='--')

        # Format the date for the title
        try:
            parsed_title_date = datetime.strptime(forecast_date_str, '%Y-%m-%d')
            formatted_title_date = parsed_title_date.strftime('%d %B, %Y')
        except ValueError:
            formatted_title_date = forecast_date_str # Fallback to original if parsing fails

        ax.set_title(f'{parameter_name} Forecast for Timor-Leste - {formatted_title_date}\nAlert in {municipality_name} ({parameter_name}: {alert_value:.2f} {parameter_unit})', fontsize=15)
        ax.set_axis_off()
        plt.tight_layout()

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=100)
        plt.close(fig)
        img_buffer.seek(0)
        return img_buffer
    except Exception as e:
        print(f"Error generating forecast map image for {parameter_name} on {forecast_date_str}: {e}")
        import traceback
        traceback.print_exc()
        return None

def generate_forecast_table_image(forecast_df, parameter_name, forecast_date_str, municipality_name):
    """
    Generates an image of a table with all available forecast data for the specific 
    parameter and municipality.
    """
    try:
        # Filter data for the municipality for all available dates
        table_data_df = forecast_df.filter(
            (pl.col("municipality_name") == municipality_name)
        ).select(["forecast_date", "value"]).sort("forecast_date")

        if table_data_df.is_empty():
            print(f"No data for {municipality_name} for table generation of {parameter_name}.")
            return None

        num_rows = table_data_df.height
        fig_height = max(3, num_rows * 0.5)

        fig, ax = plt.subplots(figsize=(8, fig_height))
        ax.axis('tight')
        ax.axis('off')
        
        col_labels = ['Date', f'{parameter_name} Value']
        
        # Get data as list of lists (rows)
        raw_table_content = table_data_df.to_pandas().values.tolist()
        
        # Format the content: dates in first col, floats in second col
        formatted_table_content = []
        for row_data in raw_table_content:
            formatted_row = []
            # Format date (first element)
            if isinstance(row_data[0], str):
                try:
                    formatted_row.append(datetime.strptime(row_data[0], '%Y-%m-%d').strftime('%d %B, %Y'))
                except ValueError:
                    formatted_row.append(row_data[0]) # Keep original if parsing fails
            else:
                formatted_row.append(row_data[0]) # Should be a string, but as a fallback
            
            # Format value (second element)
            if len(row_data) > 1 and isinstance(row_data[1], (float, int)):
                formatted_row.append(f"{row_data[1]:.2f}")
            elif len(row_data) > 1:
                formatted_row.append(row_data[1]) # Keep original if not float/int
            else:
                formatted_row.append("") # Placeholder if no second element
            
            formatted_table_content.append(formatted_row)
        
        unit = ""
        if "Temperature" in parameter_name or "Heat Index" in parameter_name: unit = " (°C)"
        elif "Rainfall" in parameter_name: unit = " (mm)"
        elif "Wind Speed" in parameter_name: unit = " (km/h)"
        col_labels[1] = f'{parameter_name} Value{unit}'

        table = ax.table(cellText=formatted_table_content, colLabels=col_labels, cellLoc='center', loc='center')
        table.auto_set_font_size(False)
        table.set_fontsize(10)
        table.scale(1.2, 1.2)

        ax.set_title(f'{parameter_name} Forecast for {municipality_name}', fontsize=12, pad=20)
        
        plt.tight_layout()
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=100)
        plt.close(fig)
        img_buffer.seek(0)
        return img_buffer
    except Exception as e:
        print(f"Error generating forecast table image for {parameter_name} in {municipality_name}: {e}")
        import traceback
        traceback.print_exc()
        return None

def upload_image_to_s3(image_buffer, s3_key, bucket_name):
    """
    Uploads an image buffer to S3.
    Returns the S3 key if successful, None otherwise.
    """
    if not s3_client or not bucket_name:
        print("S3 client or bucket name not configured. Skipping S3 upload.")
        # To allow flow without S3 for local testing, we can return the key
        # but in a real scenario, you might want to return None or raise an error.
        print(f"DEV MODE: Returning key '{s3_key}' without actual S3 upload.")
        return s3_key 

    try:
        s3_client.put_object(Bucket=bucket_name, Key=s3_key, Body=image_buffer, ContentType='image/png')
        print(f"Successfully uploaded {s3_key} to S3 bucket {bucket_name}.")
        return s3_key
    except Exception as e:
        print(f"Error uploading {s3_key} to S3 bucket {bucket_name}: {e}")
        import traceback
        traceback.print_exc()
        return None

def ingest_to_postgresql(dataframes):
    """Ingest dataframes into PostgreSQL database using Polars write_database with ADBC."""
    # Construct PostgreSQL connection URI from environment variables with fallbacks
    db_uri = (
        f"postgresql://{os.getenv('DATABASE_USER', 'superset')}:{os.getenv('DATABASE_PASSWORD', 'superset')}"
        f"@{os.getenv('DATABASE_HOST', 'db')}:{os.getenv('DATABASE_PORT', '5432')}"
        f"/{os.getenv('DATABASE_DB', 'superset')}"
    )
    
    try:
        with psycopg2.connect(db_uri) as conn:
            conn.autocommit = True
            
            # First, ingest all non-alert data tables
            for table_name, df in dataframes.items():
                if table_name != 'weather_forecast_alerts':  # Handle alerts separately
                    print(f"Ingesting data to PostgreSQL for table: {table_name}")
                    
                    # Write DataFrame to database using Polars native method with ADBC
                    rows_affected = df.write_database(
                        table_name=table_name,
                        connection=db_uri,
                        if_table_exists='replace',  # This will create new or replace existing table
                        engine='adbc'  # Using ADBC engine instead of SQLAlchemy
                    )
                    
                    print(f"Successfully inserted/updated {rows_affected} rows into {table_name}")
            
            # Handle weather_forecast_alerts separately to create linked bulletins
            if 'weather_forecast_alerts' in dataframes:
                weather_alerts_df = dataframes['weather_forecast_alerts']
                print(f"Ingesting data to PostgreSQL for table: weather_forecast_alerts")
                
                # For weather_forecast_alerts, add extra debug info
                # Count rows by weather parameter type
                param_counts = weather_alerts_df.group_by('weather_parameter').agg(pl.count().alias('count'))
                print(f"Weather forecast alerts by parameter type:")
                print(param_counts)
                
                # Check alert level distribution
                level_counts = weather_alerts_df.group_by(['weather_parameter', 'alert_level']).agg(pl.count().alias('count'))
                print(f"Weather forecast alerts by parameter and level:")
                print(level_counts)
                
                # Add a column for the current date today
                weather_alerts_df = weather_alerts_df.with_columns(
                    pl.lit(datetime.now().strftime('%Y-%m-%d')).alias('created_date')
                )
                
                # First, ingest the weather forecast alerts to the database
                rows_affected = weather_alerts_df.write_database(
                    table_name='weather_forecast_alerts',
                    connection=db_uri,
                    if_table_exists='replace',
                    engine='adbc'
                )
                print(f"Successfully inserted/updated {rows_affected} rows into weather_forecast_alerts")
                
                # Now create bulletins for high severity alerts and link them to the weather alerts
                if weather_alerts_df.shape[0] > 0:
                    high_severity_alerts = weather_alerts_df.filter(
                        (pl.col('alert_level') == 'Danger') | 
                        (pl.col('alert_level') == 'Extreme Danger') |
                        (pl.col('alert_level') == 'Extreme Caution')
                    )
                    
                    if high_severity_alerts.shape[0] > 0:
                        print(f"Creating bulletins for {high_severity_alerts.shape[0]} high severity weather alerts")
                        create_weather_bulletins_with_links(high_severity_alerts, dataframes, conn)
            
            print("All data successfully ingested to PostgreSQL")
            
    except Exception as e:
        print(f"Error ingesting data to PostgreSQL: {str(e)}")
        import traceback
        traceback.print_exc()

def create_weather_bulletins_with_links(high_severity_alerts_df, all_dataframes, db_connection):
    """
    Creates bulletins for high severity weather alerts and links them using composite IDs.
    
    Args:
        high_severity_alerts_df: Polars DataFrame with high severity weather alerts
        all_dataframes: Dictionary of all dataframes for chart generation
        db_connection: Database connection object
    """
    alerts_to_process = high_severity_alerts_df.to_pandas()
    
    with db_connection.cursor() as cur:
        for _, alert_row in alerts_to_process.iterrows():
            # Create composite ID for linking bulletin to weather forecast alert
            composite_id = f"{alert_row['municipality_code']}_{alert_row['created_date']}_{alert_row['forecast_date']}_{alert_row['weather_parameter']}"
            
            # Original forecast date string from the DataFrame
            original_forecast_date_str = alert_row['forecast_date']  # This is YYYY-MM-DD
            
            # Create a formatted date for display purposes (e.g., title, captions)
            try:
                parsed_forecast_date = datetime.strptime(original_forecast_date_str, '%Y-%m-%d')
                formatted_display_date = parsed_forecast_date.strftime('%d %B, %Y')
            except ValueError:
                # If parsing fails (should not happen if data is clean), use original as fallback for display
                formatted_display_date = original_forecast_date_str 
                print(f"Warning: Could not parse date {original_forecast_date_str} for display formatting.")

            # Build the safety tips based on alert type
            safety_tips = ""
            if alert_row['weather_parameter'] == 'Heat Index':
                safety_tips = (
                    "• Stay hydrated by drinking plenty of water\n"
                    "• Avoid outdoor activities during the hottest part of the day\n"
                    "• Wear lightweight, light-colored, loose-fitting clothing\n"
                    "• Check on vulnerable individuals like elderly and children regularly\n"
                    "• Know the signs of heat-related illness (dizziness, nausea, headache)"
                )
            elif alert_row['weather_parameter'] == 'Rainfall':
                safety_tips = (
                    "• Avoid flood-prone areas and crossing flooded roads\n"
                    "• Secure your home against water damage\n"
                    "• Have emergency supplies ready\n"
                    "• Follow evacuation orders if issued\n"
                    "• Stay informed through local weather updates"
                )
            elif alert_row['weather_parameter'] == 'Wind Speed':
                safety_tips = (
                    "• Secure or bring inside loose outdoor items\n"
                    "• Stay away from damaged buildings, power lines, and trees\n"
                    "• Avoid the coastline during strong winds\n"
                    "• Prepare for possible power outages\n"
                    "• If traveling, be aware of potential road hazards"
                )
            
            title = f"{alert_row['alert_level']} Weather Alert: {alert_row['weather_parameter']} in {alert_row['municipality_name']} ({formatted_display_date})"
            
            parameter_value = round(alert_row['parameter_value'], 2)

            parameter_unit = ""
            if alert_row['weather_parameter'] == 'Heat Index': parameter_unit = "°C"
            elif alert_row['weather_parameter'] == 'Rainfall': parameter_unit = "mm"
            elif alert_row['weather_parameter'] == 'Wind Speed': parameter_unit = "km/h"

            advisory = (
                f"{alert_row['alert_title']} for {alert_row['municipality_name']} on {formatted_display_date}.\n\n"
                f"{alert_row['alert_message']}\n\n"
                f"{alert_row['weather_parameter']}: {parameter_value} {parameter_unit} ({alert_row['alert_level']})"
            )
            
            # Create risks section
            risks = ""
            if alert_row['weather_parameter'] == 'Heat Index':
                risks = (
                    "• Heat stroke and heat exhaustion\n"
                    "• Dehydration\n"
                    "• Increased vulnerability for elderly, children, and those with chronic illnesses\n"
                    "• Possible impacts on infrastructure and services"
                )
            elif alert_row['weather_parameter'] == 'Rainfall':
                risks = (
                    "• Flooding in low-lying areas\n"
                    "• Landslides in mountainous regions\n"
                    "• Water contamination\n"
                    "• Travel disruptions\n"
                    "• Possible damage to crops and infrastructure"
                )
            elif alert_row['weather_parameter'] == 'Wind Speed':
                risks = (
                    "• Flying debris causing injuries\n"
                    "• Damage to structures and vegetation\n"
                    "• Power outages\n"
                    "• Transportation hazards\n"
                    "• Coastal dangers including storm surge"
                )
            
            # Create hashtags
            hashtags = f"weather,alert,{alert_row['weather_parameter'].lower().replace(' ', '')},{alert_row['municipality_name'].lower()}"
            
            bulletin_s3_image_keys = []
            parameter_source_table = None
            if alert_row['weather_parameter'] == 'Heat Index': parameter_source_table = 'heat_index_daily_region'
            elif alert_row['weather_parameter'] == 'Rainfall': parameter_source_table = 'rainfall_daily_weighted_average'
            elif alert_row['weather_parameter'] == 'Wind Speed': parameter_source_table = 'ws_daily_avg_region'
            
            full_parameter_df_for_charts = None
            if parameter_source_table and parameter_source_table in all_dataframes:
                full_parameter_df_for_charts = all_dataframes[parameter_source_table].with_columns(
                    pl.lit(alert_row['weather_parameter']).alias("weather_parameter")
                )

            actual_s3_bucket = os.getenv("S3_BUCKET")
            if not actual_s3_bucket: print("ERROR: S3_BUCKET environment variable not set. Cannot upload chart images.")

            if full_parameter_df_for_charts is not None and GEOJSON_FILE_PATH and actual_s3_bucket:
                # 1. Forecast Map Image
                # Pass the original YYYY-MM-DD date string to chart functions
                map_image_buffer = generate_forecast_map_image(
                    full_parameter_df_for_charts, 
                    alert_row['weather_parameter'], 
                    original_forecast_date_str, # Use original string
                    alert_row['municipality_name'],
                    alert_row['municipality_code'],
                    GEOJSON_FILE_PATH,
                    alert_row['parameter_value'],
                    parameter_unit
                )
                if map_image_buffer:
                    map_s3_key = f"bulletin_charts/map_{original_forecast_date_str}_{alert_row['weather_parameter'].replace(' ', '_')}_{alert_row['municipality_code']}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.png"
                    uploaded_map_key = upload_image_to_s3(map_image_buffer, map_s3_key, bucket_name=actual_s3_bucket) 
                    if uploaded_map_key:
                        bulletin_s3_image_keys.append({
                            "key": uploaded_map_key, 
                            "caption": f"{alert_row['weather_parameter']} forecast map for {alert_row['municipality_name']} on {formatted_display_date}" # Use display date for caption
                        })

                # 2. Forecast Table Image
                table_image_buffer = generate_forecast_table_image(
                    full_parameter_df_for_charts,
                    alert_row['weather_parameter'], 
                    original_forecast_date_str, # Use original string
                    alert_row['municipality_name']
                )
                if table_image_buffer:
                    table_s3_key = f"bulletin_charts/table_{original_forecast_date_str}_{alert_row['weather_parameter'].replace(' ', '_')}_{alert_row['municipality_code']}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}.png"
                    uploaded_table_key = upload_image_to_s3(table_image_buffer, table_s3_key, bucket_name=actual_s3_bucket)
                    if uploaded_table_key:
                        bulletin_s3_image_keys.append({
                            "key": uploaded_table_key, 
                            "caption": f"{alert_row['weather_parameter']} forecast table for {alert_row['municipality_name']}" # Display date is implicit in table content
                        })
            else:
                if not GEOJSON_FILE_PATH:
                    print("Skipping map generation as GeoJSON_FILE_PATH is not set or file not found.")
                if full_parameter_df_for_charts is None:
                    print(f"Skipping chart generation as source data for {alert_row['weather_parameter']} is not available.")
                if not actual_s3_bucket:
                    print("Skipping chart image S3 upload as S3_BUCKET is not set.")

            # Check if bulletin with same composite_id already exists
            current_time = datetime.now()
            check_existing_sql = """
            SELECT id FROM bulletins 
            WHERE weather_forecast_alert_composite_id = %s
            """
            cur.execute(check_existing_sql, (composite_id,))
            existing_bulletin = cur.fetchone()
            
            if existing_bulletin:
                # Update existing bulletin
                bulletin_id = existing_bulletin[0]
                bulletin_update_sql = """
                UPDATE bulletins SET
                    title = %s,
                    advisory = %s,
                    hashtags = %s,
                    changed_on = %s,
                    risks = %s,
                    safety_tips = %s
                WHERE id = %s
                """
                cur.execute(bulletin_update_sql, (
                    title, # Uses formatted_display_date
                    advisory, # Uses formatted_display_date
                    hashtags,
                    current_time,
                    risks, # Uses alert_row data
                    safety_tips, # Uses alert_row data
                    bulletin_id
                ))
                print(f"Updated existing bulletin: {title} with ID: {bulletin_id}, linked to weather alert: {composite_id}")
                
                # Delete existing image attachments for this bulletin
                delete_attachments_sql = """
                DELETE FROM bulletin_image_attachments WHERE bulletin_id = %s
                """
                cur.execute(delete_attachments_sql, (bulletin_id,))
                print(f"  Deleted existing image attachments for bulletin {bulletin_id}")
            else:
                # Insert new bulletin record
                bulletin_insert_sql = """
                INSERT INTO bulletins (
                    title, advisory, hashtags, created_by_fk, 
                    created_on, changed_on, risks, safety_tips,
                    weather_forecast_alert_composite_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                cur.execute(bulletin_insert_sql, (
                    title, # Uses formatted_display_date
                    advisory, # Uses formatted_display_date
                    hashtags,
                    1, 
                    current_time,
                    current_time,
                    risks, # Uses alert_row data
                    safety_tips, # Uses alert_row data
                    composite_id  # Link to weather forecast alert using composite ID
                ))
                cur.execute("SELECT lastval()")
                bulletin_id = cur.fetchone()[0]
                print(f"Created new bulletin: {title} with ID: {bulletin_id}, linked to weather alert: {composite_id}")

            # --- Insert image attachments if any ---
            if bulletin_id and bulletin_s3_image_keys:
                attachment_insert_sql = """
                INSERT INTO bulletin_image_attachments (
                    bulletin_id, s3_key, caption, created_on, changed_on
                ) VALUES (%s, %s, %s, %s, %s)
                """
                for img_data in bulletin_s3_image_keys:
                    cur.execute(attachment_insert_sql, (
                        bulletin_id,
                        img_data["key"],
                        img_data["caption"],
                        current_time,
                        current_time
                    ))
                    print(f"  Attached image: {img_data['key']} to bulletin {bulletin_id}")
            
    print(f"Finished processing bulletins for high severity weather alerts.")

def main():
    # Process all weather files and get DataFrames
    dataframes = process_weather_files()
    
    # Print DataFrame information
    for table_name, df in dataframes.items():
        print(f"\nDataFrame for {table_name}:")
        print(df.head())
        print(f"Shape: {df.shape}")
        print(f"Schema:\n{df.schema}")
    
    # Ingest data to PostgreSQL
    ingest_to_postgresql(dataframes)

if __name__ == '__main__':
    main() 