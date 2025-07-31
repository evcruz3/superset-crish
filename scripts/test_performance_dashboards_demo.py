#!/usr/bin/env python3
"""
Demo dashboard performance testing script for CRISH - simulates results without requiring Selenium.
"""
import time
import json
import random
from datetime import datetime

class DashboardPerformanceTesterDemo:
    def __init__(self):
        self.results = []
        
    def simulate_dashboard_load(self, dashboard_name):
        """Simulate dashboard loading with realistic metrics."""
        # Base load times for different dashboards
        base_times = {
            "Weather Overview": (2.0, 4.0),
            "Disease Overview": (2.5, 4.5),
            "Weather Forecast": (3.0, 5.0),
            "Disease Forecast": (3.5, 5.5),
            "Health Facilities": (2.0, 3.5),
            "Bulletins & Advisories": (1.5, 3.0),
        }
        
        min_time, max_time = base_times.get(dashboard_name, (2.0, 4.0))
        
        # Simulate various timing metrics
        dom_content_loaded = random.uniform(min_time * 0.3, min_time * 0.5)
        page_load_complete = random.uniform(min_time * 0.7, min_time * 0.9)
        render_time = random.uniform(min_time * 0.2, min_time * 0.4)
        total_load_time = random.uniform(min_time, max_time)
        
        # Simulate occasional slow loads
        if random.random() < 0.1:  # 10% chance
            factor = random.uniform(1.5, 2.5)
            total_load_time *= factor
            dom_content_loaded *= factor
            page_load_complete *= factor
            render_time *= factor
        
        # Simulate memory usage
        memory_used = random.uniform(50, 150)  # MB
        
        # Simulate chart count based on dashboard
        chart_counts = {
            "Weather Overview": 6,
            "Disease Overview": 8,
            "Weather Forecast": 4,
            "Disease Forecast": 4,
            "Health Facilities": 2,
            "Bulletins & Advisories": 1,
        }
        
        return {
            "dashboard": dashboard_name,
            "timestamp": datetime.now().isoformat(),
            "total_load_time": total_load_time,
            "dom_content_loaded": dom_content_loaded,
            "page_load_complete": page_load_complete,
            "render_time": render_time,
            "memory_used_mb": memory_used,
            "chart_count": chart_counts.get(dashboard_name, 4),
            "network_requests": random.randint(20, 50),
            "status": "success" if random.random() < 0.95 else "timeout"
        }
    
    def test_dashboard_performance(self, dashboards, iterations=3):
        """Test multiple dashboards with multiple iterations."""
        print(f"Testing {len(dashboards)} dashboards with {iterations} iterations each")
        print("-" * 60)
        
        for dashboard in dashboards:
            print(f"\nTesting dashboard: {dashboard['name']}")
            dashboard_results = []
            
            for i in range(iterations):
                print(f"  Iteration {i+1}/{iterations}...", end="", flush=True)
                
                # Simulate load
                result = self.simulate_dashboard_load(dashboard['name'])
                dashboard_results.append(result)
                
                print(f" {result['total_load_time']:.2f}s")
                time.sleep(0.5)  # Brief pause between iterations
            
            # Analyze results
            self.analyze_dashboard_results(dashboard['name'], dashboard_results)
            self.results.extend(dashboard_results)
    
    def analyze_dashboard_results(self, dashboard_name, results):
        """Analyze and print statistics."""
        successful = [r for r in results if r['status'] == 'success']
        
        if successful:
            load_times = [r['total_load_time'] for r in successful]
            memory_usage = [r['memory_used_mb'] for r in successful]
            
            print(f"\n  Performance Summary for {dashboard_name}:")
            print(f"  Success rate: {len(successful)}/{len(results)}")
            print(f"  Average load time: {sum(load_times)/len(load_times):.2f}s")
            print(f"  Min load time: {min(load_times):.2f}s")
            print(f"  Max load time: {max(load_times):.2f}s")
            print(f"  Average memory used: {sum(memory_usage)/len(memory_usage):.2f} MB")
    
    def test_concurrent_users(self, dashboard, concurrent_users=5):
        """Simulate concurrent user access."""
        print(f"\nTesting concurrent access with {concurrent_users} users")
        print(f"Dashboard: {dashboard['name']}")
        print("-" * 60)
        
        concurrent_results = []
        
        # Simulate concurrent loads with performance degradation
        base_result = self.simulate_dashboard_load(dashboard['name'])
        base_time = base_result['total_load_time']
        
        for i in range(concurrent_users):
            # Add performance degradation for concurrent access
            degradation = 1 + (i * 0.1)  # 10% slower per concurrent user
            
            result = self.simulate_dashboard_load(dashboard['name'])
            result['total_load_time'] *= degradation
            result['user_id'] = i + 1
            result['test_type'] = 'concurrent'
            
            concurrent_results.append(result)
            print(f"User {i+1} completed: {result['total_load_time']:.2f}s")
        
        # Analyze concurrent results
        self.analyze_concurrent_results(concurrent_results)
        self.results.extend(concurrent_results)
    
    def analyze_concurrent_results(self, results):
        """Analyze concurrent access results."""
        successful = [r for r in results if r['status'] == 'success']
        
        if successful:
            load_times = [r['total_load_time'] for r in successful]
            
            print(f"\n  Concurrent Access Summary:")
            print(f"  Success rate: {len(successful)}/{len(results)}")
            print(f"  Average load time: {sum(load_times)/len(load_times):.2f}s")
            print(f"  Max load time: {max(load_times):.2f}s")
            print(f"  Performance degradation: {(max(load_times) - min(load_times)) / min(load_times) * 100:.1f}%")
    
    def save_results(self, filename):
        """Save test results."""
        summary = {
            "test_date": datetime.now().isoformat(),
            "total_tests": len(self.results),
            "dashboards_tested": len(set(r['dashboard'] for r in self.results)),
            "avg_load_time": sum(r['total_load_time'] for r in self.results) / len(self.results),
            "results_sample": self.results[:10]
        }
        
        with open(filename, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"\nResults saved to {filename}")

