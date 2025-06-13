#!/usr/bin/env python3

import os
from dotenv import load_dotenv
import numpy as np
import tensorflow as tf
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
        self.models_dir = os.getenv('DENGUE_MODELS_DIR', 'dengueModels')
        self.predictions_dir = os.getenv('PREDICTIONS_DIR', 'predictions')
        self.weather_data_dir = os.getenv('WEATHER_DATA_DIR', 'weather_data')
        self.default_prev_cases = int(os.getenv('DEFAULT_PREV_CASES', '1'))
        self.keras = tf.keras
        self.models = {}
        self.scalers = {}
        
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
            AND disease ILIKE %s
            AND (year < %s OR (year = %s AND week_number <= %s))
            ORDER BY year DESC, week_number DESC
            LIMIT 1
            """
            self.cursor.execute(query_latest_week, (municipality_code, '%dengue%', year, year, week))
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
            AND disease ILIKE %s
            """
            
            self.cursor.execute(query_cases, (municipality_code, latest_year, latest_week, '%dengue%'))
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
        """Load models and scalers for each municipality."""
        available_municipalities = []
        for municipality in municipalities:
            try:
                model_path = f'{self.models_dir}/{municipality}.h5'
                scaler_path = f'{self.models_dir}/{municipality}_minmax_scaler.pkl'
                
                if os.path.exists(model_path) and os.path.exists(scaler_path):
                    self.models[municipality] = self.keras.models.load_model(model_path)
                    self.scalers[municipality] = joblib.load(scaler_path)
                    print(f"Loaded model and scaler for {municipality}")
                    available_municipalities.append(municipality)
                else:
                    print(f"Skipping {municipality}: Model or scaler not found")
            except Exception as e:
                print(f"Error loading model for {municipality}: {str(e)}")
        return available_municipalities

    def prepare_input_data(self, weekly_data, prev_cases=None):
        """Prepare input data in the format expected by the model."""
        if prev_cases is None:
            prev_cases = self.default_prev_cases
            
        input_data = np.array([
            prev_cases,
            weekly_data['temperature']['max'],
            weekly_data['temperature']['avg'],
            weekly_data['temperature']['min'],
            weekly_data['precipitation'],
            weekly_data['humidity']['max'],
            weekly_data['humidity']['mean'],
            weekly_data['humidity']['min']
        ])
        return input_data

    def log_input_data(self, municipality, input_sequence):
        """Log the input data being used for prediction."""
        for week_idx, week_data in enumerate(input_sequence):
            print(f"\nWeek {week_idx + 1}:")
            print(f"  Previous cases: {week_data[0]}")
            print(f"  Temperature (max/avg/min): {week_data[1]:.2f}°C / {week_data[2]:.2f}°C / {week_data[3]:.2f}°C")
            print(f"  Precipitation: {week_data[4]:.2f}mm")
            print(f"  Humidity (max/mean/min): {week_data[5]:.2f}% / {week_data[6]:.2f}% / {week_data[7]:.2f}%")

    def predict_dengue_cases(self, municipality, input_sequence):
        """Predict dengue cases for a municipality using a sequence of weekly data."""
        if municipality not in self.models or municipality not in self.scalers:
            print(f"No model available for {municipality}")
            return None

        # Log input data
        print("Input sequence: ", input_sequence)
        self.log_input_data(municipality, input_sequence)

        model = self.models[municipality]
        scaler = self.scalers[municipality]
        
        # Scale the input data
        input_scaled = scaler.transform(input_sequence)
        
        # Reshape for LSTM input (samples, time steps, features)
        input_reshaped = input_scaled.reshape(1, 4, input_sequence.shape[1])
        
        # Make prediction
        scaled_prediction = model.predict(input_reshaped, verbose=0)
        
        # Inverse transform the prediction
        predicted_cases = scaler.inverse_transform(
            np.concatenate((scaled_prediction.reshape(-1, 1), 
                          np.zeros((scaled_prediction.shape[0], input_sequence.shape[1]-1))), 
                          axis=1))[:, 0]
        
        # Ensure non-negative prediction and round up to nearest integer
        predicted_cases = math.ceil(max(0, float(predicted_cases[0])))
        
        return predicted_cases
    
    def predict_next_week_cases(self, municipality, input_sequence, current_prediction, forecast_data):
        """Predict cases for next week using the current prediction and forecast data."""
        print(f"\nPredicting next week for {municipality}")
        
        if municipality not in self.models or municipality not in self.scalers:
            print(f"No model available for {municipality}")
            return None
            
        if not forecast_data:
            print(f"No forecast data available for {municipality}")
            return None
            
        # Create new input sequence for next week prediction
        # Use the last 3 weeks of historical data + current week prediction
        next_week_sequence = np.copy(input_sequence[1:])  # Take last 3 weeks
        
        # Prepare the forecast week data with predicted cases as "previous cases"
        forecast_week_data = self.prepare_input_data(forecast_data[0], current_prediction)
        
        # Combine previous 3 weeks with forecast week
        next_week_sequence = np.vstack([next_week_sequence, forecast_week_data.reshape(1, -1)])
        
        # Make prediction using the new sequence
        return self.predict_dengue_cases(municipality, next_week_sequence)

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
                
                # Get previous cases for each week
                input_sequences = []
                for week_data in weeks[-int(os.getenv('MAX_WEEKS_HISTORY', '4')):]:
                    year, week = predictor.get_week_info(week_data['week_start'])
                    prev_cases = predictor.get_previous_cases(municipality, year, week)
                    input_data = predictor.prepare_input_data(week_data, prev_cases)
                    input_sequences.append(input_data)
                
                input_sequence = np.array(input_sequences)

                # Make prediction for current week
                current_prediction = predictor.predict_dengue_cases(municipality, input_sequence)
                
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
                        input_sequence, 
                        current_prediction, 
                        forecast_data[municipality]
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

        # --- Ingest Bulletins ---    
        if all_alerts:
            print(f"\nAttempting to ingest {len(all_alerts)} Dengue alerts as bulletins...")
            
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
            
            create_and_ingest_bulletins(all_alerts, predictor.db_params, all_predictions_for_map=all_predictions_for_map_arg)
            bulletins_created_this_run = len(all_alerts) # This might be an overestimation if some bulletins fail

            # Also ingest raw alerts to disease_forecast_alerts table
            create_and_ingest_disease_forecast_alerts(all_alerts, predictor.db_params)
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