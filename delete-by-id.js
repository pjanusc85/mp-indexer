import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function deleteByIds() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Supabase credentials not configured');
    return;
  }

  console.log('🗑️ DELETING MP_STAKING_HOURLY RECORDS BY ID');

  try {
    // Delete records with IDs 1, 2, 3, 4, 5 specifically
    for (let id = 1; id <= 5; id++) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        }
      });

      if (response.ok) {
        const deletedData = await response.text();
        console.log(`✅ Deleted record with ID ${id}`);
      } else {
        const error = await response.text();
        console.log(`❌ Error deleting ID ${id}: ${error}`);
      }
    }

    console.log('\n🔍 Verifying table is now empty...');
    
    const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (checkResponse.ok) {
      const data = await checkResponse.json();
      console.log(`📊 Records remaining: ${data.length}`);
      
      if (data.length === 0) {
        console.log('🎉 mp_staking_hourly is now EMPTY!');
      } else {
        console.log('⚠️ Some records still remain:', data);
      }
    }

  } catch (error) {
    console.error('❌ Error during deletion:', error.message);
  }
}

async function main() {
  console.log('🚀 TARGETED DELETION OF MP STAKING RECORDS');
  
  await deleteByIds();
  
  console.log('\n✅ Historical MP staking data should now be gone!');
  console.log('🔄 Streamlit will refresh data in ~60 seconds due to cache TTL');
}

main().catch(console.error);