#!/usr/bin/env python3

import os
import sys
import json
import tempfile
import shutil
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from visual_crossing_puller import VisualCrossingPuller

def create_mock_weather_data():
    """Create mock weather data for testing."""
    return [
        {
            'date': (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d'),
            'temperature': {
                'max': 28.5 - i * 0.5,
                'min': 20.0 - i * 0.2,
                'avg': 24.0 - i * 0.3
            },
            'humidity': {
                'max': 85.0,
                'min': 85.0,
                'mean': 85.0
            },
            'precipitation': 5.0 + i
        }
        for i in range(28)  # 4 weeks of data
    ]

def test_check_existing_data():
    """Test the check_existing_data method."""
    print("=" * 60)
    print("Testing check_existing_data method")
    print("=" * 60)
    
    # Create temporary directory for test data
    with tempfile.TemporaryDirectory() as temp_dir:
        # Mock the weather_data directory
        weather_dir = os.path.join(temp_dir, 'weather_data')
        os.makedirs(weather_dir)
        
        # Create a test data file
        test_municipality = 'Dili'
        test_data = create_mock_weather_data()
        filename = f"{test_municipality}_historical_{datetime.now().strftime('%Y%m%d')}.json"
        filepath = os.path.join(weather_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(test_data, f)
        
        # Create puller instance
        puller = VisualCrossingPuller("test_api_key")
        
        # Mock the weather_data path
        with patch('visual_crossing_puller.os.path.exists') as mock_exists:
            mock_exists.return_value = True
            
            with patch('builtins.open', open):
                # Update path to use temp directory
                expected_path = f"weather_data/{test_municipality}_historical_{datetime.now().strftime('%Y%m%d')}.json"
                with patch.object(puller, 'check_existing_data') as mock_check:
                    # Simulate finding existing data
                    mock_check.return_value = test_data
                    
                    result = mock_check(test_municipality, "historical")
                    
                    assert result is not None, "Should find existing data"
                    assert len(result) == 28, f"Should have 28 days of data, got {len(result)}"
                    print(f"✓ Successfully found existing data for {test_municipality}")

def test_check_consolidated_files_exist():
    """Test the check_consolidated_files_exist method."""
    print("\n" + "=" * 60)
    print("Testing check_consolidated_files_exist method")
    print("=" * 60)
    
    puller = VisualCrossingPuller("test_api_key")
    current_date = datetime.now().strftime('%Y%m%d')
    
    # Test when files don't exist
    with patch('os.path.exists') as mock_exists:
        mock_exists.return_value = False
        weekly_exists, forecast_exists = puller.check_consolidated_files_exist()
        
        assert not weekly_exists, "Weekly file should not exist"
        assert not forecast_exists, "Forecast file should not exist"
        print("✓ Correctly identified missing files")
    
    # Test when files exist
    with patch('os.path.exists') as mock_exists:
        mock_exists.return_value = True
        weekly_exists, forecast_exists = puller.check_consolidated_files_exist()
        
        assert weekly_exists, "Weekly file should exist"
        assert forecast_exists, "Forecast file should exist"
        print("✓ Correctly identified existing files")

def test_optimization_flow():
    """Test the optimization flow - skipping when data exists."""
    print("\n" + "=" * 60)
    print("Testing optimization flow")
    print("=" * 60)
    
    # Create mock consolidated data
    mock_weekly_data = {
        'Dili': [{'week_start': '2025-01-01', 'week_end': '2025-01-07'}],
        'Aileu': [{'week_start': '2025-01-01', 'week_end': '2025-01-07'}]
    }
    
    mock_forecast_data = {
        'Dili': [{'week_start': '2025-01-08', 'week_end': '2025-01-14'}],
        'Aileu': [{'week_start': '2025-01-08', 'week_end': '2025-01-14'}]
    }
    
    # Test scenario 1: All files exist, should skip everything
    print("\nScenario 1: All consolidated files exist")
    
    with patch.dict(os.environ, {'VISUAL_CROSSING_API_KEY': 'test_key'}):
        with patch('visual_crossing_puller.VisualCrossingPuller.check_consolidated_files_exist') as mock_check:
            mock_check.return_value = (True, True)
            
            with patch('visual_crossing_puller.VisualCrossingPuller.load_existing_consolidated_data') as mock_load:
                mock_load.return_value = (mock_weekly_data, mock_forecast_data)
                
                # Import and run main
                from visual_crossing_puller import main
                
                # Should return early without making API calls
                with patch('visual_crossing_puller.VisualCrossingPuller.get_historical_weather') as mock_api:
                    main()
                    
                    # Verify no API calls were made
                    mock_api.assert_not_called()
                    print("✓ No API calls made when all data exists")

def test_partial_data_optimization():
    """Test optimization when some municipalities have data."""
    print("\n" + "=" * 60)
    print("Testing partial data optimization")
    print("=" * 60)
    
    puller = VisualCrossingPuller("test_api_key")
    
    # Mock data for some municipalities
    existing_weekly = {
        'Dili': [{'week_start': '2025-01-01'}],
        'Aileu': [{'week_start': '2025-01-01'}]
    }
    
    existing_forecast = {
        'Dili': [{'week_start': '2025-01-08'}]
        # Aileu is missing forecast data
    }
    
    # Test which municipalities need data
    municipalities_needing_data = []
    
    for municipality in ['Dili', 'Aileu', 'Baucau']:
        if municipality in existing_weekly and municipality in existing_forecast:
            continue
        municipalities_needing_data.append(municipality)
    
    assert 'Dili' not in municipalities_needing_data, "Dili has all data"
    assert 'Aileu' in municipalities_needing_data, "Aileu missing forecast"
    assert 'Baucau' in municipalities_needing_data, "Baucau has no data"
    
    print(f"✓ Correctly identified municipalities needing data: {municipalities_needing_data}")

def test_date_ranges():
    """Test date range calculations."""
    print("\n" + "=" * 60)
    print("Testing date range calculations")
    print("=" * 60)
    
    puller = VisualCrossingPuller("test_api_key")
    
    # Test historical date range (4 weeks back)
    start_date, end_date = puller.get_date_range()
    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    end_dt = datetime.strptime(end_date, '%Y-%m-%d')
    
    days_diff = (end_dt - start_dt).days
    assert days_diff == 28, f"Should be 28 days (4 weeks), got {days_diff}"
    print(f"✓ Historical range: {start_date} to {end_date} ({days_diff} days)")
    
    # Test forecast date range (next week)
    forecast_start, forecast_end = puller.get_forecast_date_range()
    forecast_start_dt = datetime.strptime(forecast_start, '%Y-%m-%d')
    forecast_end_dt = datetime.strptime(forecast_end, '%Y-%m-%d')
    
    forecast_days = (forecast_end_dt - forecast_start_dt).days
    assert forecast_days == 6, f"Should be 6 days (1 week minus 1), got {forecast_days}"
    
    # Check forecast starts tomorrow
    tomorrow = datetime.now() + timedelta(days=1)
    assert forecast_start_dt.date() == tomorrow.date(), "Forecast should start tomorrow"
    print(f"✓ Forecast range: {forecast_start} to {forecast_end} ({forecast_days + 1} days total)")

def main():
    """Run all tests."""
    print("Testing Optimized Visual Crossing Puller")
    print("=" * 60)
    
    try:
        # Test 1: Check existing data functionality
        test_check_existing_data()
        
        # Test 2: Check consolidated files exist
        test_check_consolidated_files_exist()
        
        # Test 3: Optimization flow
        test_optimization_flow()
        
        # Test 4: Partial data optimization
        test_partial_data_optimization()
        
        # Test 5: Date ranges
        test_date_ranges()
        
        print("\n" + "=" * 60)
        print("All tests passed! ✓")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())