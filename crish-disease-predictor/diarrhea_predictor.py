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

# Load environment variables
load_dotenv()

class DiarrheaPredictor:
    def __init__(self):
        self.models_dir = os.getenv('DIARRHEA_MODELS_DIR', 'diarrheaModels')
        self.predictions_dir = os.getenv('PREDICTIONS_DIR', 'predictions')
        self.weather_data_dir = os.getenv('WEATHER_DATA_DIR', 'weather_data')
        self.default_prev_cases = int(os.getenv('DEFAULT_PREV_CASES', '1'))
        # Initialize TensorFlow session
        self.session = tf.Session()
        tf.keras.backend.set_session(self.session)
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
            'Manatuto': 'TL-MT',
            'Manufahi': 'TL-MF',
            'Raeoa': 'TL-OE',
            'Viqueque': 'TL-VI'
        }

    def __del__(self):
        """Cleanup TensorFlow session on object destruction."""
        if hasattr(self, 'session'):
            self.session.close()

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
        """Get previous diarrhea cases from the database for a specific week."""
        try:
            # Get municipality code
            municipality_code = self.municipality_iso_codes.get(municipality)
            if not municipality_code:
                print(f"Warning: No ISO code found for {municipality}")
                return 0

            # Query to get sum of cases for the specified week
            query = """
            SELECT COALESCE(SUM("totalCases"), 0) as total_cases
            FROM tlhis_diseases
            WHERE municipality_code = %s
            AND year = %s
            AND week_number = %s
            AND (disease ILIKE %s OR disease ILIKE %s)
            """
            
            self.cursor.execute(query, (municipality_code, year, week, '%diarhea%', '%diarrhea%'))
            result = self.cursor.fetchone()
            
            return int(result[0]) if result else 0
            
        except Exception as e:
            print(f"Error getting previous cases for {municipality}: {str(e)}")
            # Rollback the transaction on error
            if self.conn:
                self.conn.rollback()
            return 0

    def get_week_info(self, date_str):
        """Get year and week number from a date string."""
        date = datetime.strptime(date_str, '%Y-%m-%d')
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
                    with self.session.as_default():
                        with self.session.graph.as_default():
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
        print(f"\nInput data for {municipality}:")
        for week_idx, week_data in enumerate(input_sequence):
            print(f"\nWeek {week_idx + 1}:")
            print(f"  Previous cases: {week_data[0]}")
            print(f"  Temperature (max/avg/min): {week_data[1]:.2f}°C / {week_data[2]:.2f}°C / {week_data[3]:.2f}°C")
            print(f"  Precipitation: {week_data[4]:.2f}mm")
            print(f"  Humidity (max/mean/min): {week_data[5]:.2f}% / {week_data[6]:.2f}% / {week_data[7]:.2f}%")

    def predict_diarrhea_cases(self, municipality, input_sequence):
        """Predict diarrhea cases for a municipality using a sequence of weekly data."""
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
        
        # Make prediction with TensorFlow 1.15 session
        with self.session.as_default():
            with self.session.graph.as_default():
                scaled_prediction = model.predict(input_reshaped, verbose=0)
        
        # Inverse transform the prediction
        predicted_cases = scaler.inverse_transform(
            np.concatenate((scaled_prediction.reshape(-1, 1), 
                          np.zeros((scaled_prediction.shape[0], input_sequence.shape[1]-1))), 
                          axis=1))[:, 0]
        
        # Ensure non-negative prediction and round up to nearest integer
        predicted_cases = math.ceil(max(0, float(predicted_cases[0])))
        
        return predicted_cases

def main():
    predictor = DiarrheaPredictor()
    
    try:
        # Connect to database
        predictor.connect_db()
        
        # Load weekly averages
        current_date = datetime.now().strftime('%Y%m%d')
        weekly_averages_file = f"{predictor.weather_data_dir}/all_municipalities_weekly_averages_{current_date}.json"
        
        try:
            with open(weekly_averages_file, 'r') as f:
                weekly_data = json.load(f)
        except FileNotFoundError:
            print(f"Weekly averages file not found: {weekly_averages_file}")
            return

        # Initialize predictor and get available municipalities
        available_municipalities = predictor.load_models(weekly_data.keys())

        print(f"\nProcessing predictions for {len(available_municipalities)} municipalities with available models")

        # Store predictions
        predictions = {}

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

                # Make prediction
                predicted_cases = predictor.predict_diarrhea_cases(municipality, input_sequence)
                
                if predicted_cases is not None:
                    predictions[municipality] = {
                        'predicted_cases': predicted_cases,
                        'prediction_date': datetime.now().strftime('%Y-%m-%d'),
                        'weeks_used': [
                            {'start': weeks[-int(os.getenv('MAX_WEEKS_HISTORY', '4'))+i]['week_start'], 
                             'end': weeks[-int(os.getenv('MAX_WEEKS_HISTORY', '4'))+i]['week_end']}
                            for i in range(int(os.getenv('MAX_WEEKS_HISTORY', '4')))
                        ]
                    }

        # Save predictions
        os.makedirs(predictor.predictions_dir, exist_ok=True)
        predictions_file = f"{predictor.predictions_dir}/diarrhea_predictions_{current_date}.json"
        with open(predictions_file, 'w') as f:
            json.dump(predictions, f, indent=2)
        
        print(f"\nPredictions saved to {predictions_file}")
        
        # Print predictions
        print("\nPredicted diarrhea cases for each municipality:")
        for municipality, pred_data in predictions.items():
            print(f"{municipality}: {pred_data['predicted_cases']} cases")
            
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        predictor.disconnect_db()

if __name__ == "__main__":
    main() 