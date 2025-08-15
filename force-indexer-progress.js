import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function forceIndexerProgress() {
  console.log('🚀 FORCING INDEXER TO ADVANCE TO YOUR TRANSACTION BLOCK');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎯 Goal: Update indexer state to block 6713700 to reach your transaction at 6713815');
  console.log('');
  
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    console.log('🗑️ STEP 1: Clear old indexer state');
    
    // Delete existing indexer state to force reset
    const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Prefer': 'return=minimal'
      }
    });
    
    console.log(`Delete result: ${deleteResponse.ok ? '✅ Success' : '❌ Failed'}`);
    
    console.log('');
    console.log('🔧 STEP 2: Set indexer to start close to your transaction');
    
    // Set indexer to start from block 6713700 (close to your transaction at 6713815)
    const targetBlock = 6713700;
    
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contract_address: '0x0eccca821f078f394f2bb1f3d615ad73729a9892',
        last_block: targetBlock,
        last_updated: new Date().toISOString()
      })
    });
    
    if (insertResponse.ok) {
      console.log(`✅ Set indexer to start from block ${targetBlock}`);
    } else {
      console.log(`❌ Failed to set indexer state: ${insertResponse.status}`);
      const errorText = await insertResponse.text();
      console.log(`Error: ${errorText}`);
    }
    
    console.log('');
    console.log('🚀 STEP 3: Trigger indexer to process blocks toward your transaction');
    
    for (let i = 0; i < 3; i++) {
      console.log(`\n--- Run ${i + 1} ---`);
      
      const indexerResponse = await fetch('https://mp-indexer.vercel.app/api/alchemy-cron', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (indexerResponse.ok) {
        const result = await indexerResponse.json();
        console.log(`✅ Processed: ${result.processedRange || 'N/A'}`);
        console.log(`   MP staking: ${result.results?.mpStakingUpdated ? '✅' : '❌'}`);
        
        // Check if we've reached your transaction block
        if (result.processedRange) {
          const endBlock = parseInt(result.processedRange.split('-')[1]);
          console.log(`   End block: ${endBlock}`);
          
          if (endBlock >= 6713815) {
            console.log('🎉 SUCCESS: Reached your transaction block 6713815!');
            console.log('   Your MP staking should now be detected!');
            break;
          } else {
            const remaining = 6713815 - endBlock;
            console.log(`   ${remaining} blocks remaining to reach your transaction`);
          }
        }
      } else {
        console.log(`❌ Indexer run ${i + 1} failed: ${indexerResponse.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('');
    console.log('📊 STEP 4: Check for MP staking data');
    
    const mpStakingUrl = `${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*&order=hour.desc&limit=5`;
    const mpStakingResponse = await fetch(mpStakingUrl, { headers });
    
    if (mpStakingResponse.ok) {
      const mpStakingData = await mpStakingResponse.json();
      console.log(`📈 MP staking records: ${mpStakingData.length}`);
      
      const recentRecords = mpStakingData.filter(record => {
        const recordTime = new Date(record.hour);
        const now = new Date();
        const diffHours = (now - recordTime) / (1000 * 60 * 60);
        return diffHours < 6; // Last 6 hours
      });
      
      console.log(`📊 Recent records (last 6 hours): ${recentRecords.length}`);
      
      if (recentRecords.length > 0) {
        console.log('🎉 FOUND RECENT MP STAKING DATA!');
        recentRecords.forEach((record, i) => {
          console.log(`${i + 1}. ${record.hour}`);
          console.log(`   Events: ${record.event_count || 0}`);
          console.log(`   Block range: ${record.block_range || 'N/A'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error forcing indexer progress:', error);
  }
}

forceIndexerProgress();