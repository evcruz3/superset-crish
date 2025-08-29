<!-- Updated August 29, 2025 5:13 pm - Added FieldWorker role -->

# CRISH Platform Quick Reference Guide

## Document Version: 1.1
## For: All CRISH Platform Users

---

## Quick Start

### Login Credentials
```
URL: https://crish-demo.rimes.int
Username: [your_email]
Password: [your_password]
Support: +63 908 607 1011
```

---

## 👥 User Roles & Access

| Role | Dashboard | Reports | Bulletins | Upload Data | Admin |
|------|-----------|---------|-----------|-------------|--------|
| Administrator | ✓ | ✓ | ✓ | ✓ | ✓ |
| Health Official | ✓ | ✓ | ✓ | ✓ | ✗ |
| FieldWorker | ✓ | View | View | ✓ | ✗ |
| Alpha | ✓ | ✓ | Limited | ✓ | ✗ |
| Gamma | ✓ | View | View | ✗ | ✗ |
| Public | Limited | ✗ | View | ✗ | ✗ |

---

## Dashboard Navigation

### Main Dashboards
1. **Disease Overview** - Current disease situation
2. **Weather Overview** - Current weather conditions
3. **Disease Forecast** - 7-day predictions
4. **Weather Forecast** - 7-day weather outlook
5. **Health Facilities** - Facility locations and info
6. **Bulletins** - Health advisories

### Quick Actions
- Click refresh button to update dashboard data
- Use download buttons to export chart data
- Use search boxes to filter data
- Use browser print function for reports

---

## Alert Levels

### Disease Alert Levels
| Level | Color | Description | Action Required |
|-------|-------|-------------|----------------|
| Severe | 🔴 Red | Severe outbreak expected | Immediate preventive action |
| High | 🟠 Orange | High risk of outbreak | Community-level interventions |
| Moderate | 🟡 Yellow | Moderate risk present | Monitor and take precautions |
| Low | 🟢 Green | Low risk present | Basic preventive measures |
| None | 🔵 Light Blue | No significant risk | Routine monitoring |

### Weather Alert Levels  
| Level | Color | Description | Action Required |
|-------|-------|-------------|----------------|
| Extreme Danger | 🔴 Red | Extreme conditions | Avoid all outdoor activities |
| Danger | 🟠 Orange | Dangerous conditions | Take immediate precautions |
| Extreme Caution | 🟡 Yellow | Potentially hazardous | Exercise extreme caution |
| Normal | 🟢 Green | Safe conditions | Normal activities safe |

---

## Disease Thresholds

### Disease Alert Thresholds
| Disease | Moderate | High | Severe |
|---------|----------|------|--------|
| Dengue | ≥1 case | ≥2 cases | ≥6 cases |
| Diarrhea | ≥25 cases | ≥50 cases | ≥100 cases |
| ISPA | ≥25 cases | ≥50 cases | ≥100 cases |

---

## Weather Alert Thresholds

| Parameter | Extreme Caution | Danger | Extreme Danger |
|-----------|-----------------|--------|----------------|
| Heat Index | ≥27°C | ≥30°C | ≥33°C |
| Rainfall | ≥15mm/day | ≥25mm/day | ≥60mm/day |
| Wind Speed | ≥15km/h | ≥20km/h | ≥25km/h |

---

## Web Browser Access

### Supported Browsers
```
URL: https://crish-demo.rimes.int
Compatible with:
- Chrome (recommended)
- Firefox
- Safari
- Edge
```

### WhatsApp Integration
- WhatsApp Groups for communication
- Structured messaging for reports
- Photo sharing for documentation
- Location sharing for field data

---

## Reporting Templates

### Disease Report (Minimum Fields)
```
Date: [Required]
Location: [Municipality/Suku/Aldeia]
Disease: [Type]
Cases: [Number]
Age Group: [0-5, 6-17, 18-59, 60+]
Gender: [M/F]
Severity: [Mild/Moderate/Severe]
```

---

## Bulletin Creation

### Bulletin Types
- **Auto-generated**: Created automatically from disease forecasts and weather alerts
- **Manual creation**: Created through the bulletin interface when needed

### Bulletin Content
```
Title: Brief, descriptive headline
Advisory: Main message content
Risks: Potential dangers or impacts
Safety Tips: Recommended actions to take
Hashtags: Optional tags for categorization
Attachments: Images or charts (optional)
```

