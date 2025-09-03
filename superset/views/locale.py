"""
Locale switching fix to prevent redirecting to wrong pages.

This module provides utilities to fix the language switching redirect issue
where Flask-AppBuilder's LocaleView would redirect users to problematic pages
(like /disseminatedbulletinlogs/list/) instead of staying on the current page.

The fix works by intercepting language switch requests and manipulating
Flask-AppBuilder's page_history session data to prevent unwanted redirects.
"""

from flask import request, session

def fix_locale_redirect():
    """
    Fix the locale redirect by clearing problematic entries from page history.
    This should be called before Flask-AppBuilder's LocaleView processes the redirect.
    """
    import logging
    logger = logging.getLogger(__name__)
    # Debug logging can be enabled by uncommenting the line below
    # logger.info(f"LOCALE_FIX: Processing language switch from {request.referrer}")
    
    # Check if the referrer is a problematic page and add it to clean redirect
    current_referrer = request.referrer
    if current_referrer:
        from urllib.parse import urlparse
        parsed = urlparse(current_referrer)
        referrer_path = parsed.path + (parsed.query and '?' + parsed.query or '')
        
        session['locale_switch_return_to'] = referrer_path
    
    # Always proceed with the fix, even if there's no existing page_history
    if 'page_history' not in session:
        session['page_history'] = []
    
    try:
        # Import Stack from Flask-AppBuilder
        from flask_appbuilder.urltools import Stack
        
        page_history = Stack(session.get("page_history", []))
        
        # Filter out problematic paths from existing history
        cleaned_data = []
        for path in page_history.data:
            cleaned_data.append(path)
        
        # Instead of trying to clean history, let's force Flask-AppBuilder to redirect 
        # to a safe location by manipulating what it sees in the page history
        
        # Check if we have a stored safe return path
        safe_return_path = session.get('locale_switch_return_to')
        if safe_return_path:
            # Clear the page history and add only the safe path
            cleaned_stack = Stack([safe_return_path])
            session["page_history"] = cleaned_stack.to_json()
        else:
            # No safe return path, so clear problematic history
            # Add current page if it's not a language switch or problematic
            current_path = request.referrer
            if (current_path and 
                not current_path.endswith('/lang/en') and 
                not current_path.endswith('/lang/pt_TL') and 
                not current_path.endswith('/lang/id') and
                '/lang/' not in current_path):
                
                # Parse the current path to get just the path part
                from urllib.parse import urlparse
                parsed = urlparse(current_path)
                path_to_add = parsed.path + (parsed.query and '?' + parsed.query or '')
                
                if path_to_add not in cleaned_data:
                    cleaned_data.append(path_to_add)
            
            # Update the session with cleaned history
            cleaned_stack = Stack(cleaned_data)
            session["page_history"] = cleaned_stack.to_json()
        
    except Exception as e:
        # If anything goes wrong, just clear the history entirely  
        session.pop("page_history", None)