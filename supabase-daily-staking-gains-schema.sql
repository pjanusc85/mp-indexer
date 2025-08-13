-- Daily Issuance Gain from MP Staking Schema
-- Creates view for last 7 days of BPD fees generated vs gains claimed

-- View for daily staking gains data (last 7 days for issuance gain chart)
CREATE OR REPLACE VIEW staking_gains_daily AS
WITH 
  b AS (
    SELECT
      DATE_TRUNC('day', block_timestamp) AS day,
      SUM(bpd_fee / 1e18) AS bpd_paid
    FROM borrowing_fee_events
    GROUP BY 1
  ),
  s AS (
    SELECT
      DATE_TRUNC('day', block_timestamp) AS day,
      SUM(bpd_gain / 1e18) AS bpd_claimed
    FROM staking_gains_events
    GROUP BY 1
  )
SELECT
  COALESCE(b.day, s.day) AS day,
  COALESCE(b.bpd_paid, 0) AS bpd_paid,
  COALESCE(s.bpd_claimed, 0) AS bpd_claimed
FROM b
  FULL OUTER JOIN s ON b.day = s.day
ORDER BY 1 DESC
LIMIT 7;