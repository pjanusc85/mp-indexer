-- Simplified Balance Tracking Schema for Money Protocol Pools
-- Core tables only, views can be added later

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
    value_btc DECIMAL(30, 18) NOT NULL,
    
    -- Context
    event_context TEXT,
    vault_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique events
    CONSTRAINT unique_pool_balance_event UNIQUE(transaction_hash, log_index, pool_address)
);

-- Hourly balance aggregation table
CREATE TABLE IF NOT EXISTS pool_balance_hourly (
    id BIGSERIAL PRIMARY KEY,
    hour TIMESTAMPTZ NOT NULL,
    pool_address TEXT NOT NULL,
    pool_type TEXT NOT NULL,
    
    -- Hourly metrics
    hourly_change_btc DECIMAL(30, 18) NOT NULL DEFAULT 0,
    ending_balance_btc DECIMAL(30, 18) NOT NULL DEFAULT 0,
    transaction_count INT NOT NULL DEFAULT 0,
    
    -- USD values (optional)
    hourly_change_usd DECIMAL(30, 2),
    ending_balance_usd DECIMAL(30, 2),
    btc_price_usd DECIMAL(30, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique entries per hour per pool
    CONSTRAINT unique_pool_balance_hour UNIQUE(hour, pool_address)
);

-- Basic indexes (no function-based indexes)
CREATE INDEX IF NOT EXISTS idx_pool_balance_events_timestamp ON pool_balance_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pool_balance_events_block ON pool_balance_events(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_pool_balance_events_pool ON pool_balance_events(pool_address, pool_type);

CREATE INDEX IF NOT EXISTS idx_pool_balance_hourly_time ON pool_balance_hourly(hour DESC);
CREATE INDEX IF NOT EXISTS idx_pool_balance_hourly_pool ON pool_balance_hourly(pool_address, pool_type);

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

-- Add comments
COMMENT ON TABLE pool_balance_events IS 'Raw balance change events for Money Protocol pools';
COMMENT ON TABLE pool_balance_hourly IS 'Hourly balance aggregations with cumulative calculations';