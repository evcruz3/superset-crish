import re
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import execute_values
import logging
from pathlib import Path
import io
import boto3
import matplotlib.pyplot as plt
import geopandas
from dotenv import load_dotenv

# Load environment variables for S3 and other configurations
load_dotenv()

# S3 Configuration from environment variables
S3_BUCKET_NAME = os.getenv("S3_BUCKET")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")
S3_ACCESS_KEY = os.getenv("MINIO_ROOT_USER")
S3_SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD")
S3_ADDRESSING_STYLE = os.getenv("S3_ADDRESSING_STYLE", "auto")

s3_client = None
if S3_BUCKET_NAME and S3_ENDPOINT_URL and S3_ACCESS_KEY and S3_SECRET_KEY:
    s3_client = boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=boto3.session.Config(s3={'addressing_style': S3_ADDRESSING_STYLE})
    )
    logging.info(f"S3 client initialized for endpoint: {S3_ENDPOINT_URL}, bucket: {S3_BUCKET_NAME}")
elif S3_BUCKET_NAME:
    s3_client = boto3.client('s3')
    logging.info(f"S3 client initialized for AWS (standard, bucket: {S3_BUCKET_NAME})")
else:
    logging.warning("S3 client not initialized. Missing S3_BUCKET or other S3 configuration variables. Image uploads will be skipped.")

# Disease Alert Level Color Mapping
DISEASE_ALERT_LEVEL_COLORS = {
    'Severe': '#FF0000',          # Red
    'High': '#FFA500',            # Orange
    'Moderate': '#FFFF00',        # Yellow
    'Low':   '#008000',           # Green
    'None': '#ADD8E6',            # Light Blue
    'Missing data': '#D3D3D3'     # Light grey
}

# --- Define GeoJSON path ---
# Standard in-container path (adjust if different for this service)
CONTAINER_GEOJSON_PATH = Path("/app/config/timorleste.geojson")
# Development/fallback path
# Adjust based on where disease_alert_generator.py is relative to the GeoJSON
# Assuming crish-disease-predictor is at the same level as superset-frontend
DEV_GEOJSON_PATH = Path(__file__).resolve().parent.parent / "superset-frontend/plugins/preset-chart-deckgl-osm/src/layers/Country/countries/timorleste.geojson"

GEOJSON_FILE_PATH = None
if CONTAINER_GEOJSON_PATH.exists():
    GEOJSON_FILE_PATH = str(CONTAINER_GEOJSON_PATH)
    logging.info(f"Using GeoJSON from container path: {GEOJSON_FILE_PATH}")
elif DEV_GEOJSON_PATH.exists():
    GEOJSON_FILE_PATH = str(DEV_GEOJSON_PATH)
    logging.info(f"Using GeoJSON from development path: {GEOJSON_FILE_PATH}")
else:
    logging.error(f"ERROR: GeoJSON file not found at container path ({CONTAINER_GEOJSON_PATH}) or development path ({DEV_GEOJSON_PATH}). Maps cannot be generated.")

# Hardcoded Disease Thresholds Data based on disease_forecast_thresholds.md
DISEASE_THRESHOLDS_DATA = {
    "Dengue": {
        "threshold_rules": [
            {"min_cases": 6, "alert_level": "Severe", "alert_title": "Severe Dengue Alert", "alert_message": "Severe dengue outbreak expected with {cases} cases. Immediate preventive action required."},
            {"min_cases": 2, "alert_level": "High", "alert_title": "High Dengue Warning", "alert_message": "High risk of dengue outbreak with {cases} cases. Community-level interventions recommended."},
            {"min_cases": 1, "alert_level": "Moderate", "alert_title": "Moderate Dengue Advisory", "alert_message": "Moderate risk with {cases} dengue cases expected. Monitor local conditions and take precautions."},
            {"min_cases": 0, "cases_condition": "< 1", "alert_level": "None", "alert_title": "No Dengue Cases Expected", "alert_message": "No significant dengue risk at this time."} # Represents < 1 case (i.e., 0 cases)
        ],
        "prevention_measures": """- Eliminate standing water where mosquitoes can breed
- Use mosquito repellent on exposed skin
- Wear long-sleeved shirts and long pants
- Use mosquito nets while sleeping
- Install screens on windows and doors""",
        "community_response": """- Community clean-up campaigns to remove breeding sites
- Public education about dengue symptoms and prevention
- Vector control measures including fogging in high-risk areas
- Enhanced surveillance and case reporting
- Ensure healthcare facilities are prepared for increased cases"""
    },
    "Diarrhea": {
        "threshold_rules": [
            {"min_cases": 100, "alert_level": "Severe", "alert_title": "Severe Diarrhea Alert", "alert_message": "Severe diarrhea outbreak expected with {cases} cases. Immediate response needed."},
            {"min_cases": 50, "alert_level": "High", "alert_title": "High Diarrhea Warning", "alert_message": "High risk of diarrhea outbreak with {cases} cases. Community action advised."},
            {"min_cases": 25, "alert_level": "Moderate", "alert_title": "Moderate Diarrhea Advisory", "alert_message": "Moderate risk with {cases} diarrhea cases expected. Monitor hygiene and water quality."},
            {"min_cases": 1, "alert_level": "Low", "alert_title": "Low Diarrhea Notice", "alert_message": "Low risk with {cases} diarrhea cases expected. Basic preventive measures recommended."},
            {"min_cases": 0, "cases_condition": "< 1", "alert_level": "None", "alert_title": "No Diarrhea Cases Expected", "alert_message": "No significant diarrhea risk at this time."} # Represents < 1 case (i.e., 0 cases)
        ],
        "prevention_measures": """- Wash hands thoroughly with soap and water, especially before handling food
- Ensure drinking water is clean and properly treated
- Cook food thoroughly and maintain proper food storage
- Practice good personal hygiene
- Maintain clean sanitation facilities""",
        "community_response": """- Water quality monitoring and treatment
- Sanitation infrastructure improvements
- Public education about hygiene practices
- Healthcare facility preparation for cases
- Clean water distribution in affected areas"""
    }
}

