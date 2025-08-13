-- Redemption Gain from MP Staking Schema
-- Creates view for last 7 days of BTC redemption fees vs BTC gains claimed

-- View for daily redemption gains data (last 7 days)
CREATE OR REPLACE VIEW redemption_gains_daily AS
WITH 
  b AS (
    SELECT
      DATE_TRUNC('day', block_timestamp) AS day,
      SUM(btc_fee / 1e18) AS btc_paid
    FROM redemption_events
    GROUP BY 1
  ),
  s AS (
    SELECT
      DATE_TRUNC('day', block_timestamp) AS day,
      SUM(btc_gain / 1e18) AS btc_claimed
    FROM staking_gains_events
    GROUP BY 1
  )
SELECT
  COALESCE(b.day, s.day) AS day,
  COALESCE(b.btc_paid, 0) AS btc_paid,
  COALESCE(s.btc_claimed, 0) AS btc_claimed
FROM b
  FULL OUTER JOIN s ON b.day = s.day
ORDER BY 1 DESC
LIMIT 7;