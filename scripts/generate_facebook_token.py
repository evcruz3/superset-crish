#!/usr/bin/env python3
import requests
import sys
import argparse

def exchange_for_long_lived_user_token(short_token, app_id, app_secret):
    """Exchange short-lived token for long-lived user token (60 days)"""
    url = "https://graph.facebook.com/v18.0/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if "access_token" in data:
        print("✓ Successfully obtained long-lived user token")
        return data["access_token"]
    else:
        print(f"✗ Error getting long-lived user token: {data}")
        sys.exit(1)

def get_user_id(access_token):
    """Get the user ID associated with the token"""
    url = "https://graph.facebook.com/v18.0/me"
    params = {"access_token": access_token}
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if "id" in data:
        print(f"✓ User ID: {data['id']}")
        return data["id"]
    else:
        print(f"✗ Error getting user ID: {data}")
        sys.exit(1)

def get_page_access_token(user_token, page_id):
    """Get long-lived page access token (never expires)"""
    url = f"https://graph.facebook.com/v18.0/{page_id}"
    params = {
        "fields": "access_token",
        "access_token": user_token
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if "access_token" in data:
        print("✓ Successfully obtained long-lived page access token")
        return data["access_token"]
    else:
        print(f"✗ Error getting page access token: {data}")
        sys.exit(1)

def verify_token(token, app_id, app_secret):
    """Verify token details"""
    url = "https://graph.facebook.com/v18.0/debug_token"
    params = {
        "input_token": token,
        "access_token": f"{app_id}|{app_secret}"
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if "data" in data:
        token_data = data["data"]
        print("\nToken Details:")
        print(f"  - Valid: {token_data.get('is_valid', False)}")
        print(f"  - Type: {token_data.get('type', 'Unknown')}")
        print(f"  - App ID: {token_data.get('app_id', 'Unknown')}")
        print(f"  - Expires: {token_data.get('expires_at', 'Never') if token_data.get('expires_at', 0) != 0 else 'Never'}")
        print(f"  - Scopes: {', '.join(token_data.get('scopes', []))}")
        return True
    else:
        print(f"✗ Error verifying token: {data}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Generate a long-lived Facebook access token")
    parser.add_argument("token", help="Your short-lived Facebook access token")
    parser.add_argument("--app-id", default="1370637347489550", help="Facebook App ID (optional)")
    parser.add_argument("--app-secret", default="cc2efa39adad057cac3d04606993e391", help="Facebook App Secret (optional)")
    parser.add_argument("--page-id", default="656750690853001", help="Facebook Page ID (optional)")
    
    args = parser.parse_args()
    
    print("=== Facebook Long-Lived Token Generator ===\n")
    
    print("Step 1: Exchanging short-lived token for long-lived user token...")
    long_lived_user_token = exchange_for_long_lived_user_token(args.token, args.app_id, args.app_secret)
    
    print("\nStep 2: Getting user ID...")
    get_user_id(long_lived_user_token)
    
    print("\nStep 3: Getting long-lived page access token...")
    long_lived_page_token = get_page_access_token(long_lived_user_token, args.page_id)
    
    print("\nStep 4: Verifying the page access token...")
    verify_token(long_lived_page_token, args.app_id, args.app_secret)
    
    print("\n" + "="*50)
    print("LONG-LIVED PAGE ACCESS TOKEN:")
    print("="*50)
    print(long_lived_page_token)
    print("="*50)
    
    print("\nThis token can be used for:")
    print("  - Facebook Page API (posting to your page)")
    print("  - WhatsApp Business API (sending messages)")
    print("  - Instagram Business API")
    print("\nStore this token securely in your environment variables!")
    
    with open("long_lived_token.txt", "w") as f:
        f.write(long_lived_page_token)
    print("\n✓ Token saved to 'long_lived_token.txt'")

if __name__ == "__main__":
    main()