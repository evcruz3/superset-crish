<!-- Fact-checked August 29 5:11 pm -->

# CRISH Platform Field Worker Training Manual

## Document Version: 2.0 (Revised)
## Target Audience: Field Workers, Data Collectors, Community Health Workers
## Languages: English | Português | Tetum

**Important Note**: This manual describes the web-based CRISH system. Field workers use paper forms for data collection, WhatsApp for communication, and web browsers to upload data when connectivity is available.

---

## Table of Contents
1. [Introduction](#introduction)
2. [Web Platform Access](#web-platform-access)
3. [Using CRISH System](#using-crish-system)
4. [Disease Case Data Upload](#disease-case-data-upload)
5. [Viewing Data in CRISH](#viewing-data-in-crish)
6. [Health Facility Information](#health-facility-information)
7. [Communication and Alerts](#communication-and-alerts)
8. [Troubleshooting](#troubleshooting)
9. [Quick Reference](#quick-reference)

---

## Introduction

Welcome to the CRISH Platform Field Worker Training Manual. As a field worker, you play a crucial role in collecting accurate health data that helps predict disease outbreaks and protect communities in Timor-Leste.

### Your Important Role
- Collect health data from communities
- Report disease cases promptly
- Update facility information
- Support health education efforts
- Bridge between communities and health system

### Training Objectives
After this training, you will be able to:
- Use the CRISH web platform effectively
- Collect disease case data using paper forms
- Upload data through web interface when connected
- Use WhatsApp for field communication
- View facility information and maps
- Handle limited connectivity situations

---

## Web Platform Access

### Accessing CRISH System

1. **Using Web Browser**
   - Open Chrome/Firefox on your computer
   - Navigate to: crish-demo.rimes.int
   - Bookmark for easy access
   - Save login for convenience

2. **Login Credentials**
   ```
   URL: crish-demo.rimes.int
   Username: [your_email]
   Password: [your password]
   ```

### Web Interface

**Main Menu Options:**
1. 🏠 **Home** - Overview dashboard and system status
2. 🏥 **Facilities** - View facility information and locations
3. 🦠 **Diseases** - Disease dashboards and case data upload
   - View disease trends (Dengue, Diarrhea, ARI)
   - Upload weekly case reports (Excel files)
4. 🌤️ **Weather** - Weather forecasts for field planning
5. 📋 **Bulletins** - Health advisories and alerts
6. 💬 **WhatsApp Groups** - Communication and group management

### Field Worker Account Permissions

**What you CAN do as a field worker:**
- ✅ View all health dashboards and charts
- ✅ Upload weekly case reports (Excel files)
- ✅ View facility information and maps
- ✅ Check weather forecasts and alerts
- ✅ Read health bulletins and advisories
- ✅ View WhatsApp group information
- ✅ Edit your own profile and change password

**What you CANNOT do:**
- ❌ Create new dashboards or charts
- ❌ Manage other users' accounts
- ❌ Delete or modify system data (except uploads)
- ❌ Access administrative settings

### Browser Tips
- Works best with stable internet connection for uploads
- Save work frequently
- Use Chrome or Firefox for best compatibility
- Enable location services for map features

**Note**: CRISH is a web-based system. Data collection in the field is done by downloading data from the TLHIS system, then uploaded through this web interface when connectivity is available.

---

## Using CRISH System

### Overview

As a field worker, you primarily use CRISH to:
- Upload weekly disease case reports
- View health dashboards and trends
- Check facility information
- Monitor weather forecasts
- Read health bulletins and advisories

### Important Note

**Data Collection vs Data Upload:**
- Field data collection (using paper forms) is done through TLHIS system
- CRISH is used to upload and view the collected data
- Your supervisor may handle uploads while you focus on field collection

---

## Health Facility Information

### Viewing Facilities in CRISH

Use CRISH to look up facility information for your work area:

#### 1. Access Facility Information
- **Navigate to**: 🏥 Facilities
- **Choose view**: List View or Map View

#### 2. List View Features
- Search facilities by name or location
- Filter by municipality or facility type
- View basic details in table format
- Click facility name for full details

#### 3. Map View Features  
- See all facilities on interactive map
- Different icons for facility types (Hospital, Health Center, etc.)
- Click markers to see facility information
- Use for route planning

#### 4. Facility Details Include
- **Contact**: Phone numbers, address
- **Services**: Available medical services
- **Operating Hours**: Days and times open
- **Resources**: Number of beds, staff
- **Location**: GPS coordinates, administrative area

### Using Facility Data

**For Field Workers:**
- Find contact information when referring patients
- Check which services are available at each facility
- Plan field visits based on facility locations
- Know operating hours before sending patients

---

## Disease Case Data Upload

### Overview

The main task for field workers in CRISH is uploading weekly disease surveillance data collected from health facilities.

### Accessing the Upload Feature

1. **Login to CRISH** at crish-demo.rimes.int
2. **Navigate to**: 🦠 Diseases → Update Case Reports
3. **Upload page** will show instructions and upload area

### Upload Process

#### Step 1: Prepare Your Excel File
- Use the TLHIS/22 Excel format (download template from CRISH)
- File must contain weekly surveillance data
- Include municipality code in filename (e.g., "Dili_Week45_2025.xlsx")

#### Step 2: Select Week and Year
- **Year**: Enter the year (e.g., 2025)
- **Week Number**: Enter ISO week number (1-53)
- These must match the data in your Excel file

#### Step 3: Upload File
1. Click "Choose File" or drag Excel file to upload area
2. System will validate:
   - File format (must be Excel)
   - Municipality code in filename
   - Data structure matches TLHIS format
3. If valid, file uploads automatically

#### Step 4: Verify Upload
- Success message appears with details
- Check "Diseases" dashboard to see your data
- Report any errors to supervisor

### Common Upload Issues

| Problem | Solution |
|---------|----------|
| "Municipality not found" | Check filename includes correct municipality code |
| "Invalid week number" | Use ISO week (1-53), not date |
| "File format error" | Use Excel (.xlsx), not CSV or other formats |
| "Data structure error" | Use official TLHIS template |

### Data Formats Supported

**TLHIS Format Evolution:**
- **Old Format** (before 2025): 4 age groups
- **New Format** (2025+): 7 age groups  
- System automatically detects format

**Required Data:**
- Week number and year
- Municipality
- Disease type (Dengue, Diarrhea, ARI, etc.)
- Case counts by age group and gender
- Total cases and deaths

---

## Viewing Data in CRISH

### Disease Dashboards

After data is uploaded, you can view disease trends and patterns:

1. **Navigate to**: 🦠 Diseases
2. **Select disease type**:
   - Dengue Dashboard
   - Diarrhea Dashboard  
   - ARI (Respiratory Infection) Dashboard

3. **Dashboard Features**:
   - Weekly case trends by municipality
   - Age and gender distribution
   - Comparison with previous years
   - Alert indicators when thresholds exceeded

### Weather Information

Monitor weather conditions that affect disease patterns:

1. **Navigate to**: 🌤️ Weather
2. **View forecasts**:
   - 10-day weather outlook
   - Heat index warnings
   - Rainfall predictions
   - Wind speed alerts

3. **Use for planning**:
   - Schedule field work during safe weather
   - Anticipate disease pattern changes
   - Prepare for weather emergencies

## Communication and Alerts

### System Alerts (Automatic)

CRISH automatically generates alerts based on data analysis:

#### 1. Disease Forecast Alerts
- **Purpose**: Warn of potential disease outbreaks
- **Based on**: Weather conditions and disease patterns
- **Where to see**: Home dashboard and Bulletins section
- **Action**: Follow supervisor's instructions for increased surveillance

#### 2. Weather Forecast Alerts  
- **Purpose**: Warn of dangerous weather conditions
- **Based on**: Weather forecasts (heat, rain, wind)
- **Where to see**: Weather section and Home dashboard
- **Action**: Adjust field work schedule for safety

#### 3. Health Bulletins and Advisories
- **Purpose**: Official health communications
- **Content**: Disease prevention, health education, emergency responses
- **Where to see**: Bulletins and Advisories section
- **Action**: Share information with communities during field visits

### WhatsApp Bulletin Distribution

CRISH has WhatsApp recipient groups for distributing health bulletins:

**How it works:**
- Health officials create "WhatsApp Groups" in CRISH (these are contact lists, not actual WhatsApp groups)
- Each "group" contains phone numbers of recipients (field workers, health officials, etc.)
- When bulletins are disseminated through CRISH, they are sent individually to each phone number
- Recipients receive bulletins as individual WhatsApp messages (not group messages)

**For Field Workers:**
- Your phone number may be in one or more WhatsApp recipient lists
- You will receive health bulletins and advisories as individual WhatsApp messages
- These messages come from the CRISH system, not from group chats
- Reply to your supervisor for urgent communications, not to CRISH messages

---

## Troubleshooting

### Common Problems and Solutions

#### 1. Login Issues

**Problem:** Cannot login
**Solutions:**
- Check username spelling
- Verify password (case-sensitive)
- Ensure internet connection
- Contact supervisor for reset

#### 2. Browser Issues

**Problem:** Web browser crashes or freezes
**Solutions:**
1. Close and restart browser
2. Clear browser cache and cookies
3. Try different browser (Chrome/Firefox)
4. Restart device
5. Report persistent issues to IT support

#### 3. GPS Problems

**Problem:** Location not accurate
**Solutions:**
- Go outside/open area
- Wait 30 seconds
- Check GPS settings
- Restart location services

#### 4. Upload Failures

**Problem:** Excel files won't upload
**Solutions:**
- Check internet connection strength
- Use available WiFi connections
- Verify file format (must be Excel)
- Check file isn't corrupted
- Contact supervisor for assistance

### Error Messages

| Error | Meaning | Action |
|-------|---------|--------|
| "No Network" | No internet | Work offline, sync later |
| "Invalid Data" | Missing required field | Review and complete form |
| "Upload Failed" | Upload problem | Retry with better connection |
| "File Too Large" | File exceeds limit | Check file size |

### Getting Help

**Support Levels:**
1. **First:** Check this manual
2. **Second:** Ask supervisor
3. **Third:** Call help desk
4. **Emergency:** Use hotline

**Help Desk Contacts:**
- Phone: +670 7xxx xxxx
- WhatsApp: +670 7xxx xxxx
- Email: erickson@rimes.int
- Hours: Mon-Fri 8:00-17:00

---

## Quick Reference

### CRISH Login Steps
```
1. Open browser (Chrome/Firefox)
2. Go to: crish-demo.rimes.int
3. Enter username and password
4. Click "Sign In"
```

### Main Functions for Field Workers
```
UPLOAD DATA
• Diseases → Update Case Reports
• Select year and week
• Upload Excel file
• Verify success message

VIEW DASHBOARDS
• Diseases → Select disease type
• Check weekly trends
• Monitor alert levels

CHECK FACILITIES
• Facilities → List or Map view
• Search by name/location
• View contact info and services

READ BULLETINS
• Bulletins & Advisories
• Check for new health alerts
• Download PDFs if needed
```

### Common Municipality Codes
```
TL-AL: Aileu         TL-LA: Lautem
TL-AN: Ainaro        TL-LI: Liquica
TL-AT: Atauro        TL-MT: Manatuto
TL-BA: Baucau        TL-MF: Manufahi
TL-BO: Bobonaro      TL-OE: Oecusse
TL-CO: Covalima      TL-VI: Viqueque
TL-DI: Dili          TL-ER: Ermera
```

### Upload Checklist
```
BEFORE UPLOADING:
□ Correct Excel format (TLHIS/22)
□ Municipality code in filename
□ Week number (1-53)
□ Year matches data
□ All data complete

AFTER UPLOADING:
□ Success message received
□ Check dashboard for data
□ Report any errors
```

---

## Practical Exercises

### Exercise 1: Login Practice
1. Open Chrome or Firefox browser
2. Navigate to crish-demo.rimes.int
3. Enter your username and password
4. Successfully login to system

### Exercise 2: Navigate CRISH
1. Visit each main section (Home, Facilities, Diseases, Weather, Bulletins)
2. Find the disease upload feature
3. View a disease dashboard
4. Check facility information

### Exercise 3: Practice Upload
1. Download sample TLHIS template from CRISH
2. Review required data fields
3. Practice upload process (without submitting)
4. Understand validation requirements

### Exercise 4: View Data
1. Navigate to disease dashboards
2. Check different time periods
3. View facility on map
4. Read latest bulletin

---

## Key Points to Remember

### For Successful Data Upload
- ✅ Use correct Excel format (TLHIS/22)
- ✅ Include municipality code in filename
- ✅ Match week number and year with data
- ✅ Check success message after upload
- ✅ Verify data appears in dashboard

### Common Mistakes to Avoid
- ❌ Wrong file format (CSV instead of Excel)
- ❌ Missing municipality code
- ❌ Incorrect week number
- ❌ Mismatched year
- ❌ Incomplete data fields

---

## Support Contacts

**Technical Support:**
- Email: erickson@rimes.int
- Phone: [To be updated]
- Hours: Monday-Friday, 8:00-17:00

**For urgent issues:**
- Contact your supervisor immediately
- Document the error message
- Take screenshot if possible

---

*Collect accurately, communicate clearly, protect communities!*

*Version 2.0 - August 2025*