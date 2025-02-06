from flask import request, Response, send_file
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api
from superset.views.base_api import BaseSupersetApi
from superset.extensions import event_logger, db
from superset import app
from sqlalchemy import Table, Column, Integer, String, Float, MetaData, PrimaryKeyConstraint, DateTime
import pandas as pd
import logging
from typing import Dict, List, Tuple
import numpy as np
from sqlalchemy import create_engine, text
import re
from datetime import datetime, timedelta
from isoweek import Week
import os

logger = logging.getLogger(__name__)

class UpdateCaseReportsRestApi(BaseSupersetApi):
    resource_name = "update_case_reports"
    allow_browser_login = True

    def __init__(self):
        super().__init__()
        self.metadata = MetaData()
        # Define the table structure with composite primary key
        self.diseases_table = Table(
            'tlhis_diseases', 
            self.metadata,
            Column('year', Integer, nullable=False),
            Column('week_number', Integer, nullable=False),
            Column('disease', String(255), nullable=False),
            Column('municipality_code', String(10), nullable=False),
            Column('municipality', String(255)),
            Column('week_start_date', DateTime, nullable=False),
            # Add composite primary key
            PrimaryKeyConstraint('year', 'week_number', 'disease', 'municipality_code', name='pk_tlhis_diseases'),
            extend_existing=True
        )
        
        # Create template files table
        self.template_table = Table(
            'tlhis_template_files',
            self.metadata,
            Column('id', Integer, primary_key=True),
            Column('file_path', String(1000)),
            Column('upload_date', db.DateTime, default=db.func.now()),
            extend_existing=True
        )

    def _clean_column_name(self, col: str) -> str:
        """Clean column names by removing whitespace and converting to lowercase"""
        return col.strip().lower() if isinstance(col, str) else col

    def _get_age_groups(self, df: pd.DataFrame) -> List[str]:
        """Extract age groups from the second row"""
        age_groups = [
            "Less Than 1 Year Old",
            "1 - 4 Years Old",
            "5 - 14 Years Old",
            "15+ Years Old"
        ]
        logger.info(f"Using standard age groups: {age_groups}")
        return age_groups

    def _create_normalized_columns(self, age_groups: List[str]) -> List[str]:
        """Create normalized column names for all combinations"""
        # Overall totals
        columns = [
            'disease',
            'totalCases',
            'totalCasesMale',
            'totalCasesFemale',
            'totalDeaths',
            'totalDeathsMale',
            'totalDeathsFemale'
        ]
        
        metrics = ['Case', 'Death']
        genders = ['Male', 'Female']
        
        # Create clean names for age groups
        age_group_clean_names = {
            "Less Than 1 Year Old": "LessThan1",
            "1 - 4 Years Old": "1to4",
            "5 - 14 Years Old": "5to14",
            "15+ Years Old": "15Plus"
        }
        
        for age in age_groups:
            age_clean = age_group_clean_names[age]
            # Add totals for each age group
            columns.extend([
                f"{age_clean}TotalCases",
                f"{age_clean}TotalCasesMale",
                f"{age_clean}TotalCasesFemale",
                f"{age_clean}TotalDeaths",
                f"{age_clean}TotalDeathsMale",
                f"{age_clean}TotalDeathsFemale"
            ])
            # Add detailed breakdowns
            for metric in metrics:
                for gender in genders:
                    col_name = f"{age_clean}{metric}{gender}"
                    columns.append(col_name)
        
        return columns

    def _transform_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform the hierarchical data into a normalized format"""
        try:
            # Get age groups
            age_groups = self._get_age_groups(df)
            logger.info(f"Using age groups: {age_groups}")
            
            # Create normalized column names
            normalized_columns = self._create_normalized_columns(age_groups)
            logger.info(f"Normalized columns: {normalized_columns}")
            
            # Initialize the normalized dataframe
            normalized_data = []
            
            # Process data rows (start from row 4, which contains the actual data)
            data_rows = df.iloc[3:]  # Start from row 4 (index 3)
            total_columns = len(df.columns)
            logger.info(f"Total columns in DataFrame: {total_columns}")
            
            # Clean age group names mapping
            age_group_clean_names = {
                "Less Than 1 Year Old": "LessThan1",
                "1 - 4 Years Old": "1to4",
                "5 - 14 Years Old": "5to14",
                "15+ Years Old": "15Plus"
            }
            
            for idx, row in data_rows.iterrows():
                if pd.isna(row.iloc[1]):  # Skip if disease name is empty
                    continue
                    
                normalized_row = {col: 0 for col in normalized_columns}  # Initialize with zeros
                disease_name = row.iloc[1]
                if pd.isna(disease_name) or not isinstance(disease_name, str):
                    continue
                    
                normalized_row['disease'] = disease_name.strip()
                
                # Initialize overall totals
                total_cases = 0
                total_cases_male = 0
                total_cases_female = 0
                total_deaths = 0
                total_deaths_male = 0
                total_deaths_female = 0
                
                # Process each age group starting from column 3 (index 2)
                col_idx = 2  # Start from third column
                for age_group in age_groups:
                    age_clean = age_group_clean_names[age_group]
                    
                    # Check if we have enough columns for this age group
                    if col_idx + 3 >= total_columns:
                        logger.warning(f"Not enough columns for age group {age_group}. Expected columns up to {col_idx + 3} but only have {total_columns}")
                        break
                    
                    try:
                        # Get case values (Male, Female)
                        case_male = float(row.iloc[col_idx]) if pd.notna(row.iloc[col_idx]) else 0
                        case_female = float(row.iloc[col_idx + 1]) if pd.notna(row.iloc[col_idx + 1]) else 0
                        death_male = float(row.iloc[col_idx + 2]) if pd.notna(row.iloc[col_idx + 2]) else 0
                        death_female = float(row.iloc[col_idx + 3]) if pd.notna(row.iloc[col_idx + 3]) else 0
                        
                        # Store raw values
                        normalized_row[f"{age_clean}CaseMale"] = case_male
                        normalized_row[f"{age_clean}CaseFemale"] = case_female
                        normalized_row[f"{age_clean}DeathMale"] = death_male
                        normalized_row[f"{age_clean}DeathFemale"] = death_female
                        
                        # Calculate totals for this age group
                        age_group_total_cases = case_male + case_female
                        age_group_total_deaths = death_male + death_female
                        
                        # Store age group totals
                        normalized_row[f"{age_clean}TotalCases"] = age_group_total_cases
                        normalized_row[f"{age_clean}TotalCasesMale"] = case_male
                        normalized_row[f"{age_clean}TotalCasesFemale"] = case_female
                        normalized_row[f"{age_clean}TotalDeaths"] = age_group_total_deaths
                        normalized_row[f"{age_clean}TotalDeathsMale"] = death_male
                        normalized_row[f"{age_clean}TotalDeathsFemale"] = death_female
                        
                        # Add to overall totals
                        total_cases += age_group_total_cases
                        total_cases_male += case_male
                        total_cases_female += case_female
                        total_deaths += age_group_total_deaths
                        total_deaths_male += death_male
                        total_deaths_female += death_female
                        
                    except Exception as e:
                        logger.warning(f"Error processing age group {age_group} at column index {col_idx}: {str(e)}")
                        logger.warning(f"Row values: {row.iloc[col_idx:col_idx+4].tolist()}")
                    
                    col_idx += 4  # Move to next age group (4 columns per age group)
                
                # Add all totals to the row
                normalized_row['totalCases'] = total_cases
                normalized_row['totalCasesMale'] = total_cases_male
                normalized_row['totalCasesFemale'] = total_cases_female
                normalized_row['totalDeaths'] = total_deaths
                normalized_row['totalDeathsMale'] = total_deaths_male
                normalized_row['totalDeathsFemale'] = total_deaths_female
                
                normalized_data.append(normalized_row)
            
            # Create normalized DataFrame
            normalized_df = pd.DataFrame(normalized_data)
            
            return normalized_df
            
        except Exception as e:
            logger.error(f"Error in data transformation: {str(e)}", exc_info=True)
            raise

    def _process_excel_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Process and clean the Excel data"""
        try:
            # Drop rows where all values are NaN
            df = df.dropna(how='all')
            
            # Reset index after dropping rows
            df = df.reset_index(drop=True)
            
            logger.info(f"Processing Excel data with shape: {df.shape}")
            logger.info(f"First few rows before transformation:\n{df.head().to_string()}")
            
            # Transform the data into normalized format
            normalized_df = self._transform_data(df)
            
            return normalized_df
            
        except Exception as e:
            logger.error(f"Error processing Excel data: {str(e)}", exc_info=True)
            raise

    def _extract_week_number(self, sheet_name: str) -> int:
        """Extract week number from sheet name"""
        try:
            # Try to find a number in the sheet name
            match = re.search(r'week\s*(\d+)', sheet_name.lower())
            if match:
                return int(match.group(1))
            # If no explicit week number, try to find any number
            match = re.search(r'(\d+)', sheet_name)
            if match:
                return int(match.group(1))
            logger.warning(f"Could not extract week number from sheet name: {sheet_name}")
            return 0
        except Exception as e:
            logger.error(f"Error extracting week number from {sheet_name}: {str(e)}")
            return 0

    def _save_to_database(self, dfs: Dict[str, pd.DataFrame], municipality_code: str = None, year: int = None, week: int = None) -> None:
        """Save the processed data to PostgreSQL"""
        try:
            # Define municipality code mapping
            municipality_codes = {
                'TL-AL': 'Aileu',
                'TL-AN': 'Ainaro',
                'TL-AT': 'Atauro',
                'TL-BA': 'Baucau',
                'TL-BO': 'Bobonaro',
                'TL-CO': 'Covalima',
                'TL-DI': 'Dili',
                'TL-ER': 'Ermera',
                'TL-LA': 'Lautem',
                'TL-LI': 'Liquica',
                'TL-MT': 'Manatuto',
                'TL-MF': 'Manufahi',
                'TL-OE': 'Oecusse',
                'TL-VI': 'Viqueque'
            }

            # Combine all sheets into one DataFrame with week numbers
            all_data = []
            for sheet_name, df in dfs.items():
                df['week_number'] = week
                df['year'] = year
                df['municipality_code'] = municipality_code
                df['municipality'] = municipality_codes.get(municipality_code, '')
                # Calculate the Monday date for this year and week
                week_obj = Week(year, week)
                df['week_start_date'] = week_obj.monday()
                all_data.append(df)
            
            if not all_data:
                logger.warning("No data to save to database")
                return
                
            combined_df = pd.concat(all_data, ignore_index=True)
            
            inspector = db.inspect(db.engine)
            
            with db.engine.begin() as connection:
                # First ensure the table exists
                if not inspector.has_table('tlhis_diseases'):
                    # Create base table if it doesn't exist with the composite primary key
                    self.diseases_table.create(db.engine)
                    logger.info("Created tlhis_diseases table with composite primary key")
                
                # Now get existing columns after ensuring table exists
                existing_columns = {col['name'] for col in inspector.get_columns('tlhis_diseases')}
                
                # Add any missing columns
                for col in combined_df.columns:
                    if col not in existing_columns and col not in ['id']:
                        # Map Python types to PostgreSQL types
                        if col in ['disease', 'municipality_code', 'municipality']:
                            pg_type = 'VARCHAR(255)'
                        elif col == 'week_start_date':
                            pg_type = 'TIMESTAMP'
                        else:
                            pg_type = 'DOUBLE PRECISION'  # For numeric values
                            
                        connection.execute(db.text(
                            f'ALTER TABLE tlhis_diseases ADD COLUMN IF NOT EXISTS "{col}" {pg_type}'
                        ))
                        logger.info(f"Added column: {col}")
                
                # Delete existing records that match the composite key
                connection.execute(db.text("""
                    DELETE FROM tlhis_diseases 
                    WHERE year = :year 
                    AND week_number = :week 
                    AND municipality_code = :municipality_code
                    AND disease IN :diseases
                """), {
                    'year': year,
                    'week': week,
                    'municipality_code': municipality_code,
                    'diseases': tuple(combined_df['disease'].unique())
                })
                
                # Insert the new data
                combined_df.to_sql(
                    'tlhis_diseases',
                    connection,
                    if_exists='append',
                    index=False,
                    method='multi',
                    chunksize=1000
                )
            
            # Save the uploaded file as the new template
            upload_file = request.files.get("file")
            if upload_file and hasattr(upload_file, 'filename'):
                template_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'templates')
                os.makedirs(template_dir, exist_ok=True)
                
                template_path = os.path.join(
                    template_dir, 
                    f"template_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
                )
                upload_file.save(template_path)
                
                # Create template table if it doesn't exist
                if not inspector.has_table('tlhis_template_files'):
                    self.template_table.create(db.engine)
                
                # Insert template record using a transaction
                with db.engine.begin() as connection:
                    connection.execute(
                        self.template_table.insert().values(
                            file_path=template_path
                        )
                    )
                
                logger.info(f"Saved new template file: {template_path}")
            
            logger.info(f"Successfully saved {len(combined_df)} rows to database")
            
        except Exception as e:
            logger.error(f"Error saving to database: {str(e)}", exc_info=True)
            raise

    @expose("/upload", methods=["POST"])
    # @has_access_api
    @event_logger.log_this
    def upload(self) -> Response:
        """Upload case reports data"""
        upload_file = request.files.get("file")
        municipality_code = request.form.get("municipality_code")
        year = request.form.get("year", datetime.now().year)  # Default to current year
        week = request.form.get("week")  # Get week parameter
        
        try:
            year = int(year)
            week = int(week)
        except (TypeError, ValueError):
            return self.response_400("Invalid year or week format")
        
        if not upload_file:
            return self.response_400("No file uploaded")
        
        if not municipality_code:
            return self.response_400("Municipality code is required")
            
        if not week or week < 1 or week > 53:
            return self.response_400("Week number is required and must be between 1 and 53")
            
        try:
            # Read all sheets from the Excel file
            excel_file = pd.ExcelFile(upload_file)
            sheet_names = excel_file.sheet_names
            logger.info(f"Found sheets: {sheet_names}")
            logger.info(f"Processing for municipality code: {municipality_code}, year: {year}, week: {week}")
            
            # Dictionary to store DataFrames from each sheet
            dfs: Dict[str, pd.DataFrame] = {}
            
            # Process each sheet
            for sheet_name in sheet_names:
                logger.info(f"\nProcessing sheet: {sheet_name}")
                # Read the sheet without header since we have a complex header structure
                df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
                
                logger.info(f"Raw DataFrame shape: {df.shape}")
                logger.info(f"First few rows of raw data:\n{df.head().to_string()}")
                
                # Process and clean the data
                df = self._process_excel_data(df)
                
                # Store the processed DataFrame
                dfs[sheet_name] = df
                
                # Log the DataFrame info and first few rows
                logger.info(f"\n{'='*50}\nSheet: {sheet_name}\n{'='*50}")
                logger.info(f"\nColumns:\n{df.columns.tolist()}")
                logger.info(f"\nData Types:\n{df.dtypes}")
                logger.info(f"\nFirst few rows:\n{df.head().to_string()}")
                logger.info(f"\nShape: {df.shape}")
                
                # Log any missing values
                missing_values = df.isnull().sum()
                if missing_values.any():
                    logger.info(f"\nMissing Values:\n{missing_values[missing_values > 0]}")
            
            # Save the processed data to the database
            self._save_to_database(dfs, municipality_code, year, week)
            
            return self.response(200, message="File processed and saved to database successfully", result={
                "sheets_processed": list(dfs.keys()),
                "total_rows": {sheet: df.shape[0] for sheet, df in dfs.items()},
                "municipality_code": municipality_code,
                "year": year,
                "week": week
            })
            
        except Exception as e:
            logger.error(f"Error processing file: {str(e)}", exc_info=True)
            return self.response_400(f"Error processing file: {str(e)}")

    @expose("/template", methods=["GET"])
    @has_access_api
    @event_logger.log_this
    def template(self) -> Response:
        """Download case reports template"""
        try:
            # Query for the latest template
            with db.engine.connect() as connection:
                if not db.inspect(db.engine).has_table('tlhis_template_files'):
                    self.template_table.create(db.engine)
                
                result = connection.execute(
                    db.select(self.template_table.c.file_path)
                    .order_by(self.template_table.c.upload_date.desc())
                    .limit(1)
                ).first()
                
                template_path = result[0] if result else None
            
            if template_path and os.path.exists(template_path):
                return send_file(
                    template_path,
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    as_attachment=True,
                    download_name='case_reports_template.xlsx'
                )
            
            # If no template exists, create a basic one
            logger.warning("No template found, creating a basic template")
            df = pd.DataFrame()  # Empty DataFrame as placeholder
            
            # Save as temporary file
            temp_file = 'temp_template.xlsx'
            df.to_excel(temp_file, index=False)
            
            return send_file(
                temp_file,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name='case_reports_template.xlsx'
            )
            
        except Exception as e:
            logger.error(f"Error generating template: {str(e)}", exc_info=True)
            return self.response_400(f"Error generating template: {str(e)}")