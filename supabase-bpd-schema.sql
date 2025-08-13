-- BPD Supply Tracking Schema

-- Table to store BPD supply snapshots over time
CREATE TABLE IF NOT EXISTS bpd_supply_snapshots (
    id BIGSERIAL PRIMARY KEY,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    total_supply_bpd DECIMAL(30, 18) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(block_number)
);

-- Table to store individual mint/burn events
CREATE TABLE IF NOT EXISTS bpd_supply_events (
    id BIGSERIAL PRIMARY KEY,
    transaction_hash TEXT NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('mint', 'burn')),
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    value_bpd DECIMAL(30, 18) NOT NULL,
    supply_change DECIMAL(30, 18) NOT NULL, -- Positive for mint, negative for burn
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(transaction_hash, log_index)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bpd_snapshots_timestamp ON bpd_supply_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bpd_snapshots_block ON bpd_supply_snapshots(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_bpd_events_timestamp ON bpd_supply_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bpd_events_block ON bpd_supply_events(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_bpd_events_type ON bpd_supply_events(event_type);

-- View for daily BPD supply aggregates
CREATE OR REPLACE VIEW bpd_daily_supply AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    AVG(total_supply_bpd) as avg_supply,
    MIN(total_supply_bpd) as min_supply,
    MAX(total_supply_bpd) as max_supply,
    LAST_VALUE(total_supply_bpd) OVER (
        PARTITION BY DATE_TRUNC('day', timestamp) 
        ORDER BY timestamp 
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as closing_supply
FROM bpd_supply_snapshots
GROUP BY DATE_TRUNC('day', timestamp), timestamp, total_supply_bpd;

-- View for mint/burn activity summary
CREATE OR REPLACE VIEW bpd_supply_activity AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    COUNT(*) FILTER (WHERE event_type = 'mint') as mint_count,
    COUNT(*) FILTER (WHERE event_type = 'burn') as burn_count,
    COALESCE(SUM(value_bpd) FILTER (WHERE event_type = 'mint'), 0) as total_minted,
    COALESCE(SUM(value_bpd) FILTER (WHERE event_type = 'burn'), 0) as total_burned,
    COALESCE(SUM(supply_change), 0) as net_supply_change
FROM bpd_supply_events
GROUP BY DATE_TRUNC('day', timestamp);

-- View for latest BPD supply
CREATE OR REPLACE VIEW bpd_latest_supply AS
SELECT 
    block_number,
    timestamp,
    total_supply_bpd,
    created_at
FROM bpd_supply_snapshots
ORDER BY block_number DESC
LIMIT 1;