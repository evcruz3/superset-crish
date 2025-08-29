#!/usr/bin/env python3

import json
import statistics
from pathlib import Path

def calculate_percentile(data, percentile):
    """Calculate percentile of a list of values"""
    if not data:
        return 0
    size = len(data)
    sorted_data = sorted(data)
    index = int(size * percentile / 100)
    if index >= size:
        index = size - 1
    return sorted_data[index]

def analyze_stress_test(file_path, test_name):
    """Analyze stress test results"""
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    print(f"\n{'='*60}")
    print(f"{test_name}")
    print('='*60)
    
    # Basic info
    print(f"Test Date: {data['test_date']}")
    print(f"Total Requests: {data['total_requests']}")
    print(f"Endpoints Tested: {data['endpoints_tested']}")
    print(f"Overall Success Rate: {data['overall_success_rate']:.2%}")
    
    # Response time analysis
    response_times = [r['response_time'] for r in data['results']]
    
    if response_times:
        print(f"\nResponse Time Metrics (seconds):")
        print(f"  Average: {statistics.mean(response_times):.3f}")
        print(f"  Min: {min(response_times):.3f}")
        print(f"  Max: {max(response_times):.3f}")
        print(f"  Median: {statistics.median(response_times):.3f}")
        print(f"  95th Percentile: {calculate_percentile(response_times, 95):.3f}")
        print(f"  Standard Deviation: {statistics.stdev(response_times) if len(response_times) > 1 else 0:.3f}")
    
    # Error analysis
    status_codes = {}
    for r in data['results']:
        status = r['status']
        status_codes[status] = status_codes.get(status, 0) + 1
    
    print(f"\nStatus Code Distribution:")
    for status, count in sorted(status_codes.items()):
        percentage = (count / len(data['results'])) * 100
        print(f"  {status}: {count} ({percentage:.1f}%)")
    
    # Sample size note
    print(f"\nNOTE: Only showing {len(data['results'])} sample results out of {data['total_requests']} total requests")

def analyze_dashboard_performance(file_path):
    """Analyze dashboard performance results"""
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    print(f"\n{'='*60}")
    print("Dashboard Performance Test Results")
    print('='*60)
    
    print(f"Test Date: {data['test_date']}")
    print(f"Total Tests: {data['total_tests']}")
    print(f"Dashboards Tested: {data['dashboards_tested']}")
    print(f"Average Load Time: {data['avg_load_time']:.3f} seconds")
    
    results = data['results_sample']
    
    # Load time metrics
    load_times = [r['total_load_time'] for r in results]
    dom_times = [r['dom_content_loaded'] for r in results]
    page_times = [r['page_load_complete'] for r in results]
    render_times = [r['render_time'] for r in results]
    memory_usage = [r['memory_used_mb'] for r in results]
    
    print(f"\nTotal Load Time Metrics (seconds):")
    print(f"  Average: {statistics.mean(load_times):.3f}")
    print(f"  Min: {min(load_times):.3f}")
    print(f"  Max: {max(load_times):.3f}")
    print(f"  Median: {statistics.median(load_times):.3f}")
    print(f"  95th Percentile: {calculate_percentile(load_times, 95):.3f}")
    
    print(f"\nDOM Content Loaded Time (seconds):")
    print(f"  Average: {statistics.mean(dom_times):.3f}")
    print(f"  Min: {min(dom_times):.3f}")
    print(f"  Max: {max(dom_times):.3f}")
    
    print(f"\nPage Load Complete Time (seconds):")
    print(f"  Average: {statistics.mean(page_times):.3f}")
    print(f"  Min: {min(page_times):.3f}")
    print(f"  Max: {max(page_times):.3f}")
    
    print(f"\nRender Time (seconds):")
    print(f"  Average: {statistics.mean(render_times):.3f}")
    print(f"  Min: {min(render_times):.3f}")
    print(f"  Max: {max(render_times):.3f}")
    
    print(f"\nMemory Usage (MB):")
    print(f"  Average: {statistics.mean(memory_usage):.2f}")
    print(f"  Min: {min(memory_usage):.2f}")
    print(f"  Max: {max(memory_usage):.2f}")
    
    # Dashboard breakdown
    dashboard_stats = {}
    for r in results:
        dash = r['dashboard']
        if dash not in dashboard_stats:
            dashboard_stats[dash] = {
                'load_times': [],
                'memory': [],
                'charts': r['chart_count'],
                'statuses': []
            }
        dashboard_stats[dash]['load_times'].append(r['total_load_time'])
        dashboard_stats[dash]['memory'].append(r['memory_used_mb'])
        dashboard_stats[dash]['statuses'].append(r['status'])
    
    print(f"\nPer-Dashboard Metrics:")
    for dash, stats in dashboard_stats.items():
        success_count = stats['statuses'].count('success')
        total_count = len(stats['statuses'])
        success_rate = (success_count / total_count) * 100 if total_count > 0 else 0
        
        print(f"\n  {dash}:")
        print(f"    Chart Count: {stats['charts']}")
        print(f"    Avg Load Time: {statistics.mean(stats['load_times']):.3f}s")
        print(f"    Avg Memory: {statistics.mean(stats['memory']):.2f} MB")
        print(f"    Success Rate: {success_rate:.1f}% ({success_count}/{total_count})")
    
    # Error patterns
    error_count = sum(1 for r in results if r['status'] != 'success')
    if error_count > 0:
        print(f"\nError Patterns:")
        print(f"  Total Errors: {error_count} ({(error_count/len(results)*100):.1f}%)")
        error_types = {}
        for r in results:
            if r['status'] != 'success':
                error_types[r['status']] = error_types.get(r['status'], 0) + 1
        for error_type, count in error_types.items():
            print(f"  {error_type}: {count}")

