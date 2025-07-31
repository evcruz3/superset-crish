#!/usr/bin/env python3
"""
Demo API stress testing script for CRISH - simulates results for demonstration.
This version doesn't require a running Superset instance.
"""
import time
import json
import random
from datetime import datetime

class APIStressTesterDemo:
    def __init__(self):
        self.results = []
        
    def simulate_endpoint_test(self, endpoint, status_probability=0.95):
        """Simulate testing an endpoint with realistic response times."""
        # Simulate network latency and processing time
        base_time = random.uniform(0.1, 0.3)  # Base response time
        
        # Add variable load based on endpoint complexity
        if "forecast" in endpoint:
            base_time += random.uniform(0.1, 0.5)
        elif "alert" in endpoint:
            base_time += random.uniform(0.05, 0.3)
        elif "facilities" in endpoint:
            base_time += random.uniform(0.05, 0.2)
        
        # Simulate occasional slow responses
        if random.random() < 0.1:  # 10% chance of slow response
            base_time *= random.uniform(2, 5)
        
        # Simulate success/failure
        if random.random() < status_probability:
            status = 200
        else:
            status = random.choice([404, 500, 503])
        
        return {
            "endpoint": endpoint,
            "status": status,
            "response_time": base_time,
            "timestamp": datetime.now().isoformat()
        }
    
    def run_stress_test(self, endpoints, concurrent_requests, total_requests):
        """Simulate stress testing multiple endpoints."""
        print(f"\nRunning stress test: {concurrent_requests} concurrent, {total_requests} total")
        print("-" * 60)
        
        for endpoint in endpoints:
            print(f"Testing {endpoint['url']}...")
            endpoint_results = []
            
            # Simulate batch processing
            for i in range(total_requests):
                result = self.simulate_endpoint_test(endpoint['url'])
                endpoint_results.append(result)
                
                # Show progress
                if (i + 1) % 10 == 0:
                    print(f"  Progress: {i + 1}/{total_requests} requests", end='\r')
            
            print(f"  Completed {total_requests} requests")
            
            # Calculate statistics
            successful = [r for r in endpoint_results if r['status'] == 200]
            response_times = [r['response_time'] for r in successful]
            
            if response_times:
                avg_time = sum(response_times) / len(response_times)
                min_time = min(response_times)
                max_time = max(response_times)
                
                print(f"  Success rate: {len(successful)}/{total_requests} ({len(successful)/total_requests*100:.1f}%)")
                print(f"  Avg response: {avg_time:.3f}s, Min: {min_time:.3f}s, Max: {max_time:.3f}s")
            
            self.results.extend(endpoint_results)
            time.sleep(0.5)  # Brief pause between endpoints
    
    def save_results(self, filename):
        """Save test results to file."""
        summary = {
            "test_date": datetime.now().isoformat(),
            "total_requests": len(self.results),
            "endpoints_tested": len(set(r['endpoint'] for r in self.results)),
            "overall_success_rate": len([r for r in self.results if r['status'] == 200]) / len(self.results),
            "results": self.results[:10]  # Sample of results
        }
        
        with open(filename, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"\nResults saved to {filename}")

def main():
    print("CRISH API Stress Testing Tool (Demo Mode)")
    print("=" * 60)
    
    # Define test endpoints
    endpoints = [
        {"url": "/api/v1/weather_forecast", "method": "GET"},
        {"url": "/api/v1/weather_forecast_alert", "method": "GET"},
        {"url": "/api/v1/disease_forecast", "method": "GET"},
        {"url": "/api/v1/disease_forecast_alert", "method": "GET"},
        {"url": "/api/v1/health_facilities", "method": "GET"},
        {"url": "/api/v1/bulletins", "method": "GET"},
    ]
    
    # Test configurations
    test_configs = [
        {"concurrent": 5, "total": 50, "name": "Light load"},
        {"concurrent": 10, "total": 100, "name": "Medium load"},
        {"concurrent": 20, "total": 200, "name": "Heavy load"},
    ]
    
    tester = APIStressTesterDemo()
    
    for config in test_configs:
        print(f"\n{'='*60}")
        print(f"Test Configuration: {config['name']}")
        print(f"{'='*60}")
        
        tester.run_stress_test(
            endpoints,
            config['concurrent'],
            config['total']
        )
        
        # Save results
        filename = f"stress_test_{config['name'].lower().replace(' ', '_')}_results.json"
        tester.save_results(filename)
        
        time.sleep(2)
    
    print("\n" + "="*60)
    print("API Stress Testing Completed Successfully!")
    print("="*60)
    
    # Print summary statistics
    total_tests = sum(config['total'] * len(endpoints) for config in test_configs)
    print(f"\nTest Summary:")
    print(f"- Total API calls simulated: {total_tests}")
    print(f"- Endpoints tested: {len(endpoints)}")
    print(f"- Load configurations: {len(test_configs)}")
    print(f"- Test duration: ~{len(test_configs) * len(endpoints) * 2} seconds")
    
    return True

if __name__ == "__main__":
    success = main()