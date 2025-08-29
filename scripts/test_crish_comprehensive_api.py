#!/usr/bin/env python3
"""
Comprehensive CRISH API Testing Script
Tests all CRISH API endpoints that have openapi_spec_tag containing "CRISH"
Provides detailed performance and functionality analysis by functional area.
"""

import requests
import time
import statistics
import json
from datetime import datetime
from bs4 import BeautifulSoup

class CRISHAPITester:
    def __init__(self, base_url="http://localhost:8088"):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = {}
        
    def login(self):
        """Login to get authenticated session."""
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
        
        login_response = self.session.post(login_page_url, data=login_data)
        
        if login_response.status_code not in [302, 200]:
            raise Exception(f"Login failed: {login_response.status_code}")
            
        print("Authentication successful!")
        return True
        
    def test_endpoint(self, endpoint, iterations=3):
        """Test a single API endpoint multiple times."""
        results = []
        
        for i in range(iterations):
            start_time = time.time()
            try:
                response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)
                end_time = time.time()
                
                results.append({
                    "iteration": i + 1,
                    "status": response.status_code,
                    "response_time": end_time - start_time,
                    "timestamp": datetime.now().isoformat(),
                    "content_length": len(response.content) if response.content else 0
                })
            except Exception as e:
                end_time = time.time()
                results.append({
                    "iteration": i + 1,
                    "status": "error",
                    "error": str(e),
                    "response_time": end_time - start_time,
                    "timestamp": datetime.now().isoformat()
                })
                
            # Small delay between iterations
            if i < iterations - 1:
                time.sleep(0.1)
                
        return results
        
    def analyze_endpoint_results(self, endpoint, results):
        """Analyze results for a single endpoint."""
        successful = [r for r in results if isinstance(r.get('status'), int) and r['status'] in [200, 422]]
        failed = [r for r in results if r not in successful]
        
        analysis = {
            "endpoint": endpoint,
            "total_tests": len(results),
            "successful": len(successful),
            "failed": len(failed),
            "success_rate": len(successful) / len(results) if results else 0
        }
        
        if successful:
            response_times = [r['response_time'] for r in successful]
            analysis.update({
                "avg_response_time": statistics.mean(response_times),
                "min_response_time": min(response_times),
                "max_response_time": max(response_times),
                "median_response_time": statistics.median(response_times)
            })
            
            if len(response_times) > 1:
                analysis["std_dev"] = statistics.stdev(response_times)
                
        if failed:
            error_types = {}
            for r in failed:
                error = r.get('error', f"HTTP {r.get('status', 'Unknown')}")
                error_types[error] = error_types.get(error, 0) + 1
            analysis["errors"] = error_types
            
        return analysis
        
    def test_crish_apis(self):
        """Test all CRISH API endpoints organized by functional area."""
        
        # CRISH API endpoints organized by functional area
        api_groups = {
            "Weather & Climate": [
                "/api/v1/weather_forecast_alert",
                "/api/v1/weather_data_pull",
                "/api/v1/weather_forecasts/wind_speed",
                "/api/v1/weather_forecasts/heat_index",
                "/api/v1/weather_forecasts/rainfall", 
                "/api/v1/weather_forecasts/humidity",
                "/api/v1/weather_forecasts/temp_max",
                "/api/v1/weather_forecasts/temp_min"
            ],
            "Disease Forecasting": [
                "/api/v1/disease_forecast_alert",
                "/api/v1/disease_pipeline_run_history"
            ],
            "Health Facilities": [
                "/api/v1/health_facilities",
                "/api/v1/health_facilities/types",
                "/api/v1/update_facilities"
            ],
            "Disease Data Management": [
                "/api/v1/disease_data",
                "/api/v1/update_case_reports"
            ],
            "Communication & Dissemination": [
                "/api/v1/email_groups",
                "/api/v1/whatsapp_groups"
            ],
            "Public Education": [
                "/api/v1/public_education"
            ],
            "Bulletins & Advisories": [
                "/api/v1/bulletins_and_advisories"
            ],
            "Air Quality": [
                "/api/v1/air_quality_forecast/current",
                "/api/v1/air_quality_forecast/daily",
                "/api/v1/air_quality_forecast/forecast",
                "/api/v1/air_quality_forecast/map",
                "/api/v1/air_quality_forecast/trends"
            ]
        }
        
        print("=" * 80)
        print("COMPREHENSIVE CRISH API PERFORMANCE TESTING")
        print("=" * 80)
        print(f"Testing all CRISH APIs with openapi_spec_tag containing 'CRISH'")
        print(f"Test started: {datetime.now().isoformat()}")
        print("=" * 80)
        
        overall_results = {}
        
        for group_name, endpoints in api_groups.items():
            print(f"\n📊 Testing {group_name} APIs ({len(endpoints)} endpoints)")
            print("-" * 60)
            
            group_results = {}
            
            for endpoint in endpoints:
                print(f"Testing {endpoint}...", end=" ")
                
                results = self.test_endpoint(endpoint)
                analysis = self.analyze_endpoint_results(endpoint, results)
                group_results[endpoint] = analysis
                
                # Print immediate feedback
                if analysis['success_rate'] >= 0.8:
                    if analysis.get('avg_response_time', 0) < 0.5:
                        print("✅ FAST")
                    else:
                        print("✅ WORKING")
                elif analysis['success_rate'] > 0:
                    print("⚠️  PARTIAL")
                else:
                    print("❌ FAILED")
                    
            overall_results[group_name] = group_results
            
            # Print group summary
            group_success = sum(1 for r in group_results.values() if r['success_rate'] >= 0.8)
            print(f"\n{group_name} Summary: {group_success}/{len(endpoints)} endpoints working ({group_success/len(endpoints)*100:.1f}%)")
            
        # Store results
        self.results = overall_results
        return overall_results
        
    def print_detailed_analysis(self):
        """Print detailed analysis of all test results."""
        print("\n" + "=" * 80)
        print("DETAILED PERFORMANCE ANALYSIS")
        print("=" * 80)
        
        all_working_endpoints = []
        all_response_times = []
        
        for group_name, group_results in self.results.items():
            print(f"\n🔍 {group_name} APIs - Detailed Results:")
            
            for endpoint, analysis in group_results.items():
                if analysis['success_rate'] >= 0.8:
                    all_working_endpoints.append(endpoint)
                    if 'avg_response_time' in analysis:
                        all_response_times.append(analysis['avg_response_time'])
                        
                    print(f"  ✅ {endpoint}")
                    print(f"     Success Rate: {analysis['success_rate']*100:.1f}%")
                    if 'avg_response_time' in analysis:
                        print(f"     Avg Response Time: {analysis['avg_response_time']:.3f}s")
                        print(f"     Range: {analysis['min_response_time']:.3f}s - {analysis['max_response_time']:.3f}s")
                else:
                    print(f"  ❌ {endpoint}")
                    print(f"     Success Rate: {analysis['success_rate']*100:.1f}%")
                    if 'errors' in analysis:
                        for error, count in analysis['errors'].items():
                            print(f"     Error: {error} ({count}x)")
        
        # Overall statistics
        print("\n" + "=" * 80)
        print("OVERALL CRISH SYSTEM ANALYSIS")
        print("=" * 80)
        
        total_endpoints = sum(len(group) for group in self.results.values())
        working_endpoints = len(all_working_endpoints)
        
        print(f"Total CRISH API endpoints: {total_endpoints}")
        print(f"Working endpoints: {working_endpoints}")
        print(f"Overall success rate: {working_endpoints/total_endpoints*100:.1f}%")
        
        if all_response_times:
            print(f"System Performance Metrics:")
            print(f"  Average response time: {statistics.mean(all_response_times):.3f}s")
            print(f"  Fastest endpoint: {min(all_response_times):.3f}s") 
            print(f"  Slowest endpoint: {max(all_response_times):.3f}s")
            print(f"  Median response time: {statistics.median(all_response_times):.3f}s")
            
        # Performance grade
        if working_endpoints/total_endpoints >= 0.95:
            grade = "A+ (Excellent)"
        elif working_endpoints/total_endpoints >= 0.9:
            grade = "A (Very Good)"
        elif working_endpoints/total_endpoints >= 0.8:
            grade = "B+ (Good)"
        elif working_endpoints/total_endpoints >= 0.7:
            grade = "B (Acceptable)"
        else:
            grade = "C (Needs Improvement)"
            
        print(f"\nCRISH System Grade: {grade}")
        
    def save_results(self, filename):
        """Save comprehensive test results to JSON file."""
        output = {
            "test_metadata": {
                "test_date": datetime.now().isoformat(),
                "test_type": "Comprehensive CRISH API Testing",
                "base_url": self.base_url
            },
            "summary": {
                "total_functional_areas": len(self.results),
                "total_endpoints": sum(len(group) for group in self.results.values()),
                "working_endpoints": sum(
                    sum(1 for analysis in group.values() if analysis['success_rate'] >= 0.8)
                    for group in self.results.values()
                )
            },
            "detailed_results": self.results
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"\nDetailed results saved to {filename}")


def main():
    """Main function to run comprehensive CRISH API testing."""
    tester = CRISHAPITester()
    
    try:
        # Login first
        tester.login()
        
        # Run comprehensive tests
        tester.test_crish_apis()
        
        # Print detailed analysis
        tester.print_detailed_analysis()
        
        # Save results
        tester.save_results("crish_comprehensive_api_results.json")
        
    except Exception as e:
        print(f"Test execution failed: {e}")
    
    print("\n" + "="*80)
    print("CRISH Comprehensive API Testing completed!")
    print("Results can be used to update the CRISH Performance Test Report.")
    print("="*80)


if __name__ == "__main__":
    main()