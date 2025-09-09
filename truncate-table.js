import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function truncateTable() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Supabase credentials not configured');
    return;
  }

  console.log('🗑️ ATTEMPTING TO TRUNCATE mp_staking_hourly TABLE');

  try {
    // Try different deletion approaches
    
    console.log('1️⃣ Trying delete with created_at filter...');
    const response1 = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?created_at=gte.2020-01-01T00:00:00+00:00`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      }
    });

    if (response1.ok) {
      const result1 = await response1.text();
      console.log('✅ Delete with created_at filter completed');
    } else {
      const error1 = await response1.text();
      console.log('❌ created_at filter failed:', error1);
    }

    console.log('\n2️⃣ Trying delete with total_mp_staked filter...');
    const response2 = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?total_mp_staked=gte.0`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      }
    });

    if (response2.ok) {
      const result2 = await response2.text();
      console.log('✅ Delete with total_mp_staked filter completed');
    } else {
      const error2 = await response2.text();
      console.log('❌ total_mp_staked filter failed:', error2);
    }

    console.log('\n3️⃣ Trying to delete each record individually with multiple filters...');
    
    // Get all records first
    const getResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (getResponse.ok) {
      const records = await getResponse.json();
      console.log(`Found ${records.length} records to delete individually`);

      for (const record of records) {
        const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?id=eq.${record.id}&hour=eq.${encodeURIComponent(record.hour)}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        });

        if (deleteResponse.ok) {
          console.log(`✅ Deleted record ID ${record.id}`);
        } else {
          const error = await deleteResponse.text();
          console.log(`❌ Failed to delete ID ${record.id}: ${error}`);
        }
      }
    }

    // Final verification
    console.log('\n🔍 Final verification...');
    const finalCheck = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (finalCheck.ok) {
      const finalData = await finalCheck.json();
      console.log(`📊 Final record count: ${finalData.length}`);
      
      if (finalData.length === 0) {
        console.log('🎉 SUCCESS! Table is now empty');
      } else {
        console.log('⚠️ Records still remain - there may be RLS policies preventing deletion');
      }
    }

  } catch (error) {
    console.error('❌ Error during truncation:', error.message);
  }
}

async function main() {
  console.log('🚀 AGGRESSIVE TABLE TRUNCATION ATTEMPT');
  console.log('🎯 Trying multiple methods to empty mp_staking_hourly');
  
  await truncateTable();
  
  console.log('\n💡 If records still remain, it may be due to Supabase RLS policies');
}

main().catch(console.error);