# --- Image Generation and Upload Functions (Adapted for Disease Data) ---

def upload_image_to_s3(image_buffer, s3_key, bucket_name):
    """
    Uploads an image buffer to S3.
    Returns the S3 key if successful, None otherwise.
    """
    if not s3_client or not bucket_name:
        logging.warning(f"S3 client or bucket name not configured. Skipping S3 upload for {s3_key}.")
        # For local testing without S3, you might return the key, but for real ops, it's None.
        # return s3_key 
        return None

    try:
        s3_client.put_object(Bucket=bucket_name, Key=s3_key, Body=image_buffer, ContentType='image/png')
        logging.info(f"Successfully uploaded {s3_key} to S3 bucket {bucket_name}.")
        return s3_key
    except Exception as e:
        logging.error(f"Error uploading {s3_key} to S3 bucket {bucket_name}: {e}", exc_info=True)
        return None

def generate_disease_map_image(
    disease_type, 
    predicted_cases, 
    alert_level, 
    municipality_name, 
    municipality_code, 
    week_start_str, # YYYY-MM-DD
    geojson_path,
    all_municipalities_predictions=None # Optional: List of dicts [{municipality_code, alert_level (actual textual level)}]
):
    """
    Generates a choropleth map image for disease forecast.
    Colors municipalities by their alert level for the specific disease.
    Highlights the target municipality.
    Args:
        all_municipalities_predictions: A list of dictionaries, where each dictionary contains
                                          at least 'municipality_code' and 'alert_level' (textual)
                                          for all municipalities to be displayed on the map.
                                          If None, only the target municipality will be colored based on its alert_level.
    """
    if not geojson_path:
        logging.error("GeoJSON path not provided. Cannot generate map.")
        return None
    try:
        gdf = geopandas.read_file(geojson_path)

        # Create a DataFrame for merging if all_municipalities_predictions is provided
        if all_municipalities_predictions:
            import pandas as pd # Import pandas here as it's only used in this block
            predictions_df = pd.DataFrame(all_municipalities_predictions)
            # Ensure municipality_code is the correct type for merging if necessary
            # gdf['ISO'] is typically string, ensure predictions_df['municipality_code'] is also string.
            predictions_df['municipality_code'] = predictions_df['municipality_code'].astype(str)
            merged_gdf = gdf.merge(predictions_df, left_on='ISO', right_on='municipality_code', how='left')
            # Map alert levels to colors, using the text alert_level from predictions_df
            merged_gdf['color'] = merged_gdf['alert_level'].map(lambda x: DISEASE_ALERT_LEVEL_COLORS.get(x, DISEASE_ALERT_LEVEL_COLORS['Missing data']))
        else:
            # If no all_municipalities_predictions, color only the target municipality
            merged_gdf = gdf.copy()
            merged_gdf['color'] = DISEASE_ALERT_LEVEL_COLORS['Missing data'] # Default for others
            if municipality_code in merged_gdf['ISO'].values:
                merged_gdf.loc[merged_gdf['ISO'] == municipality_code, 'color'] = DISEASE_ALERT_LEVEL_COLORS.get(alert_level, DISEASE_ALERT_LEVEL_COLORS['Missing data'])
            else:
                logging.warning(f"Municipality code {municipality_code} not found in GeoJSON for single coloring.")

        fig, ax = plt.subplots(1, 1, figsize=(12, 10))
        merged_gdf.plot(color=merged_gdf['color'], ax=ax, edgecolor='black', linewidth=0.5)
        
        legend_handles = []
        if disease_type in DISEASE_THRESHOLDS_DATA:
            rules = DISEASE_THRESHOLDS_DATA[disease_type]["threshold_rules"]
            # Assumes rules are typically pre-sorted (e.g., Severe to None)
            for rule in rules:
                level = rule["alert_level"]
                color = DISEASE_ALERT_LEVEL_COLORS.get(level)

                if not color:
                    logging.warning(f"Legend: Color not found for alert level '{level}' in DISEASE_ALERT_LEVEL_COLORS.")
                    continue

                threshold_text = ""
                if rule.get("cases_condition") == "< 1" and rule.get("min_cases") == 0:
                    threshold_text = "0 Case"
                elif "min_cases" in rule:
                    threshold_text = f">= {rule['min_cases']} cases"
                
                label_text = f"{level} ({threshold_text})" if threshold_text else level
                legend_handles.append(plt.Rectangle((0,0),1,1, color=color, label=label_text))
        else:
            # Fallback if disease_type has no specific rules defined
            logging.warning(f"Legend: No threshold rules found for disease_type '{disease_type}'. Generating generic legend based on available colors.")
            for level, color_val in DISEASE_ALERT_LEVEL_COLORS.items():
                if level != 'Missing data': # 'Missing data' handled separately below
                     legend_handles.append(plt.Rectangle((0,0),1,1, color=color_val, label=level))
        
        # Add 'Missing data' to legend if relevant
        missing_data_color = DISEASE_ALERT_LEVEL_COLORS.get('Missing data')
        if missing_data_color and \
           (merged_gdf['color'].eq(missing_data_color).any() or not all_municipalities_predictions):
             legend_handles.append(
                 plt.Rectangle((0,0),1,1, 
                               color=missing_data_color, 
                               label='Missing data')
            )

        ax.legend(handles=legend_handles, title=f"{disease_type} Alert Levels & Thresholds", loc="lower right")

        highlight_gdf = merged_gdf[merged_gdf['ISO'] == municipality_code]
        if not highlight_gdf.empty:
            highlight_gdf.plot(ax=ax, facecolor='none', edgecolor='blue', linewidth=2.5, linestyle='--')
        else:
            logging.warning(f"Municipality code {municipality_code} not found in GeoJSON for highlighting.")

        try:
            parsed_week_start_date = datetime.strptime(week_start_str, '%Y-%m-%d')
            # Assuming a week, so we can format a week period string
            week_end_dt = parsed_week_start_date + timedelta(days=6)
            if parsed_week_start_date.year != week_end_dt.year:
                formatted_week_period = f"{parsed_week_start_date.strftime('%d %B, %Y')} - {week_end_dt.strftime('%d %B, %Y')}"
            elif parsed_week_start_date.month != week_end_dt.month:
                formatted_week_period = f"{parsed_week_start_date.strftime('%d %B')} - {week_end_dt.strftime('%d %B, %Y')}"
            else:
                formatted_week_period = f"{parsed_week_start_date.strftime('%d')} - {week_end_dt.strftime('%d %B, %Y')}"
        except ValueError:
            formatted_week_period = f"Week starting {week_start_str}" # Fallback
            logging.warning(f"Could not parse week_start_str {week_start_str} for title formatting.")

        ax.set_title(f'{disease_type} Forecast for Timor-Leste - Week of {formatted_week_period}\n{alert_level} Alert in {municipality_name} (Cases: {predicted_cases})', fontsize=15)
        ax.set_axis_off()
        plt.tight_layout()

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=100)
        plt.close(fig)
        img_buffer.seek(0)
        return img_buffer
    except Exception as e:
        logging.error(f"Error generating disease map image for {disease_type} in {municipality_name}: {e}", exc_info=True)
        return None

