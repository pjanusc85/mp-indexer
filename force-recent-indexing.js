import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function forceRecentIndexing() {
  console.log('🚀 FORCING INDEXER TO PROCESS RECENT BLOCKS');
  console.log('═══════════════════════════════════════════════');
  console.log('🎯 Goal: Delete old indexer state and force processing of recent blocks');
  console.log('');
  
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // Step 1: Delete all indexer state to force reset
    console.log('🗑️ STEP 1: Clearing indexer state');
    
    const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Prefer': 'return=minimal'
      }
    });
    
    if (deleteResponse.ok) {
      console.log('✅ Deleted old indexer state');
    } else {
      console.log(`⚠️ Could not delete indexer state: ${deleteResponse.status}`);
    }
    
    console.log('');
    console.log('🔄 STEP 2: Setting new indexer state close to recent blocks');
    
    // Set indexer to start from a recent block (but not too recent to avoid missing events)
    const recentStartBlock = 6713000; // Start before your transaction block
    
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contract_address: '0x0eccca821f078f394f2bb1f3d615ad73729a9892',
        last_block: recentStartBlock,
        last_updated: new Date().toISOString()
      })
    });
    
    if (insertResponse.ok) {
      console.log(`✅ Set indexer to start from block ${recentStartBlock}`);
    } else {
      console.log(`❌ Failed to set new indexer state: ${insertResponse.status}`);
    }
    
    console.log('');
    console.log('🚀 STEP 3: Triggering indexer multiple times');
    console.log('This should now process blocks including your MP staking transaction...');
    
    for (let i = 0; i < 5; i++) {
      console.log(`\n--- Run ${i + 1} ---`);
      
      const indexerResponse = await fetch('https://mp-indexer.vercel.app/api/alchemy-cron', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (indexerResponse.ok) {
        const result = await indexerResponse.json();
        console.log(`✅ Completed: ${result.processedRange || 'N/A'}`);
        
        if (result.results) {
          console.log(`   MP staking: ${result.results.mpStakingUpdated ? '✅' : '❌'}`);
          console.log(`   Vault events: ${result.results.vaultEvents || 0}`);
        }
        
        // Check if we've reached your transaction block
        if (result.processedRange) {
          const endBlock = parseInt(result.processedRange.split('-')[1]);
          console.log(`   Processed up to block: ${endBlock}`);
          
          if (endBlock >= 6713815) {
            console.log('🎉 SUCCESS: Reached your transaction block 6713815!');
            break;
          }
        }
      } else {
        console.log(`❌ Run ${i + 1} failed: ${indexerResponse.status}`);
      }
      
      // Wait between runs
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('');
    console.log('📊 STEP 4: Checking for your MP staking data');
    
    // Check MP staking data again
    const mpStakingUrl = `${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*&order=hour.desc&limit=10`;
    const mpStakingResponse = await fetch(mpStakingUrl, { headers });
    
    if (mpStakingResponse.ok) {
      const mpStakingData = await mpStakingResponse.json();
      console.log(`📈 Total MP staking records: ${mpStakingData.length}`);
      
      // Look for recent records
      const now = new Date();
      const todayRecords = mpStakingData.filter(record => {
        const recordDate = new Date(record.hour);
        const diffHours = (now - recordDate) / (1000 * 60 * 60);
        return diffHours < 24; // Last 24 hours
      });
      
      console.log(`📊 Records from last 24 hours: ${todayRecords.length}`);
      
      if (todayRecords.length > 0) {
        console.log('Recent records:');
        todayRecords.forEach((record, i) => {
          console.log(`   ${i + 1}. ${record.hour}`);
          console.log(`      Total staked: ${record.total_staked_mp || 0} MP`);
          console.log(`      Stakers: ${record.unique_stakers || 0}`);
        });
      }
    }
    
    console.log('');
    console.log('🎯 FINAL STATUS:');
    console.log('If your MP staking data still doesn\'t appear, it means:');
    console.log('1. The indexer needs the correct event signatures for the new contract');
    console.log('2. Or the contract integration needs to be updated');
    console.log('');
    console.log('Your transaction: 0xfbbfcfd022bae6860e2ecf4194cbe165f387ca5c917cf9879236fe757907403c');
    console.log('Should now be processed by the indexer!');
    
  } catch (error) {
    console.error('❌ Error forcing recent indexing:', error);
  }
}

forceRecentIndexing();