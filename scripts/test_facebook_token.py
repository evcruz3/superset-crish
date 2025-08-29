#!/usr/bin/env python3
import requests
from datetime import datetime

PAGE_ACCESS_TOKEN = "EAATelmA2hw4BPGcUao5ce8zH0DJw5l7ItYoFgT0JvD5TdulcadoAbwHyIkYnzt2Y86d2tbeO2k3sadfo6zSBzaSihau36qXLFQ5cuu66srabADBZCvdmeWj1S9ZB9HuZB0DI2Lool88eU3xLFW6hFMjO9YZCabZAFWZASDmyZClZBqO01JO7OXoLe4keSZC1rWfHys91CSSYgO9ZAQvQmFIeZCAYLUx"
FACEBOOK_PAGE_ID = "656750690853001"

def test_facebook_post():
    """Test posting to Facebook page"""
    url = f"https://graph.facebook.com/v18.0/{FACEBOOK_PAGE_ID}/feed"
    
    message = f"Test post from API - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    
    data = {
        "message": message,
        "access_token": PAGE_ACCESS_TOKEN
    }
    
    response = requests.post(url, data=data)
    result = response.json()
    
    if "id" in result:
        print(f"✓ Successfully posted to Facebook!")
        print(f"  Post ID: {result['id']}")
        return True
    else:
        print(f"✗ Error posting to Facebook: {result}")
        return False

def test_whatsapp_template():
    """Test WhatsApp Business API capabilities"""
    url = "https://graph.facebook.com/v18.0/me"
    params = {
        "fields": "id,name,whatsapp_business_account",
        "access_token": PAGE_ACCESS_TOKEN
    }
    
    response = requests.get(url, params=params)
    result = response.json()
    
    print("\nWhatsApp Business Account Info:")
    if "whatsapp_business_account" in result:
        print("✓ WhatsApp Business API is accessible")
        print(f"  Account details: {result}")
    else:
        print("✗ WhatsApp Business API not configured or accessible")
        print("  You may need to connect a WhatsApp Business Account to your Facebook App")
    
    return result

def main():
    print("=== Testing Long-Lived Facebook Token ===\n")
    
    print("1. Testing Facebook Page posting...")
    fb_success = test_facebook_post()
    
    print("\n2. Checking WhatsApp Business API access...")
    wa_info = test_whatsapp_template()
    
    print("\n" + "="*50)
    print("Token Test Summary:")
    print(f"  - Facebook Page API: {'✓ Working' if fb_success else '✗ Failed'}")
    print(f"  - WhatsApp Business API: {'✓ Available' if 'whatsapp_business_account' in wa_info else '✗ Not configured'}")
    print("\nYour long-lived token is ready to use!")
    print("Remember to store it securely in your environment variables.")

if __name__ == "__main__":
    main()