def generate_disease_table_image(
    disease_type, 
    municipality_name, 
    week_start_str,      # YYYY-MM-DD, start of the week this prediction is for
    predicted_cases_current_week, # Prediction for the week_start_str
    # Optional: if you have data for several weeks to show in a table for context
    # historical_weekly_cases=None, # List of tuples [(week_start_str, cases)] 
    # forecast_next_week_cases=None   # Tuple (next_week_start_str, cases)
):
    """
    Generates an image of a table with disease forecast data.
    Currently shows prediction for one week. Extendable for more data.
    """
    try:
        table_data = []
        # Format current week prediction
        try:
            current_week_start_dt = datetime.strptime(week_start_str, '%Y-%m-%d')
            current_week_end_dt = current_week_start_dt + timedelta(days=6)
            if current_week_start_dt.year != current_week_end_dt.year:
                current_week_label = f"{current_week_start_dt.strftime('%d %B, %Y')} - {current_week_end_dt.strftime('%d %B, %Y')}"
            elif current_week_start_dt.month != current_week_end_dt.month:
                current_week_label = f"{current_week_start_dt.strftime('%d %B')} - {current_week_end_dt.strftime('%d %B, %Y')}"
            else:
                current_week_label = f"{current_week_start_dt.strftime('%d')} - {current_week_end_dt.strftime('%d %B, %Y')}"
        except ValueError:
            current_week_label = f"Week starting {week_start_str}"
        
        table_data.append([current_week_label, str(predicted_cases_current_week)])

        # Placeholder for adding more rows if historical/next_week_forecast data is passed
        # e.g., if historical_weekly_cases:
        #     for hist_week_start, hist_cases in sorted(historical_weekly_cases, key=lambda x: x[0]):
        #         # format hist_week_start similar to current_week_label
        #         table_data.append([formatted_hist_week_label, str(hist_cases)])
        
        # e.g., if forecast_next_week_cases:
        #         # format next_week_start_str similar to current_week_label
        #         table_data.append([formatted_next_week_label, str(forecast_next_week_cases[1])])

        if not table_data:
            logging.warning(f"No data for {municipality_name} for table generation of {disease_type}.")
            return None

        num_rows = len(table_data)
        fig_height = max(2, num_rows * 0.5 + 1) # Adjust height based on rows

        fig, ax = plt.subplots(figsize=(8, fig_height))
        ax.axis('tight')
        ax.axis('off')
        
        col_labels = ['Forecast Week', f'Predicted {disease_type} Cases']
        
        table = ax.table(cellText=table_data, colLabels=col_labels, cellLoc='center', loc='center')
        table.auto_set_font_size(False)
        table.set_fontsize(10)
        table.scale(1.2, 1.2)

        ax.set_title(f'{disease_type} Case Forecast for {municipality_name}', fontsize=12, pad=20)
        
        plt.tight_layout()
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=100)
        plt.close(fig)
        img_buffer.seek(0)
        return img_buffer
    except Exception as e:
        logging.error(f"Error generating disease table image for {disease_type} in {municipality_name}: {e}", exc_info=True)
        return None

