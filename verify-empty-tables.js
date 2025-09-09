import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function verifyTablesEmpty() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Supabase credentials not configured');
    return;
  }

  console.log('🔍 VERIFYING ALL TABLES ARE EMPTY');

  // All possible table names from streamlit_app.py and the indexer
  const allPossibleTables = [
    'vault_events',
    'tvl_snapshots', 
    'bpd_supply_snapshots',
    'mp_staking_events',
    'mp_staking_hourly',
    'staking_gains_daily',
    'indexer_state',
    // Additional potential tables
    'vault_analytics',
    'stability_pool_events',
    'redemption_events',
    'pool_balance_changes'
  ];

  console.log(`\n📋 Checking ${allPossibleTables.length} potential tables:\n`);

  for (const table of allPossibleTables) {
    try {
      // Count records in this table
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        const count = Array.isArray(data) ? data.length : 0;
        
        if (count > 0) {
          console.log(`⚠️  ${table}: ${count} records found - NOT EMPTY!`);
          
          // Show first few records for debugging
          if (count <= 3) {
            console.log(`   Sample data:`, data.slice(0, 2));
          } else {
            console.log(`   Sample data:`, data.slice(0, 2));
            console.log(`   ... and ${count - 2} more records`);
          }
        } else {
          console.log(`✅ ${table}: Empty (${count} records)`);
        }
      } else {
        const error = await response.text();
        if (error.includes('42P01') || error.includes('does not exist')) {
          console.log(`ℹ️  ${table}: Table does not exist`);
        } else {
          console.log(`❌ ${table}: Error checking - ${error}`);
        }
      }

    } catch (error) {
      console.error(`❌ Error checking ${table}:`, error.message);
    }
  }

  console.log('\n🏁 Table verification completed!');
}

async function main() {
  console.log('🚀 VERIFYING DATABASE IS COMPLETELY EMPTY');
  console.log('📋 This will check all possible tables for remaining data');
  
  await verifyTablesEmpty();
  
  console.log('\n💡 If any tables show data, they need to be emptied');
  console.log('🔄 Streamlit cache (TTL=60s) may also need to expire');
}

main().catch(console.error);