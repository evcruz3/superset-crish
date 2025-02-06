import json
import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration
DB_CONFIG = {
    'dbname': os.getenv('DATABASE_DB', 'superset'),
    'user': os.getenv('DATABASE_USER', 'superset'),
    'password': os.getenv('DATABASE_PASSWORD', 'superset'),
    'host': os.getenv('DATABASE_HOST', 'db'),
    'port': os.getenv('DATABASE_PORT', '5432')
}

TABLE_NAME = os.getenv('CASE_REPORTS_TABLE', 'tlhis_diseases')

def create_table(conn):
    """Create the case reports table if it doesn't exist"""
    with conn.cursor() as cur:
        cur.execute(f'''
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            id SERIAL PRIMARY KEY,
            week_date TIMESTAMP,
            year INTEGER,
            week_number INTEGER,
            disease VARCHAR(50),
            municipality_code VARCHAR(10),
            municipality VARCHAR(50),
            totalCases DOUBLE PRECISION,
            totalCasesMale DOUBLE PRECISION,
            totalCasesFemale DOUBLE PRECISION,
            totalDeaths DOUBLE PRECISION,
            totalDeathsMale DOUBLE PRECISION,
            totalDeathsFemale DOUBLE PRECISION,
            LessThan1TotalCases DOUBLE PRECISION,
            LessThan1TotalCasesMale DOUBLE PRECISION,
            LessThan1TotalCasesFemale DOUBLE PRECISION,
            LessThan1TotalDeaths DOUBLE PRECISION,
            LessThan1TotalDeathsMale DOUBLE PRECISION,
            LessThan1TotalDeathsFemale DOUBLE PRECISION,
            LessThan1CaseMale DOUBLE PRECISION,
            LessThan1CaseFemale DOUBLE PRECISION,
            LessThan1DeathMale DOUBLE PRECISION,
            LessThan1DeathFemale DOUBLE PRECISION,
            "1to4TotalCases" DOUBLE PRECISION,
            "1to4TotalCasesMale" DOUBLE PRECISION,
            "1to4TotalCasesFemale" DOUBLE PRECISION,
            "1to4TotalDeaths" DOUBLE PRECISION,
            "1to4TotalDeathsMale" DOUBLE PRECISION,
            "1to4TotalDeathsFemale" DOUBLE PRECISION,
            "1to4CaseMale" DOUBLE PRECISION,
            "1to4CaseFemale" DOUBLE PRECISION,
            "1to4DeathMale" DOUBLE PRECISION,
            "1to4DeathFemale" DOUBLE PRECISION,
            "5to14TotalCases" DOUBLE PRECISION,
            "5to14TotalCasesMale" DOUBLE PRECISION,
            "5to14TotalCasesFemale" DOUBLE PRECISION,
            "5to14TotalDeaths" DOUBLE PRECISION,
            "5to14TotalDeathsMale" DOUBLE PRECISION,
            "5to14TotalDeathsFemale" DOUBLE PRECISION,
            "5to14CaseMale" DOUBLE PRECISION,
            "5to14CaseFemale" DOUBLE PRECISION,
            "5to14DeathMale" DOUBLE PRECISION,
            "5to14DeathFemale" DOUBLE PRECISION,
            "15PlusTotalCases" DOUBLE PRECISION,
            "15PlusTotalCasesMale" DOUBLE PRECISION,
            "15PlusTotalCasesFemale" DOUBLE PRECISION,
            "15PlusTotalDeaths" DOUBLE PRECISION,
            "15PlusTotalDeathsMale" DOUBLE PRECISION,
            "15PlusTotalDeathsFemale" DOUBLE PRECISION,
            "15PlusCaseMale" DOUBLE PRECISION,
            "15PlusCaseFemale" DOUBLE PRECISION,
            "15PlusDeathMale" DOUBLE PRECISION,
            "15PlusDeathFemale" DOUBLE PRECISION
        )
        ''')
        conn.commit()