# --- End of Image Generation and Upload Functions ---

def get_iso_code_for_municipality(municipality_name, municipality_iso_codes):
    """Helper to get ISO code, case-insensitive and handles common variations."""
    # Normalize the input name (e.g. "Liquiçá" to "Liquica") for matching
    normalized_name = municipality_name.replace('ç', 'c').replace('é', 'e').lower()
    for name, code in municipality_iso_codes.items():
        if name.replace('ç', 'c').replace('é', 'e').lower() == normalized_name:
            return code
    return municipality_iso_codes.get(municipality_name, '') # Fallback to direct match

def generate_disease_alert(
    disease_type, 
    predicted_cases, 
    municipality_name, 
    forecast_date_str, # Expected format YYYY-MM-DD
    week_start_str,    # Expected format YYYY-MM-DD
    week_end_str,      # Expected format YYYY-MM-DD
    municipality_iso_code 
):
    """
    Generates an alert for a given disease prediction.

    Args:
        disease_type (str): "Dengue" or "Diarrhea".
        predicted_cases (int): The number of predicted cases.
        municipality_name (str): Name of the municipality.
        forecast_date_str (str): The date the forecast was made (YYYY-MM-DD).
        week_start_str (str): Start date of the forecast week (YYYY-MM-DD).
        week_end_str (str): End date of the forecast week (YYYY-MM-DD).
        municipality_iso_code (str): ISO code for the municipality.

    Returns:
        dict: Alert data, or None if no alert is triggered.
    """
    if disease_type not in DISEASE_THRESHOLDS_DATA:
        print(f"Warning: No threshold data found for disease type '{disease_type}'")
        return None

    # Rules are pre-sorted by min_cases descending in the hardcoded data
    rules = DISEASE_THRESHOLDS_DATA[disease_type]["threshold_rules"]
    
    selected_rule = None
    for rule in rules:
        # Handle the "< 1" case (min_cases: 0)
        if rule["min_cases"] == 0 and "cases_condition" in rule and rule["cases_condition"] == "< 1":
            if predicted_cases < 1: # This specifically means 0 predicted cases
                selected_rule = rule
                break
        # Handle other cases (>= min_cases)
        elif predicted_cases >= rule["min_cases"]:
            selected_rule = rule
            break
            
    if not selected_rule or selected_rule["alert_level"].lower() == "none":
        return None # No significant risk or "None" alert level

    return {
        "disease_type": disease_type,
        "predicted_cases": predicted_cases,
        "municipality_name": municipality_name,
        "municipality_code": municipality_iso_code,
        "forecast_date": forecast_date_str, # This is the date the prediction was generated
        "week_start": week_start_str,       # This is the start of the week the prediction is FOR
        "week_end": week_end_str,           # This is the end of the week the prediction is FOR
        "alert_level": selected_rule["alert_level"],
        "alert_title_template": selected_rule["alert_title"],
        "alert_message_template": selected_rule["alert_message"],
    }

