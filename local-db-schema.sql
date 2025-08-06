-- Money Protocol Analytics Database Schema
-- For local PostgreSQL development

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS vault_events CASCADE;
DROP TABLE IF EXISTS indexer_state CASCADE;
DROP VIEW IF EXISTS daily_vault_metrics CASCADE;
DROP VIEW IF EXISTS open_vaults_by_date CASCADE;

-- Create indexer_state table to track processing progress
CREATE TABLE indexer_state (
    id SERIAL PRIMARY KEY,
    contract_address VARCHAR(42) NOT NULL,
    last_processed_block INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(contract_address)
);

-- Create vault_events table to store all vault-related events
CREATE TABLE vault_events (
    id SERIAL PRIMARY KEY,
    contract_address VARCHAR(42) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    topics TEXT[] NOT NULL,
    data TEXT,
    vault_id VARCHAR(66),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add indexes for performance
    CONSTRAINT unique_event UNIQUE(transaction_hash, event_type, vault_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_vault_events_block_number ON vault_events(block_number);
CREATE INDEX idx_vault_events_timestamp ON vault_events(timestamp);
CREATE INDEX idx_vault_events_vault_id ON vault_events(vault_id);
CREATE INDEX idx_vault_events_event_type ON vault_events(event_type);
CREATE INDEX idx_vault_events_contract ON vault_events(contract_address);

-- Create analytics views
CREATE VIEW daily_vault_metrics AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) FILTER (WHERE event_type = 'VaultUpdated') as vaults_updated,
    COUNT(*) FILTER (WHERE event_type = 'VaultLiquidated') as vaults_liquidated,
    COUNT(DISTINCT vault_id) as unique_vaults_affected
FROM vault_events 
GROUP BY DATE(timestamp)
ORDER BY date;

CREATE VIEW open_vaults_by_date AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) FILTER (WHERE event_type = 'VaultUpdated') as vaults_opened,
    SUM(COUNT(*) FILTER (WHERE event_type = 'VaultUpdated')) OVER (ORDER BY DATE(timestamp)) as cumulative_vaults_created
FROM vault_events 
GROUP BY DATE(timestamp)
ORDER BY date;

-- Insert initial indexer state for VaultManager contract
INSERT INTO indexer_state (contract_address, last_processed_block) 
VALUES ('0x0eccca821f078f394f2bb1f3d615ad73729a9892', 6680000)
ON CONFLICT (contract_address) DO NOTHING;

-- Show table information
\dt
\d vault_events
\d indexer_state

-- Show sample data
SELECT 'Database schema created successfully!' as status;
SELECT COUNT(*) as vault_events_count FROM vault_events;
SELECT COUNT(*) as indexer_state_count FROM indexer_state;