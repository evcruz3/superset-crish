import json
from datetime import datetime, timedelta
import pandas as pd

administrative_posts = [
    "Aileu", # Weekly
    # "Ainaro", # Mix of Monthly (2018 - 2024 with Dengue in Yearly) and Yearly (2013-2017)
    "Atauro", # Weekly
    "Baucau", # Weekly
    "Bobonaro", # Weekly
    # "Covalima", # Weekly, except Diarrhea which is yearly
    "Dili", # Weekly
    "Ermera", # Weekly
    # "Manatuto", # Yearly
    # "Manufahi", # Yearly
    # "Lautem", # Weekly, except Dengue which is yearly
    "Liquica", # Weekly
    # "Raeoa", # Monthly
    "Viqueque", # Weekly
]

# Municipality codes mapping
municipality_codes = {
    "Aileu": "TL-AL",
    "Ainaro": "TL-AN",
    "Atauro": "TL-AT",
    "Baucau": "TL-BA",
    "Bobonaro": "TL-BO",
    "Covalima": "TL-CO",
    "Dili": "TL-DI",
    "Ermera": "TL-ER",
    "Manatuto": "TL-MT",
    "Manufahi": "TL-MF",
    "Lautem": "TL-LA",
    "Liquica": "TL-LI",
    "Raeoa": "TL-OE",
    "Viqueque": "TL-VI"
}

def get_monday_and_sunday(year, week):
    """
    Returns the datetime of the Monday and Sunday of a given year and week number.

    :param year: The year (int)
    :param week: The week number (int)
    :return: Tuple containing (monday_datetime, sunday_datetime)
    """
    # Start with the first day of the year
    first_day_of_year = datetime(year=year, month=1, day=1)
    
    # Find the first Monday of the year
    days_to_first_monday = (7 - first_day_of_year.weekday()) % 7
    first_monday = first_day_of_year + timedelta(days=days_to_first_monday)
    
    # Calculate the Monday of the given week
    monday_of_week = first_monday + timedelta(weeks=week - 1)
    
    # Sunday is 6 days after the Monday
    sunday_of_week = monday_of_week + timedelta(days=6)
    
    return monday_of_week, sunday_of_week

# Initialize a list to hold the resulting JSON objects
json_list = []

for administrative_post in administrative_posts:
    print(f"processing {administrative_post}")
    file_path = f"./data/{administrative_post}.xlsx"
    data = pd.read_excel(file_path, sheet_name=None, header=0)[administrative_post]

    ari_column_name = 'ARI' if 'ARI' in data.columns else 'ISPA'

    # Assert the existence of 'Year', 'Week', 'Dengue', 'ARI', and 'Diarrhea' columns
    required_columns = ['Year', 'Week', 'Dengue', ari_column_name, 'Diarrhea']
    missing_columns = [column for column in required_columns if column not in data.columns]

    if missing_columns:
        for column in missing_columns:
            print(f"Missing column: {column}")
        print(f"Required columns are missing for {administrative_post}")
        continue

    # Iterate through the rows of the DataFrame
    for index, row in data.iterrows():
        # If week is missing, skip row
        if pd.isnull(row['Week']):
            continue

        # If year is missing, assume previous year
        if pd.isnull(row['Year']):
            year = previous_year
        else:
            year = row['Year']
            previous_year = row['Year']

        week = row['Week']
        week = int(week)
        year = int(year)

        # Get Monday date for the week
        monday, _ = get_monday_and_sunday(year, week)
        
        # Process each disease type
        diseases = {
            'Dengue': row['Dengue'] if not pd.isnull(row['Dengue']) else None,
            'ARI': row[ari_column_name] if not pd.isnull(row[ari_column_name]) else None,
            'Diarrhea': row['Diarrhea'] if not pd.isnull(row['Diarrhea']) else None
        }

        for disease_name, total_cases in diseases.items():
            # Create base case report object with the new schema
            case_entry = {
                'week_start_date': monday.isoformat(),
                'year': year,
                'week_number': week,
                'disease': disease_name,
                'municipality_code': municipality_codes[administrative_post],
                'municipality': administrative_post,
                'totalCases': float(total_cases) if total_cases is not None else None,
                'totalCasesMale': None,  # Default values as data not available
                'totalCasesFemale': None,
                'totalDeaths': None,
                'totalDeathsMale': None,
                'totalDeathsFemale': None,
                'LessThan1TotalCases': None,
                'LessThan1TotalCasesMale': None,
                'LessThan1TotalCasesFemale': None,
                'LessThan1TotalDeaths': None,
                'LessThan1TotalDeathsMale': None,
                'LessThan1TotalDeathsFemale': None,
                'LessThan1CaseMale': None,
                'LessThan1CaseFemale': None,
                'LessThan1DeathMale': None,
                'LessThan1DeathFemale': None,
                '1to4TotalCases': None,
                '1to4TotalCasesMale': None,
                '1to4TotalCasesFemale': None,
                '1to4TotalDeaths': None,
                '1to4TotalDeathsMale': None,
                '1to4TotalDeathsFemale': None,
                '1to4CaseMale': None,
                '1to4CaseFemale': None,
                '1to4DeathMale': None,
                '1to4DeathFemale': None,
                '5to14TotalCases': None,
                '5to14TotalCasesMale': None,
                '5to14TotalCasesFemale': None,
                '5to14TotalDeaths': None,
                '5to14TotalDeathsMale': None,
                '5to14TotalDeathsFemale': None,
                '5to14CaseMale': None,
                '5to14CaseFemale': None,
                '5to14DeathMale': None,
                '5to14DeathFemale': None,
                '15PlusTotalCases': None,
                '15PlusTotalCasesMale': None,
                '15PlusTotalCasesFemale': None,
                '15PlusTotalDeaths': None,
                '15PlusTotalDeathsMale': None,
                '15PlusTotalDeathsFemale': None,
                '15PlusCaseMale': None,
                '15PlusCaseFemale': None,
                '15PlusDeathMale': None,
                '15PlusDeathFemale': None
            }
            
            json_list.append(case_entry)

    # Save json to a {administrativePost}_cases.json file
    output_file_path = f"./data/{administrative_post}_cases.json"
    with open(output_file_path, 'w') as output_file:
        json.dump(json_list, output_file)
