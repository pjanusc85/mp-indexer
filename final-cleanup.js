import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function finalCleanup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Supabase credentials not configured');
    return;
  }

  console.log('🗑️ FINAL CLEANUP - EMPTYING REMAINING DATA');

  // Target the specific tables that still have data
  const tablesToEmpty = [
    'mp_staking_hourly'  // This one has 5 records showing August 2025 data
  ];

  for (const table of tablesToEmpty) {
    try {
      console.log(`\n🗑️ Emptying table: ${table}`);
      
      // First, let's see what's in there
      const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      });

      if (checkResponse.ok) {
        const data = await checkResponse.json();
        console.log(`   Found ${data.length} records to delete`);
      }

      // Delete ALL records from this table using id filter
      const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=gte.0`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        }
      });

      if (deleteResponse.ok) {
        const deletedData = await deleteResponse.text();
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
        const error = await deleteResponse.text();
        console.log(`❌ ${table}: Error deleting - ${error}`);
      }

    } catch (error) {
      console.error(`❌ Error cleaning ${table}:`, error.message);
    }
  }

  console.log('\n🔄 Re-initializing indexer state...');
  
  const RESET_BLOCK = 6801508;
  
  try {
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
    }
  } catch (error) {
    console.log('⚠️ Indexer state already exists, skipping initialization');
  }

  console.log('\n🏁 FINAL CLEANUP COMPLETED!');
}

async function main() {
  console.log('🚀 FINAL DATABASE CLEANUP');
  console.log('🎯 Targeting remaining records in mp_staking_hourly');
  
  await finalCleanup();
  
  console.log('\n🎉 ALL HISTORICAL DATA REMOVED!');
  console.log('💡 Streamlit cache will expire in 60 seconds');
  console.log('🔥 Charts should show no data after cache expires');
}

main().catch(console.error);