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
    """Create the case reports table if it doesn't exist or ensure all required columns exist"""
    with conn.cursor() as cur:
        # Check if table exists
        cur.execute(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = '{TABLE_NAME}'
            );
        """)
        table_exists = cur.fetchone()[0]

        if not table_exists:
            # Create table if it doesn't exist
            cur.execute(f'''
            CREATE TABLE {TABLE_NAME} (
                id SERIAL,
                "week_start_date" TIMESTAMP,
                "year" INTEGER,
                "week_number" INTEGER,
                "disease" VARCHAR(50),
                "municipality_code" VARCHAR(10),
                "municipality" VARCHAR(50),
                "totalCases" DOUBLE PRECISION,
                "totalCasesMale" DOUBLE PRECISION,
                "totalCasesFemale" DOUBLE PRECISION,
                "totalDeaths" DOUBLE PRECISION,
                "totalDeathsMale" DOUBLE PRECISION,
                "totalDeathsFemale" DOUBLE PRECISION,
                "LessThan1TotalCases" DOUBLE PRECISION,
                "LessThan1TotalCasesMale" DOUBLE PRECISION,
                "LessThan1TotalCasesFemale" DOUBLE PRECISION,
                "LessThan1TotalDeaths" DOUBLE PRECISION,
                "LessThan1TotalDeathsMale" DOUBLE PRECISION,
                "LessThan1TotalDeathsFemale" DOUBLE PRECISION,
                "LessThan1CaseMale" DOUBLE PRECISION,
                "LessThan1CaseFemale" DOUBLE PRECISION,
                "LessThan1DeathMale" DOUBLE PRECISION,
                "LessThan1DeathFemale" DOUBLE PRECISION,
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
                "15PlusDeathFemale" DOUBLE PRECISION,
                CONSTRAINT pk_tlhis_diseases UNIQUE ("year", "week_number", "disease", "municipality_code")
            )
            ''')

        else:
            # Ensure the unique constraint exists
            cur.execute(f"""
                SELECT COUNT(*) 
                FROM pg_constraint 
                WHERE conname = 'pk_tlhis_diseases' 
                AND conrelid = '{TABLE_NAME}'::regclass;
            """)
            constraint_exists = cur.fetchone()[0]

            if not constraint_exists:
                cur.execute(f'''
                    ALTER TABLE {TABLE_NAME}
                    ADD CONSTRAINT pk_tlhis_diseases 
                    UNIQUE ("year", "week_number", "disease", "municipality_code");
                ''')

            # Check for missing columns and add them if necessary
            required_columns = [
                ('week_start_date', 'TIMESTAMP'),
                ('year', 'INTEGER'),
                ('week_number', 'INTEGER'),
                ('disease', 'VARCHAR(50)'),
                ('municipality_code', 'VARCHAR(10)'),
                ('municipality', 'VARCHAR(50)'),
                ('totalCases', 'DOUBLE PRECISION'),
                ('totalCasesMale', 'DOUBLE PRECISION'),
                ('totalCasesFemale', 'DOUBLE PRECISION'),
                ('totalDeaths', 'DOUBLE PRECISION'),
                ('totalDeathsMale', 'DOUBLE PRECISION'),
                ('totalDeathsFemale', 'DOUBLE PRECISION'),
                ('LessThan1TotalCases', 'DOUBLE PRECISION'),
                ('LessThan1TotalCasesMale', 'DOUBLE PRECISION'),
                ('LessThan1TotalCasesFemale', 'DOUBLE PRECISION'),
                ('LessThan1TotalDeaths', 'DOUBLE PRECISION'),
                ('LessThan1TotalDeathsMale', 'DOUBLE PRECISION'),
                ('LessThan1TotalDeathsFemale', 'DOUBLE PRECISION'),
                ('LessThan1CaseMale', 'DOUBLE PRECISION'),
                ('LessThan1CaseFemale', 'DOUBLE PRECISION'),
                ('LessThan1DeathMale', 'DOUBLE PRECISION'),
                ('LessThan1DeathFemale', 'DOUBLE PRECISION'),
                ('1to4TotalCases', 'DOUBLE PRECISION'),
                ('1to4TotalCasesMale', 'DOUBLE PRECISION'),
                ('1to4TotalCasesFemale', 'DOUBLE PRECISION'),
                ('1to4TotalDeaths', 'DOUBLE PRECISION'),
                ('1to4TotalDeathsMale', 'DOUBLE PRECISION'),
                ('1to4TotalDeathsFemale', 'DOUBLE PRECISION'),
                ('1to4CaseMale', 'DOUBLE PRECISION'),
                ('1to4CaseFemale', 'DOUBLE PRECISION'),
                ('1to4DeathMale', 'DOUBLE PRECISION'),
                ('1to4DeathFemale', 'DOUBLE PRECISION'),
                ('5to14TotalCases', 'DOUBLE PRECISION'),
                ('5to14TotalCasesMale', 'DOUBLE PRECISION'),
                ('5to14TotalCasesFemale', 'DOUBLE PRECISION'),
                ('5to14TotalDeaths', 'DOUBLE PRECISION'),
                ('5to14TotalDeathsMale', 'DOUBLE PRECISION'),
                ('5to14TotalDeathsFemale', 'DOUBLE PRECISION'),
                ('5to14CaseMale', 'DOUBLE PRECISION'),
                ('5to14CaseFemale', 'DOUBLE PRECISION'),
                ('5to14DeathMale', 'DOUBLE PRECISION'),
                ('5to14DeathFemale', 'DOUBLE PRECISION'),
                ('15PlusTotalCases', 'DOUBLE PRECISION'),
                ('15PlusTotalCasesMale', 'DOUBLE PRECISION'),
                ('15PlusTotalCasesFemale', 'DOUBLE PRECISION'),
                ('15PlusTotalDeaths', 'DOUBLE PRECISION'),
                ('15PlusTotalDeathsMale', 'DOUBLE PRECISION'),
                ('15PlusTotalDeathsFemale', 'DOUBLE PRECISION'),
                ('15PlusCaseMale', 'DOUBLE PRECISION'),
                ('15PlusCaseFemale', 'DOUBLE PRECISION'),
                ('15PlusDeathMale', 'DOUBLE PRECISION'),
                ('15PlusDeathFemale', 'DOUBLE PRECISION')
            ]

            # Get existing columns
            cur.execute(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '{TABLE_NAME}'
            """)
            existing_columns = {row[0].lower() for row in cur.fetchall()}

            # Add missing columns
            for column_name, column_type in required_columns:
                if column_name.lower() not in existing_columns:
                    cur.execute(f'''
                        ALTER TABLE {TABLE_NAME} 
                        ADD COLUMN "{column_name}" {column_type}
                    ''')

        conn.commit()

