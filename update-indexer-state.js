import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const TARGET_BLOCK = 6713800; // Close to your transaction block (6713815)

async function updateIndexerState() {
  console.log('🔧 UPDATING INDEXER STATE');
  console.log('═══════════════════════════════════════════════');
  console.log(`🎯 Goal: Update indexer to start from block ${TARGET_BLOCK}`);
  console.log('This will make the indexer process recent blocks including your MP staking transaction');
  console.log('');
  
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // First, check current indexer state
    console.log('📊 CURRENT INDEXER STATE:');
    const currentStateUrl = `${SUPABASE_URL}/rest/v1/indexer_state?select=*&order=last_updated.desc&limit=1`;
    const currentStateResponse = await fetch(currentStateUrl, { headers });
    
    if (currentStateResponse.ok) {
      const currentState = await currentStateResponse.json();
      if (currentState.length > 0) {
        console.log(`   Current last block: ${currentState[0].last_block}`);
        console.log(`   Last updated: ${currentState[0].last_updated}`);
        console.log(`   Contract: ${currentState[0].contract_address}`);
      }
    }
    
    console.log('');
    console.log('🔄 UPDATING INDEXER STATE:');
    
    // Update the indexer state to start from recent blocks
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        contract_address: '0x0eccca821f078f394f2bb1f3d615ad73729a9892', // Vault Manager
        last_block: TARGET_BLOCK,
        last_updated: new Date().toISOString()
      })
    });
    
    if (updateResponse.ok) {
      console.log(`✅ Updated indexer state to block ${TARGET_BLOCK}`);
    } else {
      console.log(`❌ Failed to update indexer state: ${updateResponse.status}`);
    }
    
    console.log('');
    console.log('🚀 TRIGGERING INDEXER:');
    console.log('This will now process blocks including your MP staking transaction...');
    
    // Trigger the indexer multiple times to process recent blocks
    for (let i = 0; i < 3; i++) {
      console.log(`\nRun ${i + 1}: Triggering indexer...`);
      
      const indexerResponse = await fetch('https://mp-indexer.vercel.app/api/alchemy-cron', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (indexerResponse.ok) {
        const result = await indexerResponse.json();
        console.log(`✅ Indexer run ${i + 1} completed`);
        console.log(`   Processed range: ${result.processedRange || 'N/A'}`);
        console.log(`   MP staking updated: ${result.results?.mpStakingUpdated ? '✅' : '❌'}`);
        console.log(`   Current block: ${result.currentBlock || 'N/A'}`);
        
        // Check if we've reached the target block
        if (result.processedRange) {
          const endBlock = parseInt(result.processedRange.split('-')[1]);
          if (endBlock >= 6713815) {
            console.log('🎉 Reached your transaction block!');
            break;
          }
        }
      } else {
        console.log(`❌ Indexer run ${i + 1} failed`);
      }
      
      // Wait between runs
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('');
    console.log('📊 CHECKING MP STAKING DATA:');
    
    // Check if MP staking data now exists
    const mpStakingUrl = `${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*&order=hour.desc&limit=5`;
    const mpStakingResponse = await fetch(mpStakingUrl, { headers });
    
    if (mpStakingResponse.ok) {
      const mpStakingData = await mpStakingResponse.json();
      console.log(`📈 MP Staking records: ${mpStakingData.length}`);
      
      if (mpStakingData.length > 0) {
        console.log('Latest records:');
        mpStakingData.forEach((record, i) => {
          console.log(`   ${i + 1}. ${record.hour} - ${record.total_staked_mp || 0} MP staked`);
        });
      }
    }
    
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Check Streamlit dashboard for updated MP staking data');
    console.log('2. Your staking transaction should now appear in the database');
    console.log('3. If still not showing, the indexer may need the correct event signatures');
    
  } catch (error) {
    console.error('❌ Error updating indexer state:', error);
  }
}

updateIndexerState();