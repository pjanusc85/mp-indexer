-- Reset indexer to capture vault creation events from the known block range
-- Run this in Supabase SQL Editor

-- Reset to start just before the vault creation events
UPDATE indexer_state 
SET last_block = 2965932, updated_at = NOW() 
WHERE id = 1;

-- Verify the update
SELECT * FROM indexer_state;

-- Check the block range we'll be processing
SELECT 
    last_block as starting_from_block,
    3300000 - last_block as blocks_to_process,
    (3300000 - last_block) / 100 as estimated_runs_needed
FROM indexer_state 
WHERE id = 1;