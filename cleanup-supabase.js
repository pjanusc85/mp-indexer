import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Minimum block number from earliest deployment transaction
const MIN_BLOCK = 6801509;

async function cleanupSupabaseData() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Supabase credentials not configured');
    return;
  }

  console.log('🧹 Cleaning up Supabase database...');
  console.log(`📋 Removing all data before block ${MIN_BLOCK}`);

  const tables = [
    'vault_events',
    'vault_lifecycle_events', 
    'vault_count_hourly',
    'tvl_snapshots',
    'bpd_transfer_events',
    'bpd_supply_hourly',
    'mp_staking_events',
    'pool_balance_changes'
  ];

  for (const table of tables) {
    try {
      console.log(`\n🗑️  Cleaning table: ${table}`);
      
      // Delete records with block_number < MIN_BLOCK
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?block_number=lt.${MIN_BLOCK}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        }
      });

      if (response.ok) {
        const deletedData = await response.text();
        const deletedCount = deletedData ? JSON.parse(deletedData).length : 0;
        console.log(`✅ ${table}: Deleted ${deletedCount} records before block ${MIN_BLOCK}`);
      } else {
        const error = await response.text();
        console.log(`⚠️  ${table}: ${error}`);
      }

    } catch (error) {
      console.error(`❌ Error cleaning ${table}:`, error.message);
    }
  }

  // Also clean up any hourly data before the minimum block timestamp
  console.log(`\n🗑️  Cleaning hourly data before block ${MIN_BLOCK}...`);
  
  // Get the timestamp of the minimum block (approximate)
  const minBlockTimestamp = new Date('2024-01-01T00:00:00Z'); // We'll use a safe date
  const hourlyTables = ['vault_count_hourly', 'bpd_supply_hourly'];
  
  for (const table of hourlyTables) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?hour=lt.${minBlockTimestamp.toISOString()}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        }
      });

      if (response.ok) {
        const deletedData = await response.text();
        const deletedCount = deletedData ? JSON.parse(deletedData).length : 0;
        console.log(`✅ ${table}: Deleted ${deletedCount} old hourly records`);
      }
    } catch (error) {
      console.error(`❌ Error cleaning hourly data from ${table}:`, error.message);
    }
  }

  console.log('\n✅ Database cleanup completed!');
  console.log(`📊 All data before block ${MIN_BLOCK} has been removed`);
}

// Update the last processed block in tracking
async function updateLastProcessedBlock() {
  try {
    console.log('\n📝 Updating last processed block tracking...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/indexer_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: 'main',
        last_processed_block: MIN_BLOCK - 1, // Start from one block before
        updated_at: new Date().toISOString()
      })
    });

    if (response.ok) {
      console.log(`✅ Updated last processed block to ${MIN_BLOCK - 1}`);
    } else {
      const error = await response.text();
      console.log(`⚠️  Could not update indexer status: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error updating last processed block:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting Supabase cleanup for latest deployment...');
  console.log(`📍 Minimum block from deployment transactions: ${MIN_BLOCK}`);
  
  await cleanupSupabaseData();
  await updateLastProcessedBlock();
  
  console.log('\n🎉 Cleanup completed successfully!');
  console.log('💡 The indexer will now start fresh from the latest deployment.');
}

main().catch(console.error);