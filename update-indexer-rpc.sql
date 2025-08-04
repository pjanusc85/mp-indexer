-- Create RPC function to update indexer state
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_indexer_state(new_block INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE indexer_state 
  SET last_block = new_block, updated_at = NOW() 
  WHERE id = 1;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO indexer_state (last_block, updated_at) 
    VALUES (new_block, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;