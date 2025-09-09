import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function emptyActualTables() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Supabase credentials not configured');
    return;
  }

  console.log('🗑️ EMPTYING ACTUAL TABLES USED BY STREAMLIT APP');

  // These are the actual table names used in streamlit_app.py
  const actualTables = [
    'vault_events',
    'tvl_snapshots', 
    'bpd_supply_snapshots', // This is what streamlit uses, not bpd_supply_hourly
    'mp_staking_events',
    'mp_staking_hourly', // Used by MP Staking Analytics
    'staking_gains_daily', // Used by Staking Gains Analytics
    'indexer_state'
  ];

  for (const table of actualTables) {
    try {
      console.log(`\n🗑️ Emptying table: ${table}`);
      
      // Delete ALL records from this table
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

  console.log('\n🏁 All actual tables have been emptied!');
}

// Initialize fresh indexer state  
async function initializeFreshIndexerState() {
  const RESET_BLOCK = 6801508;

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
  console.log('🚀 EMPTYING ACTUAL TABLES USED BY STREAMLIT');
  console.log('📋 This will target the specific tables referenced in the code');
  
  await emptyActualTables();
  await initializeFreshIndexerState();
  
  console.log('\n🎉 ACTUAL TABLES RESET COMPLETED!');
  console.log('💡 BPD Supply Analytics should now show no data');
  console.log('🔥 Fresh data collection will start from block 6801509');
}

main().catch(console.error);