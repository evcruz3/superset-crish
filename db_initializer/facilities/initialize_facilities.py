import pandas as pd
import sqlite3

# Load the Excel file
file_path = './tl_health_facilities_edited.xlsx'
sheets_data = pd.read_excel(file_path, sheet_name=None)  # Load all sheets into a dictionary

administrative_posts = [
    "Aileu",
    "Ainaro",
    "Atauro",
    "Baucau",
    "Bobonaro",
    "Covalima",
    "Dili",
    "Ermera",
    "Manatuto",
    "Manufahi",
    "Lautem",
    "Liquica",
    "Raeoa",
    "Viqueque"
]

table_name = "Facility"

# Connect to SQLite database (or create it if it doesn't exist)
conn = sqlite3.connect('health_facilities.db')


for sheet_name, data in sheets_data.items():
    if sheet_name in administrative_posts:
        # Clean the data by renaming the columns and removing unnecessary rows
        cleaned_data = pd.read_excel(file_path, sheet_name=sheet_name, header=0)

        print(f"keys of  {sheet_name}")
        print(cleaned_data.keys())

        # Remove any rows where the first column is NaN as they seem to be irrelevant
        cleaned_data = cleaned_data.dropna(subset=[cleaned_data.columns[1]])

        # Trim whitespace from column names
        cleaned_data.columns = cleaned_data.columns.str.strip()

        # Ensure that Longitude and Latitude columns are float
        if 'Longitude' in cleaned_data.columns:
            cleaned_data['Longitude'] = pd.to_numeric(cleaned_data['Longitude'], errors='coerce')
        if 'Latitude' in cleaned_data.columns:
            cleaned_data['Latitude'] = pd.to_numeric(cleaned_data['Latitude'], errors='coerce')

        if 'Ambulance' in cleaned_data.columns:
            cleaned_data['Ambulance'] = pd.to_numeric(cleaned_data['Ambulance'], errors='coerce', downcast='integer')

        if 'Maternity bed' in cleaned_data.columns:
            cleaned_data['Maternity bed'] = pd.to_numeric(cleaned_data['Maternity bed'], errors='coerce', downcast='integer')

        if 'Total bed' in cleaned_data.columns:
            cleaned_data['Total bed'] = pd.to_numeric(cleaned_data['Total bed'], errors='coerce', downcast='integer')

        # Drop rows where Longitude or Latitude is NaN after conversion
        cleaned_data = cleaned_data.dropna(subset=['Longitude', 'Latitude'])

        # Get the existing columns
        cursor = conn.execute(f"PRAGMA table_info({table_name})")
        existing_columns = [row[1] for row in cursor.fetchall()]

        # Add missing columns to the table
        # for column in cleaned_data.columns:
        #     if column not in existing_columns:
        #         conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column}")

        # Convert the dataframe to SQL table
        cleaned_data.to_sql(table_name, conn, if_exists='append', index=False)

# Commit and close the connection
conn.commit()

# Print the headers and a sample of the data
cursor = conn.execute(f"PRAGMA table_info({table_name})")
headers = [row[1] for row in cursor.fetchall()]
print("Headers:", headers)

cursor = conn.execute(f"SELECT * FROM {table_name} LIMIT 1")
sample_data = cursor.fetchall()
print("Sample Data:")
for row in sample_data:
    print(row)
print("\n" + "-"*40 + "\n")

conn.close()