def create_and_ingest_disease_forecast_alerts(list_of_alerts, db_params):
    """
    Creates the disease_forecast_alerts table (dropping if exists) and ingests alert data.
    Returns a mapping of alert data to their database IDs for linking to bulletins.
    
    Returns:
        dict: Mapping of alert tuple to database ID for linking bulletins
              Key: (municipality_code, forecast_date, disease_type, municipality_name)
              Value: database ID
    """
    if not list_of_alerts:
        print("No disease alerts to process for disease_forecast_alerts table.")
        return {}

    alerts_to_insert = []
    alert_mapping = {}  # Will store (alert_data_dict, insert_index) for later ID mapping
    
    for i, alert_data in enumerate(list_of_alerts):
        if not alert_data: # Skip if generate_disease_alert returned None
            continue

        formatted_title = alert_data["alert_title_template"].format(cases=alert_data["predicted_cases"])
        formatted_message = alert_data["alert_message_template"].format(cases=alert_data["predicted_cases"])

        alert_tuple = (
            alert_data["municipality_code"],
            alert_data["week_start"],  # This is the forecast_date for the table
            alert_data["disease_type"],
            alert_data["alert_level"],
            formatted_title,
            formatted_message,
            alert_data["predicted_cases"],
            alert_data["municipality_name"]
        )
        
        alerts_to_insert.append(alert_tuple)
        
        # Create key for mapping back to alert_data
        alert_key = (
            alert_data["municipality_code"],
            alert_data["week_start"],
            alert_data["disease_type"],
            alert_data["municipality_name"]
        )
        alert_mapping[alert_key] = {"alert_data": alert_data, "insert_index": len(alerts_to_insert) - 1}
    
    if not alerts_to_insert:
        print("No valid alert data to insert into disease_forecast_alerts table.")
        return {}

    conn = None
    alert_id_mapping = {}
    
    try:
        conn = psycopg2.connect(**db_params)
        with conn.cursor() as cur:
            # 1. Create table only if it doesn't exist
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS disease_forecast_alerts (
                id SERIAL PRIMARY KEY,
                municipality_code TEXT,
                forecast_date DATE, -- Stores week_start
                disease_type TEXT,
                alert_level TEXT,
                alert_title TEXT,
                alert_message TEXT,
                predicted_cases INTEGER,
                municipality_name TEXT,
                -- Add a constraint to help identify unique alerts if needed later
                UNIQUE (municipality_code, forecast_date, disease_type, municipality_name)
            );
            """
            cur.execute(create_table_sql)
            print("Checked/Created table disease_forecast_alerts.")

            # 2. Delete existing records for the specific alerts being inserted
            keys_to_delete = set()
            for alert_tuple in alerts_to_insert:
                key = (alert_tuple[0], alert_tuple[1], alert_tuple[2])
                keys_to_delete.add(key)
            
            delete_count = 0
            if keys_to_delete:
                delete_sql_base = "DELETE FROM disease_forecast_alerts WHERE municipality_code = %s AND forecast_date = %s AND disease_type = %s;"
                delete_sql_null_code = "DELETE FROM disease_forecast_alerts WHERE municipality_code IS NULL AND forecast_date = %s AND disease_type = %s;"
                for muni_code, f_date, d_type in keys_to_delete:
                    if muni_code is None:
                        cur.execute(delete_sql_null_code, (f_date, d_type))
                    else:
                        cur.execute(delete_sql_base, (muni_code, f_date, d_type))
                    delete_count += cur.rowcount
                print(f"Deleted {delete_count} existing alert records before insertion.")

            # 3. Insert the new data and get the IDs
            insert_sql = """
            INSERT INTO disease_forecast_alerts (
                municipality_code, forecast_date, disease_type, alert_level, 
                alert_title, alert_message, predicted_cases, municipality_name
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """
            
            # Insert one by one to get IDs
            for i, alert_tuple in enumerate(alerts_to_insert):
                cur.execute(insert_sql, alert_tuple)
                alert_id = cur.fetchone()[0]
                
                # Find the corresponding alert_key for this insert
                for alert_key, mapping_data in alert_mapping.items():
                    if mapping_data["insert_index"] == i:
                        alert_id_mapping[alert_key] = alert_id
                        break
            
            conn.commit()
            print(f"Successfully inserted {len(alerts_to_insert)} rows into disease_forecast_alerts.")
            return alert_id_mapping

    except psycopg2.errors.UniqueViolation as uve:
        print(f"Database unique constraint violation: {uve}")
        print("This might happen if multiple alerts for the same key were generated in this run. Check alert generation logic.")
        if conn:
            conn.rollback()
        return {}
    except psycopg2.DatabaseError as e:
        print(f"Database error during disease_forecast_alerts ingestion: {e}")
        if conn:
            conn.rollback()
        return {}
    except Exception as e:
        print(f"Error ingesting data to disease_forecast_alerts: {e}")
        if conn:
            conn.rollback()
        return {}
    finally:
        if conn:
            conn.close()

def create_and_ingest_bulletins(list_of_alerts, db_params, disease_threshold_data=DISEASE_THRESHOLDS_DATA, all_predictions_for_map=None, alert_id_mapping=None):
    """
    Creates bulletins from alerts, generates images, uploads them, and ingests all into the PostgreSQL database.

    Args:
        list_of_alerts (list): A list of alert data dictionaries from generate_disease_alert.
        db_params (dict): Database connection parameters.
        disease_threshold_data (dict): Parsed threshold data.
        all_predictions_for_map (dict): Optional. A dictionary where keys are disease types (e.g., "Dengue", "Diarrhea")
                                        and values are lists of alert data for all municipalities for that disease.
        alert_id_mapping (dict): Optional. Mapping of alert keys to database IDs from disease_forecast_alerts.
                                Key: (municipality_code, forecast_date, disease_type, municipality_name)
                                Value: database ID
    """
    if not list_of_alerts:
        logging.info("No disease alerts to process for bulletins.")
        return

    conn = None
    try:
        conn = psycopg2.connect(**db_params)
        conn.autocommit = False # Use a transaction
        with conn.cursor() as cur:
            # Ensure bulletin_image_attachments table exists
            cur.execute("""
            CREATE TABLE IF NOT EXISTS bulletin_image_attachments (
                id SERIAL PRIMARY KEY,
                bulletin_id INTEGER REFERENCES bulletins(id) ON DELETE CASCADE,
                s3_key TEXT NOT NULL,
                caption TEXT,
                created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                changed_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            """)
            logging.info("Checked/Created table bulletin_image_attachments.")

            bulletin_insert_sql = """
            INSERT INTO bulletins (
                title, advisory, hashtags, created_by_fk, 
                created_on, changed_on, risks, safety_tips, disease_forecast_alert_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
            """
            attachment_insert_sql = """
            INSERT INTO bulletin_image_attachments (
                bulletin_id, s3_key, caption, created_on, changed_on
            ) VALUES (%s, %s, %s, %s, %s);
            """

            bulletins_created_count = 0
            for alert_data in list_of_alerts:
                if not alert_data:
                    continue

                disease_type = alert_data["disease_type"]
                municipality_name = alert_data["municipality_name"]
                municipality_code = alert_data["municipality_code"]
                predicted_cases = alert_data["predicted_cases"]
                alert_level = alert_data["alert_level"]
                week_start_for_alert = alert_data["week_start"] # YYYY-MM-DD
                
                # Get the disease_forecast_alert_id if mapping is provided
                disease_forecast_alert_id = None
                if alert_id_mapping:
                    alert_key = (
                        municipality_code,
                        week_start_for_alert,
                        disease_type,
                        municipality_name
                    )
                    disease_forecast_alert_id = alert_id_mapping.get(alert_key)
                    if disease_forecast_alert_id:
                        logging.info(f"Linking bulletin to disease_forecast_alert ID: {disease_forecast_alert_id}")
                    else:
                        logging.warning(f"No disease_forecast_alert_id found for {alert_key}")
                
                # Format dates for titles and messages
                try:
                    forecast_week_start_dt = datetime.strptime(week_start_for_alert, '%Y-%m-%d')
                    forecast_week_end_dt = forecast_week_start_dt + timedelta(days=6)
                    generated_on_dt = datetime.strptime(alert_data["forecast_date"], '%Y-%m-%d')

                    generated_on_str = generated_on_dt.strftime('%d %B, %Y')

                    if forecast_week_start_dt.year != forecast_week_end_dt.year:
                        week_period_str = f"{forecast_week_start_dt.strftime('%d %B, %Y')} - {forecast_week_end_dt.strftime('%d %B, %Y')}"
                    elif forecast_week_start_dt.month != forecast_week_end_dt.month:
                        week_period_str = f"{forecast_week_start_dt.strftime('%d %B')} - {forecast_week_end_dt.strftime('%d %B, %Y')}"
                    else:
                        week_period_str = f"{forecast_week_start_dt.strftime('%d')} - {forecast_week_end_dt.strftime('%d %B, %Y')}"
                except ValueError as e:
                    logging.warning(f"Error parsing date for bulletin title/advisory: {e}. Using raw dates.")
                    week_period_str = f"{week_start_for_alert} to {alert_data['week_end']}"
                    generated_on_str = alert_data["forecast_date"]

                title = alert_data["alert_title_template"].format(cases=predicted_cases) + f" in {municipality_name} for week of {week_period_str}"
                advisory = (
                    f"{alert_data['alert_message_template'].format(cases=predicted_cases)}\n\n"
                    f"Forecast for week: {week_period_str} (Predicted cases: {predicted_cases}).\n"
                    f"This forecast was generated on {generated_on_str}."
                )
                risks = f"Potential for increased {disease_type.lower()} transmission and associated health impacts. "
                if disease_type in disease_threshold_data and "community_response" in disease_threshold_data[disease_type]:
                    risks += "\n\nCommunity Response Guidance:\n" + disease_threshold_data[disease_type]["community_response"]
                safety_tips = ""
                if disease_type in disease_threshold_data and "prevention_measures" in disease_threshold_data[disease_type]:
                    safety_tips = "Prevention Measures:\n" + disease_threshold_data[disease_type]["prevention_measures"]
                hashtags = f"disease,alert,{disease_type.lower()},{municipality_name.lower().replace(' ', '')},{alert_level.lower()}"
                current_time = datetime.now()

                bulletin_id = None
                try:
                    cur.execute(bulletin_insert_sql, (
                        title, advisory, hashtags, 1, current_time, current_time, risks, safety_tips, disease_forecast_alert_id
                    ))
                    bulletin_id = cur.fetchone()[0]
                    bulletins_created_count += 1
                    logging.info(f"Inserted bulletin ID {bulletin_id} for {disease_type} in {municipality_name}" + 
                               (f" linked to disease_forecast_alert ID {disease_forecast_alert_id}" if disease_forecast_alert_id else " (no alert link)"))
                except Exception as e:
                    logging.error(f"Error inserting bulletin for {disease_type} in {municipality_name}: {e}", exc_info=True)
                    conn.rollback() # Rollback this specific bulletin insertion attempt
                    continue # Skip to next alert

                if bulletin_id and S3_BUCKET_NAME and GEOJSON_FILE_PATH:
                    bulletin_s3_image_keys = []
                    map_image_buffer = None
                    table_image_buffer = None
                    
                    # Prepare data for map: list of all predictions for THIS disease type
                    all_preds_for_map_type = []
                    if all_predictions_for_map and disease_type in all_predictions_for_map:
                        all_preds_for_map_type = all_predictions_for_map[disease_type]

                    # 1. Disease Map Image
                    map_image_buffer = generate_disease_map_image(
                        disease_type, predicted_cases, alert_level, 
                        municipality_name, municipality_code, week_start_for_alert, 
                        GEOJSON_FILE_PATH, all_municipalities_predictions=all_preds_for_map_type
                    )
                    if map_image_buffer:
                        map_s3_key = f"bulletin_charts/disease_map_{week_start_for_alert}_{disease_type.replace(' ', '_')}_{municipality_code}_{current_time.strftime('%Y%m%d%H%M%S%f')}.png"
                        uploaded_map_key = upload_image_to_s3(map_image_buffer, map_s3_key, S3_BUCKET_NAME)
                        if uploaded_map_key:
                            bulletin_s3_image_keys.append({
                                "key": uploaded_map_key,
                                "caption": f"{disease_type} forecast map for {municipality_name}, week of {week_period_str}"
                            })
                    
                    # 2. Disease Table Image
                    table_image_buffer = generate_disease_table_image(
                        disease_type, municipality_name, week_start_for_alert, predicted_cases
                        # Add historical/next_week data here if available and function is extended
                    )
                    if table_image_buffer:
                        table_s3_key = f"bulletin_charts/disease_table_{week_start_for_alert}_{disease_type.replace(' ', '_')}_{municipality_code}_{current_time.strftime('%Y%m%d%H%M%S%f')}.png"
                        uploaded_table_key = upload_image_to_s3(table_image_buffer, table_s3_key, S3_BUCKET_NAME)
                        if uploaded_table_key:
                            bulletin_s3_image_keys.append({
                                "key": uploaded_table_key,
                                "caption": f"{disease_type} case forecast table for {municipality_name}, week of {week_period_str}"
                            })

                    # Insert image attachments
                    if bulletin_s3_image_keys:
                        for img_data in bulletin_s3_image_keys:
                            try:
                                cur.execute(attachment_insert_sql, (
                                    bulletin_id, img_data["key"], img_data["caption"], current_time, current_time
                                ))
                                logging.info(f"  Attached image {img_data['key']} to bulletin {bulletin_id}")
                            except Exception as e:
                                logging.error(f"Error attaching image {img_data['key']} to bulletin {bulletin_id}: {e}", exc_info=True)
                    
                elif not S3_BUCKET_NAME:
                    logging.warning(f"S3_BUCKET_NAME not set. Skipping image generation/upload for bulletin ID {bulletin_id}.")
                elif not GEOJSON_FILE_PATH:
                    logging.warning(f"GEOJSON_FILE_PATH not set. Skipping map image generation for bulletin ID {bulletin_id}.")
            
            if bulletins_created_count > 0:
                conn.commit()
                logging.info(f"Successfully processed and inserted {bulletins_created_count} disease bulletins and their attachments.")
            else:
                logging.info("No new disease bulletins were created in this run.")
                conn.rollback() # Rollback if nothing was actually committed (e.g. table creation only)

    except psycopg2.DatabaseError as e:
        logging.error(f"Database error during bulletin processing: {e}", exc_info=True)
        if conn:
            conn.rollback()
    except Exception as e:
        logging.error(f"General error during bulletin processing: {e}", exc_info=True)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

def record_disease_pipeline_run(
    db_params,
    pipeline_name: str,
    status: str,
    details: str = "",
    municipalities_processed_count: int = 0,
    alerts_generated_count: int = 0,
    bulletins_created_count: int = 0
):
    """Records the outcome of a disease prediction pipeline run into the database."""
    conn = None
    try:
        conn = psycopg2.connect(**db_params)
        with conn.cursor() as cur:
            # Check if table exists and create if not
            cur.execute("""
            SELECT EXISTS (
               SELECT FROM information_schema.tables 
               WHERE table_name = 'disease_pipeline_run_history'
            );
            """)
            table_exists = cur.fetchone()[0]

            if not table_exists:
                logging.info("Creating disease_pipeline_run_history table")
                cur.execute("""
                CREATE TABLE disease_pipeline_run_history (
                    id SERIAL PRIMARY KEY,
                    ran_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    pipeline_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    details TEXT,
                    municipalities_processed_count INTEGER DEFAULT 0,
                    alerts_generated_count INTEGER DEFAULT 0,
                    bulletins_created_count INTEGER DEFAULT 0
                );
                """)
                conn.commit()
                logging.info("Table disease_pipeline_run_history created successfully.")
            
            # Insert the run history record
            sql = """
            INSERT INTO disease_pipeline_run_history (
                pipeline_name, status, details, 
                municipalities_processed_count, alerts_generated_count, bulletins_created_count
            ) VALUES (%s, %s, %s, %s, %s, %s);
            """
            cur.execute(sql, (
                pipeline_name,
                status,
                details,
                municipalities_processed_count,
                alerts_generated_count,
                bulletins_created_count
            ))
            conn.commit()
            logging.info(f"Successfully recorded disease pipeline run: {pipeline_name} - {status}")

    except Exception as e:
        logging.error(f"Failed to record disease pipeline run history for {pipeline_name}: {str(e)}")
        # logging.exception("Full error traceback for pipeline run recording:") # Optional: for more detail
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # Example usage (for testing the functions with hardcoded data)
    print("DISEASE_THRESHOLDS_DATA Loaded.")
    # print(json.dumps(DISEASE_THRESHOLDS_DATA, indent=2)) # Requires json import for full dump

    if "Dengue" in DISEASE_THRESHOLDS_DATA:
        print("\\n--- Dengue Data (from hardcoded dict) ---")
        print(f"Prevention Measures (first 50 chars): {DISEASE_THRESHOLDS_DATA['Dengue']['prevention_measures'][:50]}...")
        print(f"Community Response (first 50 chars): {DISEASE_THRESHOLDS_DATA['Dengue']['community_response'][:50]}...")
        print("Threshold Rules:")
        for rule in DISEASE_THRESHOLDS_DATA["Dengue"]["threshold_rules"]:
            print(rule)
    
    if "Diarrhea" in DISEASE_THRESHOLDS_DATA:
        print("\\n--- Diarrhea Data (from hardcoded dict) ---")
        print(f"Prevention Measures (first 50 chars): {DISEASE_THRESHOLDS_DATA['Diarrhea']['prevention_measures'][:50]}...")
        print(f"Community Response (first 50 chars): {DISEASE_THRESHOLDS_DATA['Diarrhea']['community_response'][:50]}...")
        print("Threshold Rules:")
        for rule in DISEASE_THRESHOLDS_DATA["Diarrhea"]["threshold_rules"]:
            print(rule)

    # Test alert generation
    mock_municipality_iso_codes = {
            'Aileu': 'TL-AL', 'Ainaro': 'TL-AN', 'Atauro': 'TL-AT', 'Baucau': 'TL-BA',
            'Bobonaro': 'TL-BO', 'Covalima': 'TL-CO', 'Dili': 'TL-DI', 'Ermera': 'TL-ER',
            'Lautem': 'TL-LA', 'Liquica': 'TL-LI', 'Liquiçá': 'TL-LI', 'Manatuto': 'TL-MT',
            'Manufahi': 'TL-MF', 'Raeoa': 'TL-OE', # Assuming Raeoa is Oecusse
            'Viqueque': 'TL-VI'
    }
    
    test_alerts = []
    # Test cases for Dengue
    test_alerts.append(generate_disease_alert("Dengue", 150, "Dili", "2023-10-01", "2023-10-02", "2023-10-08", get_iso_code_for_municipality("Dili", mock_municipality_iso_codes))) # Severe
    test_alerts.append(generate_disease_alert("Dengue", 75, "Baucau", "2023-10-01", "2023-10-02", "2023-10-08", get_iso_code_for_municipality("Baucau", mock_municipality_iso_codes))) # High
    test_alerts.append(generate_disease_alert("Dengue", 30, "Aileu", "2023-10-01", "2023-10-02", "2023-10-08", get_iso_code_for_municipality("Aileu", mock_municipality_iso_codes))) # Moderate
    test_alerts.append(generate_disease_alert("Dengue", 5, "Manatuto", "2023-10-01", "2023-10-02", "2023-10-08", get_iso_code_for_municipality("Manatuto", mock_municipality_iso_codes))) # Low
    test_alerts.append(generate_disease_alert("Dengue", 0, "Ermera", "2023-10-01", "2023-10-02", "2023-10-08", get_iso_code_for_municipality("Ermera", mock_municipality_iso_codes))) # None
    
    # Test cases for Diarrhea
    test_alerts.append(generate_disease_alert("Diarrhea", 110, "Covalima", "2023-10-01", "2023-10-02", "2023-10-08", get_iso_code_for_municipality("Covalima", mock_municipality_iso_codes))) # Severe
    test_alerts.append(generate_disease_alert("Diarrhea", 0, "Viqueque", "2023-10-01", "2023-10-02", "2023-10-08", get_iso_code_for_municipality("Viqueque", mock_municipality_iso_codes))) # None


    print("\\n--- Generated Test Alerts (should filter out None) ---")
    active_alerts = [alert for alert in test_alerts if alert is not None]
    for alert in active_alerts:
        print(alert)

    # Example of creating and ingesting bulletins (requires DB setup and .env)
    # This part would typically be run from the predictor scripts with actual DB params.
    # For standalone testing, you'd need to set up db_params.
    # print("\\n--- Testing Bulletin Ingestion (Example - DB connection required) ---")
    # test_db_params = {
    #     'dbname': os.getenv('DATABASE_DB'),
    #     'user': os.getenv('DATABASE_USER'),
    #     'password': os.getenv('DATABASE_PASSWORD'),
    #     'host': os.getenv('DATABASE_HOST'),
    #     'port': os.getenv('DATABASE_PORT', '5432')
    # }
    # # Ensure all required env vars are present for testing DB connection
    # if all(test_db_params.values()) and active_alerts : # Check if db_params are set and there are alerts
    #      create_and_ingest_bulletins(active_alerts, test_db_params)
    # else:
    #      if not all(test_db_params.values()):
    #          print("Skipping bulletin ingestion test: DB parameters not fully configured in .env")
    #      if not active_alerts:
    #          print("Skipping bulletin ingestion test: No active alerts to ingest.") 

    # Test new function for disease_forecast_alerts table
    # print("\\n--- Testing disease_forecast_alerts Ingestion (Example - DB connection required) ---")
    # if all(test_db_params.values()) and active_alerts:
    #     create_and_ingest_disease_forecast_alerts(active_alerts, test_db_params)
    # else:
    #     if not all(test_db_params.values()):
    #         print("Skipping disease_forecast_alerts ingestion test: DB parameters not fully configured in .env")
    #     if not active_alerts:
    #          print("Skipping disease_forecast_alerts ingestion test: No active alerts to ingest.") 