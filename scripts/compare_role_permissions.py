#!/usr/bin/env python3
"""
Permission Comparison Script for CRISH Roles
Compare permissions between Alpha and HealthOfficial roles
"""

import sys
import os
from collections import defaultdict

# Add the superset path
sys.path.insert(0, '/app')

try:
    from superset import create_app
    from superset.extensions import appbuilder
    from flask_appbuilder.security.sqla.models import PermissionView, Role
    
    def analyze_role_permissions():
        """Analyze and compare permissions between Alpha and HealthOfficial roles"""
        
        app = create_app()
        with app.app_context():
            # Get the security manager
            sm = appbuilder.sm
            
            # Get all permission-view-menu combinations
            all_pvms = sm._get_all_pvms()
            
            print("🔍 CRISH Role Permission Comparison")
            print("=" * 60)
            
            # Analyze each role
            roles_to_compare = ['Alpha', 'HealthOfficial', 'Gamma']
            role_permissions = {}
            
            for role_name in roles_to_compare:
                print(f"\n📋 Analyzing {role_name} role permissions...")
                
                permissions = set()
                method_name = f"_is_{role_name.lower()}_pvm"
                
                if hasattr(sm, method_name):
                    pvm_method = getattr(sm, method_name)
                    
                    for pvm in all_pvms:
                        if pvm_method(pvm):
                            permissions.add((pvm.permission.name, pvm.view_menu.name))
                    
                    role_permissions[role_name] = permissions
                    print(f"   ✓ {len(permissions)} permissions found")
                else:
                    print(f"   ❌ Method {method_name} not found")
                    role_permissions[role_name] = set()
            
            # Compare permissions
            print(f"\n🔄 Permission Comparison Results")
            print("=" * 60)
            
            alpha_perms = role_permissions.get('Alpha', set())
            health_official_perms = role_permissions.get('HealthOfficial', set())
            gamma_perms = role_permissions.get('Gamma', set())
            
            # Permissions only in Alpha
            alpha_only = alpha_perms - health_official_perms
            print(f"\n🚫 Permissions ONLY in Alpha ({len(alpha_only)}):")
            for perm, view in sorted(alpha_only):
                print(f"   - {perm} on {view}")
            
            # Permissions only in HealthOfficial  
            health_only = health_official_perms - alpha_perms
            print(f"\n✅ Permissions ONLY in HealthOfficial ({len(health_only)}):")
            for perm, view in sorted(health_only):
                print(f"   - {perm} on {view}")
            
            # Common permissions
            common_perms = alpha_perms & health_official_perms
            print(f"\n🤝 Common permissions ({len(common_perms)}):")
            print("   (First 10 shown)")
            for perm, view in sorted(common_perms)[:10]:
                print(f"   - {perm} on {view}")
            if len(common_perms) > 10:
                print(f"   ... and {len(common_perms) - 10} more")
            
            # HealthOfficial vs Gamma comparison
            health_vs_gamma = health_official_perms - gamma_perms
            print(f"\n⬆️  HealthOfficial permissions BEYOND Gamma ({len(health_vs_gamma)}):")
            for perm, view in sorted(health_vs_gamma):
                print(f"   - {perm} on {view}")
            
            # Summary stats
            print(f"\n📊 Summary Statistics:")
            print(f"   Alpha permissions:         {len(alpha_perms)}")
            print(f"   HealthOfficial permissions: {len(health_official_perms)}")
            print(f"   Gamma permissions:         {len(gamma_perms)}")
            print(f"   Alpha-only permissions:    {len(alpha_only)}")
            print(f"   HealthOfficial-only permissions: {len(health_only)}")
            print(f"   Common permissions:        {len(common_perms)}")
            
            # Health-specific modules analysis
            print(f"\n🏥 Health Module Permissions Analysis:")
            health_modules = [
                'disease_forecast_alert', 'weather_forecasts', 'health_facilities',
                'bulletins_and_advisories', 'email_groups', 'whatsapp_groups'
            ]
            
            for module in health_modules:
                alpha_module = [(p, v) for p, v in alpha_perms if v == module]
                health_module = [(p, v) for p, v in health_official_perms if v == module]
                
                if alpha_module or health_module:
                    print(f"\n   📋 {module}:")
                    print(f"      Alpha:         {[p for p, v in alpha_module]}")
                    print(f"      HealthOfficial: {[p for p, v in health_module]}")

    if __name__ == "__main__":
        analyze_role_permissions()
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("This script must be run from within the Superset Docker container")
    print("Usage: docker-compose exec superset python /app/scripts/compare_role_permissions.py")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()