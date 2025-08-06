-- Reset indexer to start from an earlier block
-- Run this in Supabase SQL Editor to find historical vault events

-- Option 1: Reset to 1 million blocks ago (will gradually catch up)
UPDATE indexer_state 
SET last_block = 5200000, updated_at = NOW() 
WHERE id = 1;

-- Option 2: Check current RSK block and go back 500k blocks
-- UPDATE indexer_state 
-- SET last_block = 5700000, updated_at = NOW() 
-- WHERE id = 1;

-- Verify the update
SELECT * FROM indexer_state;