import re
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_values
import logging

# Hardcoded Disease Thresholds Data based on disease_forecast_thresholds.md
DISEASE_THRESHOLDS_DATA = {
    "Dengue": {
        "threshold_rules": [
            {"min_cases": 100, "alert_level": "Severe", "alert_title": "Severe Dengue Alert", "alert_message": "Severe dengue outbreak expected with {cases} cases. Immediate preventive action required."},
            {"min_cases": 50, "alert_level": "High", "alert_title": "High Dengue Warning", "alert_message": "High risk of dengue outbreak with {cases} cases. Community-level interventions recommended."},
            {"min_cases": 25, "alert_level": "Moderate", "alert_title": "Moderate Dengue Advisory", "alert_message": "Moderate risk with {cases} dengue cases expected. Monitor local conditions and take precautions."},
            {"min_cases": 1, "alert_level": "Low", "alert_title": "Low Dengue Notice", "alert_message": "Low risk with {cases} dengue cases expected. Preventive measures advised."},
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

def create_and_ingest_bulletins(list_of_alerts, db_params, disease_threshold_data=DISEASE_THRESHOLDS_DATA):
    """
    Creates bulletins from alerts and ingests them into the PostgreSQL database.

    Args:
        list_of_alerts (list): A list of alert data dictionaries from generate_disease_alert.
        db_params (dict): Database connection parameters.
        disease_threshold_data (dict): Parsed threshold data.
    """
    if not list_of_alerts:
        print("No disease alerts to process for bulletins.")
        return

    bulletins_to_insert = []

    for alert_data in list_of_alerts:
        if not alert_data:
            continue

        disease_type = alert_data["disease_type"]
        municipality_name = alert_data["municipality_name"]
        predicted_cases = alert_data["predicted_cases"]
        
        # Format dates for titles and messages
        try:
            # The bulletin refers to the week the forecast is FOR
            forecast_week_start_dt = datetime.strptime(alert_data["week_start"], '%Y-%m-%d')
            # formatted_week_start = forecast_week_start_dt.strftime('%B %d, %Y') # Not directly used in title
            forecast_week_end_dt = datetime.strptime(alert_data["week_end"], '%Y-%m-%d')
            # formatted_week_end = forecast_week_end_dt.strftime('%B %d, %Y') # Not directly used in title
            
            # If start and end month are the same, format as "Month Day1-Day2, Year"
            # Otherwise, "Month1 Day1 - Month2 Day2, Year" (assuming year is same)
            if forecast_week_start_dt.month == forecast_week_end_dt.month:
                week_period_str = f"{forecast_week_start_dt.strftime('%B %d')}-{forecast_week_end_dt.strftime('%d, %Y')}"
            else:
                week_period_str = f"{forecast_week_start_dt.strftime('%B %d')} - {forecast_week_end_dt.strftime('%B %d, %Y')}"

        except ValueError as e:
            print(f"Error parsing date for bulletin: {e}. Using raw dates.")
            week_period_str = f"{alert_data['week_start']} to {alert_data['week_end']}"

        # Create bulletin title and advisory
        title = alert_data["alert_title_template"].format(cases=predicted_cases) + f" in {municipality_name} for week of {week_period_str}"
        advisory = (
            f"{alert_data['alert_message_template'].format(cases=predicted_cases)}\\n\\n"
            f"Forecast for week: {week_period_str} (Predicted cases: {predicted_cases}).\\n"
            f"This forecast was generated on {alert_data['forecast_date']}."
        )

        # Get risks and safety tips
        risks = f"Potential for increased {disease_type.lower()} transmission and associated health impacts. "
        if disease_type in disease_threshold_data and "community_response" in disease_threshold_data[disease_type]:
            risks += "\\n\\nCommunity Response Guidance:\\n" + disease_threshold_data[disease_type]["community_response"]
        
        safety_tips = ""
        if disease_type in disease_threshold_data and "prevention_measures" in disease_threshold_data[disease_type]:
            safety_tips = "Prevention Measures:\\n" + disease_threshold_data[disease_type]["prevention_measures"]
        
        hashtags = f"disease,alert,{disease_type.lower()},{municipality_name.lower().replace(' ', '')},{alert_data['alert_level'].lower()}"

        # Ensure this tuple matches the schema in transform_weather_data.py
        bulletins_to_insert.append((
            title,
            advisory,
            hashtags,
            1,  # created_by_fk (Admin user ID)
            datetime.now(), # created_on
            datetime.now(), # changed_on
            risks,
            safety_tips
        ))

    if not bulletins_to_insert:
        print("No valid bulletins generated.")
        return

    # Ingest into PostgreSQL
    conn = None
    try:
        conn = psycopg2.connect(**db_params)
        conn.autocommit = False # Use a transaction
        with conn.cursor() as cur:
            # This SQL statement and columns MUST match transform_weather_data.py
            sql = """
            INSERT INTO bulletins (
                title, advisory, hashtags, created_by_fk, 
                created_on, changed_on, risks, safety_tips
            ) VALUES %s
            """
            # Using execute_values for batch insert
            execute_values(cur, sql, bulletins_to_insert, page_size=100)
            conn.commit()
            print(f"Successfully inserted {len(bulletins_to_insert)} disease bulletins into the database.")

    except psycopg2.DatabaseError as e:
        print(f"Database error during bulletin ingestion: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"Error ingesting disease bulletins to PostgreSQL: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

def create_and_ingest_disease_forecast_alerts(list_of_alerts, db_params):
    """
    Creates the disease_forecast_alerts table (dropping if exists) and ingests alert data.
    Schema is based on weather_forecast_alerts:
    - municipality_code (TEXT)
    - forecast_date (DATE) -> from alert_data["week_start"]
    - disease_type (TEXT) -> from alert_data["disease_type"]
    - alert_level (TEXT)
    - alert_title (TEXT) -> formatted
    - alert_message (TEXT) -> formatted
    - predicted_cases (INTEGER) -> from alert_data["predicted_cases"]
    - municipality_name (TEXT)
    """
    if not list_of_alerts:
        print("No disease alerts to process for disease_forecast_alerts table.")
        return

    alerts_to_insert = []
    for alert_data in list_of_alerts:
        if not alert_data: # Skip if generate_disease_alert returned None
            continue

        formatted_title = alert_data["alert_title_template"].format(cases=alert_data["predicted_cases"])
        formatted_message = alert_data["alert_message_template"].format(cases=alert_data["predicted_cases"])

        alerts_to_insert.append((
            alert_data["municipality_code"],
            alert_data["week_start"],  # This is the forecast_date for the table
            alert_data["disease_type"],
            alert_data["alert_level"],
            formatted_title,
            formatted_message,
            alert_data["predicted_cases"],
            alert_data["municipality_name"]
        ))
    
    if not alerts_to_insert:
        print("No valid alert data to insert into disease_forecast_alerts table.")
        return

    conn = None
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
            # This prevents duplicates if the script runs again for the same period
            # Group alerts by their unique key (municipality, date, type) to minimize DELETE statements
            keys_to_delete = set()
            for alert_tuple in alerts_to_insert:
                # Extract key fields (municipality_code, forecast_date, disease_type)
                # Indices: 0=muni_code, 1=forecast_date, 2=disease_type
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
                    delete_count += cur.rowcount # Accumulate number of deleted rows
                print(f"Deleted {delete_count} existing alert records before insertion.")

            # 3. Insert the new data
            insert_sql = """
            INSERT INTO disease_forecast_alerts (
                municipality_code, forecast_date, disease_type, alert_level, 
                alert_title, alert_message, predicted_cases, municipality_name
            ) VALUES %s
            -- Optionally add ON CONFLICT DO NOTHING/UPDATE if strict uniqueness is handled by DB constraint
            -- but explicit DELETE beforehand is clearer with the current logic.
            """
            execute_values(cur, insert_sql, alerts_to_insert, page_size=100)
            
            conn.commit()
            print(f"Successfully inserted {len(alerts_to_insert)} rows into disease_forecast_alerts.")

    except psycopg2.errors.UniqueViolation as uve:
        print(f"Database unique constraint violation: {uve}")
        print("This might happen if multiple alerts for the same key were generated in this run. Check alert generation logic.")
        if conn:
            conn.rollback()
    except psycopg2.DatabaseError as e:
        print(f"Database error during disease_forecast_alerts ingestion: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"Error ingesting data to disease_forecast_alerts: {e}")
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