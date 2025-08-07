-- Snowflake Analytics Setup for Money Protocol Indexer
-- This script sets up tables and views for vault event analytics

-- Create database and schema
CREATE DATABASE IF NOT EXISTS MP_ANALYTICS;
USE DATABASE MP_ANALYTICS;
CREATE SCHEMA IF NOT EXISTS VAULT_EVENTS;
USE SCHEMA VAULT_EVENTS;

-- Create main events table
CREATE OR REPLACE TABLE vault_events (
    id NUMBER AUTOINCREMENT PRIMARY KEY,
    contract_address VARCHAR(42) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number NUMBER NOT NULL,
    timestamp TIMESTAMP_TZ NOT NULL,
    topics ARRAY,
    data VARCHAR,
    vault_id VARCHAR(66),
    processed_at TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
    
    -- Add constraints
    CONSTRAINT unique_event UNIQUE(transaction_hash, event_type, vault_id)
);

-- Create indexer state table
CREATE OR REPLACE TABLE indexer_state (
    contract_address VARCHAR(42) PRIMARY KEY,
    last_block NUMBER NOT NULL,
    last_updated TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP()
);

-- Create analytics views
CREATE OR REPLACE VIEW daily_vault_metrics AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) FILTER (WHERE event_type = 'VaultUpdated') as vaults_updated,
    COUNT(*) FILTER (WHERE event_type = 'VaultLiquidated') as vaults_liquidated,
    COUNT(DISTINCT vault_id) as unique_vaults_affected,
    MAX(block_number) as latest_block
FROM vault_events 
GROUP BY DATE(timestamp)
ORDER BY date;

CREATE OR REPLACE VIEW hourly_vault_activity AS
SELECT 
    DATE_TRUNC('HOUR', timestamp) as hour,
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT vault_id) as unique_vaults
FROM vault_events
WHERE timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY DATE_TRUNC('HOUR', timestamp), event_type
ORDER BY hour DESC;

CREATE OR REPLACE VIEW top_active_vaults AS
SELECT 
    vault_id,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE event_type = 'VaultUpdated') as updates,
    COUNT(*) FILTER (WHERE event_type = 'VaultLiquidated') as liquidations,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_seen,
    DATEDIFF('day', MIN(timestamp), MAX(timestamp)) as days_active
FROM vault_events
WHERE vault_id IS NOT NULL
GROUP BY vault_id
ORDER BY total_events DESC
LIMIT 100;

-- Create external stage for API data ingestion
CREATE OR REPLACE STAGE mp_api_stage
    URL = 'https://mp-indexer.vercel.app/api/'
    COMMENT = 'Stage for Money Protocol API endpoints';

-- Create task to sync data from Supabase (requires external access integration)
CREATE OR REPLACE TASK sync_vault_events
    WAREHOUSE = COMPUTE_WH
    SCHEDULE = 'USING CRON 0 */6 * * * UTC'  -- Every 6 hours
AS
    -- This would need to be implemented with external function or Snowpipe
    -- to pull data from your Supabase or API endpoints
    SELECT 'Task placeholder - implement data sync logic';

-- Grant necessary permissions
GRANT USAGE ON DATABASE MP_ANALYTICS TO ROLE ANALYST;
GRANT USAGE ON SCHEMA VAULT_EVENTS TO ROLE ANALYST;
GRANT SELECT ON ALL TABLES IN SCHEMA VAULT_EVENTS TO ROLE ANALYST;
GRANT SELECT ON ALL VIEWS IN SCHEMA VAULT_EVENTS TO ROLE ANALYST;

-- Create stored procedure for analytics
CREATE OR REPLACE PROCEDURE get_vault_analytics(
    start_date DATE,
    end_date DATE,
    event_type_filter VARCHAR
)
RETURNS TABLE (
    date DATE,
    event_type VARCHAR,
    event_count NUMBER,
    unique_vaults NUMBER
)
LANGUAGE SQL
AS
$$
BEGIN
    RETURN TABLE(
        SELECT 
            DATE(timestamp) as date,
            event_type,
            COUNT(*) as event_count,
            COUNT(DISTINCT vault_id) as unique_vaults
        FROM vault_events
        WHERE timestamp BETWEEN :start_date AND :end_date
            AND (event_type = :event_type_filter OR :event_type_filter IS NULL)
        GROUP BY DATE(timestamp), event_type
        ORDER BY date, event_type
    );
END;
$$;

-- Example queries for analytics
-- Get daily summary
SELECT * FROM daily_vault_metrics 
WHERE date >= DATEADD('day', -30, CURRENT_DATE());

-- Get most active vaults
SELECT * FROM top_active_vaults;

-- Get recent liquidations
SELECT 
    vault_id,
    timestamp,
    block_number,
    transaction_hash
FROM vault_events
WHERE event_type = 'VaultLiquidated'
    AND timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP())
ORDER BY timestamp DESC;