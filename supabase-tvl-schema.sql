-- TVL (Total Value Locked) tracking schema for Money Protocol

-- Table to store TVL snapshots at different block heights
CREATE TABLE IF NOT EXISTS tvl_snapshots (
    id SERIAL PRIMARY KEY,
    block_number INTEGER NOT NULL UNIQUE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- BTC balances in the different pools
    active_pool_btc DECIMAL(18, 8) NOT NULL DEFAULT 0,
    default_pool_btc DECIMAL(18, 8) NOT NULL DEFAULT 0,
    total_btc DECIMAL(18, 8) NOT NULL DEFAULT 0,
    
    -- USD values (if we add price feeds later)
    btc_price_usd DECIMAL(18, 2) DEFAULT NULL,
    total_usd DECIMAL(18, 2) DEFAULT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT unique_block UNIQUE(block_number)
);

-- Table to store detailed vault operations for TVL calculations
CREATE TABLE IF NOT EXISTS vault_operations (
    id SERIAL PRIMARY KEY,
    
    -- Transaction details
    transaction_hash VARCHAR(66) NOT NULL,
    block_number INTEGER NOT NULL,
    log_index INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Operation details
    operation_type VARCHAR(20) NOT NULL, -- 'VaultUpdated', 'VaultLiquidated'
    borrower VARCHAR(42) NOT NULL,
    
    -- Vault state
    debt DECIMAL(18, 8) NOT NULL DEFAULT 0,
    collateral DECIMAL(18, 8) NOT NULL DEFAULT 0,
    operation_code INTEGER NOT NULL, -- 0=openVault, 1=closeVault, 2=adjustVault, etc.
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_operation UNIQUE(transaction_hash, log_index)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tvl_snapshots_timestamp ON tvl_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_tvl_snapshots_block ON tvl_snapshots(block_number);

CREATE INDEX IF NOT EXISTS idx_vault_operations_timestamp ON vault_operations(timestamp);
CREATE INDEX IF NOT EXISTS idx_vault_operations_block ON vault_operations(block_number);
CREATE INDEX IF NOT EXISTS idx_vault_operations_borrower ON vault_operations(borrower);
CREATE INDEX IF NOT EXISTS idx_vault_operations_type ON vault_operations(operation_type);

-- View for TVL analytics
CREATE OR REPLACE VIEW tvl_analytics AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    DATE_TRUNC('day', timestamp) as day,
    AVG(total_btc) as avg_tvl_btc,
    MAX(total_btc) as max_tvl_btc,
    MIN(total_btc) as min_tvl_btc,
    COUNT(*) as snapshots_count
FROM tvl_snapshots
GROUP BY DATE_TRUNC('hour', timestamp), DATE_TRUNC('day', timestamp)
ORDER BY hour;

-- View for recent TVL trends
CREATE OR REPLACE VIEW tvl_trends AS
SELECT 
    timestamp,
    total_btc,
    total_btc - LAG(total_btc, 1) OVER (ORDER BY timestamp) as btc_change,
    ((total_btc - LAG(total_btc, 1) OVER (ORDER BY timestamp)) / NULLIF(LAG(total_btc, 1) OVER (ORDER BY timestamp), 0)) * 100 as pct_change
FROM tvl_snapshots
ORDER BY timestamp;

-- View for vault activity summary
CREATE OR REPLACE VIEW vault_activity_summary AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    COUNT(*) as total_operations,
    COUNT(*) FILTER (WHERE operation_type = 'VaultUpdated') as vault_updates,
    COUNT(*) FILTER (WHERE operation_type = 'VaultLiquidated') as vault_liquidations,
    COUNT(DISTINCT borrower) as unique_borrowers,
    SUM(collateral) FILTER (WHERE operation_type = 'VaultUpdated') as collateral_added,
    SUM(collateral) FILTER (WHERE operation_type = 'VaultLiquidated') as collateral_liquidated
FROM vault_operations
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY date;

-- Function to calculate TVL change over time periods
CREATE OR REPLACE FUNCTION get_tvl_change(period_hours INTEGER DEFAULT 24)
RETURNS TABLE(
    current_tvl DECIMAL(18, 8),
    previous_tvl DECIMAL(18, 8),
    absolute_change DECIMAL(18, 8),
    percentage_change DECIMAL(8, 4)
) AS $$
BEGIN
    RETURN QUERY
    WITH current_data AS (
        SELECT total_btc
        FROM tvl_snapshots
        ORDER BY timestamp DESC
        LIMIT 1
    ),
    previous_data AS (
        SELECT total_btc
        FROM tvl_snapshots
        WHERE timestamp <= NOW() - INTERVAL '1 hour' * period_hours
        ORDER BY timestamp DESC
        LIMIT 1
    )
    SELECT 
        c.total_btc as current_tvl,
        p.total_btc as previous_tvl,
        c.total_btc - p.total_btc as absolute_change,
        CASE 
            WHEN p.total_btc > 0 THEN ((c.total_btc - p.total_btc) / p.total_btc) * 100
            ELSE 0
        END as percentage_change
    FROM current_data c, previous_data p;
END;
$$ LANGUAGE plpgsql;

-- RLS policies (if needed)
ALTER TABLE tvl_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_operations ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your security needs)
CREATE POLICY "Allow all operations on tvl_snapshots" ON tvl_snapshots FOR ALL USING (true);
CREATE POLICY "Allow all operations on vault_operations" ON vault_operations FOR ALL USING (true);

-- Sample query to test the setup
-- SELECT * FROM tvl_trends ORDER BY timestamp DESC LIMIT 10;