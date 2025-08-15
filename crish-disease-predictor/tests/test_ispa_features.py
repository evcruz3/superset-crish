#!/usr/bin/env python3

import numpy as np
import os

def test_ispa_feature_order():
    """Test the feature order for the ISPA models."""
    print("Testing Feature Order for ISPA Models")
    print("=" * 60)
    
    # Create sample data matching the expected format
    # According to the pattern, we need 40 features in this order:
    
    # Sample data for 4 weeks (lag_1 is most recent)
    ispa_cases = [15, 12, 18, 14]  # lag_1 to lag_4
    temp_max = [28.5, 28.0, 27.5, 27.0]  # lag_1 to lag_4
    temp_mean = [24.5, 24.2, 23.9, 23.6]  # lag_1 to lag_4
    temp_min = [20.5, 20.3, 20.1, 19.9]  # lag_1 to lag_4
    precip_max = [15.0, 12.0, 10.0, 8.0]  # lag_1 to lag_4
    precip_mean = [15.0, 12.0, 10.0, 8.0]  # lag_1 to lag_4
    precip_min = [15.0, 12.0, 10.0, 8.0]  # lag_1 to lag_4
    humid_max = [85.0, 83.0, 81.0, 79.0]  # lag_1 to lag_4
    humid_mean = [75.0, 73.5, 72.0, 70.5]  # lag_1 to lag_4
    humid_min = [65.0, 64.0, 63.0, 62.0]  # lag_1 to lag_4
    
    # Build feature array according to the specification
    features = []
    
    # Add all features in the correct order
    features.extend(ispa_cases)    # Positions 0-3
    features.extend(temp_max)      # Positions 4-7
    features.extend(temp_mean)     # Positions 8-11
    features.extend(temp_min)      # Positions 12-15
    features.extend(precip_max)    # Positions 16-19
    features.extend(precip_mean)   # Positions 20-23
    features.extend(precip_min)    # Positions 24-27
    features.extend(humid_max)     # Positions 28-31
    features.extend(humid_mean)    # Positions 32-35
    features.extend(humid_min)     # Positions 36-39
    
    prediction_input = np.array([features])
    
    print(f"Input shape: {prediction_input.shape}")
    print(f"Expected: (1, 40)")
    print(f"✓ Correct shape!" if prediction_input.shape == (1, 40) else "✗ Wrong shape!")
    
    print("\nFeature positions:")
    print(f"ISPA cases (0-3): {prediction_input[0][0:4]}")
    print(f"Temperature max (4-7): {prediction_input[0][4:8]}")
    print(f"Temperature mean (8-11): {prediction_input[0][8:12]}")
    print(f"Temperature min (12-15): {prediction_input[0][12:16]}")
    print(f"Precipitation max (16-19): {prediction_input[0][16:20]}")
    print(f"Precipitation mean (20-23): {prediction_input[0][20:24]}")
    print(f"Precipitation min (24-27): {prediction_input[0][24:28]}")
    print(f"Humidity max (28-31): {prediction_input[0][28:32]}")
    print(f"Humidity mean (32-35): {prediction_input[0][32:36]}")
    print(f"Humidity min (36-39): {prediction_input[0][36:40]}")
    
    # Show the expected prediction_feature_input names
    print("\n" + "=" * 60)
    print("Expected feature names for ISPA:")
    print("=" * 60)
    
    prediction_feature_input = [
        'ISPA_lag_1', 'ISPA_lag_2', 'ISPA_lag_3', 'ISPA_lag_4',
        't2m_max_lag_1', 't2m_max_lag_2', 't2m_max_lag_3', 't2m_max_lag_4',
        't2m_mean_lag_1', 't2m_mean_lag_2', 't2m_mean_lag_3', 't2m_mean_lag_4',
        't2m_min_lag_1', 't2m_min_lag_2', 't2m_min_lag_3', 't2m_min_lag_4',
        'tp_max_lag_1', 'tp_max_lag_2', 'tp_max_lag_3', 'tp_max_lag_4',
        'tp_mean_lag_1', 'tp_mean_lag_2', 'tp_mean_lag_3', 'tp_mean_lag_4',
        'tp_min_lag_1', 'tp_min_lag_2', 'tp_min_lag_3', 'tp_min_lag_4',
        'relative_humidity_max_lag_1', 'relative_humidity_max_lag_2',
        'relative_humidity_max_lag_3', 'relative_humidity_max_lag_4',
        'relative_humidity_mean_lag_1', 'relative_humidity_mean_lag_2',
        'relative_humidity_mean_lag_3', 'relative_humidity_mean_lag_4',
        'relative_humidity_min_lag_1', 'relative_humidity_min_lag_2',
        'relative_humidity_min_lag_3', 'relative_humidity_min_lag_4'
    ]
    
    print(f"\nTotal features expected: {len(prediction_feature_input)}")
    
    # Print feature mapping
    print("\nFeature mapping:")
    for i, (name, value) in enumerate(zip(prediction_feature_input, features)):
        print(f"{i:2d}: {name:30s} = {value:6.1f}")

def test_ispa_model_files():
    """Test if ISPA models exist in the expected location."""
    print("\n" + "=" * 60)
    print("Testing ISPA Model Files")
    print("=" * 60)
    
    model_dir = "../new_models/ISPA"
    print(f"Checking directory: {model_dir}")
    
    if os.path.exists(model_dir):
        files = sorted([f for f in os.listdir(model_dir) if f.endswith('.joblib')])
        print(f"\nFound {len(files)} model files:")
        for f in files:
            municipality = f.replace('_ISPA.joblib', '')
            print(f"  - {f} (municipality: {municipality})")
    else:
        print(f"✗ Directory not found: {model_dir}")

if __name__ == "__main__":
    # Test 1: Feature order
    test_ispa_feature_order()
    
    # Test 2: Model files
    test_ispa_model_files()
    
    print("\n" + "=" * 60)
    print("ISPA testing complete!")
    print("=" * 60)