import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function cleanupRLSProtected() {
  if (!SUPABASE_URL) {
    console.log('❌ Supabase URL not configured');
    return;
  }

  console.log('🔒 CLEANING UP RLS-PROTECTED mp_staking_hourly RECORDS');

  // Try with service role key first (bypasses RLS), then fallback to anon key
  let apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  let keyType = SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON';

  if (!apiKey) {
    console.log('❌ No Supabase keys configured');
    return;
  }

  console.log(`🔑 Using ${keyType} key to bypass RLS policies`);

  try {
    // First, let's see what records exist
    console.log('\n1️⃣ Checking current records...');
    const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    if (checkResponse.ok) {
      const records = await checkResponse.json();
      console.log(`📊 Found ${records.length} records to delete:`);
      records.forEach(r => console.log(`   - ID ${r.id}: ${r.hour} (MP Staked: ${r.total_mp_staked})`));

      if (records.length === 0) {
        console.log('🎉 Table is already empty!');
        return;
      }

      // Delete using service role key with a broad filter
      console.log('\n2️⃣ Attempting deletion with service role privileges...');
      
      const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?hour=gte.2020-01-01T00:00:00.000Z`, {
        method: 'DELETE',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Prefer': 'return=representation'
        }
      });

      if (deleteResponse.ok) {
        const deletedData = await deleteResponse.text();
        console.log('✅ Deletion request successful');
        
        // Verify deletion worked
        console.log('\n3️⃣ Verifying deletion...');
        const verifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*`, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
          }
        });

        if (verifyResponse.ok) {
          const remainingRecords = await verifyResponse.json();
          console.log(`📊 Records remaining: ${remainingRecords.length}`);
          
          if (remainingRecords.length === 0) {
            console.log('🎉 SUCCESS! All RLS-protected records deleted');
          } else {
            console.log('⚠️ Some records still remain:');
            remainingRecords.forEach(r => console.log(`   - ID ${r.id}: ${r.hour}`));
          }
        }
      } else {
        const error = await deleteResponse.text();
        console.log(`❌ Deletion failed: ${error}`);
      }

    } else {
      const error = await checkResponse.text();
      console.log(`❌ Failed to check records: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error during RLS cleanup:', error.message);
  }
}

async function main() {
  console.log('🚀 RLS-PROTECTED RECORD CLEANUP');
  console.log('🎯 Targeting mp_staking_hourly table with admin privileges');
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️ SERVICE_ROLE_KEY not found, will try with ANON_KEY (may fail due to RLS)');
  }
  
  await cleanupRLSProtected();
  
  console.log('\n✅ RLS cleanup attempt completed');
  console.log('💡 If records still remain, manual deletion via Supabase dashboard is needed');
}

main().catch(console.error);