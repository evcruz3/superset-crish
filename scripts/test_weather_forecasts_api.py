#!/usr/bin/env python3

import requests
import json

def test_weather_forecasts_api():
    # Test the weather_forecasts API
    session = requests.Session()

    # Login first
    login_url = 'http://localhost:8088/login/'
    login_response = session.get(login_url)

    # Extract CSRF token
    csrf_start = login_response.text.find('csrf_token') + 15
    csrf_end = login_response.text.find('"', csrf_start)
    csrf_token = login_response.text[csrf_start:csrf_end]

    # Login with credentials
    login_data = {
        'username': 'admin',
        'password': 'admin', 
        'csrf_token': csrf_token
    }
    session.post(login_url, data=login_data)

    # Test the fixed endpoints that were previously returning 404
    endpoints = [
        'http://localhost:8088/api/v1/weather_forecasts/wind_speed',
        'http://localhost:8088/api/v1/weather_forecasts/heat_index',
        'http://localhost:8088/api/v1/weather_forecasts/rainfall',
        'http://localhost:8088/api/v1/weather_forecasts/humidity',
        'http://localhost:8088/api/v1/weather_forecasts/temp_max',
        'http://localhost:8088/api/v1/weather_forecasts/temp_min',
        'http://localhost:8088/api/v1/disease_forecast_alert',  # Use existing alert endpoint
        'http://localhost:8088/api/v1/bulletins',
        'http://localhost:8088/api/v1/air_quality_forecast'
    ]

    print('Testing Fixed API endpoints:')
    results = []
    
    for endpoint in endpoints:
        try:
            response = session.get(endpoint, timeout=5)
            status = "✅ SUCCESS" if response.status_code == 200 else f"❌ FAILED ({response.status_code})"
            print(f'{endpoint}: {status}')
            
            results.append({
                'endpoint': endpoint,
                'status_code': response.status_code,
                'success': response.status_code == 200,
                'response_size': len(response.text)
            })
            
            if response.status_code != 200:
                print(f'  Error: {response.text[:200]}...')
                
        except Exception as e:
            print(f'{endpoint}: ERROR - {e}')
            results.append({
                'endpoint': endpoint,
                'status_code': None,
                'success': False,
                'error': str(e)
            })
    
    # Summary
    successful = sum(1 for r in results if r.get('success', False))
    total = len(results)
    
    print(f'\nSUMMARY: {successful}/{total} endpoints working')
    
    return results

if __name__ == '__main__':
    test_weather_forecasts_api()