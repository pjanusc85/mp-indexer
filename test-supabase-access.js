import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function testSupabaseAccess() {
  console.log('🔍 Testing Supabase access for balance tracking data...');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing environment variables');
    return;
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Check hourly balance data
    console.log('📊 Testing pool_balance_hourly table...');
    const hourlyUrl = `${SUPABASE_URL}/rest/v1/pool_balance_hourly?select=*&order=hour.desc&limit=10`;
    const hourlyResponse = await fetch(hourlyUrl, { headers });
    
    if (hourlyResponse.ok) {
      const hourlyData = await hourlyResponse.json();
      console.log(`✅ Found ${hourlyData.length} hourly balance records`);
      
      if (hourlyData.length > 0) {
        console.log('Sample record:', JSON.stringify(hourlyData[0], null, 2));
      }
    } else {
      console.error(`❌ Hourly data fetch failed: ${hourlyResponse.status}`);
    }

    // Test 2: Check current balances view
    console.log('💰 Testing pool_balances_current view...');
    const currentUrl = `${SUPABASE_URL}/rest/v1/pool_balances_current?select=*`;
    const currentResponse = await fetch(currentUrl, { headers });
    
    if (currentResponse.ok) {
      const currentData = await currentResponse.json();
      console.log(`✅ Found ${currentData.length} current balance records`);
      
      if (currentData.length > 0) {
        console.log('Current balances:');
        currentData.forEach(record => {
          console.log(`  ${record.pool_type}: ${record.current_balance_btc} BTC`);
        });
      }
    } else {
      console.error(`❌ Current balances fetch failed: ${currentResponse.status}`);
    }

    // Test 3: Check balance events table  
    console.log('📝 Testing pool_balance_events table...');
    const eventsUrl = `${SUPABASE_URL}/rest/v1/pool_balance_events?select=*&order=timestamp.desc&limit=5`;
    const eventsResponse = await fetch(eventsUrl, { headers });
    
    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      console.log(`✅ Found ${eventsData.length} balance event records`);
    } else {
      console.error(`❌ Balance events fetch failed: ${eventsResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Error testing Supabase access:', error);
  }
}

testSupabaseAccess();