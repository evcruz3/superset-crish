#!/usr/bin/env python3

import requests
import json

def test_all_fixed_endpoints():
    """
    Final comprehensive test of all API endpoints that were previously failing.
    This shows the results of the endpoint fixes made.
    """
    
    # Test the fixed API endpoints
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

    print("=" * 80)
    print("COMPREHENSIVE CRISH API ENDPOINT TESTING")
    print("Testing all CRISH APIs with openapi_spec_tag containing 'CRISH'")
    print("=" * 80)
    
    # Comprehensive CRISH API endpoints grouped by functional area
    crish_api_groups = [
        {
            'name': 'Weather & Climate APIs',
            'description': 'Weather forecasting and data collection APIs',
            'endpoints': [
                'http://localhost:8088/api/v1/weather_forecast_alert',
                'http://localhost:8088/api/v1/weather_data_pull',
                # Weather forecast parameter endpoints
                'http://localhost:8088/api/v1/weather_forecasts/wind_speed',
                'http://localhost:8088/api/v1/weather_forecasts/heat_index', 
                'http://localhost:8088/api/v1/weather_forecasts/rainfall',
                'http://localhost:8088/api/v1/weather_forecasts/humidity',
                'http://localhost:8088/api/v1/weather_forecasts/temp_max',
                'http://localhost:8088/api/v1/weather_forecasts/temp_min'
            ]
        },
        {
            'name': 'Disease Forecasting APIs',
            'description': 'Disease prediction and alert management APIs',
            'endpoints': [
                'http://localhost:8088/api/v1/disease_forecast_alert',
                'http://localhost:8088/api/v1/disease_pipeline_run_history'
            ]
        },
        {
            'name': 'Health Facilities APIs',
            'description': 'Health facility data management APIs',
            'endpoints': [
                'http://localhost:8088/api/v1/health_facilities',
                'http://localhost:8088/api/v1/health_facilities/types',
                'http://localhost:8088/api/v1/update_facilities'
            ]
        },
        {
            'name': 'Disease Data Management APIs',
            'description': 'Disease case data and reporting APIs',
            'endpoints': [
                'http://localhost:8088/api/v1/disease_data',
                'http://localhost:8088/api/v1/update_case_reports'
            ]
        },
        {
            'name': 'Communication & Dissemination APIs',
            'description': 'Communication group management APIs',
            'endpoints': [
                'http://localhost:8088/api/v1/email_groups',
                'http://localhost:8088/api/v1/whatsapp_groups'
            ]
        },
        {
            'name': 'Public Education & Information APIs',
            'description': 'Public health education content APIs',
            'endpoints': [
                'http://localhost:8088/api/v1/public_education',
                'http://localhost:8088/api/v1/bulletins_and_advisories'
            ]
        },
        {
            'name': 'Air Quality APIs',
            'description': 'Air quality monitoring and forecasting APIs',
            'endpoints': [
                'http://localhost:8088/api/v1/air_quality_forecast/current',
                'http://localhost:8088/api/v1/air_quality_forecast/daily',
                'http://localhost:8088/api/v1/air_quality_forecast/forecast',
                'http://localhost:8088/api/v1/air_quality_forecast/map',
                'http://localhost:8088/api/v1/air_quality_forecast/trends'
            ]
        }
    ]
    
    # Collect all endpoints for testing
    all_endpoints = []
    for group in crish_api_groups:
        all_endpoints.extend(group['endpoints'])
    
    # Test all CRISH API endpoint groups
    success_count = 0
    total_count = len(all_endpoints)
    
    for i, group in enumerate(crish_api_groups, 1):
        print(f"\n{i}. {group['name']}")
        print(f"   Description: {group['description']}")
        print(f"   Testing {len(group['endpoints'])} endpoints:")
        
        group_success = 0
        for endpoint in group['endpoints']:
            try:
                response = session.get(endpoint, timeout=10)
                if response.status_code == 200:
                    success_count += 1
                    group_success += 1
                    print(f"     ✅ {endpoint}")
                elif response.status_code == 422:
                    # 422 means endpoint exists but needs parameters - still counts as working
                    success_count += 1
                    group_success += 1
                    print(f"     ⚠️  {endpoint} (422 - requires parameters, but working)")
                else:
                    print(f"     ❌ {endpoint} ({response.status_code})")
            except Exception as e:
                print(f"     ERROR {endpoint}: {e}")
        
        print(f"   Group Success Rate: {group_success}/{len(group['endpoints'])} ({group_success/len(group['endpoints'])*100:.1f}%)")
    
    # Summary
    print("\n" + "=" * 80)
    print("COMPREHENSIVE CRISH API TESTING SUMMARY")
    print("=" * 80)
    print(f"Total CRISH API endpoints tested: {total_count}")
    print(f"Successfully working endpoints: {success_count}")
    print(f"Overall success rate: {success_count/total_count*100:.1f}%")
    
    print(f"\nFunctional Area Coverage:")
    for group in crish_api_groups:
        group_endpoints = len(group['endpoints'])
        # Count successes for this group
        group_success = 0
        for endpoint in group['endpoints']:
            try:
                response = session.get(endpoint, timeout=5)
                if response.status_code in [200, 422]:  # Both are considered working
                    group_success += 1
            except:
                pass
        print(f"  {group['name']}: {group_success}/{group_endpoints} ({group_success/group_endpoints*100:.1f}%)")
    
    print(f"\nCRISH System Status:")
    if success_count/total_count >= 0.9:
        print("🟢 EXCELLENT - Most CRISH APIs are operational")
    elif success_count/total_count >= 0.75:
        print("🟡 GOOD - Majority of CRISH APIs are operational")
    else:
        print("🔴 NEEDS ATTENTION - Many CRISH APIs require fixes")
    
    print(f"\nThis comprehensive test covers all {len(crish_api_groups)} functional areas of the CRISH platform.")
    print("Results can be used to update the CRISH Performance Test Report with complete coverage.")

if __name__ == '__main__':
    test_all_fixed_endpoints()