def insert_case_report(conn, json_obj):
    """Insert or update a case report in the PostgreSQL database"""
    try:
        # Debug: Print the keys in json_obj
        # print(f"JSON object keys: {json_obj.keys()}")
        # print(f"week_start_date value: {json_obj.get('week_start_date', 'NOT FOUND')}")
        
        with conn.cursor() as cur:
            cur.execute(f'''
            INSERT INTO {TABLE_NAME} (
                "week_start_date", "year", "week_number", "disease", "municipality_code", "municipality",
                "totalCases", "totalCasesMale", "totalCasesFemale", "totalDeaths", "totalDeathsMale", "totalDeathsFemale",
                "LessThan1TotalCases", "LessThan1TotalCasesMale", "LessThan1TotalCasesFemale",
                "LessThan1TotalDeaths", "LessThan1TotalDeathsMale", "LessThan1TotalDeathsFemale",
                "LessThan1CaseMale", "LessThan1CaseFemale", "LessThan1DeathMale", "LessThan1DeathFemale",
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
            ON CONFLICT ON CONSTRAINT pk_tlhis_diseases DO UPDATE SET
                "week_start_date" = EXCLUDED."week_start_date",
                "municipality" = EXCLUDED."municipality",
                "totalCases" = EXCLUDED."totalCases",
                "totalCasesMale" = EXCLUDED."totalCasesMale",
                "totalCasesFemale" = EXCLUDED."totalCasesFemale",
                "totalDeaths" = EXCLUDED."totalDeaths",
                "totalDeathsMale" = EXCLUDED."totalDeathsMale",
                "totalDeathsFemale" = EXCLUDED."totalDeathsFemale",
                "LessThan1TotalCases" = EXCLUDED."LessThan1TotalCases",
                "LessThan1TotalCasesMale" = EXCLUDED."LessThan1TotalCasesMale",
                "LessThan1TotalCasesFemale" = EXCLUDED."LessThan1TotalCasesFemale",
                "LessThan1TotalDeaths" = EXCLUDED."LessThan1TotalDeaths",
                "LessThan1TotalDeathsMale" = EXCLUDED."LessThan1TotalDeathsMale",
                "LessThan1TotalDeathsFemale" = EXCLUDED."LessThan1TotalDeathsFemale",
                "LessThan1CaseMale" = EXCLUDED."LessThan1CaseMale",
                "LessThan1CaseFemale" = EXCLUDED."LessThan1CaseFemale",
                "LessThan1DeathMale" = EXCLUDED."LessThan1DeathMale",
                "LessThan1DeathFemale" = EXCLUDED."LessThan1DeathFemale",
                "1to4TotalCases" = EXCLUDED."1to4TotalCases",
                "1to4TotalCasesMale" = EXCLUDED."1to4TotalCasesMale",
                "1to4TotalCasesFemale" = EXCLUDED."1to4TotalCasesFemale",
                "1to4TotalDeaths" = EXCLUDED."1to4TotalDeaths",
                "1to4TotalDeathsMale" = EXCLUDED."1to4TotalDeathsMale",
                "1to4TotalDeathsFemale" = EXCLUDED."1to4TotalDeathsFemale",
                "1to4CaseMale" = EXCLUDED."1to4CaseMale",
                "1to4CaseFemale" = EXCLUDED."1to4CaseFemale",
                "1to4DeathMale" = EXCLUDED."1to4DeathMale",
                "1to4DeathFemale" = EXCLUDED."1to4DeathFemale",
                "5to14TotalCases" = EXCLUDED."5to14TotalCases",
                "5to14TotalCasesMale" = EXCLUDED."5to14TotalCasesMale",
                "5to14TotalCasesFemale" = EXCLUDED."5to14TotalCasesFemale",
                "5to14TotalDeaths" = EXCLUDED."5to14TotalDeaths",
                "5to14TotalDeathsMale" = EXCLUDED."5to14TotalDeathsMale",
                "5to14TotalDeathsFemale" = EXCLUDED."5to14TotalDeathsFemale",
                "5to14CaseMale" = EXCLUDED."5to14CaseMale",
                "5to14CaseFemale" = EXCLUDED."5to14CaseFemale",
                "5to14DeathMale" = EXCLUDED."5to14DeathMale",
                "5to14DeathFemale" = EXCLUDED."5to14DeathFemale",
                "15PlusTotalCases" = EXCLUDED."15PlusTotalCases",
                "15PlusTotalCasesMale" = EXCLUDED."15PlusTotalCasesMale",
                "15PlusTotalCasesFemale" = EXCLUDED."15PlusTotalCasesFemale",
                "15PlusTotalDeaths" = EXCLUDED."15PlusTotalDeaths",
                "15PlusTotalDeathsMale" = EXCLUDED."15PlusTotalDeathsMale",
                "15PlusTotalDeathsFemale" = EXCLUDED."15PlusTotalDeathsFemale",
                "15PlusCaseMale" = EXCLUDED."15PlusCaseMale",
                "15PlusCaseFemale" = EXCLUDED."15PlusCaseFemale",
                "15PlusDeathMale" = EXCLUDED."15PlusDeathMale",
                "15PlusDeathFemale" = EXCLUDED."15PlusDeathFemale"
            ''', (
                json_obj.get('week_start_date'),
                json_obj.get('year'),
                json_obj.get('week_number'),
                json_obj.get('disease'),
                json_obj.get('municipality_code'),
                json_obj.get('municipality'),
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
    except KeyError as e:
        print(f"KeyError: Missing required field {e}")
        raise
    except Exception as e:
        print(f"Error in insert_case_report: {str(e)}")
        print(f"Full error details: {type(e).__name__}: {str(e)}")
        raise

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
                    
                    # Debug: Print the first record
                    if case_reports:
                        print(f"Sample record from {filename}:")
                        print(json.dumps(case_reports[0], indent=2))
                    
                    # Insert each object from the JSON array
                    for obj in case_reports:
                        insert_case_report(conn, obj)
                    
                    conn.commit()
                    print(f"Successfully imported case reports from {filename}")

        print("All data has been imported successfully!")

    except psycopg2.Error as e:
        print(f"Error connecting to PostgreSQL database: {e}")
        print(f"Full PostgreSQL error details: {type(e).__name__}: {str(e)}")
    except Exception as e:
        print(f"An error occurred: {e}")
        print(f"Full error details: {type(e).__name__}: {str(e)}")
        import traceback
        print("Traceback:")
        print(traceback.format_exc())
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    main() 