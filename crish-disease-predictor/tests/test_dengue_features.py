#!/usr/bin/env python3

import numpy as np
from datetime import datetime, timedelta

def test_feature_order():
    """Test the feature order for the new dengue models."""
    print("Testing Feature Order for New Dengue Models")
    print("=" * 60)
    
    # Create sample data matching the expected format
    # According to instructions, we need 40 features in this order:
    
    # Sample data for 4 weeks (lag_1 is most recent)
    dengue_cases = [10, 8, 12, 9]  # lag_1 to lag_4
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
    features.extend(dengue_cases)  # Positions 0-3
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
    print(f"Dengue cases (0-3): {prediction_input[0][0:4]}")
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
    print("Expected feature names from instructions:")
    print("=" * 60)
    
    prediction_feature_input = [
        'Dengue_lag_1', 'Dengue_lag_2', 'Dengue_lag_3', 'Dengue_lag_4',
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
    
    return prediction_input

def test_weekly_data_processing():
    """Test how weekly data should be processed."""
    print("\n" + "=" * 60)
    print("Testing Weekly Data Processing")
    print("=" * 60)
    
    # Simulate 4 weeks of data (oldest to newest)
    weeks = []
    base_date = datetime(2025, 1, 6)  # A Monday
    
    for i in range(4):
        week_start = base_date + timedelta(weeks=i)
        week_end = week_start + timedelta(days=6)
        
        week_data = {
            "week_start": week_start.strftime("%Y-%m-%d"),
            "week_end": week_end.strftime("%Y-%m-%d"),
            "week_number": i + 1
        }
        weeks.append(week_data)
    
    print("Original weeks (chronological order, oldest first):")
    for i, week in enumerate(weeks):
        print(f"  Week {i}: {week['week_start']} (week #{week['week_number']})")
    
    print("\nFor lag features:")
    print("- lag_1 should be the MOST RECENT week (week #4)")
    print("- lag_2 should be the second most recent (week #3)")
    print("- lag_3 should be the third most recent (week #2)")
    print("- lag_4 should be the fourth most recent (week #1)")
    
    # Get last 4 weeks
    last_4_weeks = weeks[-4:]
    print("\nLast 4 weeks (weeks[-4:]):")
    for i, week in enumerate(last_4_weeks):
        print(f"  Index {i}: {week['week_start']} (week #{week['week_number']})")
    
    # Process in reverse order (as done in prepare_input_sequence)
    print("\nProcessing in reverse (most recent to oldest):")
    lags = []
    for i in range(len(last_4_weeks)):
        week = last_4_weeks[-(i+1)]  # Get from the end
        lags.append(week['week_number'])
        print(f"  i={i}: week #{week['week_number']} ({week['week_start']})")
    
    print(f"\nCollected lags before reversal: {lags}")
    lags_reversed = lags[::-1]
    print(f"After reversal (for feature array): {lags_reversed}")
    print("\nThis gives us:")
    for i, lag in enumerate(lags_reversed):
        print(f"  lag_{i+1} = week #{lag}")

def test_model_loading():
    """Test if models exist in the expected location."""
    print("\n" + "=" * 60)
    print("Testing Model Files")
    print("=" * 60)
    
    import os
    
    model_dir = "new_models/Dengue"
    print(f"Checking directory: {model_dir}")
    
    if os.path.exists(model_dir):
        files = sorted([f for f in os.listdir(model_dir) if f.endswith('.joblib')])
        print(f"\nFound {len(files)} model files:")
        for f in files:
            municipality = f.replace('_Dengue.joblib', '')
            print(f"  - {f} (municipality: {municipality})")
        
        # Check for special cases
        if 'Cova Lima_Dengue.joblib' in files:
            print("\n✓ Found 'Cova Lima' model (will need mapping from 'Covalima')")
    else:
        print(f"✗ Directory not found: {model_dir}")

if __name__ == "__main__":
    # Test 1: Feature order
    test_feature_order()
    
    # Test 2: Weekly data processing logic
    test_weekly_data_processing()
    
    # Test 3: Model files
    test_model_loading()
    
    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)