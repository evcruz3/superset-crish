#!/usr/bin/env python3

import os
from dotenv import load_dotenv
import numpy as np
import json
from datetime import datetime, timedelta
import joblib
import math
import psycopg2
import isoweek

# Import alert generation functions
from disease_alert_generator import (
    generate_disease_alert, create_and_ingest_bulletins, 
    get_iso_code_for_municipality, create_and_ingest_disease_forecast_alerts,
    record_disease_pipeline_run
)

# Load environment variables
load_dotenv()

class DenguePredictor:
    def __init__(self):
        self.models_dir = os.getenv('DENGUE_MODELS_DIR', 'new_models/Dengue')
        self.predictions_dir = os.getenv('PREDICTIONS_DIR', 'predictions')
        self.weather_data_dir = os.getenv('WEATHER_DATA_DIR', 'weather_data')
        self.default_prev_cases = int(os.getenv('DEFAULT_PREV_CASES', '1'))
        self.models = {}
        
        # Database connection parameters
        self.db_params = {
            'dbname': os.getenv('DATABASE_DB'),
            'user': os.getenv('DATABASE_USER'),
            'password': os.getenv('DATABASE_PASSWORD'),
            'host': os.getenv('DATABASE_HOST'),
            'port': os.getenv('DATABASE_PORT', '5432')
        }
        self.conn = None
        self.cursor = None
        
        # Municipality to ISO code mapping
        self.municipality_iso_codes = {
            'Aileu': 'TL-AL',
            'Ainaro': 'TL-AN',
            'Atauro': 'TL-AT',
            'Baucau': 'TL-BA',
            'Bobonaro': 'TL-BO',
            'Covalima': 'TL-CO',
            'Dili': 'TL-DI',
            'Ermera': 'TL-ER',
            'Lautem': 'TL-LA',
            'Liquica': 'TL-LI',
            'Liquiça': 'TL-LI',
            'Manatuto': 'TL-MT',
            'Manufahi': 'TL-MF',
            'Raeoa': 'TL-OE',
            'Viqueque': 'TL-VI'
        }

    def connect_db(self):
        """Connect to the PostgreSQL database."""
        try:
            self.conn = psycopg2.connect(**self.db_params)
            self.cursor = self.conn.cursor()
            print("Connected to the database successfully")
        except Exception as e:
            print(f"Error connecting to the database: {str(e)}")
            raise

    def disconnect_db(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            print("Database connection closed")

    def get_previous_cases(self, municipality, year, week):
        """Get the most recent available dengue cases from the database for a municipality up to a specific week."""
        try:
            # Get municipality code
            municipality_code = self.municipality_iso_codes.get(municipality)
            if not municipality_code:
                print(f"Warning: No ISO code found for {municipality}")
                return 0

            # Find the latest year and week with data up to the target year/week
            query_latest_week = """
            SELECT year, week_number
            FROM tlhis_diseases
            WHERE municipality_code = %s
            AND lower(disease) ~* '\ydengue\y'
            AND (year < %s OR (year = %s AND week_number <= %s))
            ORDER BY year DESC, week_number DESC
            LIMIT 1
            """
            self.cursor.execute(query_latest_week, (municipality_code, year, year, week))
            latest_week_data = self.cursor.fetchone()

            if not latest_week_data:
                # No data found up to this week, return 0
                # print(f"No previous dengue case data found for {municipality} up to {year}-W{week}") # Optional: for debugging
                return 0

            latest_year, latest_week = latest_week_data

            # Query to get sum of cases for the identified latest week
            query_cases = """
            SELECT COALESCE(SUM("totalCases"), 0) as total_cases
            FROM tlhis_diseases
            WHERE municipality_code = %s
            AND year = %s
            AND week_number = %s
            AND lower(disease) ~* '\ydengue\y'
            """
            
            self.cursor.execute(query_cases, (municipality_code, latest_year, latest_week))
            result = self.cursor.fetchone()
            
            # print(f"Using dengue data from {latest_year}-W{latest_week} for target {year}-W{week} for {municipality}: {int(result[0]) if result else 0} cases") # Optional: for debugging
            return int(result[0]) if result else 0
            
        except Exception as e:
            print(f"Error getting previous dengue cases for {municipality} up to {year}-W{week}: {str(e)}")
            # Rollback the transaction on error
            if self.conn:
                self.conn.rollback()
            return 0

    def get_week_info(self, date_str):
        """Get year and week number from a date string."""
        # Ensure date_str is in 'YYYY-MM-DD' format
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            # Attempt to parse if it's a different common format or already a date object
            # This part might need adjustment based on actual date string formats encountered
            if isinstance(date_str, datetime):
                date = date_str
            else: # Add more parsing attempts if other formats are possible
                raise ValueError(f"Date string '{date_str}' is not in 'YYYY-MM-DD' format and could not be parsed.")
        
        year = date.year
        week = isoweek.Week.withdate(date).week
        return year, week
        
    def load_models(self, municipalities):
        """Load joblib models for each municipality."""
        available_municipalities = []
        for municipality in municipalities:
            try:
                model_path = f'{self.models_dir}/{municipality}_Dengue.joblib'
                
                if os.path.exists(model_path):
                    self.models[municipality] = joblib.load(model_path)
                    print(f"Loaded model for {municipality} from {model_path}")
                    available_municipalities.append(municipality)
                else:
                    print(f"Skipping {municipality}: Model not found at {model_path}")
            except Exception as e:
                print(f"Error loading model for {municipality}: {str(e)}")
        return available_municipalities

    def prepare_input_sequence(self, municipality, weeks_data, year, week):
        """Prepare the 40-feature input sequence for the new models.
        
        Features order (40 total):
        - Dengue_lag_1 to Dengue_lag_4 (4 features)
        - t2m_max_lag_1 to t2m_max_lag_4 (4 features)
        - t2m_mean_lag_1 to t2m_mean_lag_4 (4 features)
        - t2m_min_lag_1 to t2m_min_lag_4 (4 features)
        - tp_max_lag_1 to tp_max_lag_4 (4 features)
        - tp_mean_lag_1 to tp_mean_lag_4 (4 features)
        - tp_min_lag_1 to tp_min_lag_4 (4 features)
        - relative_humidity_max_lag_1 to relative_humidity_max_lag_4 (4 features)
        - relative_humidity_mean_lag_1 to relative_humidity_mean_lag_4 (4 features)
        - relative_humidity_min_lag_1 to relative_humidity_min_lag_4 (4 features)
        """
        # Get previous cases for the last 4 weeks
        dengue_lags = []
        weather_data_by_lag = []
        
        # Process the 4 weeks in chronological order (oldest to newest)
        # weeks_data is already in chronological order
        for week_data in weeks_data:
            week_year, week_num = self.get_week_info(week_data['week_start'])
            
            # Get dengue cases for this week
            cases = self.get_previous_cases(municipality, week_year, week_num)
            dengue_lags.append(cases)
            weather_data_by_lag.append(week_data)
        
        # Reverse to get lag_1 as most recent (last week in the list)
        dengue_lags = dengue_lags[::-1]
        weather_data_by_lag = weather_data_by_lag[::-1]
        
        # Build the feature array
        features = []
        
        # Add dengue lags
        features.extend(dengue_lags)
        
        # Add weather features in the correct order
        # t2m_max
        for week_data in weather_data_by_lag:
            features.append(week_data['temperature']['max'])
        
        # t2m_mean (using avg as mean)
        for week_data in weather_data_by_lag:
            features.append(week_data['temperature']['avg'])
            
        # t2m_min
        for week_data in weather_data_by_lag:
            features.append(week_data['temperature']['min'])
            
        # tp_max (precipitation max - assuming single value, so using same for max/mean/min)
        for week_data in weather_data_by_lag:
            features.append(week_data['precipitation'])
            
        # tp_mean
        for week_data in weather_data_by_lag:
            features.append(week_data['precipitation'])
            
        # tp_min
        for week_data in weather_data_by_lag:
            features.append(week_data['precipitation'])
            
        # relative_humidity_max
        for week_data in weather_data_by_lag:
            features.append(week_data['humidity']['max'])
            
        # relative_humidity_mean
        for week_data in weather_data_by_lag:
            features.append(week_data['humidity']['mean'])
            
        # relative_humidity_min
        for week_data in weather_data_by_lag:
            features.append(week_data['humidity']['min'])
        
        return np.array(features).reshape(1, -1)

    def log_input_data(self, input_features):
        """Log the input data being used for prediction."""
        print("\nInput features for prediction:")
        print(f"  Dengue cases (lag 1-4): {input_features[0][:4]}")
        print(f"  Temperature max (lag 1-4): {input_features[0][4:8]}")
        print(f"  Temperature mean (lag 1-4): {input_features[0][8:12]}")
        print(f"  Temperature min (lag 1-4): {input_features[0][12:16]}")
        print(f"  Precipitation max (lag 1-4): {input_features[0][16:20]}")
        print(f"  Precipitation mean (lag 1-4): {input_features[0][20:24]}")
        print(f"  Precipitation min (lag 1-4): {input_features[0][24:28]}")
        print(f"  Humidity max (lag 1-4): {input_features[0][28:32]}")
        print(f"  Humidity mean (lag 1-4): {input_features[0][32:36]}")
        print(f"  Humidity min (lag 1-4): {input_features[0][36:40]}")

    def predict_dengue_cases(self, municipality, input_features):
        """Predict dengue cases for a municipality using the new model format."""
        if municipality not in self.models:
            print(f"No model available for {municipality}")
            return None

        # Log input data
        print(f"\nPredicting for {municipality}")
        self.log_input_data(input_features)

        model = self.models[municipality]
        
        # Make prediction directly (no scaling needed for new models)
        prediction = model.predict(input_features)
        
        # Ensure non-negative prediction and round up to nearest integer
        predicted_cases = math.ceil(max(0, float(prediction[0])))
        
        print(f"Predicted cases: {predicted_cases}")
        
        return predicted_cases
    
    def predict_next_week_cases(self, municipality, previous_features, current_prediction, forecast_week_data):
        """Predict cases for next week using the current prediction and forecast data."""
        print(f"\nPredicting next week for {municipality}")
        
        if municipality not in self.models:
            print(f"No model available for {municipality}")
            return None
            
        if not forecast_week_data:
            print(f"No forecast data available for {municipality}")
            return None
            
        # Create new input features for next week prediction
        # Shift all lags by 1 (lag_1 becomes lag_2, etc.)
        # Current prediction becomes new lag_1
        
        features = []
        
        # Dengue lags: current_prediction becomes lag_1, previous lag_1-3 become lag_2-4
        features.append(current_prediction)
        features.extend(previous_features[0][:3])  # Previous lag_1 to lag_3
        
        # Weather features: forecast becomes lag_1, previous lag_1-3 become lag_2-4
        # For each weather parameter, add forecast as lag_1 and shift others
        
        # Temperature max
        features.append(forecast_week_data['temperature']['max'])
        features.extend(previous_features[0][4:7])  # Previous t2m_max lag_1-3
        
        # Temperature mean
        features.append(forecast_week_data['temperature']['avg'])
        features.extend(previous_features[0][8:11])  # Previous t2m_mean lag_1-3
        
        # Temperature min
        features.append(forecast_week_data['temperature']['min'])
        features.extend(previous_features[0][12:15])  # Previous t2m_min lag_1-3
        
        # Precipitation max/mean/min (using same value)
        features.append(forecast_week_data['precipitation'])
        features.extend(previous_features[0][16:19])  # Previous tp_max lag_1-3
        
        features.append(forecast_week_data['precipitation'])
        features.extend(previous_features[0][20:23])  # Previous tp_mean lag_1-3
        
        features.append(forecast_week_data['precipitation'])
        features.extend(previous_features[0][24:27])  # Previous tp_min lag_1-3
        
        # Humidity max
        features.append(forecast_week_data['humidity']['max'])
        features.extend(previous_features[0][28:31])  # Previous humidity_max lag_1-3
        
        # Humidity mean
        features.append(forecast_week_data['humidity']['mean'])
        features.extend(previous_features[0][32:35])  # Previous humidity_mean lag_1-3
        
        # Humidity min
        features.append(forecast_week_data['humidity']['min'])
        features.extend(previous_features[0][36:39])  # Previous humidity_min lag_1-3
        
        next_week_features = np.array(features).reshape(1, -1)
        
        # Make prediction using the new features
        return self.predict_dengue_cases(municipality, next_week_features)

def main():
    predictor = DenguePredictor()
    pipeline_name = "Dengue Predictor Pipeline"
    pipeline_start_time = datetime.now() # For recording run
    municipalities_processed_count = 0
    alerts_generated_this_run = 0
    bulletins_created_this_run = 0

    try:
        # Connect to database
        predictor.connect_db()
        
        # Load weekly averages and forecast data
        # Standardized date format for filenames
        current_date_filename_suffix = pipeline_start_time.strftime('%Y%m%d')
        weekly_averages_file = f"{predictor.weather_data_dir}/all_municipalities_weekly_averages_{current_date_filename_suffix}.json"
        forecast_file = f"{predictor.weather_data_dir}/all_municipalities_forecast_{current_date_filename_suffix}.json"
        
        try:
            with open(weekly_averages_file, 'r') as f:
                weekly_data = json.load(f)
        except FileNotFoundError:
            print(f"Weekly averages file not found: {weekly_averages_file}")
            return
            
        try:
            with open(forecast_file, 'r') as f:
                forecast_data = json.load(f)
            has_forecast = True
            print("Forecast data loaded successfully")
        except FileNotFoundError:
            print(f"Forecast file not found: {forecast_file}")
            has_forecast = False

        # Initialize predictor and get available municipalities
        available_municipalities = predictor.load_models(weekly_data.keys())
        print("Available municipalities: ", available_municipalities)
        print(f"\nProcessing predictions for {len(available_municipalities)} municipalities with available models")

        # Store predictions
        predictions = {}
        all_alerts = [] # Initialize list to store all generated alerts
        processed_municipality_names = [] # Keep track of successfully processed municipalities

        # Process each municipality with available model
        for municipality in available_municipalities:
            weeks = weekly_data[municipality]
            if len(weeks) >= int(os.getenv('MAX_WEEKS_HISTORY', '4')):  # Need minimum weeks of data
                print(f"\nProcessing {municipality}")
                
                # Prepare input sequence for the new model format
                # Get the last week's info for reference
                last_week = weeks[-1]
                year, week = predictor.get_week_info(last_week['week_start'])
                
                # Prepare the 40-feature input sequence
                input_features = predictor.prepare_input_sequence(municipality, weeks[-4:], year, week)

                # Make prediction for current week
                current_prediction = predictor.predict_dengue_cases(municipality, input_features)
                
                # Initialize next week prediction
                next_week_prediction = None
                
                # Get municipality ISO code (needed for alerts)
                municipality_iso_code = get_iso_code_for_municipality(municipality, predictor.municipality_iso_codes)
                if not municipality_iso_code:
                    print(f"Warning: ISO code not found for {municipality}, bulletins might be missing this info.")

                # If forecast data is available, predict next week
                if has_forecast and municipality in forecast_data and forecast_data[municipality]:
                    next_week_prediction = predictor.predict_next_week_cases(
                        municipality, 
                        input_features, 
                        current_prediction, 
                        forecast_data[municipality][0]  # Pass the first forecast week
                    )
                
                if current_prediction is not None:
                    # Calculate current prediction week range
                    last_hist_week_end_dt = datetime.strptime(weeks[-1]['week_end'], '%Y-%m-%d')
                    current_pred_week_start_dt = last_hist_week_end_dt + timedelta(days=1)
                    current_pred_week_end_dt = current_pred_week_start_dt + timedelta(days=6)

                    predictions[municipality] = {
                        'current_week': {
                            'predicted_cases': current_prediction,
                            'prediction_date': pipeline_start_time.strftime('%Y-%m-%d'),
                            'week_range': {
                                'start': current_pred_week_start_dt.strftime('%Y-%m-%d'),
                                'end': current_pred_week_end_dt.strftime('%Y-%m-%d')
                            },
                            'weeks_used': [
                                {'start': weeks[-int(os.getenv('MAX_WEEKS_HISTORY', '4'))+i]['week_start'],
                                 'end': weeks[-int(os.getenv('MAX_WEEKS_HISTORY', '4'))+i]['week_end']}
                                for i in range(int(os.getenv('MAX_WEEKS_HISTORY', '4')))]
                        }
                    }

                    # Add next week prediction if available
                    if next_week_prediction is not None:
                        # Calculate next week's date range based on the current prediction's week
                        next_week_start_dt = current_pred_week_end_dt + timedelta(days=1)
                        next_week_end_dt = next_week_start_dt + timedelta(days=6)

                        predictions[municipality]['next_week'] = {
                            'predicted_cases': next_week_prediction,
                            'prediction_date': pipeline_start_time.strftime('%Y-%m-%d'),
                            'week_range': {
                                'start': next_week_start_dt.strftime('%Y-%m-%d'),
                                'end': next_week_end_dt.strftime('%Y-%m-%d')
                            }
                        }

                    # --- Generate Alerts ---
                    # Use a consistent forecast_date for alerts generated in this run
                    alert_forecast_date_str = pipeline_start_time.strftime('%Y-%m-%d')

                    # Alert for current week prediction
                    if current_prediction is not None:
                        current_alert = generate_disease_alert(
                            disease_type="Dengue",
                            predicted_cases=int(current_prediction),
                            municipality_name=municipality,
                            forecast_date_str=alert_forecast_date_str, # Standardized
                            week_start_str=predictions[municipality]['current_week']['week_range']['start'],
                            week_end_str=predictions[municipality]['current_week']['week_range']['end'],
                            municipality_iso_code=municipality_iso_code
                        )
                        if current_alert:
                            all_alerts.append(current_alert)
                            print(f"Generated current week Dengue alert for {municipality}: Level {current_alert['alert_level']}")

                    # Alert for next week prediction
                    if next_week_prediction is not None:
                        next_week_alert = generate_disease_alert(
                            disease_type="Dengue",
                            predicted_cases=int(next_week_prediction),
                            municipality_name=municipality,
                            forecast_date_str=alert_forecast_date_str, # Standardized
                            week_start_str=predictions[municipality]['next_week']['week_range']['start'],
                            week_end_str=predictions[municipality]['next_week']['week_range']['end'],
                            municipality_iso_code=municipality_iso_code
                        )
                        if next_week_alert:
                            all_alerts.append(next_week_alert)
                            print(f"Generated next week Dengue alert for {municipality}: Level {next_week_alert['alert_level']}")

                    processed_municipality_names.append(municipality)
        
        municipalities_processed_count = len(processed_municipality_names)
        alerts_generated_this_run = len(all_alerts)

        # Save predictions
        os.makedirs(predictor.predictions_dir, exist_ok=True)
        # Use standardized date suffix for predictions file
        predictions_file = f"{predictor.predictions_dir}/dengue_predictions_{current_date_filename_suffix}.json"
        with open(predictions_file, 'w') as f:
            json.dump(predictions, f, indent=2)
        
        print(f"\nPredictions saved to {predictions_file}")
        
        # Print predictions
        print("\nPredicted dengue cases for each municipality:")
        for municipality, pred_data in predictions.items():
            print(f"{municipality}: Current week: {pred_data['current_week']['predicted_cases']} cases")
            if 'next_week' in pred_data:
                print(f"             Next week: {pred_data['next_week']['predicted_cases']} cases")

        # --- Ingest Alerts and Bulletins ---    
        if all_alerts:
            print(f"\nAttempting to ingest {len(all_alerts)} Dengue alerts...")
            
            # First, create disease forecast alerts and get their IDs
            alert_id_mapping = create_and_ingest_disease_forecast_alerts(all_alerts, predictor.db_params)
            
            # Then create bulletins linked to those alerts
            print(f"\nCreating bulletins linked to disease forecast alerts...")
            
            # Prepare data for full map coloring
            # The map needs a list of {'municipality_code', 'alert_level'} for all relevant alerts
            # For dengue, all alerts in all_alerts are for Dengue.
            predictions_for_map_display = []
            for alert_item in all_alerts:
                if alert_item and 'municipality_code' in alert_item and 'alert_level' in alert_item:
                    predictions_for_map_display.append({
                        'municipality_code': alert_item['municipality_code'],
                        'alert_level': alert_item['alert_level']
                    })
            
            all_predictions_for_map_arg = {"Dengue": predictions_for_map_display}
            
            create_and_ingest_bulletins(
                all_alerts, 
                predictor.db_params, 
                all_predictions_for_map=all_predictions_for_map_arg,
                alert_id_mapping=alert_id_mapping
            )
            bulletins_created_this_run = len(all_alerts) # This might be an overestimation if some bulletins fail
        else:
            print("\nNo Dengue alerts generated to create bulletins or store in disease_forecast_alerts table.")
        
        record_disease_pipeline_run(
            db_params=predictor.db_params,
            pipeline_name=pipeline_name,
            status="Success",
            details=f"Successfully processed {municipalities_processed_count} municipalities. Generated {alerts_generated_this_run} alerts and {bulletins_created_this_run} bulletins.",
            municipalities_processed_count=municipalities_processed_count,
            alerts_generated_count=alerts_generated_this_run,
            bulletins_created_count=bulletins_created_this_run
        )
            
    except Exception as e:
        err_message = f"Error: {str(e)}"
        print(err_message)
        import traceback # For more detailed error logging
        traceback.print_exc() # Print stack trace to console
        record_disease_pipeline_run(
            db_params=predictor.db_params,
            pipeline_name=pipeline_name,
            status="Failed",
            details=err_message,
            municipalities_processed_count=municipalities_processed_count,
            alerts_generated_count=alerts_generated_this_run,
            bulletins_created_count=bulletins_created_this_run
        )
    finally:
        predictor.disconnect_db()

if __name__ == "__main__":
    main() 