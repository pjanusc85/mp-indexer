"""
Test Snowflake and Supabase connections
"""

import os
import sys
from dotenv import load_dotenv
import snowflake.connector
from supabase import create_client

# Load environment from .env.snowflake
load_dotenv('.env.snowflake')

def test_snowflake_connection():
    """Test Snowflake connection"""
    print("Testing Snowflake connection...")
    
    try:
        conn = snowflake.connector.connect(
            user=os.getenv('SNOWFLAKE_USER'),
            password=os.getenv('SNOWFLAKE_PASSWORD'),
            account=os.getenv('SNOWFLAKE_ACCOUNT'),
            warehouse=os.getenv('SNOWFLAKE_WAREHOUSE', 'COMPUTE_WH'),
            role=os.getenv('SNOWFLAKE_ROLE', 'ACCOUNTADMIN')
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT CURRENT_VERSION()")
        version = cursor.fetchone()
        print(f"✅ Snowflake connected! Version: {version[0]}")
        
        # Check if database exists
        cursor.execute("SHOW DATABASES LIKE 'MP_ANALYTICS'")
        if cursor.fetchone():
            print("✅ MP_ANALYTICS database exists")
            
            # Use the database and check tables
            cursor.execute("USE DATABASE MP_ANALYTICS")
            cursor.execute("USE SCHEMA VAULT_EVENTS")
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            
            if tables:
                print(f"✅ Found {len(tables)} tables in MP_ANALYTICS.VAULT_EVENTS:")
                for table in tables:
                    print(f"   - {table[1]}")
            else:
                print("⚠️  No tables found. Please run analytics_setup.sql")
        else:
            print("⚠️  MP_ANALYTICS database not found. Please run analytics_setup.sql")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Snowflake connection failed: {e}")
        return False

def test_supabase_connection():
    """Test Supabase connection"""
    print("\nTesting Supabase connection...")
    
    try:
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_ANON_KEY')
        
        if not url or not key:
            print("❌ Missing Supabase credentials")
            return False
        
        supabase = create_client(url, key)
        
        # Test by fetching vault_events count
        response = supabase.table('vault_events').select('*', count='exact').limit(1).execute()
        
        if hasattr(response, 'count'):
            print(f"✅ Supabase connected! Found {response.count} vault events")
        else:
            # Fallback for older supabase versions
            response = supabase.table('vault_events').select('*').limit(10).execute()
            print(f"✅ Supabase connected! Sample events retrieved")
        
        # Check indexer state
        state_response = supabase.table('indexer_state').select('*').limit(1).execute()
        if state_response.data:
            print(f"✅ Indexer state found. Last block: {state_response.data[0].get('last_block', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        return False

def main():
    """Run all connection tests"""
    print("=" * 50)
    print("MP Indexer - Connection Test")
    print("=" * 50)
    
    snowflake_ok = test_snowflake_connection()
    supabase_ok = test_supabase_connection()
    
    print("\n" + "=" * 50)
    print("Test Results:")
    print("=" * 50)
    
    if snowflake_ok and supabase_ok:
        print("✅ All connections successful!")
        print("\nYou're ready to run the sync script:")
        print("python3 snowflake/sync_to_snowflake.py")
        return 0
    else:
        if not snowflake_ok:
            print("❌ Snowflake connection failed")
            print("   Check your SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, and SNOWFLAKE_ACCOUNT")
        if not supabase_ok:
            print("❌ Supabase connection failed")
            print("   Check your SUPABASE_URL and SUPABASE_ANON_KEY")
        return 1

if __name__ == "__main__":
    sys.exit(main())