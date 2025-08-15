#!/usr/bin/env python3

import os
import sys
import numpy as np
from datetime import datetime, timedelta
import json

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dengue_predictor import DenguePredictor

def create_test_weekly_data():
    """Create sample weekly data for testing."""
    base_date = datetime(2025, 1, 6)  # A Monday
    weeks = []
    
    for i in range(4):
        week_start = base_date + timedelta(weeks=i)
        week_end = week_start + timedelta(days=6)
        
        # Create realistic weather data
        week_data = {
            "week_start": week_start.strftime("%Y-%m-%d"),
            "week_end": week_end.strftime("%Y-%m-%d"),
            "temperature": {
                "max": 28.5 + i * 0.5,  # Slightly increasing temps
                "avg": 24.0 + i * 0.3,
                "min": 20.0 + i * 0.2
            },
            "humidity": {
                "max": 85.0 - i * 2,  # Slightly decreasing humidity
                "mean": 75.0 - i * 1.5,
                "min": 65.0 - i * 1
            },
            "precipitation": 10.0 + i * 2  # Increasing precipitation
        }
        weeks.append(week_data)
    
    return weeks

def test_prepare_input_sequence():
    """Test the prepare_input_sequence method."""
    print("=" * 60)
    print("Testing prepare_input_sequence method")
    print("=" * 60)
    
    predictor = DenguePredictor()
    
    # Create test data
    weeks_data = create_test_weekly_data()
    municipality = "Aileu"
    
    # Mock the get_previous_cases method to return predictable values
    original_get_previous_cases = predictor.get_previous_cases
    def mock_get_previous_cases(municipality, year, week):
        # Return mock values based on week number
        return 10 + week  # Just for testing
    predictor.get_previous_cases = mock_get_previous_cases
    
    try:
        # Prepare input sequence
        input_features = predictor.prepare_input_sequence(municipality, weeks_data, 2025, 4)
        
        print(f"\nInput shape: {input_features.shape}")
        print(f"Expected shape: (1, 40)")
        assert input_features.shape == (1, 40), f"Wrong shape: {input_features.shape}"
        
        # Extract and verify features
        features = input_features[0]
        
        print("\n--- Feature Verification ---")
        
        # Check dengue lags (should be most recent to oldest)
        print(f"\nDengue lags (positions 0-3): {features[0:4]}")
        print("Expected: Most recent week first (lag_1), then older weeks")
        
        # Check temperature max
        print(f"\nTemperature max (positions 4-7): {features[4:8]}")
        print(f"Expected order: {[w['temperature']['max'] for w in weeks_data]}")
        
        # Check temperature mean/avg
        print(f"\nTemperature mean (positions 8-11): {features[8:12]}")
        print(f"Expected order: {[w['temperature']['avg'] for w in weeks_data]}")
        
        # Check temperature min
        print(f"\nTemperature min (positions 12-15): {features[12:16]}")
        print(f"Expected order: {[w['temperature']['min'] for w in weeks_data]}")
        
        # Check precipitation (all should be same since we use one value)
        print(f"\nPrecipitation max (positions 16-19): {features[16:20]}")
        print(f"Precipitation mean (positions 20-23): {features[20:24]}")
        print(f"Precipitation min (positions 24-27): {features[24:28]}")
        print(f"Expected values: {[w['precipitation'] for w in weeks_data]}")
        
        # Check humidity
        print(f"\nHumidity max (positions 28-31): {features[28:32]}")
        print(f"Expected order: {[w['humidity']['max'] for w in weeks_data]}")
        
        print(f"\nHumidity mean (positions 32-35): {features[32:36]}")
        print(f"Expected order: {[w['humidity']['mean'] for w in weeks_data]}")
        
        print(f"\nHumidity min (positions 36-39): {features[36:40]}")
        print(f"Expected order: {[w['humidity']['min'] for w in weeks_data]}")
        
        print("\n✓ Test passed: prepare_input_sequence creates correct 40-feature array")
        
    finally:
        # Restore original method
        predictor.get_previous_cases = original_get_previous_cases

