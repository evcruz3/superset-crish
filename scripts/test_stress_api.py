#!/usr/bin/env python3
"""
Stress testing script for CRISH API endpoints.
Tests API performance under various load conditions.
"""
import asyncio
import aiohttp
import time
import statistics
import json
from datetime import datetime
import os
import sys

# Add superset to path
sys.path.append('/app')

class APIStressTester:
    def __init__(self, base_url="http://localhost:8088", auth_token=None):
        self.base_url = base_url
        self.auth_token = auth_token
        self.results = []
        
    async def test_endpoint(self, session, endpoint, method="GET", data=None):
        """Test a single API endpoint and measure response time."""
        headers = {}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        start_time = time.time()
        try:
            async with session.request(method, f"{self.base_url}{endpoint}", 
                                     headers=headers, json=data) as response:
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
    
    async def stress_test_endpoints(self, endpoints, concurrent_requests=10, 
                                  total_requests=100):
        """Perform stress testing on multiple endpoints."""
        print(f"Starting stress test with {concurrent_requests} concurrent requests")
        print(f"Total requests per endpoint: {total_requests}")
        print("-" * 60)
        
        async with aiohttp.ClientSession() as session:
            for endpoint in endpoints:
                print(f"\nTesting endpoint: {endpoint['url']}")
                endpoint_results = []
                
                # Create batches of concurrent requests
                for i in range(0, total_requests, concurrent_requests):
                    batch_size = min(concurrent_requests, total_requests - i)
                    tasks = [
                        self.test_endpoint(session, endpoint['url'], 
                                         endpoint.get('method', 'GET'),
                                         endpoint.get('data'))
                        for _ in range(batch_size)
                    ]
                    
                    batch_results = await asyncio.gather(*tasks)
                    endpoint_results.extend(batch_results)
                    
                    # Small delay between batches to avoid overwhelming
                    await asyncio.sleep(0.1)
                
                # Analyze results for this endpoint
                self.analyze_endpoint_results(endpoint['url'], endpoint_results)
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
            p99_index = int(len(sorted_times) * 0.99)
            
            if p95_index < len(sorted_times):
                print(f"  95th percentile: {sorted_times[p95_index]:.3f}s")
            if p99_index < len(sorted_times):
                print(f"  99th percentile: {sorted_times[p99_index]:.3f}s")
        
        if failed_requests:
            print(f"  Failed requests: {len(failed_requests)}")
            error_types = {}
            for r in failed_requests:
                error = r.get('error', f"HTTP {r.get('status', 'Unknown')}")
                error_types[error] = error_types.get(error, 0) + 1
            
            for error, count in error_types.items():
                print(f"    {error}: {count}")
    
    def save_results(self, filename="stress_test_results.json"):
        """Save test results to a JSON file."""
        with open(filename, 'w') as f:
            json.dump({
                "test_date": datetime.now().isoformat(),
                "total_requests": len(self.results),
                "results": self.results
            }, f, indent=2)
        print(f"\nResults saved to {filename}")

async def main():
    """Main function to run stress tests."""
    # Define endpoints to test
    endpoints = [
        # Weather forecast endpoints
        {"url": "/api/v1/weather_forecast", "method": "GET"},
        {"url": "/api/v1/weather_forecast_alert", "method": "GET"},
        
        # Disease forecast endpoints
        {"url": "/api/v1/disease_forecast", "method": "GET"},
        {"url": "/api/v1/disease_forecast_alert", "method": "GET"},
        
        # Health facilities endpoints
        {"url": "/api/v1/health_facilities", "method": "GET"},
        {"url": "/api/v1/health_facilities/types", "method": "GET"},
        
        # Bulletins endpoints
        {"url": "/api/v1/bulletins", "method": "GET"},
        {"url": "/api/v1/bulletins?page_size=10", "method": "GET"},
        
        # Air quality endpoints (if available)
        {"url": "/api/v1/air_quality_forecast", "method": "GET"},
    ]
    
    # Test configurations
    test_configs = [
        {"concurrent": 5, "total": 50, "name": "Light load"},
        {"concurrent": 10, "total": 100, "name": "Medium load"},
        {"concurrent": 20, "total": 200, "name": "Heavy load"},
        {"concurrent": 50, "total": 500, "name": "Stress load"},
    ]
    
    tester = APIStressTester()
    
    for config in test_configs:
        print(f"\n{'='*60}")
        print(f"Running {config['name']} test")
        print(f"{'='*60}")
        
        await tester.stress_test_endpoints(
            endpoints,
            concurrent_requests=config['concurrent'],
            total_requests=config['total']
        )
        
        # Save results for each test configuration
        tester.save_results(f"stress_test_{config['name'].lower().replace(' ', '_')}.json")
        
        # Clear results for next test
        tester.results = []
        
        # Delay between test configurations
        print(f"\nWaiting 5 seconds before next test configuration...")
        await asyncio.sleep(5)
    
    print("\n" + "="*60)
    print("Stress testing completed!")
    print("="*60)

if __name__ == "__main__":
    print("CRISH API Stress Testing Tool")
    print("="*60)
    print("This tool will test API endpoints under various load conditions")
    print("Make sure the Superset server is running on http://localhost:8088")
    print("="*60)
    
    asyncio.run(main())