def insert_case_report(conn, json_obj):
    """Insert a case report into the PostgreSQL database"""
    with conn.cursor() as cur:
        cur.execute(f'''
        INSERT INTO {TABLE_NAME} (
            week_date, year, week_number, disease, municipality_code, municipality,
            totalCases, totalCasesMale, totalCasesFemale, totalDeaths, totalDeathsMale, totalDeathsFemale,
            LessThan1TotalCases, LessThan1TotalCasesMale, LessThan1TotalCasesFemale,
            LessThan1TotalDeaths, LessThan1TotalDeathsMale, LessThan1TotalDeathsFemale,
            LessThan1CaseMale, LessThan1CaseFemale, LessThan1DeathMale, LessThan1DeathFemale,
            "1to4TotalCases", "1to4TotalCasesMale", "1to4TotalCasesFemale",
            "1to4TotalDeaths", "1to4TotalDeathsMale", "1to4TotalDeathsFemale",
            "1to4CaseMale", "1to4CaseFemale", "1to4DeathMale", "1to4DeathFemale",
            "5to14TotalCases", "5to14TotalCasesMale", "5to14TotalCasesFemale",
            "5to14TotalDeaths", "5to14TotalDeathsMale", "5to14TotalDeathsFemale",
            "5to14CaseMale", "5to14CaseFemale", "5to14DeathMale", "5to14DeathFemale",
            "15PlusTotalCases", "15PlusTotalCasesMale", "15PlusTotalCasesFemale",
            "15PlusTotalDeaths", "15PlusTotalDeathsMale", "15PlusTotalDeathsFemale",
            "15PlusCaseMale", "15PlusCaseFemale", "15PlusDeathMale", "15PlusDeathFemale"
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s
        )
        ''', (
            json_obj['week_date'],
            json_obj['year'],
            json_obj['week_number'],
            json_obj['disease'],
            json_obj['municipality_code'],
            json_obj['municipality'],
            json_obj.get('totalCases'),
            json_obj.get('totalCasesMale'),
            json_obj.get('totalCasesFemale'),
            json_obj.get('totalDeaths'),
            json_obj.get('totalDeathsMale'),
            json_obj.get('totalDeathsFemale'),
            json_obj.get('LessThan1TotalCases'),
            json_obj.get('LessThan1TotalCasesMale'),
            json_obj.get('LessThan1TotalCasesFemale'),
            json_obj.get('LessThan1TotalDeaths'),
            json_obj.get('LessThan1TotalDeathsMale'),
            json_obj.get('LessThan1TotalDeathsFemale'),
            json_obj.get('LessThan1CaseMale'),
            json_obj.get('LessThan1CaseFemale'),
            json_obj.get('LessThan1DeathMale'),
            json_obj.get('LessThan1DeathFemale'),
            json_obj.get('1to4TotalCases'),
            json_obj.get('1to4TotalCasesMale'),
            json_obj.get('1to4TotalCasesFemale'),
            json_obj.get('1to4TotalDeaths'),
            json_obj.get('1to4TotalDeathsMale'),
            json_obj.get('1to4TotalDeathsFemale'),
            json_obj.get('1to4CaseMale'),
            json_obj.get('1to4CaseFemale'),
            json_obj.get('1to4DeathMale'),
            json_obj.get('1to4DeathFemale'),
            json_obj.get('5to14TotalCases'),
            json_obj.get('5to14TotalCasesMale'),
            json_obj.get('5to14TotalCasesFemale'),
            json_obj.get('5to14TotalDeaths'),
            json_obj.get('5to14TotalDeathsMale'),
            json_obj.get('5to14TotalDeathsFemale'),
            json_obj.get('5to14CaseMale'),
            json_obj.get('5to14CaseFemale'),
            json_obj.get('5to14DeathMale'),
            json_obj.get('5to14DeathFemale'),
            json_obj.get('15PlusTotalCases'),
            json_obj.get('15PlusTotalCasesMale'),
            json_obj.get('15PlusTotalCasesFemale'),
            json_obj.get('15PlusTotalDeaths'),
            json_obj.get('15PlusTotalDeathsMale'),
            json_obj.get('15PlusTotalDeathsFemale'),
            json_obj.get('15PlusCaseMale'),
            json_obj.get('15PlusCaseFemale'),
            json_obj.get('15PlusDeathMale'),
            json_obj.get('15PlusDeathFemale')
        ))

def main():
    try:
        # Connect to PostgreSQL database
        conn = psycopg2.connect(**DB_CONFIG)
        print("Connected to PostgreSQL database successfully!")

        # Create table if it doesn't exist
        create_table(conn)
        print(f"Ensured {TABLE_NAME} table exists")

        # Process JSON files
        for filename in os.listdir('./data'):
            if filename.endswith('.json'):
                print(f"Processing {filename}")
                with open(os.path.join('./data', filename), 'r') as file:
                    case_reports = json.load(file)
                    
                    # Insert each object from the JSON array
                    for obj in case_reports:
                        insert_case_report(conn, obj)
                    
                    conn.commit()
                    print(f"Successfully imported case reports from {filename}")

        print("All data has been imported successfully!")

    except psycopg2.Error as e:
        print(f"Error connecting to PostgreSQL database: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    main() 