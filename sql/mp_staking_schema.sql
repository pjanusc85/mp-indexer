-- MP Staking Analytics Schema
-- Equivalent to Liquity's LQTY staking tracking from Dune Analytics

-- Create MP staking hourly aggregation table
CREATE TABLE IF NOT EXISTS mp_staking_hourly (
    id SERIAL PRIMARY KEY,
    hour TIMESTAMP WITH TIME ZONE NOT NULL,
    total_mp_staked DECIMAL(24, 6) DEFAULT 0,
    mp_claimed_in_hour DECIMAL(24, 6) DEFAULT 0,
    total_mp_claimed DECIMAL(24, 6) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique entries per hour
    CONSTRAINT unique_mp_staking_hour UNIQUE(hour)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mp_staking_hour ON mp_staking_hourly(hour);
CREATE INDEX IF NOT EXISTS idx_mp_staking_total_staked ON mp_staking_hourly(total_mp_staked);

-- Create MP staking events table (raw events)
CREATE TABLE IF NOT EXISTS mp_staking_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'staking_update' or 'mp_claimed'
    block_number INTEGER NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- For staking update events
    total_mp_staked DECIMAL(24, 6),
    
    -- For claim events
    amount_claimed DECIMAL(24, 6),
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    
    -- Metadata
    log_index INTEGER,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique events
    CONSTRAINT unique_mp_staking_event UNIQUE(transaction_hash, event_type, log_index)
);

-- Create indexes for MP staking events
CREATE INDEX IF NOT EXISTS idx_mp_staking_events_block ON mp_staking_events(block_number);
CREATE INDEX IF NOT EXISTS idx_mp_staking_events_timestamp ON mp_staking_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_mp_staking_events_type ON mp_staking_events(event_type);

-- Create view for daily MP staking metrics (for charts)
CREATE OR REPLACE VIEW mp_staking_daily AS
SELECT 
    DATE(hour) as day,
    AVG(total_mp_staked) as avg_mp_staked,
    MAX(total_mp_staked) as max_mp_staked,
    MIN(total_mp_staked) as min_mp_staked,
    SUM(mp_claimed_in_hour) as total_mp_claimed_day,
    MAX(total_mp_claimed) as cumulative_mp_claimed
FROM mp_staking_hourly 
GROUP BY DATE(hour)
ORDER BY day;

-- Create view for latest MP staking metrics
CREATE OR REPLACE VIEW mp_staking_latest AS
SELECT 
    hour,
    total_mp_staked,
    total_mp_claimed,
    mp_claimed_in_hour,
    created_at
FROM mp_staking_hourly 
ORDER BY hour DESC 
LIMIT 1;

-- Create view for MP staking growth over time (similar to Dune chart)
CREATE OR REPLACE VIEW mp_staking_growth AS
SELECT 
    hour,
    total_mp_staked as staked_mp,
    total_mp_claimed as claimed_mp,
    (total_mp_staked - total_mp_claimed) as net_mp_staked,
    
    -- Calculate percentage growth
    LAG(total_mp_staked) OVER (ORDER BY hour) as prev_staked,
    CASE 
        WHEN LAG(total_mp_staked) OVER (ORDER BY hour) > 0 
        THEN ((total_mp_staked - LAG(total_mp_staked) OVER (ORDER BY hour)) / LAG(total_mp_staked) OVER (ORDER BY hour)) * 100
        ELSE 0 
    END as staking_growth_pct
    
FROM mp_staking_hourly 
ORDER BY hour;

-- Add comments for documentation
COMMENT ON TABLE mp_staking_hourly IS 'Hourly aggregation of MP staking data, equivalent to Dune Analytics LQTY staking tracking';
COMMENT ON TABLE mp_staking_events IS 'Raw MP staking and claim events from blockchain';
COMMENT ON VIEW mp_staking_daily IS 'Daily metrics for MP staking for dashboard charts';
COMMENT ON VIEW mp_staking_latest IS 'Latest MP staking metrics for real-time display';
COMMENT ON VIEW mp_staking_growth IS 'MP staking growth analysis over time';

-- Insert a sample row for testing (can be removed in production)
INSERT INTO mp_staking_hourly (hour, total_mp_staked, mp_claimed_in_hour, total_mp_claimed)
VALUES (DATE_TRUNC('hour', NOW()), 0, 0, 0)
ON CONFLICT (hour) DO NOTHING;

-- Show tables
SELECT 'MP Staking schema created successfully!' as status;