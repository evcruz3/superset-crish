from dotenv import load_dotenv
load_dotenv()
import subprocess


subprocess.run([
    'dataex_region_data_analysis.py',
    '-mt', 'ecmwf_hres',
    '-r', 'tmax_daily_tmax_region',
    '-ai', '9b4f37e1-00f4-4296-8c3a-914ee19989a6',
    '-uf', 'ADM1',
    '-of', 'json',
    '-o', 'tmax_daily_tmax_region_data.json'
]) 