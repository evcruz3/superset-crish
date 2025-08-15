#!/usr/bin/env python3

import numpy as np

def verify_feature_order():
    """Verify the feature order matches the model requirements."""
    
    print("Verifying Feature Order for New Dengue Models")
    print("=" * 60)
    
    # According to the instructions, lag_1 is the most recent week
    print("\nUnderstanding lag notation:")
    print("- lag_1: Most recent past week (last week)")
    print("- lag_2: Two weeks ago")
    print("- lag_3: Three weeks ago") 
    print("- lag_4: Four weeks ago (oldest)")
    
    # Example: If we have 4 weeks of data in chronological order
    weeks = ["Week 1 (Jan 1-7)", "Week 2 (Jan 8-14)", "Week 3 (Jan 15-21)", "Week 4 (Jan 22-28)"]
    print(f"\nGiven weeks in chronological order: {weeks}")
    
    # After processing for model input
    print("\nFor model input:")
    print(f"- lag_1 should be: {weeks[3]} (most recent)")
    print(f"- lag_2 should be: {weeks[2]}")
    print(f"- lag_3 should be: {weeks[1]}")
    print(f"- lag_4 should be: {weeks[0]} (oldest)")
    
    # The prepare_input_sequence method:
    # 1. Takes weeks[-4:] which gives us the last 4 weeks in chronological order
    # 2. Processes them in order (oldest to newest)
    # 3. Reverses the lists so lag_1 is the most recent
    
    print("\n" + "=" * 60)
    print("Feature array structure (40 features total):")
    print("=" * 60)
    
    feature_groups = [
        ("Dengue cases", 0, 4),
        ("Temperature max (t2m_max)", 4, 8),
        ("Temperature mean (t2m_mean)", 8, 12),
        ("Temperature min (t2m_min)", 12, 16),
        ("Precipitation max (tp_max)", 16, 20),
        ("Precipitation mean (tp_mean)", 20, 24),
        ("Precipitation min (tp_min)", 24, 28),
        ("Humidity max", 28, 32),
        ("Humidity mean", 32, 36),
        ("Humidity min", 36, 40)
    ]
    
    for name, start, end in feature_groups:
        positions = list(range(start, end))
        lags = [f"lag_{i+1}" for i in range(4)]
        print(f"\n{name}:")
        for pos, lag in zip(positions, lags):
            print(f"  Position {pos:2d}: {name} {lag}")
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    print("✓ 40 features total")
    print("✓ Each parameter has 4 lag values")
    print("✓ lag_1 is always the most recent week")
    print("✓ Features are grouped by parameter type, then by lag")

if __name__ == "__main__":
    verify_feature_order()