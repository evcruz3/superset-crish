import json
from datetime import datetime
from pathlib import Path
import os
import polars as pl
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values

# Load environment variables
load_dotenv()

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
        pl.when(pl.col('value') > 42).then(pl.lit('Extreme Danger'))
          .when(pl.col('value') > 40).then(pl.lit('Danger'))
          .when(pl.col('value') >= 36).then(pl.lit('Extreme Caution'))
          .otherwise(pl.lit('Normal')).alias('alert_level'),
        pl.when(pl.col('value') > 42).then(pl.lit('Extreme Heat Index Alert'))
          .when(pl.col('value') > 40).then(pl.lit('Dangerous Heat Index Alert'))
          .when(pl.col('value') >= 36).then(pl.lit('High Heat Index Warning'))
          .otherwise(pl.lit('Normal Conditions')).alias('alert_title'),
        pl.when(pl.col('value') > 42).then(pl.lit('Heat stroke imminent. Avoid any outdoor activities.'))
          .when(pl.col('value') > 40).then(pl.lit('Heat cramps and heat exhaustion likely; heat stroke probable with continued exposure.'))
          .when(pl.col('value') >= 36).then(pl.lit('Heat cramps and heat exhaustion possible; continuing activity could result in heat stroke.'))
          .otherwise(pl.lit('No heat index alerts at this time.')).alias('alert_message'),
        pl.col('value').alias('parameter_value')
    ])

    # Rainfall Alerts
    rainfall_alerts = dataframes['rainfall_daily_weighted_average'].with_columns([
        pl.lit('Rainfall').alias('weather_parameter'),
        pl.when(pl.col('value') > 60).then(pl.lit('Extreme Danger'))
          .when(pl.col('value') > 25).then(pl.lit('Danger'))
          .when(pl.col('value') >= 15).then(pl.lit('Extreme Caution'))
          .otherwise(pl.lit('Normal')).alias('alert_level'),
        pl.when(pl.col('value') > 60).then(pl.lit('Severe Rainfall Alert'))
          .when(pl.col('value') > 25).then(pl.lit('Special Rainfall Attention'))
          .when(pl.col('value') >= 15).then(pl.lit('Rainfall Advisory'))
          .otherwise(pl.lit('Normal Rainfall Conditions')).alias('alert_title'),
        pl.when(pl.col('value') > 60).then(pl.lit('Severe rainfall expected. High risk of flooding and landslides.'))
          .when(pl.col('value') > 25).then(pl.lit('Significant rainfall expected. Be vigilant of local alerts.'))
          .when(pl.col('value') >= 15).then(pl.lit('Moderate rainfall expected. Exercise caution.'))
          .otherwise(pl.lit('No significant rainfall expected.')).alias('alert_message'),
        pl.col('value').alias('parameter_value')
    ])

    # Wind Alerts
    wind_alerts = dataframes['ws_daily_avg_region'].with_columns([
        pl.lit('Wind Speed').alias('weather_parameter'),
        pl.when(pl.col('value') > 80).then(pl.lit('Extreme Danger'))
          .when(pl.col('value') > 60).then(pl.lit('Danger'))
          .when(pl.col('value') >= 40).then(pl.lit('Extreme Caution'))
          .otherwise(pl.lit('Normal')).alias('alert_level'),
        pl.when(pl.col('value') > 80).then(pl.lit('Severe Wind Alert'))
          .when(pl.col('value') > 60).then(pl.lit('Strong Wind Warning'))
          .when(pl.col('value') >= 40).then(pl.lit('Wind Speed Advisory'))
          .otherwise(pl.lit('Calm Conditions')).alias('alert_title'),
        pl.when(pl.col('value') > 80).then(pl.lit('Extremely strong winds expected. Major damage possible.'))
          .when(pl.col('value') > 60).then(pl.lit('Strong winds expected. Secure loose objects and take precautions.'))
          .when(pl.col('value') >= 40).then(pl.lit('Moderate winds expected. Stay alert for possible disruptions.'))
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

def ingest_to_postgresql(dataframes):
    """Ingest dataframes into PostgreSQL database using Polars write_database with ADBC."""
    # Construct PostgreSQL connection URI from environment variables with fallbacks
    db_uri = (
        f"postgresql://{os.getenv('DATABASE_USER', 'superset')}:{os.getenv('DATABASE_PASSWORD', 'superset')}"
        f"@{os.getenv('DATABASE_HOST', 'db')}:{os.getenv('DATABASE_PORT', '5432')}"
        f"/{os.getenv('DATABASE_DB', 'superset')}"
    )
    
    try:
        for table_name, df in dataframes.items():
            print(f"Ingesting data to PostgreSQL for table: {table_name}")
            
            # For weather_forecast_alerts, add extra debug info
            if table_name == 'weather_forecast_alerts':
                # Count rows by weather parameter type
                param_counts = df.group_by('weather_parameter').agg(pl.count().alias('count'))
                print(f"Weather forecast alerts by parameter type:")
                print(param_counts)
                
                # Check alert level distribution
                level_counts = df.group_by(['weather_parameter', 'alert_level']).agg(pl.count().alias('count'))
                print(f"Weather forecast alerts by parameter and level:")
                print(level_counts)
            
            # Write DataFrame to database using Polars native method with ADBC
            rows_affected = df.write_database(
                table_name=table_name,
                connection=db_uri,
                if_table_exists='replace',  # This will create new or replace existing table
                engine='adbc'  # Using ADBC engine instead of SQLAlchemy
            )
            
            print(f"Successfully inserted/updated {rows_affected} rows into {table_name}")
        
        print("All data successfully ingested to PostgreSQL")
        
    except Exception as e:
        print(f"Error ingesting data to PostgreSQL: {str(e)}")

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