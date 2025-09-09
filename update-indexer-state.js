import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Reset to one block before our minimum deployment block
const RESET_BLOCK = 6801508; // One before 6801509

async function updateIndexerState() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Supabase credentials not configured');
    return;
  }

  console.log('🔄 Updating indexer state to reset from deployment block...');
  console.log(`📍 Setting last_block to ${RESET_BLOCK} (will start indexing from ${RESET_BLOCK + 1})`);

  try {
    // Update the indexer state record
    const response = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state?id=eq.2`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        last_block: RESET_BLOCK,
        updated_at: new Date().toISOString()
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Indexer state updated successfully:', result);
      console.log(`🚀 Indexer will now start from block ${RESET_BLOCK + 1} (6801509)`);
    } else {
      const error = await response.text();
      console.error('❌ Error updating indexer state:', error);
    }

  } catch (error) {
    console.error('❌ Error updating indexer state:', error.message);
  }
}

async function main() {
  console.log('🚀 Resetting indexer state for clean deployment start...');
  await updateIndexerState();
  console.log('✅ Indexer state reset completed!');
}

main().catch(console.error);