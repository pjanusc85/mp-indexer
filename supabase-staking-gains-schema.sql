-- Staking Gains Tables for Money Protocol
-- Based on Liquity's staking mechanism but adapted for MP tokens

-- Table for BPD borrowing fee events (equivalent to LUSD borrowing fees)
CREATE TABLE IF NOT EXISTS borrowing_fee_events (
  id SERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  borrower_address VARCHAR(42) NOT NULL,
  bpd_fee DECIMAL(78,0) NOT NULL, -- Fee in wei
  block_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(transaction_hash, log_index)
);

-- Table for redemption events 
CREATE TABLE IF NOT EXISTS redemption_events (
  id SERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  redeemer_address VARCHAR(42) NOT NULL,
  bpd_amount DECIMAL(78,0) NOT NULL, -- BPD amount redeemed
  btc_sent DECIMAL(78,0) NOT NULL, -- BTC sent to redeemer
  btc_fee DECIMAL(78,0) NOT NULL, -- BTC fee for staking
  block_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(transaction_hash, log_index)
);

-- Table for MP staking gains withdrawn events
CREATE TABLE IF NOT EXISTS staking_gains_events (
  id SERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  staker_address VARCHAR(42) NOT NULL,
  bpd_gain DECIMAL(78,0) NOT NULL, -- BPD gains claimed
  btc_gain DECIMAL(78,0) NOT NULL, -- BTC gains claimed  
  block_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(transaction_hash, log_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_borrowing_fee_timestamp ON borrowing_fee_events(block_timestamp);
CREATE INDEX IF NOT EXISTS idx_borrowing_fee_block ON borrowing_fee_events(block_number);

CREATE INDEX IF NOT EXISTS idx_redemption_timestamp ON redemption_events(block_timestamp);
CREATE INDEX IF NOT EXISTS idx_redemption_block ON redemption_events(block_number);

CREATE INDEX IF NOT EXISTS idx_staking_gains_timestamp ON staking_gains_events(block_timestamp);
CREATE INDEX IF NOT EXISTS idx_staking_gains_block ON staking_gains_events(block_number);
CREATE INDEX IF NOT EXISTS idx_staking_gains_staker ON staking_gains_events(staker_address);

-- View for hourly aggregated staking gains data (matches Dune query structure)
CREATE OR REPLACE VIEW staking_gains_hourly AS
WITH 
  b AS (
    SELECT
      DATE_TRUNC('hour', block_timestamp) AS hour,
      SUM(bpd_fee / 1e18) AS bpd_paid
    FROM borrowing_fee_events
    GROUP BY 1
  ),
  r AS (
    SELECT
      DATE_TRUNC('hour', block_timestamp) AS hour,
      SUM(btc_fee / 1e18) AS btc_paid
    FROM redemption_events
    GROUP BY 1
  ),
  s AS (
    SELECT
      DATE_TRUNC('hour', block_timestamp) AS hour,
      SUM(bpd_gain / 1e18) AS bpd_claimed,
      SUM(btc_gain / 1e18) AS btc_claimed
    FROM staking_gains_events
    GROUP BY 1
  )
SELECT
  COALESCE(b.hour, s.hour, r.hour) AS hour,
  SUM(b.bpd_paid) OVER (
    ORDER BY COALESCE(b.hour, s.hour, r.hour)
  ) AS total_bpd_paid,
  SUM(s.bpd_claimed) OVER (
    ORDER BY COALESCE(b.hour, s.hour, r.hour)
  ) AS total_bpd_claimed,
  SUM(COALESCE(r.btc_paid, 0)) OVER (
    ORDER BY COALESCE(b.hour, s.hour, r.hour)
  ) AS total_btc_paid,
  SUM(s.btc_claimed) OVER (
    ORDER BY COALESCE(b.hour, s.hour, r.hour)
  ) AS total_btc_claimed
FROM b
  FULL OUTER JOIN s ON b.hour = s.hour
  FULL OUTER JOIN r ON COALESCE(b.hour, s.hour) = r.hour
ORDER BY 1;