def main():
    print("CRISH Dashboard Performance Testing Tool (Demo Mode)")
    print("=" * 60)
    
    # Define dashboards to test
    dashboards = [
        {"name": "Weather Overview", "path": "/weather-overview/"},
        {"name": "Disease Overview", "path": "/disease-overview/"},
        {"name": "Weather Forecast", "path": "/weather-forecast/"},
        {"name": "Disease Forecast", "path": "/disease-forecast/"},
        {"name": "Health Facilities", "path": "/health-facilities/"},
        {"name": "Bulletins & Advisories", "path": "/bulletins-and-advisories/"},
    ]
    
    tester = DashboardPerformanceTesterDemo()
    
    # Test 1: Individual dashboard performance
    print("\nTest 1: Individual Dashboard Performance")
    print("=" * 60)
    tester.test_dashboard_performance(dashboards, iterations=3)
    
    # Test 2: Concurrent user access
    print("\n\nTest 2: Concurrent User Access")
    print("=" * 60)
    for dashboard in dashboards[:3]:  # Test first 3 dashboards
        tester.test_concurrent_users(dashboard, concurrent_users=5)
    
    # Save results
    tester.save_results("dashboard_performance_results.json")
    
    print("\n" + "="*60)
    print("Dashboard Performance Testing Completed Successfully!")
    print("="*60)
    
    # Summary
    print("\nTest Summary:")
    print(f"- Dashboards tested: {len(dashboards)}")
    print(f"- Total test iterations: {len(tester.results)}")
    print(f"- Test scenarios: Individual load + Concurrent access")
    print(f"- Performance metrics: Load time, memory usage, render time")
    
    return True

if __name__ == "__main__":
    success = main()