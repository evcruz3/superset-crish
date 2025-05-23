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
    openapi_spec_tag = "CRISH Update Case Reports"
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

    def _get_age_groups_old_format(self) -> List[str]:
        """Get standard age groups for the old format"""
        return [
            "Less Than 1 Year Old",
            "1 - 4 Years Old",
            "5 - 14 Years Old",
            "15+ Years Old"
        ]

    def _get_age_groups_new_format(self) -> List[str]:
        """Get standard age groups for the new format (>= 2025)"""
        return [
            "<1",           # Less Than 1 Year Old
            "1 - 4",        # 1 - 4 Years Old
            "5 - 14",       # 5 - 14 Years Old
            "15 - 24",      # 15 - 24 Years Old
            "25 - 39",      # 25 - 39 Years Old
            "40 - 59",      # 40 - 59 Years Old
            "60+"           # 60+ Years Old
        ]

    def _create_normalized_columns(self, age_groups: List[str], age_group_clean_names: Dict[str, str]) -> List[str]:
        """Create normalized column names for all combinations based on provided age groups"""
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
        
        for age in age_groups:
            age_clean = age_group_clean_names.get(age)
            if not age_clean:
                logger.warning(f"Could not find clean name for age group: {age}. Skipping.")
                continue

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

    def _transform_data(self, df: pd.DataFrame, year: int) -> pd.DataFrame:
        """Transform the hierarchical data into a normalized format based on the year"""
        try:
            # Determine age groups and clean names based on year
            if year >= 2025:
                logger.info("Using new format logic (year >= 2025)")
                age_groups = self._get_age_groups_new_format()
                age_group_clean_names = {
                    "<1": "LessThan1",
                    "1 - 4": "1to4",
                    "5 - 14": "5to14",
                    "15 - 24": "15to24",
                    "25 - 39": "25to39",
                    "40 - 59": "40to59",
                    "60+": "60Plus"
                }
            else:
                logger.info("Using old format logic (year < 2025)")
                age_groups = self._get_age_groups_old_format()
                age_group_clean_names = {
                    "Less Than 1 Year Old": "LessThan1",
                    "1 - 4 Years Old": "1to4",
                    "5 - 14 Years Old": "5to14",
                    "15+ Years Old": "15Plus"
                }

            logger.info(f"Using age groups: {age_groups}")
            
            # Create normalized column names
            normalized_columns = self._create_normalized_columns(age_groups, age_group_clean_names)
            logger.info(f"Normalized columns: {normalized_columns}")
            
            # Initialize the normalized dataframe
            normalized_data = []
            
            # Process data rows (start from row 4, which contains the actual data)
            data_rows = df.iloc[3:]  # Start from row 4 (index 3)
            total_columns_in_file = len(df.columns)
            logger.info(f"Total columns in source DataFrame: {total_columns_in_file}")
            
            expected_columns_per_age_group = 4 # Case M, Case F, Death M, Death F
            
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
                col_idx = 2  # Start from third column in the source file
                for age_group in age_groups:
                    age_clean = age_group_clean_names.get(age_group)
                    if not age_clean: continue # Should not happen based on creation logic
                    
                    # Check if we have enough columns for this age group's data
                    if col_idx + expected_columns_per_age_group > total_columns_in_file:
                        logger.warning(
                            f"Row {idx+4} ({disease_name}): Not enough columns for age group '{age_group}'. "
                            f"Expected columns up to index {col_idx + expected_columns_per_age_group - 1} but only have {total_columns_in_file-1}."
                        )
                        # Fill remaining age groups with 0 and break for this row
                        # This assumes data is contiguous and missing columns means no more data for subsequent age groups
                        break 
                    
                    try:
                        # Get case/death values (Male, Female)
                        # Indices: col_idx = Case M, col_idx+1 = Case F, col_idx+2 = Death M, col_idx+3 = Death F
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
                        
                    except IndexError:
                         logger.error(f"Row {idx+4} ({disease_name}): IndexError accessing columns for age group {age_group} at base index {col_idx}. Total columns: {total_columns_in_file}")
                         break # Stop processing age groups for this row
                    except ValueError as ve:
                        logger.warning(f"Row {idx+4} ({disease_name}): ValueError processing age group '{age_group}' at column index {col_idx}: {str(ve)}. Values: {row.iloc[col_idx:col_idx+expected_columns_per_age_group].tolist()}. Treating as 0.")
                        # Attempt to continue with 0s for this group might be risky, better to skip group or row?
                        # For now, let's just log and let the 0s from initialization stand for this group's totals.
                    except Exception as e:
                        logger.warning(f"Row {idx+4} ({disease_name}): Unexpected error processing age group '{age_group}' at column index {col_idx}: {str(e)}")
                        # Log and let the 0s from initialization stand for this group's totals.
                    
                    col_idx += expected_columns_per_age_group # Move to next age group
                
                # Add all calculated totals to the row
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
            logger.error(f"Error in data transformation for year {year}: {str(e)}", exc_info=True)
            raise

    def _process_excel_data(self, df: pd.DataFrame, year: int) -> pd.DataFrame:
        """Process and clean the Excel data"""
        try:
            # Drop rows where all values are NaN
            df = df.dropna(how='all')
            
            # Reset index after dropping rows
            df = df.reset_index(drop=True)
            
            logger.info(f"Processing Excel data with shape: {df.shape} for year {year}")
            logger.info(f"First few rows before transformation:\n{df.head().to_string()}")
            
            # Transform the data into normalized format, passing the year
            normalized_df = self._transform_data(df, year)
            
            return normalized_df
            
        except Exception as e:
            logger.error(f"Error processing Excel data for year {year}: {str(e)}", exc_info=True)
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
                # Ensure essential columns exist before proceeding
                required_cols = {'disease', 'totalCases', 'totalCasesMale', 'totalCasesFemale', 
                                 'totalDeaths', 'totalDeathsMale', 'totalDeathsFemale'}
                if not required_cols.issubset(df.columns):
                    logger.error(f"Sheet '{sheet_name}' is missing essential columns after transformation. Skipping sheet.")
                    logger.error(f"Required: {required_cols}")
                    logger.error(f"Present: {set(df.columns)}")
                    continue # Skip this sheet

                df['week_number'] = week
                df['year'] = year
                df['municipality_code'] = municipality_code
                df['municipality'] = municipality_codes.get(municipality_code, '')
                # Calculate the Monday date for this year and week
                try:
                    week_obj = Week(year, week)
                    df['week_start_date'] = week_obj.monday()
                except ValueError as ve:
                    logger.error(f"Invalid year/week combination: {year}, {week}. Error: {ve}. Cannot calculate week_start_date.")
                    # Decide how to handle: skip sheet, set null date, etc. Setting to None for now.
                    df['week_start_date'] = None 

                all_data.append(df)
            
            if not all_data:
                logger.warning("No valid data to save to database after processing all sheets.")
                return
                
            combined_df = pd.concat(all_data, ignore_index=True)
            
            # Ensure week_start_date column type is datetime before saving
            if 'week_start_date' in combined_df.columns:
                 combined_df['week_start_date'] = pd.to_datetime(combined_df['week_start_date'], errors='coerce')

            inspector = db.inspect(db.engine)
            
            with db.engine.begin() as connection:
                # First ensure the table exists
                if not inspector.has_table('tlhis_diseases'):
                    # Create base table if it doesn't exist with the composite primary key
                    self.diseases_table.create(db.engine)
                    logger.info("Created tlhis_diseases table with composite primary key")
                
                # Now get existing columns after ensuring table exists
                existing_columns = {col['name'] for col in inspector.get_columns('tlhis_diseases')}
                
                # Add any missing columns from the combined DataFrame
                for col in combined_df.columns:
                    if col not in existing_columns:
                        # Determine PostgreSQL type based on column name or inferred dtype
                        pg_type = 'VARCHAR(255)' # Default
                        if col in ['year', 'week_number']:
                            pg_type = 'INTEGER'
                        elif col == 'week_start_date':
                            pg_type = 'TIMESTAMP'
                        elif 'municipality' in col or 'disease' in col:
                            pg_type = 'VARCHAR(255)'
                        elif combined_df[col].dtype in (np.int64, np.int32):
                             pg_type = 'INTEGER'
                        elif combined_df[col].dtype in (np.float64, np.float32):
                            pg_type = 'DOUBLE PRECISION'

                        try:
                            connection.execute(db.text(
                                f'ALTER TABLE tlhis_diseases ADD COLUMN IF NOT EXISTS "{col}" {pg_type}'
                            ))
                            logger.info(f"Added column: {col} with type {pg_type}")
                        except Exception as alter_err:
                            logger.error(f"Failed to add column {col} with type {pg_type}: {alter_err}")
                            # If adding column fails, we might need to stop or handle differently
                            raise

                # Prepare data for deletion criteria (handle potential None values)
                unique_diseases = tuple(combined_df['disease'].dropna().unique())
                if not unique_diseases:
                    logger.warning("No unique diseases found in the data to process. Skipping database operations.")
                    return

                # Delete existing records that match the composite key components
                # Ensure parameters are not None before executing delete
                if year is not None and week is not None and municipality_code is not None:
                    delete_stmt = db.text("""
                        DELETE FROM tlhis_diseases 
                        WHERE year = :year 
                        AND week_number = :week 
                        AND municipality_code = :municipality_code
                        AND disease IN :diseases
                    """)
                    connection.execute(delete_stmt, {
                        'year': year,
                        'week': week,
                        'municipality_code': municipality_code,
                        'diseases': unique_diseases
                    })
                    logger.info(f"Executed delete for Year: {year}, Week: {week}, MunCode: {municipality_code}, Diseases: {len(unique_diseases)} types")
                else:
                     logger.warning("Skipping delete operation due to missing year, week, or municipality code.")

                # Prepare DataFrame for insertion: Ensure column order matches table? Not strictly necessary with to_sql
                # Ensure data types are compatible (e.g., handle potential NaNs in numeric columns)
                for col in combined_df.columns:
                     if combined_df[col].dtype in (np.float64, np.float32, np.int64, np.int32):
                           combined_df[col] = combined_df[col].fillna(0) # Or appropriate default

                # Select only columns that exist in the table to avoid errors with to_sql
                final_columns_to_insert = list(set(combined_df.columns) & existing_columns)
                # Ensure primary key columns are always included if present in dataframe
                pk_cols = ['year', 'week_number', 'disease', 'municipality_code']
                for pkc in pk_cols:
                    if pkc in combined_df.columns and pkc not in final_columns_to_insert:
                        final_columns_to_insert.append(pkc)
                
                # Add newly added columns to the list
                for col in combined_df.columns:
                    if col not in existing_columns and col not in final_columns_to_insert:
                         # We just added this column, so include it
                         final_columns_to_insert.append(col)

                if not final_columns_to_insert:
                     logger.error("No columns identified for database insertion. Aborting.")
                     return
                
                logger.info(f"Columns selected for insertion: {final_columns_to_insert}")

                # Insert the new data using only the selected columns
                combined_df_to_insert = combined_df[final_columns_to_insert]

                combined_df_to_insert.to_sql(
                    'tlhis_diseases',
                    connection,
                    if_exists='append',
                    index=False,
                    method='multi',
                    chunksize=1000,
                    # dtype={'week_start_date': DateTime} # Explicitly set type if needed
                )
                logger.info(f"Attempted to save {len(combined_df_to_insert)} rows to database.")
            
            # Save the uploaded file as the new template (outside transaction)
            upload_file = request.files.get("file")
            if upload_file and hasattr(upload_file, 'filename'):
                # Reset stream position in case it was read before
                upload_file.seek(0) 
                template_dir = os.path.join(app.config.get('UPLOAD_FOLDER', './uploads'), 'templates') # Use config or default
                os.makedirs(template_dir, exist_ok=True)
                
                template_path = os.path.join(
                    template_dir, 
                    f"template_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
                )
                
                try:
                    upload_file.save(template_path)
                    logger.info(f"Saved uploaded file to: {template_path}")

                    # Now update the database record for the template
                    with db.engine.begin() as connection:
                        # Create template table if it doesn't exist
                        if not inspector.has_table('tlhis_template_files'):
                             self.template_table.create(db.engine)
                             logger.info("Created tlhis_template_files table.")

                        # Insert template record
                        connection.execute(
                            self.template_table.insert().values(
                                file_path=template_path
                            )
                        )
                        logger.info(f"Saved new template file record to database: {template_path}")

                except Exception as save_err:
                     logger.error(f"Error saving template file or updating database record: {save_err}", exc_info=True)
                     # Continue execution even if template saving fails? Or raise?
            
            logger.info(f"Database save process completed for year {year}, week {week}.")
            
        except Exception as e:
            logger.error(f"Error saving to database for year {year}, week {week}: {str(e)}", exc_info=True)
            raise

    @expose("/upload", methods=["POST"])
    # @has_access_api # Temporarily disabled for testing if needed
    @event_logger.log_this
    def upload(self) -> Response:
        """Upload case reports data. Handles different formats based on year."""
        upload_file = request.files.get("file")
        municipality_code = request.form.get("municipality_code")
        year_str = request.form.get("year", str(datetime.now().year))  # Default to current year as string
        week_str = request.form.get("week")  # Get week parameter as string
        
        # Validate year
        try:
            year = int(year_str)
        except (TypeError, ValueError):
            return self.response_400("Invalid year format. Year must be an integer.")
        
        # Validate week
        try:
            if week_str is None:
                 raise ValueError("Week number is required.")
            week = int(week_str)
            if not 1 <= week <= 53:
                raise ValueError("Week number must be between 1 and 53.")
        except ValueError as ve:
            return self.response_400(str(ve))
        
        if not upload_file:
            return self.response_400("No file uploaded")
        
        # Check if filename attribute exists before accessing it
        if not hasattr(upload_file, 'filename') or not upload_file.filename:
             return self.response_400("Uploaded file is invalid or has no filename.")

        if not municipality_code:
            return self.response_400("Municipality code is required")
            
        try:
            # Read all sheets from the Excel file
            # Use a copy of the file stream if reading multiple times or passing around
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
                # Ensure excel_file can be re-read or pass the stream/path correctly
                df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
                
                logger.info(f"Raw DataFrame shape for sheet '{sheet_name}': {df.shape}")
                # logger.info(f"First few rows of raw data:\n{df.head().to_string()}") # Potentially verbose
                
                # Process and clean the data, passing the year to handle format differences
                processed_df = self._process_excel_data(df, year)
                
                # Store the processed DataFrame
                dfs[sheet_name] = processed_df
                
                # Log the DataFrame info and first few rows
                logger.info(f"\n{'='*50}\nProcessed Sheet: {sheet_name}\n{'='*50}")
                if not processed_df.empty:
                    logger.info(f"\nColumns:\n{processed_df.columns.tolist()}")
                    # logger.info(f"\nData Types:\n{processed_df.dtypes}") # Can be verbose
                    logger.info(f"\nFirst 5 rows:\n{processed_df.head().to_string()}")
                    logger.info(f"\nShape: {processed_df.shape}")
                
                    # Log any missing values in processed data (optional)
                    # missing_values = processed_df.isnull().sum()
                    # if missing_values.any():
                    #     logger.info(f"\nMissing Values in Processed Data:\n{missing_values[missing_values > 0]}")
                else:
                    logger.info("Processed DataFrame is empty.")

            # Ensure the original file stream is reset if needed for saving template
            upload_file.seek(0)

            # Save the processed data to the database
            self._save_to_database(dfs, municipality_code, year, week)
            
            # Calculate total rows processed across valid sheets
            total_processed_rows = sum(df.shape[0] for df in dfs.values() if not df.empty)

            return self.response(200, message="File processed and potentially saved to database successfully", result={
                "sheets_processed": list(dfs.keys()),
                "total_rows_processed": total_processed_rows,
                # "rows_per_sheet": {sheet: df.shape[0] for sheet, df in dfs.items()}, # Can be verbose
                "municipality_code": municipality_code,
                "year": year,
                "week": week,
                "format_used": "new (>=2025)" if year >= 2025 else "old (<2025)"
            })
            
        except ValueError as ve: # Catch specific errors like format issues
             logger.error(f"ValueError during processing: {str(ve)}", exc_info=True)
             return self.response_400(f"Error processing file data: {str(ve)}")
        except ImportError as ie: # E.g., missing Excel engine
            logger.error(f"ImportError: {str(ie)}. Ensure 'openpyxl' is installed.", exc_info=True)
            return self.response_500(f"Server configuration error: Missing required library to read Excel files.")
        except Exception as e:
            logger.error(f"Error processing file: {str(e)}", exc_info=True)
            # Avoid exposing raw internal errors to the client
            return self.response_500(f"An unexpected error occurred while processing the file.")

    @expose("/template", methods=["GET"])
    @has_access_api
    @event_logger.log_this
    def template(self) -> Response:
        """Download the latest uploaded case reports template"""
        try:
            # Query for the latest template
            with db.engine.connect() as connection:
                 # Ensure table exists before querying
                 if not db.inspect(db.engine).has_table('tlhis_template_files'):
                      logger.info("Template table 'tlhis_template_files' does not exist. Creating it.")
                      self.template_table.create(db.engine)
                      template_path = None # No templates exist yet
                 else:
                      # Table exists, query for the latest path
                      result = connection.execute(
                          db.select(self.template_table.c.file_path)
                          .order_by(self.template_table.c.upload_date.desc())
                          .limit(1)
                      ).first()
                      template_path = result[0] if result else None
            
            if template_path and os.path.exists(template_path):
                logger.info(f"Found latest template at: {template_path}")
                return send_file(
                    template_path,
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    as_attachment=True,
                    download_name='case_reports_template.xlsx'
                )
            else:
                # If no template record found or file doesn't exist
                if template_path:
                     logger.warning(f"Template record found ({template_path}), but file does not exist on disk.")
                else:
                     logger.warning("No template record found in database.")
                
                # Provide a response indicating no template is available, or generate a default one
                # For now, return 404
                return self.response_404("No template file found. Please upload a file first to create a template.")

                # --- Alternative: Create and send a basic placeholder template ---
                # logger.warning("No template found, creating a basic placeholder template.")
                # df = pd.DataFrame({'Column1': [], 'Column2': []}) # Minimal structure
                # temp_dir = tempfile.mkdtemp()
                # temp_file_path = os.path.join(temp_dir, 'basic_template.xlsx')
                # df.to_excel(temp_file_path, index=False)
                # response = send_file(
                #     temp_file_path,
                #     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                #     as_attachment=True,
                #     download_name='basic_case_reports_template.xlsx'
                # )
                # # Clean up temp file after sending
                # @response.call_on_close
                # def cleanup():
                #      try:
                #           os.remove(temp_file_path)
                #           os.rmdir(temp_dir)
                #      except Exception as cleanup_err:
                #           logger.error(f"Error cleaning up temp template file: {cleanup_err}")
                # return response
                # --- End Alternative ---
            
        except Exception as e:
            logger.error(f"Error retrieving template: {str(e)}", exc_info=True)
            return self.response_500(f"Error retrieving template: {str(e)}")
