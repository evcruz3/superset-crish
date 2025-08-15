import json
import csv
from datetime import datetime, timedelta

# Municipality codes for Timor-Leste
MUNICIPALITY_CODES = {
    'Aileu': 'TL-AL',
    'Ainaro': 'TL-AN',
    'Ambeno': 'TL-OE',  # Oecusse/Ambeno
    'Baucau': 'TL-BA',
    'Bobonaro': 'TL-BO',
    'Covalima': 'TL-CO',
    'Dili': 'TL-DI',
    'Ermera': 'TL-ER',
    'Lautem': 'TL-LA',
    'Liquica': 'TL-LI',
    'Liquiça': 'TL-LI',
    'Manatuto': 'TL-MT',
    'Manufahi': 'TL-MF',
    'Viqueque': 'TL-VI'
}

def get_monday_date(week_number, year=2024):
    """Calculate the Monday date for a given week number in 2024."""
    # January 1st, 2024 is a Monday, making it easier to calculate
    jan_first = datetime(year, 1, 1)
    # Calculate days to add (week_number - 1 because week 1 starts on Jan 1)
    days_to_add = (week_number - 1) * 7
    monday_date = jan_first + timedelta(days=days_to_add)
    return monday_date.strftime('%Y-%m-%d')

def convert_json_to_csv():
    # Read JSON file
    json_data = []
    with open('tl_Climatology.json', 'r') as file:
        for line in file:
            json_data.append(json.loads(line.strip()))
    
    # Write CSV file
    csv_fields = [
        'Municipalities', 'municipality_code', 'Week', 'week_date',
        'temp_max', 'temp_mean', 'temp_min',
        'pr_max', 'pr_mean', 'pr_min',
        'rh_max', 'rh_mean', 'rh_min'
    ]
    
    with open('tl_Climatology_2024.csv', 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=csv_fields)
        writer.writeheader()
        
        for row in json_data:
            # Add municipality code and week date
            row['municipality_code'] = MUNICIPALITY_CODES.get(row['Municipalities'], 'UNKNOWN')
            row['week_date'] = get_monday_date(row['Week'])
            writer.writerow(row)

if __name__ == "__main__":
    convert_json_to_csv()
    print("Conversion completed! Output saved as 'tl_Climatology_2024.csv'") 