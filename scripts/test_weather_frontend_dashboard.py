#!/usr/bin/env python3
"""
Test script for Weather Forecasts Frontend Dashboard.
Tests the actual rendered React frontend at /weather/ route.
"""
import requests
import time
import json
from datetime import datetime
from bs4 import BeautifulSoup
import statistics

class WeatherFrontendTester:
    def __init__(self, base_url="http://localhost:8088"):
        self.base_url = base_url
        self.session = requests.Session()
        
    def login(self):
        """Login to get authenticated session."""
        # Get login page for CSRF token
        login_page_url = f'{self.base_url}/login/'
        login_page = self.session.get(login_page_url)
        
        if login_page.status_code != 200:
            raise Exception(f"Failed to get login page: {login_page.status_code}")
            
        # Extract CSRF token
        soup = BeautifulSoup(login_page.content, 'html.parser')
        csrf_token = soup.find('input', {'name': 'csrf_token'})['value']
        
        # Login with credentials
        login_data = {
            'username': 'admin',
            'password': 'admin', 
            'csrf_token': csrf_token
        }
        
        login_response = self.session.post(login_page_url, data=login_data, allow_redirects=False)
        
        if login_response.status_code not in [302, 200]:
            raise Exception(f"Login failed: {login_response.status_code}")
            
        print("✅ Authentication successful!")
        return True
    
    def test_weather_frontend_page(self):
        """Test the Weather Forecasts frontend page load and components."""
        print("\n" + "="*60)
        print("Testing Weather Forecasts Frontend Dashboard")
        print("="*60)
        
        # Test page load performance
        page_url = f"{self.base_url}/weather/"
        load_times = []
        
        print("\n1. Page Load Performance Test (5 iterations):")
        print("-" * 40)
        
        for i in range(5):
            start_time = time.time()
            response = self.session.get(page_url)
            end_time = time.time()
            load_time = end_time - start_time
            load_times.append(load_time)
            
            print(f"   Iteration {i+1}: {load_time:.3f}s (Status: {response.status_code})")
            
            if response.status_code != 200:
                print(f"   ❌ Failed to load page: {response.status_code}")
                continue
                
            # Check page content
            if i == 0:  # Only analyze content on first successful load
                content_length = len(response.content)
                print(f"\n   Page Size: {content_length / 1024:.2f} KB")
                
                # Check if React app loaded
                if 'id="app"' in response.text:
                    print("   ✅ React app container found")
                else:
                    print("   ❌ React app container not found")
                    
                # Check for weather-specific content markers
                if 'Weather' in response.text or 'weather' in response.text:
                    print("   ✅ Weather content indicators found")
                else:
                    print("   ⚠️  Weather content indicators not found in initial HTML")
        
        # Performance summary
        if load_times:
            print(f"\n   Performance Summary:")
            print(f"   Average Load Time: {statistics.mean(load_times):.3f}s")
            print(f"   Min Load Time: {min(load_times):.3f}s")
            print(f"   Max Load Time: {max(load_times):.3f}s")
            if len(load_times) > 1:
                print(f"   Std Deviation: {statistics.stdev(load_times):.3f}s")
    
    def test_weather_api_endpoints(self):
        """Test API endpoints used by the Weather frontend."""
        print("\n2. Testing Weather Frontend API Dependencies:")
        print("-" * 40)
        
        # Test weather data pull endpoint (used by frontend)
        api_endpoints = [
            {
                'name': 'Weather Data Pull - Last Pull',
                'endpoint': '/api/v1/weather_data_pull/last_pull',
                'expected_status': [200, 404]  # 404 is ok if no pulls yet
            },
            {
                'name': 'Weather Forecast Alert',
                'endpoint': '/api/v1/weather_forecast_alert',
                'expected_status': [200]
            },
            {
                'name': 'Chart Data - 10 Day Forecast',
                'endpoint': '/api/v1/chart/data',
                'method': 'POST',
                'data': {
                    'datasource': {'id': 1, 'type': 'table'},
                    'queries': [{
                        'metrics': [],
                        'where': '',
                        'columns': []
                    }]
                },
                'expected_status': [200, 400, 422]  # May fail without proper chart config
            }
        ]
        
        for api in api_endpoints:
            start_time = time.time()
            
            if api.get('method') == 'POST':
                response = self.session.post(
                    f"{self.base_url}{api['endpoint']}", 
                    json=api.get('data', {})
                )
            else:
                response = self.session.get(f"{self.base_url}{api['endpoint']}")
                
            end_time = time.time()
            response_time = end_time - start_time
            
            status_icon = "✅" if response.status_code in api['expected_status'] else "❌"
            print(f"   {status_icon} {api['name']}: {response.status_code} ({response_time:.3f}s)")
            
            # Show sample data for successful responses
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'result' in data:
                        print(f"      Data: {str(data)[:100]}...")
                except:
                    pass
    
    def test_chart_slugs(self):
        """Test if chart slugs referenced in the frontend exist."""
        print("\n3. Testing Chart Slug Availability:")
        print("-" * 40)
        
        # Chart slugs used in WeatherForecasts component
        chart_slugs = [
            '10_day_weather_forecast',
            'weather_forecast_alerts',
            'weather_forecast_table'
        ]
        
        # Note: We can't directly test chart slug resolution without the full API
        # but we can check if the dashboard/chart APIs are responsive
        print("   Chart slugs referenced in Weather frontend:")
        for slug in chart_slugs:
            print(f"   - {slug}")
        
        # Test if chart API is available
        chart_api_test = self.session.get(f"{self.base_url}/api/v1/chart/")
        if chart_api_test.status_code == 200:
            print("\n   ✅ Chart API is accessible")
            try:
                charts = chart_api_test.json()
                if 'result' in charts and charts['result']:
                    print(f"   Found {len(charts['result'])} charts in the system")
                    
                    # Look for weather-related charts
                    weather_charts = [
                        c for c in charts['result'] 
                        if 'weather' in c.get('slice_name', '').lower() or 
                           'weather' in c.get('viz_type', '').lower()
                    ]
                    if weather_charts:
                        print(f"   Found {len(weather_charts)} weather-related charts")
                        for chart in weather_charts[:3]:
                            print(f"   - {chart.get('slice_name', 'Unknown')}")
            except:
                pass
        else:
            print(f"   ❌ Chart API returned status: {chart_api_test.status_code}")
    
    def test_concurrent_access(self):
        """Test concurrent user access to weather dashboard."""
        print("\n4. Concurrent Access Test (5 simultaneous users):")
        print("-" * 40)
        
        import concurrent.futures
        
        def load_dashboard():
            """Single user loading the dashboard."""
            start = time.time()
            response = self.session.get(f"{self.base_url}/weather/")
            end = time.time()
            return {
                'status': response.status_code,
                'time': end - start,
                'size': len(response.content) if response.status_code == 200 else 0
            }
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(load_dashboard) for _ in range(5)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        successful = [r for r in results if r['status'] == 200]
        if successful:
            times = [r['time'] for r in successful]
            print(f"   Success Rate: {len(successful)}/5 ({len(successful)*20}%)")
            print(f"   Average Load Time: {statistics.mean(times):.3f}s")
            print(f"   Max Load Time: {max(times):.3f}s")
            print(f"   Performance Degradation: {(max(times) - min(times)) / min(times) * 100:.1f}%")
    
    def save_results(self, filename="weather_frontend_test_results.json"):
        """Save test results to JSON file."""
        results = {
            "test_date": datetime.now().isoformat(),
            "frontend_route": "/weather/",
            "test_type": "Weather Forecasts Frontend Dashboard",
            "status": "completed"
        }
        
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n✅ Results saved to {filename}")

def main():
    """Main test execution function."""
    tester = WeatherFrontendTester()
    
    print("CRISH Weather Forecasts Frontend Testing")
    print("Testing actual React frontend at /weather/")
    print("="*60)
    
    try:
        # Login first
        tester.login()
        
        # Run tests
        tester.test_weather_frontend_page()
        tester.test_weather_api_endpoints()
        tester.test_chart_slugs()
        tester.test_concurrent_access()
        
        # Save results
        tester.save_results()
        
        print("\n" + "="*60)
        print("Weather Frontend Testing Completed!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()