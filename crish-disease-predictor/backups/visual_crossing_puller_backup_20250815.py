#!/usr/bin/env python3

import requests
from datetime import datetime, timedelta
import json
import os
from typing import Dict, List
import time
from collections import defaultdict

class VisualCrossingPuller:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline"
        
        # Municipality coordinates (latitude, longitude)
        self.municipalities = {
            'Aileu': (-8.7, 125.56),
            'Ainaro': (-9.0, 125.5),
            'Atauro': (-8.25, 125.57),
            'Baucau': (-8.54, 126.35),
            'Bobonaro': (-9.04, 125.32),
            'Covalima': (-9.32, 125.26),
            'Dili': (-8.59, 125.57),
            'Ermera': (-8.75, 125.4),
            'Manatuto': (-8.51, 126.01),
            'Manufahi': (-9.0, 125.65),
            'Lautem': (-8.5, 127.02),
            'Liquica': (-8.74, 125.14),
            'Raeoa': (-9.21, 124.37),
            'Viqueque': (-8.87, 126.37)
        }

    def get_date_range(self):
        end_date = datetime.now()
        start_date = end_date - timedelta(weeks=4)
        return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')
    
    def get_forecast_date_range(self):
        """Get date range for the next week's forecast."""
        start_date = datetime.now() + timedelta(days=1)  # Start from tomorrow
        end_date = start_date + timedelta(days=6)  # Get a full week
        return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')

    def get_historical_weather(self, municipality: str, start_date: str, end_date: str) -> Dict:
        lat, lon = self.municipalities[municipality]
        location = f"{lat},{lon}"
        
        url = f"{self.base_url}/{location}/{start_date}/{end_date}"
        
        params = {
            'key': self.api_key,
            'unitGroup': 'metric',
            'include': 'days',
            'contentType': 'json',
            'elements': 'datetime,tempmax,tempmin,temp,humidity,precip'
        }
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                raw_data = response.json()
                processed_data = []
                
                for day in raw_data.get('days', []):
                    humidity = day['humidity']
                    processed_data.append({
                        'date': day['datetime'],
                        'temperature': {
                            'max': day['tempmax'],
                            'min': day['tempmin'],
                            'avg': day['temp']
                        },
                        'humidity': {
                            'max': humidity,  # Using same humidity value for all
                            'min': humidity,
                            'mean': humidity
                        },
                        'precipitation': day['precip']
                    })
                
                return processed_data
            else:
                print(f"Error getting data for {municipality}: {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"Exception while getting data for {municipality}: {str(e)}")
            return None
    
    def get_forecast_weather(self, municipality: str) -> Dict:
        """Get forecast weather data for the next week."""
        start_date, end_date = self.get_forecast_date_range()
        print(f"Getting forecast for {municipality} from {start_date} to {end_date}")
        
        # Uses the same endpoint and parameters as historical data
        # Visual Crossing automatically returns forecast for future dates
        return self.get_historical_weather(municipality, start_date, end_date)

    def save_data(self, municipality: str, data: Dict, data_type="historical"):
        os.makedirs('weather_data', exist_ok=True)
        filename = f"weather_data/{municipality}_{data_type}_{datetime.now().strftime('%Y%m%d')}.json"
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Saved {data_type} data for {municipality} to {filename}")

    def compute_weekly_averages(self, data: List[Dict]) -> List[Dict]:
        """Compute weekly averages from daily data."""
        if not data:
            return []

        # Convert dates to datetime objects and sort by date
        for entry in data:
            entry['datetime'] = datetime.strptime(entry['date'], '%Y-%m-%d')
        
        data.sort(key=lambda x: x['datetime'])
        
        # Group data by week
        weekly_data = defaultdict(list)
        for entry in data:
            # Get the monday of the week
            monday = entry['datetime'] - timedelta(days=entry['datetime'].weekday())
            weekly_data[monday].append(entry)

        # Compute averages for each week
        weekly_averages = []
        for week_start, entries in sorted(weekly_data.items()):
            week_end = week_start + timedelta(days=6)
            
            avg_data = {
                'week_start': week_start.strftime('%Y-%m-%d'),
                'week_end': week_end.strftime('%Y-%m-%d'),
                'temperature': {
                    'max': sum(e['temperature']['max'] for e in entries) / len(entries),
                    'min': sum(e['temperature']['min'] for e in entries) / len(entries),
                    'avg': sum(e['temperature']['avg'] for e in entries) / len(entries)
                },
                'humidity': {
                    'max': sum(e['humidity']['max'] for e in entries) / len(entries),
                    'min': sum(e['humidity']['min'] for e in entries) / len(entries),
                    'mean': sum(e['humidity']['mean'] for e in entries) / len(entries)
                },
                'precipitation': sum(e['precipitation'] for e in entries) / len(entries)
            }
            weekly_averages.append(avg_data)
        
        return weekly_averages

def main():
    API_KEY = os.getenv("VISUAL_CROSSING_API_KEY")
    
    puller = VisualCrossingPuller(API_KEY)
    start_date, end_date = puller.get_date_range()
    
    print(f"Pulling historical data from {start_date} to {end_date}")
    
    # Dictionary to store weekly averages for all municipalities
    all_weekly_averages = {}
    all_forecast_data = {}
    
    for municipality in puller.municipalities:
        print(f"\nProcessing {municipality}")
        
        # Get historical data
        historical_data = puller.get_historical_weather(municipality, start_date, end_date)
        if historical_data:
            # Save raw data
            puller.save_data(municipality, historical_data, "historical")
            
            # Compute and store weekly averages
            weekly_averages = puller.compute_weekly_averages(historical_data)
            all_weekly_averages[municipality] = weekly_averages
        
        try:    
            # Get forecast data for next week
            forecast_data = puller.get_forecast_weather(municipality)
            if forecast_data:
                # Save raw forecast data
                puller.save_data(municipality, forecast_data, "forecast")
            
                # Compute and store weekly forecast
                forecast_weekly = puller.compute_weekly_averages(forecast_data)
                all_forecast_data[municipality] = forecast_weekly
        except Exception as e:
            print(f"Error getting forecast data for {municipality}: {str(e)}")
            
        # Respect API rate limits
        time.sleep(1)
    
    # Save all weekly averages to a single file
    weekly_averages_file = f"weather_data/all_municipalities_weekly_averages_{datetime.now().strftime('%Y%m%d')}.json"
    with open(weekly_averages_file, 'w') as f:
        json.dump(all_weekly_averages, f, indent=2)
    print(f"\nSaved weekly averages for all municipalities to {weekly_averages_file}")
    
    # Save all forecast data to a single file
    forecast_file = f"weather_data/all_municipalities_forecast_{datetime.now().strftime('%Y%m%d')}.json"
    with open(forecast_file, 'w') as f:
        json.dump(all_forecast_data, f, indent=2)
    print(f"\nSaved forecast data for all municipalities to {forecast_file}")

if __name__ == "__main__":
    main() 