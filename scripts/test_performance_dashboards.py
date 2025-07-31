#!/usr/bin/env python3
"""
Performance testing script for CRISH dashboards.
Measures dashboard loading times, rendering performance, and resource usage.
"""
import time
import json
import psutil
import asyncio
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import concurrent.futures
import statistics

class DashboardPerformanceTester:
    def __init__(self, base_url="http://localhost:8088", headless=True):
        self.base_url = base_url
        self.headless = headless
        self.results = []
        
    def create_driver(self):
        """Create a Selenium WebDriver instance."""
        options = webdriver.ChromeOptions()
        if self.headless:
            options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        
        # Enable performance logging
        options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        
        return webdriver.Chrome(options=options)
    
    def login(self, driver, username="admin", password="admin"):
        """Login to Superset."""
        driver.get(f"{self.base_url}/login")
        
        # Wait for login form
        username_field = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.NAME, "username"))
        )
        password_field = driver.find_element(By.NAME, "password")
        
        username_field.send_keys(username)
        password_field.send_keys(password)
        
        # Submit form
        login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        login_button.click()
        
        # Wait for redirect after login
        WebDriverWait(driver, 10).until(
            EC.url_contains("/superset/welcome")
        )
    
    def measure_dashboard_load(self, driver, dashboard_path, dashboard_name):
        """Measure dashboard loading performance."""
        # Record start metrics
        start_time = time.time()
        start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        
        # Navigate to dashboard
        driver.get(f"{self.base_url}{dashboard_path}")
        
        # Wait for dashboard to load
        try:
            # Wait for dashboard container
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CLASS_NAME, "dashboard"))
            )
            
            # Wait for charts to render (adjust selector as needed)
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CLASS_NAME, "chart-container"))
            )
            
            # Additional wait for async data loading
            time.sleep(2)
            
            load_complete_time = time.time()
            
            # Get performance metrics
            performance_logs = driver.get_log('performance')
            
            # Extract network timing
            network_events = []
            for log in performance_logs:
                message = json.loads(log['message'])['message']
                if message['method'] == 'Network.responseReceived':
                    network_events.append(message)
            
            # Calculate metrics
            total_load_time = load_complete_time - start_time
            end_memory = psutil.Process().memory_info().rss / 1024 / 1024
            memory_used = end_memory - start_memory
            
            # Count rendered elements
            chart_count = len(driver.find_elements(By.CLASS_NAME, "chart-container"))
            
            # Get JavaScript execution time
            js_metrics = driver.execute_script("""
                return {
                    domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                    loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
                    renderTime: performance.timing.domComplete - performance.timing.domLoading
                };
            """)
            
            result = {
                "dashboard": dashboard_name,
                "timestamp": datetime.now().isoformat(),
                "total_load_time": total_load_time,
                "dom_content_loaded": js_metrics['domContentLoaded'] / 1000,
                "page_load_complete": js_metrics['loadComplete'] / 1000,
                "render_time": js_metrics['renderTime'] / 1000,
                "memory_used_mb": memory_used,
                "chart_count": chart_count,
                "network_requests": len(network_events),
                "status": "success"
            }
            
        except TimeoutException as e:
            result = {
                "dashboard": dashboard_name,
                "timestamp": datetime.now().isoformat(),
                "total_load_time": time.time() - start_time,
                "status": "timeout",
                "error": str(e)
            }
        except Exception as e:
            result = {
                "dashboard": dashboard_name,
                "timestamp": datetime.now().isoformat(),
                "total_load_time": time.time() - start_time,
                "status": "error",
                "error": str(e)
            }
        
        return result
    
    def test_dashboard_performance(self, dashboards, iterations=5):
        """Test performance of multiple dashboards."""
        print(f"Testing {len(dashboards)} dashboards with {iterations} iterations each")
        print("-" * 60)
        
        for dashboard in dashboards:
            print(f"\nTesting dashboard: {dashboard['name']}")
            dashboard_results = []
            
            for i in range(iterations):
                print(f"  Iteration {i+1}/{iterations}...", end="", flush=True)
                
                driver = self.create_driver()
                try:
                    self.login(driver)
                    result = self.measure_dashboard_load(
                        driver, 
                        dashboard['path'], 
                        dashboard['name']
                    )
                    dashboard_results.append(result)
                    print(f" {result['total_load_time']:.2f}s")
                    
                except Exception as e:
                    print(f" Error: {e}")
                    dashboard_results.append({
                        "dashboard": dashboard['name'],
                        "timestamp": datetime.now().isoformat(),
                        "status": "error",
                        "error": str(e)
                    })
                finally:
                    driver.quit()
                
                # Delay between iterations
                time.sleep(2)
            
            # Analyze results for this dashboard
            self.analyze_dashboard_results(dashboard['name'], dashboard_results)
            self.results.extend(dashboard_results)
    
    def analyze_dashboard_results(self, dashboard_name, results):
        """Analyze and print statistics for dashboard results."""
        successful_results = [r for r in results if r.get('status') == 'success']
        
        if successful_results:
            load_times = [r['total_load_time'] for r in successful_results]
            memory_usage = [r.get('memory_used_mb', 0) for r in successful_results]
            
            print(f"\n  Performance Summary for {dashboard_name}:")
            print(f"  Success rate: {len(successful_results)}/{len(results)}")
            print(f"  Average load time: {statistics.mean(load_times):.2f}s")
            print(f"  Min load time: {min(load_times):.2f}s")
            print(f"  Max load time: {max(load_times):.2f}s")
            
            if len(load_times) > 1:
                print(f"  Std deviation: {statistics.stdev(load_times):.2f}s")
            
            if memory_usage:
                print(f"  Average memory used: {statistics.mean(memory_usage):.2f} MB")
    
    def test_concurrent_users(self, dashboard, concurrent_users=5):
        """Test dashboard performance with concurrent users."""
        print(f"\nTesting concurrent access with {concurrent_users} users")
        print(f"Dashboard: {dashboard['name']}")
        print("-" * 60)
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            futures = []
            
            for i in range(concurrent_users):
                future = executor.submit(self._test_single_user, dashboard, i+1)
                futures.append(future)
            
            results = []
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                results.append(result)
                print(f"User {result.get('user_id', 'Unknown')} completed: "
                      f"{result.get('total_load_time', 'N/A'):.2f}s")
            
            self.analyze_concurrent_results(results)
            self.results.extend(results)
    
    def _test_single_user(self, dashboard, user_id):
        """Test dashboard as a single user."""
        driver = self.create_driver()
        try:
            self.login(driver)
            result = self.measure_dashboard_load(
                driver, 
                dashboard['path'], 
                dashboard['name']
            )
            result['user_id'] = user_id
            result['test_type'] = 'concurrent'
            return result
        except Exception as e:
            return {
                "dashboard": dashboard['name'],
                "user_id": user_id,
                "timestamp": datetime.now().isoformat(),
                "status": "error",
                "error": str(e),
                "test_type": "concurrent"
            }
        finally:
            driver.quit()
    
    def analyze_concurrent_results(self, results):
        """Analyze concurrent user test results."""
        successful_results = [r for r in results if r.get('status') == 'success']
        
        if successful_results:
            load_times = [r['total_load_time'] for r in successful_results]
            
            print(f"\n  Concurrent Access Summary:")
            print(f"  Success rate: {len(successful_results)}/{len(results)}")
            print(f"  Average load time: {statistics.mean(load_times):.2f}s")
            print(f"  Max load time: {max(load_times):.2f}s")
            print(f"  Performance degradation: "
                  f"{(max(load_times) - min(load_times)) / min(load_times) * 100:.1f}%")
    
    def save_results(self, filename="dashboard_performance_results.json"):
        """Save test results to a JSON file."""
        with open(filename, 'w') as f:
            json.dump({
                "test_date": datetime.now().isoformat(),
                "total_tests": len(self.results),
                "results": self.results
            }, f, indent=2)
        print(f"\nResults saved to {filename}")

