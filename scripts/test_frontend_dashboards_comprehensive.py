#!/usr/bin/env python3
"""
Comprehensive test script for CRISH Frontend Dashboards.
Tests the actual rendered React frontend dashboards including:
- Weather Forecasts (/weather/)
- Disease Forecasts (/disease-forecasts/)
- Other key frontend routes
"""
import requests
import time
import json
from datetime import datetime
from bs4 import BeautifulSoup
import statistics
import concurrent.futures

class FrontendDashboardTester:
    def __init__(self, base_url="http://localhost:8088"):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_results = []
        
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
    
    def test_dashboard_page(self, name, route, expected_content=None):
        """Test a specific dashboard frontend page."""
        print(f"\n{'='*60}")
        print(f"Testing {name} Dashboard")
        print(f"Route: {route}")
        print('='*60)
        
        page_url = f"{self.base_url}{route}"
        load_times = []
        results = {
            'name': name,
            'route': route,
            'tests': {}
        }
        
        print("\n1. Page Load Performance (5 iterations):")
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
                results['status'] = 'failed'
                results['error'] = f"HTTP {response.status_code}"
                continue
                
            # Analyze page content on first successful load
            if i == 0:
                content_length = len(response.content)
                print(f"\n   Page Size: {content_length / 1024:.2f} KB")
                
                # Check React app loaded
                if 'id="app"' in response.text:
                    print("   ✅ React app container found")
                    results['react_loaded'] = True
                else:
                    print("   ❌ React app container not found")
                    results['react_loaded'] = False
                    
                # Check for expected content
                if expected_content:
                    found_content = []
                    missing_content = []
                    for content in expected_content:
                        if content.lower() in response.text.lower():
                            found_content.append(content)
                        else:
                            missing_content.append(content)
                    
                    if found_content:
                        print(f"   ✅ Found expected content: {', '.join(found_content)}")
                    if missing_content:
                        print(f"   ⚠️  Missing expected content: {', '.join(missing_content)}")
                    
                    results['content_check'] = {
                        'found': found_content,
                        'missing': missing_content
                    }
        
        # Performance summary
        if load_times:
            results['performance'] = {
                'average': statistics.mean(load_times),
                'min': min(load_times),
                'max': max(load_times),
                'std_dev': statistics.stdev(load_times) if len(load_times) > 1 else 0
            }
            
            print(f"\n   Performance Summary:")
            print(f"   Average Load Time: {results['performance']['average']:.3f}s")
            print(f"   Min Load Time: {results['performance']['min']:.3f}s")
            print(f"   Max Load Time: {results['performance']['max']:.3f}s")
            if len(load_times) > 1:
                print(f"   Std Deviation: {results['performance']['std_dev']:.3f}s")
        
        results['status'] = 'success' if load_times else 'failed'
        self.test_results.append(results)
        return results
    
    def test_api_dependencies(self, dashboard_name, api_endpoints):
        """Test API endpoints used by a dashboard."""
        print(f"\n2. API Dependencies for {dashboard_name}:")
        print("-" * 40)
        
        api_results = []
        
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
            
            success = response.status_code in api.get('expected_status', [200])
            status_icon = "✅" if success else "❌"
            
            result = {
                'name': api['name'],
                'endpoint': api['endpoint'],
                'status': response.status_code,
                'response_time': response_time,
                'success': success
            }
            
            print(f"   {status_icon} {api['name']}: {response.status_code} ({response_time:.3f}s)")
            
            # Show sample data for successful responses
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'result' in data:
                        print(f"      Data preview: {str(data)[:80]}...")
                    elif 'count' in data:
                        print(f"      Record count: {data['count']}")
                except:
                    pass
            
            api_results.append(result)
        
        return api_results
    
    def test_concurrent_access(self, dashboard_name, route):
        """Test concurrent user access to a dashboard."""
        print(f"\n3. Concurrent Access Test (5 users):")
        print("-" * 40)
        
        def load_dashboard():
            """Single user loading the dashboard."""
            start = time.time()
            response = self.session.get(f"{self.base_url}{route}")
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
            
            if len(times) > 1 and min(times) > 0:
                degradation = (max(times) - min(times)) / min(times) * 100
                print(f"   Performance Degradation: {degradation:.1f}%")
        
        return results
    
    def test_all_dashboards(self):
        """Test all major frontend dashboards."""
        dashboards = [
            {
                'name': 'Weather Forecasts',
                'route': '/weather/',
                'expected_content': ['Weather', 'Forecast'],
                'api_endpoints': [
                    {
                        'name': 'Weather Data Pull Status',
                        'endpoint': '/api/v1/weather_data_pull/last_pull',
                        'expected_status': [200, 404]
                    },
                    {
                        'name': 'Weather Forecast Alerts',
                        'endpoint': '/api/v1/weather_forecast_alert',
                        'expected_status': [200]
                    }
                ]
            },
            {
                'name': 'Disease Forecasts',
                'route': '/disease-forecasts/',
                'expected_content': ['Disease', 'Forecast'],
                'api_endpoints': [
                    {
                        'name': 'Disease Pipeline Status',
                        'endpoint': '/api/v1/disease_pipeline_run_history/latest',
                        'expected_status': [200, 404]
                    },
                    {
                        'name': 'Disease Forecast Alerts',
                        'endpoint': '/api/v1/disease_forecast_alert',
                        'expected_status': [200]
                    }
                ]
            },
            {
                'name': 'Home Dashboard',
                'route': '/superset/welcome/',
                'expected_content': ['Welcome', 'Superset'],
                'api_endpoints': []
            }
        ]
        
        overall_results = {
            'test_date': datetime.now().isoformat(),
            'dashboards_tested': len(dashboards),
            'results': []
        }
        
        for dashboard in dashboards:
            # Test page load
            page_results = self.test_dashboard_page(
                dashboard['name'],
                dashboard['route'],
                dashboard.get('expected_content')
            )
            
            # Test API dependencies
            if dashboard.get('api_endpoints'):
                api_results = self.test_api_dependencies(
                    dashboard['name'],
                    dashboard['api_endpoints']
                )
                page_results['api_tests'] = api_results
            
            # Test concurrent access
            concurrent_results = self.test_concurrent_access(
                dashboard['name'],
                dashboard['route']
            )
            page_results['concurrent_access'] = concurrent_results
            
            overall_results['results'].append(page_results)
        
        return overall_results
    
    def print_summary(self, results):
        """Print test summary."""
        print("\n" + "="*60)
        print("FRONTEND DASHBOARD TEST SUMMARY")
        print("="*60)
        
        successful_dashboards = [r for r in results['results'] if r.get('status') == 'success']
        
        print(f"\nDashboards Tested: {results['dashboards_tested']}")
        print(f"Successful: {len(successful_dashboards)}")
        print(f"Success Rate: {len(successful_dashboards)/results['dashboards_tested']*100:.0f}%")
        
        print("\nPerformance Summary:")
        print("-" * 40)
        
        for result in results['results']:
            if result.get('status') == 'success' and 'performance' in result:
                perf = result['performance']
                print(f"\n{result['name']} ({result['route']}):")
                print(f"  Average Load Time: {perf['average']:.3f}s")
                print(f"  Min/Max: {perf['min']:.3f}s / {perf['max']:.3f}s")
                
                # API test results
                if 'api_tests' in result:
                    successful_apis = [a for a in result['api_tests'] if a['success']]
                    print(f"  API Tests: {len(successful_apis)}/{len(result['api_tests'])} successful")
    
    def save_results(self, results, filename="frontend_dashboard_test_results.json"):
        """Save test results to JSON file."""
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n✅ Results saved to {filename}")

def main():
    """Main test execution function."""
    tester = FrontendDashboardTester()
    
    print("CRISH Frontend Dashboard Comprehensive Testing")
    print("Testing actual React frontend dashboards")
    print("="*60)
    
    try:
        # Login first
        tester.login()
        
        # Run all dashboard tests
        results = tester.test_all_dashboards()
        
        # Print summary
        tester.print_summary(results)
        
        # Save results
        tester.save_results(results)
        
        print("\n" + "="*60)
        print("Frontend Dashboard Testing Completed!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()