### Distribution Channels
- 📧 **Email Groups**: Distributed to configured email lists
- 📱 **WhatsApp Groups**: Sent to registered WhatsApp groups
- 📄 **PDF Export**: Generate PDF versions for printing/sharing

---

## Common Tasks

### Disseminate Bulletins
1. **Navigate to Bulletins & Advisories**
2. **Select bulletin** → Click disseminate icon 📧
3. **Choose channels:**
   - 📧 Email Groups: Select groups, customize subject/message
   - 📱 WhatsApp Groups: Select contact lists, individual messages sent to each number
   - 📘 Facebook: Auto-post with images
4. **Review content** and click "Send"
5. **Check dissemination logs** for delivery status

### Manage Contact Lists
1. **Email Groups**: Create lists of email addresses for bulk emailing
2. **WhatsApp Groups**: Create lists of phone numbers (+country code format)
   - Each "group" stores individual phone numbers as comma-separated list
   - During dissemination, individual messages sent to each number
   - Uses WhatsApp Business API with approved message templates

### View Disease Forecasts
1. **Navigate to Disease Forecasts**
2. **Select tab:**
   - **Forecasts**: Multi-disease predictions
   - **Alerts**: Current disease alerts
   - **Trendlines**: Interactive trend analysis
   - **Table**: Detailed forecast data
3. **Use trendline filters:**
   - Level: National or Municipality
   - Municipality: Select specific areas
   - Date Range: Custom time periods
   - Show Thresholds: Toggle alert lines

### View Weather Forecasts  
1. **Navigate to Weather Forecasts**
2. **Select tab:**
   - **Forecasts**: 10-day weather outlook
   - **Alerts**: Current weather alerts
   - **Trendlines**: Interactive parameter analysis
   - **Table**: Detailed weather data
3. **Analyze parameters:**
   - Heat Index, Temperature, Humidity
   - Rainfall, Wind Speed
   - Color-coded threshold violations

### Download Bulletins
1. **Access bulletin** (list or detail view)
2. **Click PDF download** 📄
3. **PDF opens** with formatted content and images

### Upload Disease Case Reports (FieldWorker/Health Official)
1. **Navigate to Diseases** → **Update Case Reports**
2. **Set reporting period:**
   - Year: Select reporting year
   - Week: Select week number (1-53)
3. **Download template** (optional): Get TLHIS/22 Weekly surveillance Excel format
4. **Prepare files:**
   - Use Excel format (.xlsx or .xls)
   - Include municipality name or code in filename (e.g., "Dili_cases.xlsx" or "TL-DI_cases.xlsx")
   - One file per municipality
5. **Upload files:**
   - Drag and drop or click to select multiple files
   - System auto-detects municipality from filename
   - Review selected files and missing municipalities
6. **Start bulk upload** and monitor status for each file

**Note for FieldWorkers**: This is your primary data entry function. You have full upload access but read-only dashboard access.

---

## Troubleshooting

| Problem | Quick Fix |
|---------|-----------|
| Can't login | Check CAPS LOCK, verify username |
| Dashboard slow | Clear cache, use Chrome/Firefox |
| Missing data | Check date range, refresh page |
| Export fails | Try smaller date range |
| Sync error | Check internet, retry |
| Can't create bulletin | FieldWorkers have read-only access - contact Health Official |
| Upload fails | Check file format (.xlsx/.xls), municipality in filename |
| Dashboard edit blocked | FieldWorkers have read-only dashboard access |

---

## Emergency Contacts

### System Support
- **WhatsApp**: +63 908 607 1011
- **Email**: erickson@rimes.int
- **Hours**: Mon-Fri 8:00-17:00

### Health Emergency
- **Ambulance**: [To be filled out by MOH]
- **Health Hotline**: [To be filled out by MOH]
- **MOH Surveillance**: [To be filled out by MOH]

---

## Browser Functions

| Action | How To |
|--------|---------|
| Refresh | Use browser refresh button or F5 |
| Export | Click download buttons on charts |
| Print | Use browser print (Ctrl+P/Cmd+P) |
| Search | Use search boxes within pages |
| Save | Data saves automatically |

---

## Key Performance Indicators

### System Performance
- Dashboard Load: <3 seconds ✓
- API Response: <1 second ✓
- Sync Time: <30 seconds ✓
- Uptime Target: 99.5% ✓