def analyze_database_load_test(file_path):
    """Analyze database load test results"""
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    print(f"\n{'='*60}")
    print("Database Load Test Results")
    print('='*60)
    
    print(f"Test Date: {data['test_date']}")
    print(f"Database: {data['database']}")
    print(f"Total Tests: {data['total_tests']}")
    print(f"Average Query Time: {data['avg_query_time']:.3f} seconds")
    
    results = data['results_sample']
    
    # Query time metrics
    query_times = [r['execution_time'] for r in results]
    row_counts = [r['row_count'] for r in results]
    
    print(f"\nQuery Execution Time Metrics (seconds):")
    print(f"  Average: {statistics.mean(query_times):.3f}")
    print(f"  Min: {min(query_times):.3f}")
    print(f"  Max: {max(query_times):.3f}")
    print(f"  Median: {statistics.median(query_times):.3f}")
    print(f"  95th Percentile: {calculate_percentile(query_times, 95):.3f}")
    print(f"  Standard Deviation: {statistics.stdev(query_times) if len(query_times) > 1 else 0:.3f}")
    
    print(f"\nRow Count Statistics:")
    print(f"  Average: {statistics.mean(row_counts):.0f}")
    print(f"  Min: {min(row_counts)}")
    print(f"  Max: {max(row_counts)}")
    
    # Query performance by type
    query_stats = {}
    for r in results:
        query = r['query_name']
        if query not in query_stats:
            query_stats[query] = {
                'times': [],
                'rows': [],
                'statuses': []
            }
        query_stats[query]['times'].append(r['execution_time'])
        query_stats[query]['rows'].append(r['row_count'])
        query_stats[query]['statuses'].append(r['status'])
    
    print(f"\nQuery Type Performance:")
    for query, stats in query_stats.items():
        success_count = stats['statuses'].count('success')
        total_count = len(stats['statuses'])
        success_rate = (success_count / total_count) * 100 if total_count > 0 else 0
        
        print(f"\n  {query}:")
        print(f"    Execution Count: {len(stats['times'])}")
        print(f"    Avg Execution Time: {statistics.mean(stats['times']):.3f}s")
        print(f"    Avg Row Count: {statistics.mean(stats['rows']):.0f}")
        print(f"    Success Rate: {success_rate:.1f}%")
    
    # Success vs failure analysis
    success_count = sum(1 for r in results if r['status'] == 'success')
    failure_count = len(results) - success_count
    
    print(f"\nOverall Query Performance:")
    print(f"  Successful Queries: {success_count} ({(success_count/len(results)*100):.1f}%)")
    print(f"  Failed Queries: {failure_count} ({(failure_count/len(results)*100):.1f}%)")
    
    print(f"\nNOTE: Showing {len(results)} sample results out of {data['total_tests']} total tests")

def main():
    """Main analysis function"""
    print("CRISH Performance Test Analysis - Actual Metrics")
    print("=" * 60)
    
    # Analyze stress tests
    stress_tests = [
        ("scripts/stress_test_light_load_results.json", "Stress Test - Light Load (300 requests)"),
        ("scripts/stress_test_medium_load_results.json", "Stress Test - Medium Load (900 requests)"),
        ("scripts/stress_test_heavy_load_results.json", "Stress Test - Heavy Load (2100 requests)")
    ]
    
    for file_path, test_name in stress_tests:
        if Path(file_path).exists():
            analyze_stress_test(file_path, test_name)
    
    # Analyze dashboard performance
    if Path("scripts/dashboard_performance_results.json").exists():
        analyze_dashboard_performance("scripts/dashboard_performance_results.json")
    
    # Analyze database load test
    if Path("scripts/database_load_test_results.json").exists():
        analyze_database_load_test("scripts/database_load_test_results.json")
    
    print(f"\n{'='*60}")
    print("Analysis Complete")
    print('='*60)

if __name__ == "__main__":
    main()