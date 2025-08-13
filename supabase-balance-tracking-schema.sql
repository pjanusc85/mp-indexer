-- Balance Tracking Schema for Money Protocol Pools
-- Equivalent to Dune Analytics balance tracking pattern

-- Table to store all BTC transfers in/out of protocol pools
CREATE TABLE IF NOT EXISTS pool_balance_events (
    id BIGSERIAL PRIMARY KEY,
    block_number BIGINT NOT NULL,
    transaction_hash TEXT NOT NULL,
    log_index INT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    
    -- Pool information
    pool_address TEXT NOT NULL,
    pool_type TEXT NOT NULL CHECK (pool_type IN ('active', 'default', 'stability', 'coll_surplus')),
    
    -- Transfer details
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    value_btc DECIMAL(30, 18) NOT NULL, -- Positive for inbound, negative for outbound
    
    -- Context
    event_context TEXT, -- 'deposit', 'withdrawal', 'liquidation', 'redemption', etc.
    vault_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique events
    CONSTRAINT unique_pool_balance_event UNIQUE(transaction_hash, log_index, pool_address)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pool_balance_events_timestamp ON pool_balance_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pool_balance_events_block ON pool_balance_events(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_pool_balance_events_pool ON pool_balance_events(pool_address, pool_type);
CREATE INDEX IF NOT EXISTS idx_pool_balance_events_hour ON pool_balance_events(DATE_TRUNC('hour', timestamp));

-- Hourly balance aggregation table (equivalent to Dune's 't' CTE)
CREATE TABLE IF NOT EXISTS pool_balance_hourly (
    id BIGSERIAL PRIMARY KEY,
    hour TIMESTAMPTZ NOT NULL,
    pool_address TEXT NOT NULL,
    pool_type TEXT NOT NULL,
    
    -- Hourly metrics
    hourly_change_btc DECIMAL(30, 18) NOT NULL DEFAULT 0, -- Net change this hour
    ending_balance_btc DECIMAL(30, 18) NOT NULL DEFAULT 0, -- Cumulative balance at end of hour
    transaction_count INT NOT NULL DEFAULT 0,
    
    -- USD values (if price data available)
    hourly_change_usd DECIMAL(30, 2),
    ending_balance_usd DECIMAL(30, 2),
    btc_price_usd DECIMAL(30, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique entries per hour per pool
    CONSTRAINT unique_pool_balance_hour UNIQUE(hour, pool_address)
);

-- Indexes for hourly data
CREATE INDEX IF NOT EXISTS idx_pool_balance_hourly_time ON pool_balance_hourly(hour DESC);
CREATE INDEX IF NOT EXISTS idx_pool_balance_hourly_pool ON pool_balance_hourly(pool_address, pool_type);

-- View for current pool balances (equivalent to Dune's final SELECT)
CREATE OR REPLACE VIEW pool_balances_current AS
SELECT 
    pool_address,
    pool_type,
    hour as last_updated,
    ending_balance_btc as current_balance_btc,
    ending_balance_usd as current_balance_usd,
    btc_price_usd as last_btc_price
FROM pool_balance_hourly p1
WHERE hour = (
    SELECT MAX(hour) 
    FROM pool_balance_hourly p2 
    WHERE p2.pool_address = p1.pool_address
)
ORDER BY pool_type, pool_address;

-- View for balance trends over time (Dune-style time series)
CREATE OR REPLACE VIEW pool_balance_trends AS
SELECT 
    hour as time,
    pool_address,
    pool_type,
    hourly_change_btc,
    ending_balance_btc as balance_btc,
    ending_balance_usd as balance_usd,
    
    -- Calculate percentage change
    LAG(ending_balance_btc) OVER (
        PARTITION BY pool_address 
        ORDER BY hour
    ) as prev_balance_btc,
    
    CASE 
        WHEN LAG(ending_balance_btc) OVER (PARTITION BY pool_address ORDER BY hour) > 0 
        THEN ((ending_balance_btc - LAG(ending_balance_btc) OVER (PARTITION BY pool_address ORDER BY hour)) 
              / LAG(ending_balance_btc) OVER (PARTITION BY pool_address ORDER BY hour)) * 100
        ELSE 0 
    END as balance_change_pct
    
FROM pool_balance_hourly
ORDER BY hour DESC, pool_type;

-- View for total protocol TVL over time (sum of all pools)
CREATE OR REPLACE VIEW protocol_tvl_hourly AS
SELECT 
    hour as time,
    SUM(ending_balance_btc) as total_tvl_btc,
    SUM(ending_balance_usd) as total_tvl_usd,
    AVG(btc_price_usd) as avg_btc_price,
    
    -- Individual pool breakdowns
    SUM(CASE WHEN pool_type = 'active' THEN ending_balance_btc ELSE 0 END) as active_pool_btc,
    SUM(CASE WHEN pool_type = 'default' THEN ending_balance_btc ELSE 0 END) as default_pool_btc,
    SUM(CASE WHEN pool_type = 'stability' THEN ending_balance_btc ELSE 0 END) as stability_pool_btc,
    SUM(CASE WHEN pool_type = 'coll_surplus' THEN ending_balance_btc ELSE 0 END) as coll_surplus_btc,
    
    COUNT(DISTINCT pool_address) as active_pools
    
FROM pool_balance_hourly
GROUP BY hour
ORDER BY hour DESC;

-- View for balance flows analysis (like Dune's transfer tracking)
CREATE OR REPLACE VIEW pool_balance_flows AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    pool_type,
    event_context,
    
    -- Flow metrics
    COUNT(*) as transaction_count,
    SUM(CASE WHEN value_btc > 0 THEN value_btc ELSE 0 END) as total_inflow_btc,
    SUM(CASE WHEN value_btc < 0 THEN ABS(value_btc) ELSE 0 END) as total_outflow_btc,
    SUM(value_btc) as net_flow_btc,
    
    -- Unique metrics
    COUNT(DISTINCT vault_id) FILTER (WHERE vault_id IS NOT NULL) as unique_vaults,
    COUNT(DISTINCT from_address) as unique_senders,
    COUNT(DISTINCT to_address) as unique_receivers
    
FROM pool_balance_events
GROUP BY DATE_TRUNC('day', timestamp), pool_type, event_context
ORDER BY date DESC, pool_type;

-- Add comments for documentation
COMMENT ON TABLE pool_balance_events IS 'Raw balance change events for all Money Protocol pools, equivalent to Dune traces analysis';
COMMENT ON TABLE pool_balance_hourly IS 'Hourly balance aggregations with cumulative calculations, equivalent to Dune balance tracking pattern';
COMMENT ON VIEW pool_balances_current IS 'Current balance state for all pools';
COMMENT ON VIEW pool_balance_trends IS 'Historical balance trends with percentage changes';
COMMENT ON VIEW protocol_tvl_hourly IS 'Protocol-wide TVL metrics aggregated by hour';
COMMENT ON VIEW pool_balance_flows IS 'Analysis of balance flows and transaction patterns';

-- Enable Row Level Security
ALTER TABLE pool_balance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_balance_hourly ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for read access
CREATE POLICY "Enable read access for all users" ON pool_balance_events
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON pool_balance_hourly
    FOR SELECT USING (true);

-- Create RLS policies for insert access (for API)
CREATE POLICY "Enable insert for service role" ON pool_balance_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable insert for service role" ON pool_balance_hourly
    FOR INSERT WITH CHECK (true);

-- Data will be inserted by the alchemy-cron indexer
-- No sample data inserts in schema