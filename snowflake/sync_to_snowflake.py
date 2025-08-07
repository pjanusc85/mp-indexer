"""
Sync vault events from Supabase to Snowflake
This script pulls data from Supabase and loads it into Snowflake for analytics
"""

import os
import snowflake.connector
from supabase import create_client
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pandas as pd
import json

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')

# Snowflake configuration
SNOWFLAKE_CONFIG = {
    'user': os.getenv('SNOWFLAKE_USER'),
    'password': os.getenv('SNOWFLAKE_PASSWORD'),
    'account': os.getenv('SNOWFLAKE_ACCOUNT'),
    'warehouse': os.getenv('SNOWFLAKE_WAREHOUSE', 'COMPUTE_WH'),
    'database': 'MP_ANALYTICS',
    'schema': 'VAULT_EVENTS',
    'role': os.getenv('SNOWFLAKE_ROLE', 'ACCOUNTADMIN')
}

def get_supabase_client():
    """Initialize Supabase client"""
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def get_snowflake_connection():
    """Create Snowflake connection"""
    return snowflake.connector.connect(**SNOWFLAKE_CONFIG)

def get_last_sync_timestamp(conn):
    """Get the last synchronized timestamp from Snowflake"""
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT MAX(timestamp) as last_sync 
            FROM vault_events
        """)
        result = cursor.fetchone()
        if result and result[0]:
            return result[0]
        else:
            # Default to 30 days ago if no data exists
            return datetime.now() - timedelta(days=30)
    finally:
        cursor.close()

def fetch_new_events(supabase, last_sync):
    """Fetch events from Supabase newer than last_sync"""
    try:
        # Fetch events newer than last sync
        response = supabase.table('vault_events')\
            .select('*')\
            .gt('timestamp', last_sync.isoformat())\
            .order('timestamp', desc=False)\
            .execute()
        
        return response.data
    except Exception as e:
        print(f"Error fetching from Supabase: {e}")
        return []

def prepare_data_for_snowflake(events):
    """Prepare event data for Snowflake insertion"""
    prepared_data = []
    
    for event in events:
        # Convert topics array to JSON string for Snowflake ARRAY type
        topics_json = json.dumps(event.get('topics', []))
        
        prepared_data.append({
            'CONTRACT_ADDRESS': event.get('contract_address'),
            'EVENT_TYPE': event.get('event_type'),
            'TRANSACTION_HASH': event.get('transaction_hash'),
            'BLOCK_NUMBER': event.get('block_number'),
            'TIMESTAMP': event.get('timestamp'),
            'TOPICS': topics_json,
            'DATA': event.get('data'),
            'VAULT_ID': event.get('vault_id'),
            'PROCESSED_AT': event.get('processed_at', datetime.now().isoformat())
        })
    
    return prepared_data

def load_to_snowflake(conn, data):
    """Load data into Snowflake"""
    if not data:
        print("No new data to load")
        return 0
    
    cursor = conn.cursor()
    try:
        # Create DataFrame
        df = pd.DataFrame(data)
        
        # Use Snowflake's write_pandas for efficient bulk loading
        from snowflake.connector.pandas_tools import write_pandas
        
        success, nchunks, nrows, _ = write_pandas(
            conn, 
            df, 
            'VAULT_EVENTS',
            auto_create_table=False,
            on_error='continue'  # Continue on duplicate key errors
        )
        
        if success:
            print(f"Successfully loaded {nrows} rows to Snowflake")
            return nrows
        else:
            print("Failed to load data to Snowflake")
            return 0
            
    except Exception as e:
        print(f"Error loading to Snowflake: {e}")
        # Fallback to individual inserts
        inserted = 0
        for record in data:
            try:
                cursor.execute("""
                    INSERT INTO vault_events (
                        contract_address, event_type, transaction_hash,
                        block_number, timestamp, topics, data, vault_id, processed_at
                    ) VALUES (
                        %(CONTRACT_ADDRESS)s, %(EVENT_TYPE)s, %(TRANSACTION_HASH)s,
                        %(BLOCK_NUMBER)s, %(TIMESTAMP)s, PARSE_JSON(%(TOPICS)s), 
                        %(DATA)s, %(VAULT_ID)s, %(PROCESSED_AT)s
                    )
                """, record)
                inserted += 1
            except Exception as insert_error:
                # Skip duplicates
                if 'Duplicate' not in str(insert_error):
                    print(f"Error inserting record: {insert_error}")
        
        conn.commit()
        print(f"Inserted {inserted} records via fallback method")
        return inserted
    finally:
        cursor.close()

def update_analytics_views(conn):
    """Refresh materialized views and run analytics procedures"""
    cursor = conn.cursor()
    try:
        # Update summary statistics
        cursor.execute("""
            CREATE OR REPLACE VIEW current_stats AS
            SELECT 
                COUNT(*) as total_events,
                COUNT(DISTINCT vault_id) as unique_vaults,
                COUNT(*) FILTER (WHERE event_type = 'VaultUpdated') as total_updates,
                COUNT(*) FILTER (WHERE event_type = 'VaultLiquidated') as total_liquidations,
                MAX(block_number) as latest_block,
                MAX(timestamp) as latest_event_time
            FROM vault_events
            WHERE timestamp >= DATEADD('day', -30, CURRENT_DATE())
        """)
        
        print("Analytics views updated")
    except Exception as e:
        print(f"Error updating views: {e}")
    finally:
        cursor.close()

def main():
    """Main sync process"""
    print(f"Starting sync at {datetime.now()}")
    
    # Initialize connections
    try:
        supabase = get_supabase_client()
        conn = get_snowflake_connection()
        
        # Get last sync timestamp
        last_sync = get_last_sync_timestamp(conn)
        print(f"Last sync: {last_sync}")
        
        # Fetch new events
        events = fetch_new_events(supabase, last_sync)
        print(f"Found {len(events)} new events")
        
        if events:
            # Prepare and load data
            prepared_data = prepare_data_for_snowflake(events)
            rows_loaded = load_to_snowflake(conn, prepared_data)
            
            # Update analytics views
            if rows_loaded > 0:
                update_analytics_views(conn)
        
        # Close connection
        conn.close()
        
        print(f"Sync completed at {datetime.now()}")
        
    except Exception as e:
        print(f"Sync failed: {e}")
        raise

if __name__ == "__main__":
    main()