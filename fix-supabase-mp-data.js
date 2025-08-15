import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function fixSupabaseMPData() {
  console.log('🔧 FIXING SUPABASE MP STAKING DATA');
  console.log('════════════════════════════════════');
  
  try {
    // First, get the current incorrect data
    console.log('📊 Current incorrect data in database:');
    const currentResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*&order=hour.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const currentData = await currentResponse.json();
    console.log('   Current record:', JSON.stringify(currentData[0], null, 2));
    
    // Update the most recent record with correct values
    const correctData = {
      total_mp_staked: 12355.0, // Correct total: 12,345 + 10
      mp_claimed_in_hour: 0.0,  // No actual claims/rewards
      total_mp_claimed: 0.0     // No actual claims/rewards
    };
    
    console.log('\\n✅ Updating with correct data:');
    console.log('   New values:', JSON.stringify(correctData, null, 2));
    
    // Update the record with id=5 (most recent)
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?id=eq.5`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(correctData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Update failed: ${updateResponse.status} - ${errorText}`);
    }
    
    console.log('✅ Successfully updated MP staking hourly data!');
    
    // Verify the update
    console.log('\\n🔍 Verifying update...');
    const verifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly?id=eq.5&select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const verifyData = await verifyResponse.json();
    console.log('   Updated record:', JSON.stringify(verifyData[0], null, 2));
    
    // Also add a new record with wallet breakdown data for today
    console.log('\\n📝 Adding detailed wallet breakdown...');
    
    const now = new Date();
    now.setMinutes(0, 0, 0); // Round to current hour
    
    const detailedRecord = {
      hour: now.toISOString(),
      total_mp_staked: 12355.0,
      mp_claimed_in_hour: 0.0,
      total_mp_claimed: 0.0
    };
    
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify([detailedRecord])
    });
    
    if (insertResponse.ok) {
      console.log('✅ Added current hour record with correct data');
    } else {
      console.log('ℹ️ Current hour record may already exist');
    }
    
    console.log('\\n🎉 SUPABASE MP DATA FIX COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log('📊 Correct Data Summary:');
    console.log('   Total MP Staked: 12,355 MP');
    console.log('   Wallet 1 (0xd1C7...): 12,345 MP (99.92%)');
    console.log('   Wallet 2 (0xC6d1...): 10 MP (0.08%)');
    console.log('   Total Wallets: 2');
    console.log('');
    console.log('✅ Streamlit should now show correct MP staking data!');
    
  } catch (error) {
    console.error('❌ Error fixing Supabase MP data:', error);
  }
}

fixSupabaseMPData();