def main():
    """Main function to run performance tests."""
    # Define dashboards to test
    dashboards = [
        {"name": "Weather Overview", "path": "/weather-overview/"},
        {"name": "Disease Overview", "path": "/disease-overview/"},
        {"name": "Weather Forecast", "path": "/weather-forecast/"},
        {"name": "Disease Forecast", "path": "/disease-forecast/"},
        {"name": "Health Facilities", "path": "/health-facilities/"},
        {"name": "Bulletins & Advisories", "path": "/bulletins-and-advisories/"},
    ]
    
    tester = DashboardPerformanceTester()
    
    print("CRISH Dashboard Performance Testing Tool")
    print("="*60)
    
    # Test 1: Individual dashboard performance
    print("\nTest 1: Individual Dashboard Performance")
    print("="*60)
    tester.test_dashboard_performance(dashboards, iterations=3)
    
    # Test 2: Concurrent user access
    print("\n\nTest 2: Concurrent User Access")
    print("="*60)
    for dashboard in dashboards[:3]:  # Test first 3 dashboards
        tester.test_concurrent_users(dashboard, concurrent_users=5)
    
    # Save all results
    tester.save_results()
    
    print("\n" + "="*60)
    print("Performance testing completed!")
    print("="*60)

if __name__ == "__main__":
    print("Note: This script requires Selenium WebDriver and Chrome/Chromium installed.")
    print("Make sure Superset is running on http://localhost:8088")
    print("-"*60)
    
    try:
        main()
    except Exception as e:
        print(f"Error running performance tests: {e}")
        import traceback
        traceback.print_exc()