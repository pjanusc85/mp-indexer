import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const STAKING_TX_HASH = '0xfbbfcfd022bae6860e2ecf4194cbe165f387ca5c917cf9879236fe757907403c';
const NEW_MP_CONTRACT = '0x9Ea9FA0e1605382aE217966173E26E2f5EE73ac6';

async function debugMPStakingEvents() {
  console.log('🔍 DEBUGGING MP STAKING EVENT DETECTION');
  console.log('═══════════════════════════════════════════════');
  console.log(`🎯 Your staking transaction: ${STAKING_TX_HASH}`);
  console.log(`🏦 MP Staking contract: ${NEW_MP_CONTRACT}`);
  console.log('');
  
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Step 1: Get your transaction details again
    console.log('📊 STEP 1: Transaction Analysis');
    console.log('═══════════════════════════════════════');
    
    const tx = await provider.getTransaction(STAKING_TX_HASH);
    const receipt = await provider.getTransactionReceipt(STAKING_TX_HASH);
    const block = await provider.getBlock(tx.blockNumber);
    
    console.log(`Block: ${tx.blockNumber}`);
    console.log(`Transaction successful: ${receipt.status === 1 ? '✅' : '❌'}`);
    console.log(`Events found: ${receipt.logs.length}`);
    console.log('');
    
    // Step 2: Check if indexer has processed this block
    console.log('🔍 STEP 2: Indexer Progress Check');
    console.log('═══════════════════════════════════════');
    
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const indexerStateUrl = `${SUPABASE_URL}/rest/v1/indexer_state?select=*&order=last_updated.desc&limit=1`;
    const stateResponse = await fetch(indexerStateUrl, { headers });
    
    if (stateResponse.ok) {
      const stateData = await stateResponse.json();
      if (stateData.length > 0) {
        const lastIndexedBlock = stateData[0].last_block;
        console.log(`Last indexed block: ${lastIndexedBlock}`);
        console.log(`Your transaction block: ${tx.blockNumber}`);
        console.log(`Has been processed: ${lastIndexedBlock >= tx.blockNumber ? '✅ YES' : '❌ NO'}`);
        
        if (lastIndexedBlock < tx.blockNumber) {
          console.log(`❌ Indexer needs ${tx.blockNumber - lastIndexedBlock} more blocks to reach your transaction`);
        }
      }
    }
    console.log('');
    
    // Step 3: Check what the MP staking indexer is actually looking for
    console.log('🔍 STEP 3: MP Staking Event Detection Logic');
    console.log('═══════════════════════════════════════════');
    
    // Check the current alchemy-cron.js logic for MP staking
    console.log('Current indexer should be looking for:');
    console.log(`✅ Events from contract: ${NEW_MP_CONTRACT}`);
    console.log('');
    
    console.log('Your transaction events:');
    let mpContractEvents = 0;
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === NEW_MP_CONTRACT.toLowerCase()) {
        mpContractEvents++;
        console.log(`📝 Event ${mpContractEvents}: ${log.topics[0]}`);
        console.log(`   Data: ${log.data.substring(0, 50)}...`);
      }
    }
    
    console.log(`\nMP contract events found: ${mpContractEvents}`);
    
    if (mpContractEvents === 0) {
      console.log('❌ NO MP staking contract events found in your transaction!');
      console.log('   This means your transaction might not be a direct staking transaction');
      console.log('   Or it\'s interacting through a different contract');
    }
    console.log('');
    
    // Step 4: Check current MP staking data in database
    console.log('📊 STEP 4: Current MP Staking Database Records');
    console.log('═══════════════════════════════════════════');
    
    const mpStakingUrl = `${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*&order=hour.desc&limit=5`;
    const mpStakingResponse = await fetch(mpStakingUrl, { headers });
    
    if (mpStakingResponse.ok) {
      const mpStakingData = await mpStakingResponse.json();
      console.log(`Total MP staking records: ${mpStakingData.length}`);
      
      if (mpStakingData.length > 0) {
        console.log('Latest records:');
        mpStakingData.forEach((record, i) => {
          console.log(`${i + 1}. ${record.hour}`);
          console.log(`   Total staked: ${record.total_staked_mp || 0} MP`);
          console.log(`   Unique stakers: ${record.unique_stakers || 0}`);
          console.log(`   Created: ${record.created_at}`);
        });
      } else {
        console.log('❌ No MP staking records found in database');
      }
    }
    console.log('');
    
    // Step 5: Manual event search in block range
    console.log('🔍 STEP 5: Manual Event Search Around Your Transaction');
    console.log('═══════════════════════════════════════════════════');
    
    const searchStart = tx.blockNumber - 5;
    const searchEnd = tx.blockNumber + 5;
    
    console.log(`Searching blocks ${searchStart} to ${searchEnd} for ANY events from MP contract...`);
    
    try {
      const logs = await provider.getLogs({
        address: NEW_MP_CONTRACT,
        fromBlock: `0x${searchStart.toString(16)}`,
        toBlock: `0x${searchEnd.toString(16)}`
      });
      
      console.log(`Found ${logs.length} events from MP staking contract in this range`);
      
      if (logs.length > 0) {
        console.log('Events found:');
        logs.forEach((log, i) => {
          console.log(`${i + 1}. Block ${parseInt(log.blockNumber, 16)}: ${log.topics[0]}`);
          if (log.transactionHash === STAKING_TX_HASH) {
            console.log(`   ✅ THIS IS YOUR TRANSACTION!`);
          }
        });
      } else {
        console.log('❌ No events found from MP staking contract in this block range');
      }
    } catch (error) {
      console.log(`❌ Error searching for events: ${error.message}`);
    }
    
    console.log('');
    console.log('🎯 DIAGNOSIS AND NEXT STEPS');
    console.log('═══════════════════════════════════════');
    
    if (mpContractEvents > 0) {
      console.log('✅ Your transaction HAS MP staking events');
      console.log('💡 Issue likely: Indexer hasn\'t processed your block yet OR event signatures don\'t match');
      console.log('');
      console.log('Recommendations:');
      console.log('1. Wait for indexer to reach block', tx.blockNumber);
      console.log('2. Check if the indexer is using the correct event signatures');
    } else {
      console.log('❌ Your transaction has NO direct MP staking events');
      console.log('💡 This means your staking might be happening through:');
      console.log('   - A different contract (proxy, router, etc.)');
      console.log('   - Multiple transactions');
      console.log('   - Internal contract calls');
      console.log('');
      console.log('Check the Money Protocol frontend to see what contract it\'s actually using for staking!');
    }
    
  } catch (error) {
    console.error('❌ Error debugging MP staking events:', error);
  }
}

debugMPStakingEvents();