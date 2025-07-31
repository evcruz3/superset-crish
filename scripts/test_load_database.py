#!/usr/bin/env python3
"""
Database load testing script for CRISH system.
Tests database performance under various query loads and concurrent operations.
"""
import asyncio
import asyncpg
import time
import statistics
import json
from datetime import datetime, timedelta
import random
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import psycopg2
from psycopg2 import pool

class DatabaseLoadTester:
    def __init__(self, db_config):
        self.db_config = db_config
        self.results = []
        
        # Create connection pool for concurrent testing
        self.connection_pool = psycopg2.pool.ThreadedConnectionPool(
            1, 50,  # min and max connections
            host=db_config.get('host', 'localhost'),
            port=db_config.get('port', 5432),
            database=db_config.get('database', 'superset'),
            user=db_config.get('user', 'superset'),
            password=db_config.get('password', 'superset')
        )
    
    def get_connection(self):
        """Get a connection from the pool."""
        return self.connection_pool.getconn()
    
    def return_connection(self, conn):
        """Return a connection to the pool."""
        self.connection_pool.putconn(conn)
    
    def test_query_performance(self, query_name, query, params=None, iterations=10):
        """Test performance of a specific query."""
        print(f"\nTesting query: {query_name}")
        query_results = []
        
        for i in range(iterations):
            conn = self.get_connection()
            cursor = conn.cursor()
            
            start_time = time.time()
            try:
                cursor.execute(query, params)
                results = cursor.fetchall()
                end_time = time.time()
                
                query_results.append({
                    "query_name": query_name,
                    "execution_time": end_time - start_time,
                    "row_count": len(results),
                    "status": "success",
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                end_time = time.time()
                query_results.append({
                    "query_name": query_name,
                    "execution_time": end_time - start_time,
                    "status": "error",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
            finally:
                cursor.close()
                self.return_connection(conn)
        
        self.analyze_query_results(query_name, query_results)
        self.results.extend(query_results)
    
    def analyze_query_results(self, query_name, results):
        """Analyze and print query performance statistics."""
        successful_results = [r for r in results if r.get('status') == 'success']
        
        if successful_results:
            exec_times = [r['execution_time'] for r in successful_results]
            
            print(f"  Success rate: {len(successful_results)}/{len(results)}")
            print(f"  Average execution time: {statistics.mean(exec_times):.4f}s")
            print(f"  Min execution time: {min(exec_times):.4f}s")
            print(f"  Max execution time: {max(exec_times):.4f}s")
            
            if len(exec_times) > 1:
                print(f"  Std deviation: {statistics.stdev(exec_times):.4f}s")
    
    def test_concurrent_queries(self, queries, concurrent_users=10):
        """Test database performance with concurrent queries."""
        print(f"\nTesting concurrent queries with {concurrent_users} users")
        print("-" * 60)
        
        with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            futures = []
            
            for i in range(concurrent_users):
                # Randomly select a query for each user
                query_info = random.choice(queries)
                future = executor.submit(
                    self._execute_query,
                    query_info['name'],
                    query_info['query'],
                    query_info.get('params'),
                    user_id=i+1
                )
                futures.append(future)
            
            concurrent_results = []
            for future in as_completed(futures):
                result = future.result()
                concurrent_results.append(result)
                
            self.analyze_concurrent_results(concurrent_results)
            self.results.extend(concurrent_results)
    
    def _execute_query(self, query_name, query, params=None, user_id=None):
        """Execute a single query for concurrent testing."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        start_time = time.time()
        try:
            cursor.execute(query, params)
            results = cursor.fetchall()
            end_time = time.time()
            
            return {
                "query_name": query_name,
                "user_id": user_id,
                "execution_time": end_time - start_time,
                "row_count": len(results),
                "status": "success",
                "test_type": "concurrent",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            end_time = time.time()
            return {
                "query_name": query_name,
                "user_id": user_id,
                "execution_time": end_time - start_time,
                "status": "error",
                "error": str(e),
                "test_type": "concurrent",
                "timestamp": datetime.now().isoformat()
            }
        finally:
            cursor.close()
            self.return_connection(conn)
    
    def analyze_concurrent_results(self, results):
        """Analyze concurrent query execution results."""
        successful_results = [r for r in results if r.get('status') == 'success']
        
        if successful_results:
            exec_times = [r['execution_time'] for r in successful_results]
            
            print(f"\n  Concurrent Query Summary:")
            print(f"  Success rate: {len(successful_results)}/{len(results)}")
            print(f"  Average execution time: {statistics.mean(exec_times):.4f}s")
            print(f"  Max execution time: {max(exec_times):.4f}s")
            
            # Group by query type
            query_groups = {}
            for r in successful_results:
                query_name = r['query_name']
                if query_name not in query_groups:
                    query_groups[query_name] = []
                query_groups[query_name].append(r['execution_time'])
            
            print("\n  Performance by query type:")
            for query_name, times in query_groups.items():
                print(f"    {query_name}: avg {statistics.mean(times):.4f}s")
    
    def test_bulk_operations(self, table_name, record_count=1000):
        """Test bulk insert/update operations."""
        print(f"\nTesting bulk operations on {table_name}")
        print(f"Inserting {record_count} records...")
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Bulk insert test
        insert_start = time.time()
        try:
            # Example bulk insert for weather data
            if table_name == "weather_forecast":
                values = []
                for i in range(record_count):
                    values.append((
                        f"TL-{random.choice(['DI', 'BA', 'LI', 'ER', 'AL'])}",
                        datetime.now() + timedelta(days=i % 7),
                        random.uniform(20, 40),  # temperature
                        random.uniform(0, 100),  # rainfall
                        random.uniform(10, 50),  # wind speed
                        'test_bulk'
                    ))
                
                cursor.executemany(
                    """INSERT INTO weather_forecast 
                    (municipality_code, forecast_date, temperature, rainfall, wind_speed, source) 
                    VALUES (%s, %s, %s, %s, %s, %s)""",
                    values
                )
                conn.commit()
            
            insert_end = time.time()
            insert_time = insert_end - insert_start
            
            print(f"  Bulk insert completed: {insert_time:.2f}s")
            print(f"  Records per second: {record_count / insert_time:.0f}")
            
            # Cleanup
            cursor.execute(f"DELETE FROM {table_name} WHERE source = 'test_bulk'")
            conn.commit()
            
            self.results.append({
                "operation": "bulk_insert",
                "table": table_name,
                "record_count": record_count,
                "execution_time": insert_time,
                "records_per_second": record_count / insert_time,
                "status": "success",
                "timestamp": datetime.now().isoformat()
            })
            
        except Exception as e:
            print(f"  Bulk operation failed: {e}")
            self.results.append({
                "operation": "bulk_insert",
                "table": table_name,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
        finally:
            cursor.close()
            self.return_connection(conn)
    
    def save_results(self, filename="database_load_test_results.json"):
        """Save test results to a JSON file."""
        with open(filename, 'w') as f:
            json.dump({
                "test_date": datetime.now().isoformat(),
                "database": self.db_config.get('database'),
                "total_tests": len(self.results),
                "results": self.results
            }, f, indent=2)
        print(f"\nResults saved to {filename}")

def main():
    """Main function to run database load tests."""
    # Database configuration
    db_config = {
        'host': os.getenv('DATABASE_HOST', 'localhost'),
        'port': os.getenv('DATABASE_PORT', 5432),
        'database': os.getenv('DATABASE_DB', 'superset'),
        'user': os.getenv('DATABASE_USER', 'superset'),
        'password': os.getenv('DATABASE_PASSWORD', 'superset')
    }
    
    # Define queries to test
    test_queries = [
        {
            "name": "weather_forecast_latest",
            "query": """
                SELECT * FROM weather_forecast 
                WHERE forecast_date >= CURRENT_DATE 
                ORDER BY forecast_date DESC 
                LIMIT 100
            """
        },
        {
            "name": "disease_alerts_by_municipality",
            "query": """
                SELECT municipality_code, COUNT(*) as alert_count 
                FROM disease_forecast_alerts 
                WHERE alert_level != 'None' 
                GROUP BY municipality_code
            """
        },
        {
            "name": "health_facilities_nearby",
            "query": """
                SELECT * FROM health_facilities 
                WHERE ST_DWithin(
                    location::geography, 
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 
                    10000
                )
            """,
            "params": [125.5, -8.5]  # Example coordinates
        },
        {
            "name": "bulletin_search",
            "query": """
                SELECT * FROM bulletins 
                WHERE title ILIKE %s OR advisory ILIKE %s 
                ORDER BY created_on DESC 
                LIMIT 50
            """,
            "params": ['%dengue%', '%dengue%']
        },
        {
            "name": "aggregated_weather_stats",
            "query": """
                SELECT 
                    municipality_code,
                    DATE_TRUNC('week', forecast_date) as week,
                    AVG(temperature) as avg_temp,
                    SUM(rainfall) as total_rainfall,
                    MAX(wind_speed) as max_wind
                FROM weather_forecast
                WHERE forecast_date >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY municipality_code, week
            """
        }
    ]
    
    tester = DatabaseLoadTester(db_config)
    
    print("CRISH Database Load Testing Tool")
    print("="*60)
    print(f"Database: {db_config['database']} @ {db_config['host']}:{db_config['port']}")
    print("="*60)
    
    # Test 1: Individual query performance
    print("\nTest 1: Individual Query Performance")
    print("="*60)
    for query_info in test_queries:
        tester.test_query_performance(
            query_info['name'],
            query_info['query'],
            query_info.get('params'),
            iterations=20
        )
    
    # Test 2: Concurrent query execution
    print("\n\nTest 2: Concurrent Query Execution")
    print("="*60)
    for concurrent_users in [5, 10, 20, 50]:
        tester.test_concurrent_queries(test_queries, concurrent_users)
        time.sleep(2)  # Brief pause between tests
    
    # Test 3: Bulk operations
    print("\n\nTest 3: Bulk Operations")
    print("="*60)
    tester.test_bulk_operations("weather_forecast", record_count=1000)
    
    # Save results
    tester.save_results()
    
    # Close connection pool
    tester.connection_pool.closeall()
    
    print("\n" + "="*60)
    print("Database load testing completed!")
    print("="*60)

if __name__ == "__main__":
    print("Note: This script requires database credentials to be set")
    print("Make sure the database is accessible")
    print("-"*60)
    
    try:
        main()
    except Exception as e:
        print(f"Error running database load tests: {e}")
        import traceback
        traceback.print_exc()