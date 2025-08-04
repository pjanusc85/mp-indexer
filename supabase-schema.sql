-- Money Protocol Indexer Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable Row Level Security (recommended for Supabase)
-- Note: For this indexer, we'll allow anonymous access since we're using service role key

-- Indexer state tracking
CREATE TABLE IF NOT EXISTS indexer_state (
  id SERIAL PRIMARY KEY,
  last_block INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw vault events from blockchain
CREATE TABLE IF NOT EXISTS vault_events (
  id SERIAL PRIMARY KEY,
  contract_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  topics TEXT[] NOT NULL,
  data TEXT,
  vault_id TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT unique_tx_log UNIQUE (transaction_hash, topics, data)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vault_events_block_number ON vault_events(block_number);
CREATE INDEX IF NOT EXISTS idx_vault_events_contract ON vault_events(contract_address);
CREATE INDEX IF NOT EXISTS idx_vault_events_event_type ON vault_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vault_events_vault_id ON vault_events(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_events_timestamp ON vault_events(timestamp);

-- Current state of each vault (derived from events)
CREATE TABLE IF NOT EXISTS vault_states (
  vault_id TEXT PRIMARY KEY,
  owner TEXT,
  collateral DECIMAL(38, 18) DEFAULT 0,
  debt DECIMAL(38, 18) DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'liquidated', 'closed'
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_event_block INTEGER
);

-- Historical vault changes (for analytics)
CREATE TABLE IF NOT EXISTS vault_history (
  id SERIAL PRIMARY KEY,
  vault_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  collateral_before DECIMAL(38, 18),
  collateral_after DECIMAL(38, 18),
  debt_before DECIMAL(38, 18),
  debt_after DECIMAL(38, 18),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL
);

-- Create indexes for vault_history
CREATE INDEX IF NOT EXISTS idx_vault_history_vault_id ON vault_history(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_history_timestamp ON vault_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_vault_history_event_type ON vault_history(event_type);

-- Analytics views (same as original schema)
CREATE OR REPLACE VIEW open_vaults_by_date AS
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as vaults_opened,
  SUM(COUNT(*)) OVER (ORDER BY DATE(timestamp)) as cumulative_vaults_created
FROM vault_history 
WHERE event_type = 'VaultUpdated'
  AND collateral_before IS NULL -- First time seeing this vault
GROUP BY DATE(timestamp)
ORDER BY date;

CREATE OR REPLACE VIEW daily_vault_metrics AS
SELECT 
  DATE(timestamp) as date,
  COUNT(DISTINCT CASE WHEN event_type = 'VaultUpdated' AND collateral_before IS NULL THEN vault_id END) as new_vaults,
  COUNT(DISTINCT CASE WHEN event_type = 'VaultLiquidated' THEN vault_id END) as liquidated_vaults,
  AVG(CASE WHEN event_type = 'VaultUpdated' THEN collateral_after END) as avg_collateral,
  AVG(CASE WHEN event_type = 'VaultUpdated' THEN debt_after END) as avg_debt
FROM vault_history
GROUP BY DATE(timestamp)
ORDER BY date;

CREATE OR REPLACE VIEW vault_summary AS
SELECT 
  COUNT(*) as total_vaults,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_vaults,
  COUNT(CASE WHEN status = 'liquidated' THEN 1 END) as liquidated_vaults,
  SUM(collateral) as total_collateral,
  SUM(debt) as total_debt,
  AVG(collateral) as avg_collateral,
  AVG(debt) as avg_debt
FROM vault_states;

-- Enable RLS but allow all operations for now (since we're using service role)
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_history ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations (adjust as needed for security)
CREATE POLICY "Allow all operations on indexer_state" ON indexer_state FOR ALL USING (true);
CREATE POLICY "Allow all operations on vault_events" ON vault_events FOR ALL USING (true);
CREATE POLICY "Allow all operations on vault_states" ON vault_states FOR ALL USING (true);
CREATE POLICY "Allow all operations on vault_history" ON vault_history FOR ALL USING (true);

-- Insert initial indexer state if it doesn't exist
INSERT INTO indexer_state (last_block) 
SELECT 0 
WHERE NOT EXISTS (SELECT 1 FROM indexer_state);

-- Sample data insertion function (for testing)
CREATE OR REPLACE FUNCTION insert_sample_vault_data() 
RETURNS void AS $$
BEGIN
  -- Insert sample vault events for testing
  INSERT INTO vault_events (
    contract_address, 
    event_type, 
    transaction_hash, 
    block_number, 
    timestamp, 
    topics, 
    data, 
    vault_id
  ) VALUES 
  (
    '0x54f2712fd31fc81a47d014727c12f26ba24feec2',
    'VaultUpdated',
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    1000000,
    NOW() - INTERVAL '1 day',
    ARRAY['0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c', '0x0000000000000000000000000000000000000000000000000000000000000001'],
    '0x',
    '0x0000000000000000000000000000000000000000000000000000000000000001'
  ) ON CONFLICT (transaction_hash, topics, data) DO NOTHING;
  
  -- Insert corresponding vault state
  INSERT INTO vault_states (
    vault_id,
    owner,
    collateral,
    debt,
    status,
    created_at,
    last_event_block
  ) VALUES (
    '0x0000000000000000000000000000000000000000000000000000000000000001',
    '0x742d35cc6634c0532925a3b8d6a5c0b9e4c2b6f7',
    1.5,
    1000.0,
    'active',
    NOW() - INTERVAL '1 day',
    1000000
  ) ON CONFLICT (vault_id) DO NOTHING;
  
  -- Insert vault history
  INSERT INTO vault_history (
    vault_id,
    event_type,
    collateral_before,
    collateral_after,
    debt_before,
    debt_after,
    timestamp,
    block_number,
    transaction_hash
  ) VALUES (
    '0x0000000000000000000000000000000000000000000000000000000000000001',
    'VaultUpdated',
    NULL,
    1.5,
    NULL,
    1000.0,
    NOW() - INTERVAL '1 day',
    1000000,
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  );
END;
$$ LANGUAGE plpgsql;

-- Uncomment the line below to insert sample data for testing
-- SELECT insert_sample_vault_data();