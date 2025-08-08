"""
Test Supabase connection with the actual credentials
"""

import requests

SUPABASE_URL = "https://qvjekspjaqjtenzoqlpr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2amVrc3BqYXFqdGVuem9xbHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNzcxNTEsImV4cCI6MjA2OTg1MzE1MX0.PjJfixr9JRh9Sj6Ib4U9lufZ-LY17o7ghOSuXbf4GZo"

def test_connection():
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Test 1: Basic connection
    print("Test 1: Basic connection to vault_events table")
    url = f'{SUPABASE_URL}/rest/v1/vault_events?select=*&limit=5'
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:200]}...")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Found {len(data)} records")
        if data:
            print("Sample record:", data[0])
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return
    
    # Test 2: Check table structure
    print("\nTest 2: Check table structure")
    # This might not work, but let's try
    url = f'{SUPABASE_URL}/rest/v1/vault_events?select=*&limit=1'
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and response.json():
        record = response.json()[0]
        print("Table columns:", list(record.keys()))
    
    # Test 3: Count total records
    print("\nTest 3: Count total records")
    url = f'{SUPABASE_URL}/rest/v1/vault_events?select=count'
    response = requests.get(url, headers=headers)
    print(f"Count response: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_connection()