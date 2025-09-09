import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function emptyAllTables() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Supabase credentials not configured');
    return;
  }

  console.log('🗑️ EMPTYING ALL SUPABASE TABLES - COMPLETE FRESH START');
  console.log('⚠️ This will delete ALL data from ALL tables!');

  // List of all tables to empty
  const tables = [
    'vault_events',
    'vault_lifecycle_events', 
    'vault_count_hourly',
    'tvl_snapshots',
    'tvl_analytics',
    'bpd_transfer_events',
    'bpd_supply_hourly',
    'mp_staking_events',
    'pool_balance_changes',
    'indexer_state'
  ];

  for (const table of tables) {
    try {
      console.log(`\n🗑️ Emptying table: ${table}`);
      
      // Delete ALL records from this table (use neq filter to match all records)
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=neq.999999`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        }
      });

      if (response.ok) {
        const deletedData = await response.text();
        let deletedCount = 0;
        if (deletedData && deletedData !== '[]') {
          try {
            const parsed = JSON.parse(deletedData);
            deletedCount = Array.isArray(parsed) ? parsed.length : 1;
          } catch (e) {
            deletedCount = deletedData ? 1 : 0;
          }
        }
        console.log(`✅ ${table}: Deleted ${deletedCount} records (table now empty)`);
      } else {
        const error = await response.text();
        if (error.includes('42P01') || error.includes('does not exist')) {
          console.log(`ℹ️  ${table}: Table does not exist (skipping)`);
        } else {
          console.log(`⚠️  ${table}: ${error}`);
        }
      }

    } catch (error) {
      console.error(`❌ Error emptying ${table}:`, error.message);
    }
  }

  console.log('\n🏁 All tables have been emptied!');
}

// Initialize indexer state for fresh start
async function initializeIndexerState() {
  const RESET_BLOCK = 6801508; // One before our minimum deployment block

  try {
    console.log('\n🔄 Initializing fresh indexer state...');
    console.log(`📍 Setting initial last_block to ${RESET_BLOCK}`);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: 1,
        last_block: RESET_BLOCK,
        updated_at: new Date().toISOString()
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Fresh indexer state initialized:', result);
      console.log(`🚀 Indexer will start from block ${RESET_BLOCK + 1} (6801509)`);
    } else {
      const error = await response.text();
      console.log(`⚠️ Could not initialize indexer state: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error initializing indexer state:', error.message);
  }
}

async function main() {
  console.log('🚀 COMPLETE SUPABASE RESET - STARTING FRESH');
  console.log('📋 This will empty all tables and reset indexer state');
  
  await emptyAllTables();
  await initializeIndexerState();
  
  console.log('\n🎉 COMPLETE FRESH START COMPLETED!');
  console.log('💡 All tables are empty and indexer is ready for deployment data');
  console.log('🔥 The mp-indexer will start collecting data from block 6801509');
}

main().catch(console.error);