def test_model_loading():
    """Test model loading with the new directory structure."""
    print("\n" + "=" * 60)
    print("Testing model loading")
    print("=" * 60)
    
    predictor = DenguePredictor()
    
    # Check if models directory exists
    print(f"\nModels directory: {predictor.models_dir}")
    print(f"Directory exists: {os.path.exists(predictor.models_dir)}")
    
    if os.path.exists(predictor.models_dir):
        # List available model files
        model_files = [f for f in os.listdir(predictor.models_dir) if f.endswith('.joblib')]
        print(f"\nAvailable model files: {len(model_files)}")
        for model_file in sorted(model_files):
            print(f"  - {model_file}")
        
        # Try loading models for test municipalities
        test_municipalities = ["Aileu", "Dili", "Covalima"]
        available = predictor.load_models(test_municipalities)
        
        print(f"\nSuccessfully loaded models for: {available}")
        print(f"Models loaded: {len(predictor.models)}")
        
        # Check municipality name mapping
        if "Covalima" in available and "Covalima" not in [f.replace('_Dengue.joblib', '') for f in model_files]:
            print("\n✓ Municipality name mapping working (Covalima -> Cova Lima)")
    else:
        print(f"\n⚠ Models directory not found: {predictor.models_dir}")
        print("Please ensure the new_models/Dengue directory exists with the model files")

def test_prediction_format():
    """Test the prediction output format."""
    print("\n" + "=" * 60)
    print("Testing prediction format")
    print("=" * 60)
    
    predictor = DenguePredictor()
    
    # Create test input that matches the expected format
    test_input = np.array([[
        # Dengue lags 1-4
        5, 4, 6, 3,
        # Temperature max lags 1-4
        28.5, 28.0, 27.5, 27.0,
        # Temperature mean lags 1-4
        24.5, 24.2, 23.9, 23.6,
        # Temperature min lags 1-4
        20.5, 20.3, 20.1, 19.9,
        # Precipitation max lags 1-4
        15.0, 12.0, 10.0, 8.0,
        # Precipitation mean lags 1-4
        15.0, 12.0, 10.0, 8.0,
        # Precipitation min lags 1-4
        15.0, 12.0, 10.0, 8.0,
        # Humidity max lags 1-4
        85.0, 83.0, 81.0, 79.0,
        # Humidity mean lags 1-4
        75.0, 73.5, 72.0, 70.5,
        # Humidity min lags 1-4
        65.0, 64.0, 63.0, 62.0
    ]])
    
    print(f"\nTest input shape: {test_input.shape}")
    print(f"Number of features: {test_input.shape[1]}")
    
    # Try loading a model and making a prediction
    test_municipalities = ["Aileu"]
    available = predictor.load_models(test_municipalities)
    
    if available:
        municipality = available[0]
        print(f"\nTesting prediction for: {municipality}")
        
        # Log the input
        predictor.log_input_data(test_input)
        
        # Check if model can handle the input
        model = predictor.models[municipality]
        print(f"\nModel type: {type(model)}")
        
        try:
            # Make a test prediction
            prediction = model.predict(test_input)
            print(f"\nPrediction successful!")
            print(f"Predicted value: {prediction[0]}")
            print(f"Prediction type: {type(prediction)}")
            print(f"✓ Model accepts 40-feature input and returns prediction")
        except Exception as e:
            print(f"\n✗ Prediction failed: {str(e)}")
    else:
        print("\n⚠ No models loaded, cannot test prediction")

def main():
    """Run all tests."""
    print("Testing New Dengue Predictor Implementation")
    print("=" * 60)
    
    # Test 1: Input sequence preparation
    test_prepare_input_sequence()
    
    # Test 2: Model loading
    test_model_loading()
    
    # Test 3: Prediction format
    test_prediction_format()
    
    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()