### Data Quality
- Completeness: >95% required
- Timeliness: <24 hours
- Accuracy: Regular validation

---

## Multi-Language Support

### Available Languages
- **English** (EN)
- **Português** (PT)
- **Tetum** (TET)

### Switching Languages
1. Click profile icon
2. Select "Settings"
3. Choose "Language"
4. Select preferred language
5. Page refreshes automatically

---

## Weekly Workflow

### Monday Morning (Before 9:00 AM)
**FieldWorkers & Health Officials:**
- [ ] **Upload weekly disease case reports** for previous week
- [ ] Verify all 14 municipalities have submitted data
- [ ] Check for data completeness and accuracy

**Health Officials Only:**
- [ ] Review any disease forecast alerts generated

### Monday (After Disease Pipeline - ~10:00 AM)
**Health Officials Only:**
- [ ] Review new **disease forecasts and alerts** generated by pipeline
- [ ] Check **weather forecasts and alerts** for the week
- [ ] Create or review **bulletins** for dissemination
- [ ] Plan field activities based on alerts

**FieldWorkers:**
- [ ] Review dashboards for situational awareness
- [ ] Plan data collection activities based on alerts

### Tuesday-Thursday
**Health Officials Only:**
- [ ] **Monitor dashboard updates** and alerts
- [ ] **Disseminate bulletins** to relevant groups
- [ ] Review **dissemination logs** for delivery status
- [ ] Update **contact lists** (Email/WhatsApp groups) as needed

**FieldWorkers:**
- [ ] Continue data collection activities
- [ ] Report any urgent cases immediately
- [ ] View bulletins and weather alerts for field planning

### Friday
**Health Officials Only:**
- [ ] **Weekly review** of forecast accuracy
- [ ] Update **health facility information** if needed
- [ ] Plan weekend coverage for urgent alerts

**FieldWorkers & Health Officials:**
- [ ] Prepare for next week's data collection
- [ ] Review data quality and completeness

---

## FieldWorker Role Guide

### What FieldWorkers Can Do
- ✓ **Upload case reports** - Primary data entry responsibility
- ✓ **View dashboards** - Read-only access for situational awareness  
- ✓ **View bulletins** - Stay informed about health advisories
- ✓ **View weather alerts** - Plan field activities safely
- ✓ **Edit own profile** - Manage personal account information
- ✓ **Access health facilities** - View facility locations and contact info

### What FieldWorkers Cannot Do
- ✗ **Create bulletins** - Only Health Officials can create/edit
- ✗ **Disseminate messages** - No access to email/WhatsApp dissemination
- ✗ **Edit dashboards** - Read-only access to all charts and reports
- ✗ **Manage users** - No administrative functions
- ✗ **Full SQL Lab** - Limited database query access

### FieldWorker Daily Tasks
1. **Morning**: Check weather alerts before field activities
2. **Data Collection**: Upload case reports as they become available
3. **Safety**: Monitor bulletins for health risks in your area
4. **Reporting**: Contact Health Officials for urgent cases requiring immediate action

### FieldWorker Tools
- **Update Case Reports** page - Your primary work interface
- **Weather Forecasts** - Plan safe field activities
- **Health Facilities** - Find nearby facilities and contact information
- **Bulletins** - Stay informed about current health situations

---

## Best Practices

### Data Entry
- ✓ Double-check numbers
- ✓ Use correct date format
- ✓ Select from dropdowns
- ✓ Complete all required fields
- ✗ Don't guess data
- ✗ Don't duplicate entries

### Communication
- ✓ Use templates
- ✓ Be clear and concise
- ✓ Include contact info
- ✓ Follow up important messages
- ✗ Don't share passwords
- ✗ Don't send sensitive data

---


## Security Reminders

### Password Policy
- Minimum 8 characters
- Mix of letters, numbers, symbols
- Change every 90 days
- Don't share with anyone
- Use different passwords

### Data Protection
- Log out when done
- Don't save passwords in browser
- Report suspicious activity
- Keep app updated
- Use secure networks

---

## Additional Resources

### Updates & News
- Check bulletin board
- Read system messages
- Join training sessions
- Follow CRISH Facebook

---

*Keep this guide handy for quick reference!*

*Version 1.1 - August 2025*