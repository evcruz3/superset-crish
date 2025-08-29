# CRISH Role Permission Analysis

## Alpha vs HealthOfficial Permission Logic Comparison

Based on the security manager code analysis, here are the key differences:

### Alpha Role Logic (`_is_alpha_pvm`)
```python
def _is_alpha_pvm(self, pvm: PermissionView) -> bool:
    return not (
        self._is_user_defined_permission(pvm)
        or self._is_admin_only(pvm)
        or self._is_sql_lab_only(pvm)
    ) or self._is_accessible_to_all(pvm)
```

**Alpha gets:**
- ✅ All permissions EXCEPT admin-only, user-defined, and sql-lab-only
- ✅ Plus all accessible-to-all permissions

### HealthOfficial Role Logic (`_is_health_official_pvm`)
```python
def _is_health_official_pvm(self, pvm):
    # First check if accessible to all
    if self._is_accessible_to_all(pvm):
        return True
    
    # Exclude admin-only and user-defined permissions
    if self._is_admin_only(pvm) or self._is_user_defined_permission(pvm):
        return False
    
    # Include SQL Lab permissions
    if self._is_sql_lab_pvm(pvm):
        return True
    
    # Include health-specific write permissions
    if (pvm.view_menu.name in HEALTH_OFFICIAL_VIEW_MENUS and 
        pvm.permission.name in HEALTH_OFFICIAL_PERMISSIONS):
        return True
    
    # Include all Gamma permissions
    if self._is_gamma_pvm(pvm):
        return True
        
    return False
```

**HealthOfficial gets:**
- ✅ All Gamma permissions (base read access)
- ✅ SQL Lab permissions (Alpha normally excludes these)
- ✅ Write/edit permissions on health modules
- ✅ All accessible-to-all permissions
- ❌ Admin-only permissions
- ❌ User-defined permissions

## Key Differences

### 🔴 Alpha HAS but HealthOfficial LACKS:

#### 1. **Alpha-Only Permissions**
From `ALPHA_ONLY_PERMISSIONS`:
- `muldelete` - Bulk delete operations
- `all_database_access` - Access to all databases
- `all_datasource_access` - Access to all data sources

#### 2. **Alpha-Only Permission-View Combinations**
From `ALPHA_ONLY_PMVS`:
- `can_csv_upload` on `Database`
- `can_excel_upload` on `Database`

#### 3. **Alpha-Only View Menus**
From `ALPHA_ONLY_VIEW_MENUS`:
- `Alerts & Report`
- `Annotation Layers`  
- `CSS Templates`
- `Import dashboards`
- `Manage` menu
- And many more administrative views

### 🟢 HealthOfficial HAS but Alpha LACKS:

#### 1. **SQL Lab Access**
- Alpha specifically excludes SQL Lab permissions
- HealthOfficial explicitly includes them for health data analysis

#### 2. **Health Module Write Permissions**
HealthOfficial gets write access (`can_write`, `can_add`, `can_edit`) on:
- `disease_forecast_alert`
- `weather_forecasts`
- `health_facilities`
- `bulletins_and_advisories`
- `email_groups`
- `whatsapp_groups`
- `air_quality_forecasts`

### 🟡 Both Share (via Gamma inheritance):

- Dashboard viewing
- Chart viewing
- Basic data exploration
- Report viewing
- Standard user functions

## Permission Scope Comparison

| Category | Alpha | HealthOfficial | Notes |
|----------|-------|----------------|--------|
| **Database Admin** | ✅ Full access | ❌ Blocked | Alpha can upload files, manage databases |
| **SQL Lab** | ❌ Blocked | ✅ Full access | HealthOfficial gets query capabilities |
| **Health Data Write** | 🔶 Read-only | ✅ Full write | HealthOfficial can edit health records |
| **User Management** | ❌ Blocked | ❌ Blocked | Both blocked from admin functions |
| **System Config** | 🔶 Limited | ❌ Blocked | Alpha has some config access |
| **Dissemination** | 🔶 Read-only | ✅ Full access | HealthOfficial can send alerts |
| **Bulk Operations** | ✅ muldelete | ❌ Limited | Alpha can bulk delete |

## Security Model Comparison

### Alpha: "Power User" Model
- Broad system access
- Database management capabilities  
- Advanced features like imports/exports
- Blocks SQL Lab (assumes they use UI tools)

### HealthOfficial: "Domain Expert" Model  
- Focused on health surveillance tasks
- SQL Lab for health data analysis
- Write access to health modules
- Blocked from system administration

## Recommendations

1. **For Health Surveillance**: Use HealthOfficial
   - Optimal for epidemiologists, health officers
   - Can query data and edit health records
   - Cannot break system configuration

2. **For System Power Users**: Use Alpha
   - Optimal for data analysts, system managers
   - Can manage databases and imports
   - Limited to read-only on health modules

3. **For Read-Only Access**: Use Gamma
   - Optimal for stakeholders, viewers
   - Safe, cannot modify any data