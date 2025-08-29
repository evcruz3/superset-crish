# CRISH Detailed Permission Matrix

## Role Capabilities Overview

| Capability | Admin | Alpha | HealthOfficial | Gamma | Public |
|------------|-------|-------|----------------|-------|--------|
| **Dashboard Viewing** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Chart Creation** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **SQL Lab Access** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Database Management** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **User Management** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Health Data Edit** | ✅ | 🔶 | ✅ | ❌ | ❌ |
| **Dissemination** | ✅ | 🔶 | ✅ | ❌ | ❌ |
| **File Uploads** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Bulk Operations** | ✅ | ✅ | 🔶 | ❌ | ❌ |

**Legend:** ✅ Full Access | 🔶 Limited Access | ❌ No Access

## Detailed Permission Breakdown

### 🏥 Health Surveillance Modules

| Module | Admin | Alpha | HealthOfficial | Gamma |
|--------|-------|-------|----------------|-------|
| **Disease Forecast Alerts** | Full R/W | Read Only | Full R/W | Read Only |
| **Weather Forecasts** | Full R/W | Read Only | Full R/W | Read Only |
| **Health Facilities** | Full R/W | Read Only | Full R/W | Read Only |
| **Bulletins & Advisories** | Full R/W | Read Only | Full R/W | Read Only |
| **Email Groups** | Full R/W | Read Only | Full R/W | Read Only |
| **WhatsApp Groups** | Full R/W | Read Only | Full R/W | Read Only |
| **Air Quality Forecasts** | Full R/W | Read Only | Full R/W | Read Only |

### 🗃️ Data Management

| Function | Admin | Alpha | HealthOfficial | Gamma |
|----------|-------|-------|----------------|-------|
| **SQL Lab Queries** | ✅ | ❌ | ✅ | ❌ |
| **CSV Upload** | ✅ | ✅ | ❌ | ❌ |
| **Excel Upload** | ✅ | ✅ | ❌ | ❌ |
| **Database Connections** | ✅ | ✅ | ❌ | ❌ |
| **Dataset Creation** | ✅ | ✅ | 🔶 | ❌ |
| **Query Saved Queries** | ✅ | ❌ | ✅ | ❌ |

### 👥 User & System Management

| Function | Admin | Alpha | HealthOfficial | Gamma |
|----------|-------|-------|----------------|-------|
| **Create Users** | ✅ | ❌ | ❌ | ❌ |
| **Assign Roles** | ✅ | ❌ | ❌ | ❌ |
| **System Configuration** | ✅ | ❌ | ❌ | ❌ |
| **Access Logs** | ✅ | ❌ | ❌ | ❌ |
| **Security Settings** | ✅ | ❌ | ❌ | ❌ |

### 📊 Dashboard & Chart Management

| Function | Admin | Alpha | HealthOfficial | Gamma |
|----------|-------|-------|----------------|-------|
| **View Dashboards** | ✅ | ✅ | ✅ | ✅ |
| **Create Dashboards** | ✅ | ✅ | ✅ | ✅ |
| **Edit Own Dashboards** | ✅ | ✅ | ✅ | ✅ |
| **Edit Others' Dashboards** | ✅ | 🔶 | 🔶 | ❌ |
| **Delete Dashboards** | ✅ | 🔶 | 🔶 | ❌ |
| **Bulk Delete** | ✅ | ✅ | ❌ | ❌ |

### 📤 Import/Export Functions

| Function | Admin | Alpha | HealthOfficial | Gamma |
|----------|-------|-------|----------------|-------|
| **Export Charts** | ✅ | ✅ | ✅ | ✅ |
| **Export Dashboards** | ✅ | ✅ | ✅ | ✅ |
| **Import Dashboards** | ✅ | ✅ | ❌ | ❌ |
| **Download as PDF** | ✅ | ✅ | ✅ | ✅ |
| **Download as Image** | ✅ | ✅ | ✅ | ✅ |

### 🔔 Alert & Notification Systems

| Function | Admin | Alpha | HealthOfficial | Gamma |
|----------|-------|-------|----------------|-------|
| **View Alerts** | ✅ | ✅ | ✅ | ✅ |
| **Create Alert Rules** | ✅ | ❌ | ✅ | ❌ |
| **Send WhatsApp** | ✅ | ❌ | ✅ | ❌ |
| **Send Email Alerts** | ✅ | ❌ | ✅ | ❌ |
| **Facebook Posting** | ✅ | ❌ | ✅ | ❌ |

## Role-Specific Superpowers

### 🦸‍♂️ Admin Superpowers
- **Everything**: Complete system control
- **User Management**: Create/delete users and roles
- **System Config**: Modify global settings
- **Security**: Manage permissions and access
- **Database Admin**: Full database control

### 🔬 Alpha Superpowers
- **Data Engineering**: Upload files, create datasets
- **All Database Access**: Connect to any database
- **Bulk Operations**: Mass delete/update operations
- **Advanced Features**: Annotations, CSS templates
- **Import/Export**: Dashboard and dataset management

### 🏥 HealthOfficial Superpowers
- **SQL Lab**: Write custom health data queries
- **Health Data Authority**: Edit all health surveillance data
- **Alert Dissemination**: Send public health alerts
- **Health Module Management**: Full CRUD on health systems
- **Data Analysis**: Custom reporting on health data

### 👁️ Gamma Strengths
- **Safe Exploration**: Can't break anything
- **Dashboard Creation**: Build visualizations
- **Report Generation**: Create and share reports
- **Data Viewing**: Access to approved datasets

## Security Boundaries

### 🚫 What HealthOfficial CANNOT Do (vs Alpha)
- Upload CSV/Excel files to databases
- Manage database connections
- Access all databases/datasources
- Bulk delete operations
- Import dashboards from external sources
- Access administrative view menus
- Manage CSS templates or annotations

### ✅ What HealthOfficial CAN Do (vs Alpha)
- Write and execute SQL queries
- Edit disease forecasting data
- Manage health facility records
- Send WhatsApp/Facebook/Email alerts
- Update weather forecast thresholds
- Modify bulletin content
- Manage contact groups for dissemination

## Use Case Recommendations

### 👨‍⚕️ Health Officials → **HealthOfficial Role**
Perfect for:
- Epidemiologists analyzing disease trends
- Health officers updating facility data
- Public health communicators sending alerts
- Medical professionals querying health data

### 📈 Data Analysts → **Alpha Role**  
Perfect for:
- Business analysts importing external data
- Data engineers managing databases
- Visualization experts creating templates
- System integrators building pipelines

### 👁️‍🗨️ Stakeholders → **Gamma Role**
Perfect for:
- Government officials viewing reports
- Community leaders accessing dashboards
- Researchers exploring approved data
- General public accessing public dashboards

This role structure ensures **separation of concerns** while giving health domain experts the tools they need for effective public health surveillance and response.