#!/usr/bin/env python3

import requests
import json

def test_air_quality_api():
    # Test the air quality API with correct subpath endpoints
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

    # Test air quality endpoints with correct subpaths
    endpoints = [
        'http://localhost:8088/api/v1/air_quality_forecast',  # Root endpoint (should fail)
        'http://localhost:8088/api/v1/air_quality_forecast/current',  # Subpath endpoints
        'http://localhost:8088/api/v1/air_quality_forecast/daily',
        'http://localhost:8088/api/v1/air_quality_forecast/forecast',
        'http://localhost:8088/api/v1/air_quality_forecast/map',
    ]

    print('Testing Air Quality API endpoints:')
    
    for endpoint in endpoints:
        try:
            response = session.get(endpoint, timeout=5)
            status = "✅ SUCCESS" if response.status_code == 200 else f"❌ FAILED ({response.status_code})"
            print(f'{endpoint}: {status}')
            
            if response.status_code != 200:
                print(f'  Error: {response.text[:150]}...')
                
        except Exception as e:
            print(f'{endpoint}: ERROR - {e}')

if __name__ == '__main__':
    test_air_quality_api()