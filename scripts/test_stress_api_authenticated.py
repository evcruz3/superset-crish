#!/usr/bin/env python3
"""
Authenticated stress testing script for CRISH API endpoints.
Uses session-based authentication with admin credentials.
"""
import requests
import time
import statistics
import json
from datetime import datetime
from bs4 import BeautifulSoup
import asyncio
import aiohttp
from aiohttp import CookieJar

class AuthenticatedAPIStressTester:
    def __init__(self, base_url="http://localhost:8088"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session_cookie = None
        self.results = []
        
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
            
        # Get session cookie for async requests
        self.session_cookie = self.session.cookies.get_dict().get('session')
        print("Authentication successful!")
        return True
        
    async def test_endpoint(self, session, endpoint):
        """Test a single API endpoint with authentication."""
        cookies = {'session': self.session_cookie} if self.session_cookie else {}
        
        start_time = time.time()
        try:
            async with session.get(f"{self.base_url}{endpoint}", cookies=cookies) as response:
                end_time = time.time()
                return {
                    "endpoint": endpoint,
                    "status": response.status,
                    "response_time": end_time - start_time,
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            end_time = time.time()
            return {
                "endpoint": endpoint,
                "status": "error",
                "error": str(e),
                "response_time": end_time - start_time,
                "timestamp": datetime.now().isoformat()
            }
    
    async def stress_test_endpoints(self, endpoints, concurrent_requests=10, total_requests=100):
        """Perform stress testing with authentication."""
        print(f"Starting authenticated stress test")
        print(f"Concurrent requests: {concurrent_requests}, Total per endpoint: {total_requests}")
        print("-" * 60)
        
        # Create cookie jar with session cookie
        jar = CookieJar()
        if self.session_cookie:
            jar.update_cookies({'session': self.session_cookie})
        
        async with aiohttp.ClientSession(cookie_jar=jar) as session:
            for endpoint in endpoints:
                print(f"\\nTesting endpoint: {endpoint}")
                endpoint_results = []
                
                # Create batches of concurrent requests
                for i in range(0, total_requests, concurrent_requests):
                    batch_size = min(concurrent_requests, total_requests - i)
                    tasks = [self.test_endpoint(session, endpoint) for _ in range(batch_size)]
                    
                    batch_results = await asyncio.gather(*tasks)
                    endpoint_results.extend(batch_results)
                    
                    await asyncio.sleep(0.1)  # Small delay between batches
                
                # Analyze results
                self.analyze_endpoint_results(endpoint, endpoint_results)
                self.results.extend(endpoint_results)
    
    def analyze_endpoint_results(self, endpoint, results):
        """Analyze and print statistics for endpoint results."""
        successful_requests = [r for r in results if isinstance(r.get('status'), int) 
                              and 200 <= r['status'] < 300]
        failed_requests = [r for r in results if r.get('status') == 'error' 
                          or (isinstance(r.get('status'), int) and r['status'] >= 400)]
        
        if successful_requests:
            response_times = [r['response_time'] for r in successful_requests]
            
            print(f"  Success rate: {len(successful_requests)}/{len(results)} "
                  f"({len(successful_requests)/len(results)*100:.1f}%)")
            print(f"  Average response time: {statistics.mean(response_times):.3f}s")
            print(f"  Min response time: {min(response_times):.3f}s")
            print(f"  Max response time: {max(response_times):.3f}s")
            print(f"  Median response time: {statistics.median(response_times):.3f}s")
            
            if len(response_times) > 1:
                print(f"  Std deviation: {statistics.stdev(response_times):.3f}s")
                
            # Calculate percentiles
            sorted_times = sorted(response_times)
            p95_index = int(len(sorted_times) * 0.95)
            if p95_index < len(sorted_times):
                print(f"  95th percentile: {sorted_times[p95_index]:.3f}s")
        
        if failed_requests:
            print(f"  Failed requests: {len(failed_requests)}")
            error_types = {}
            for r in failed_requests:
                error = r.get('error', f"HTTP {r.get('status', 'Unknown')}")
                error_types[error] = error_types.get(error, 0) + 1
            
            for error, count in error_types.items():
                print(f"    {error}: {count}")
    
    def save_results(self, filename):
        """Save test results to JSON file."""
        successful_results = [r for r in self.results if isinstance(r.get('status'), int) and 200 <= r['status'] < 300]
        
        output = {
            "test_date": datetime.now().isoformat(),
            "total_requests": len(self.results),
            "endpoints_tested": len(set(r['endpoint'] for r in self.results)),
            "overall_success_rate": len(successful_results) / len(self.results) if self.results else 0,
            "results": self.results[:10]  # Save first 10 results as sample
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"\\nResults saved to {filename}")

async def main():
    """Main function to run authenticated stress tests."""
    # Test endpoints - All CRISH API endpoints with openapi_spec_tag containing "CRISH"
    endpoints = [
        # Weather & Climate APIs
        "/api/v1/weather_forecast",
        "/api/v1/weather_forecast_alert", 
        "/api/v1/weather_data_pull",
        
        # Disease Forecasting APIs
        "/api/v1/disease_forecast",
        "/api/v1/disease_forecast_alert",
        "/api/v1/disease_pipeline_run_history",
        
        # Health Facilities APIs  
        "/api/v1/health_facilities",
        "/api/v1/health_facilities/types",
        "/api/v1/update_facilities",
        
        # Disease Data Management APIs
        "/api/v1/disease_data",
        "/api/v1/update_case_reports",
        
        # Communication & Dissemination APIs
        "/api/v1/email_groups",
        "/api/v1/whatsapp_groups",
        
        # Public Education API
        "/api/v1/public_education",
        
        # Bulletins & Advisories API
        "/api/v1/bulletins_and_advisories",
        
        # Air Quality API
        "/api/v1/air_quality_forecast",
        
        # Core Superset APIs (for comparison)
        "/api/v1/chart/",
        "/api/v1/dashboard/"
    ]
    
    # Test configurations
    test_configs = [
        {"concurrent": 5, "total": 50, "name": "light_load"},
        {"concurrent": 10, "total": 100, "name": "medium_load"},
        {"concurrent": 20, "total": 200, "name": "heavy_load"}
    ]
    
    tester = AuthenticatedAPIStressTester()
    
    try:
        # Login first
        tester.login()
        
        # Run tests
        for config in test_configs:
            print(f"\\n{'='*60}")
            print(f"Running {config['name']} test")
            print(f"{'='*60}")
            
            await tester.stress_test_endpoints(
                endpoints,
                concurrent_requests=config['concurrent'],
                total_requests=config['total']
            )
            
            # Save results
            tester.save_results(f"authenticated_stress_test_{config['name']}_results.json")
            
            # Clear results for next test
            tester.results = []
            
            # Brief pause between tests
            print(f"\\nWaiting 3 seconds before next test...")
            await asyncio.sleep(3)
            
    except Exception as e:
        print(f"Test execution failed: {e}")
    
    print("\\n" + "="*60)
    print("Authenticated stress testing completed!")
    print("="*60)

if __name__ == "__main__":
    print("CRISH Authenticated API Stress Testing Tool")
    print("="*60)
    print("Using admin credentials for authentication")
    print("="*60)
    
    asyncio.run(main())