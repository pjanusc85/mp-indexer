import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const eventTypesToTry = [
  'mp_stake',
  'mp_claim', 
  'MP_STAKE',
  'MP_CLAIM',
  'MPStake',
  'MPClaim',
  'StakeUpdate',
  'RewardUpdate'
];

async function findValidEventTypes() {
  console.log('🔍 TESTING VALID EVENT TYPES FOR mp_staking_events TABLE');
  console.log('═══════════════════════════════════════════════════════');
  
  for (const eventType of eventTypesToTry) {
    try {
      console.log(`Testing: "${eventType}"`);
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_events`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          event_type: eventType,
          block_number: 9999999,
          transaction_hash: `0xtest${Date.now()}`,
          timestamp: new Date().toISOString(),
          total_mp_staked: 100,
          amount_claimed: null,
          from_address: '0x1234567890123456789012345678901234567890',
          to_address: '0x1234567890123456789012345678901234567890',
          log_index: 0,
          processed_at: new Date().toISOString()
        }])
      });
      
      if (response.ok) {
        console.log(`✅ SUCCESS: "${eventType}" is valid!`);
        
        // Clean up the test record
        await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_events?transaction_hash=like.0xtest*`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        
      } else {
        const errorText = await response.text();
        if (errorText.includes('mp_staking_events_event_type_check')) {
          console.log(`❌ INVALID: "${eventType}" - constraint violation`);
        } else {
          console.log(`❌ ERROR: "${eventType}" - ${errorText}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ ERROR: "${eventType}" - ${error.message}`);
    }
  }
}

findValidEventTypes();