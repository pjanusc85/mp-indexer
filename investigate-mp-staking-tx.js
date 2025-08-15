import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const STAKING_TX_HASH = '0xfbbfcfd022bae6860e2ecf4194cbe165f387ca5c917cf9879236fe757907403c';

const CONTRACTS = {
  mpStaking: '0x6651E5d0C04CBefCa1ce9eDDd479BA8f7B4A6976',
  mpToken: '0x08a181f4Fc6C78258fFbaf166f2C7326DCc3C946'
};

async function investigateMPStakingTx() {
  console.log('🔍 INVESTIGATING MP STAKING TRANSACTION');
  console.log('═══════════════════════════════════════════════');
  console.log(`🎯 Transaction: ${STAKING_TX_HASH}`);
  console.log('🔍 Goal: Find out why this staking isn\'t showing in database');
  console.log('');
  
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Step 1: Get transaction details
    console.log('📊 STEP 1: Transaction Analysis');
    console.log('════════════════════════════════════════');
    
    const tx = await provider.getTransaction(STAKING_TX_HASH);
    const receipt = await provider.getTransactionReceipt(STAKING_TX_HASH);
    
    if (!tx || !receipt) {
      console.log('❌ Transaction not found or failed');
      return;
    }
    
    const block = await provider.getBlock(tx.blockNumber);
    
    console.log(`📝 Transaction Details:`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Value: ${ethers.formatEther(tx.value)} BTC`);
    console.log(`   Block: ${tx.blockNumber}`);
    console.log(`   Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`   Timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
    console.log('');
    
    // Step 2: Check if transaction is to MP Staking contract
    console.log('🏦 STEP 2: Contract Verification');
    console.log('═══════════════════════════════════════');
    
    const isToMPStaking = tx.to && tx.to.toLowerCase() === CONTRACTS.mpStaking.toLowerCase();
    const isToMPToken = tx.to && tx.to.toLowerCase() === CONTRACTS.mpToken.toLowerCase();
    
    console.log(`MP Staking Contract: ${CONTRACTS.mpStaking}`);
    console.log(`Transaction to MP Staking: ${isToMPStaking ? '✅ YES' : '❌ NO'}`);
    console.log(`Transaction to MP Token: ${isToMPToken ? '✅ YES' : '❌ NO'}`);
    
    if (tx.to) {
      console.log(`Actual destination: ${tx.to}`);
    }
    console.log('');
    
    // Step 3: Analyze transaction logs/events
    console.log('📋 STEP 3: Transaction Events Analysis');
    console.log('═════════════════════════════════════════');
    
    console.log(`Found ${receipt.logs.length} events in transaction:`);
    
    const mpStakingEvents = [];
    const mpTokenEvents = [];
    
    for (const log of receipt.logs) {
      console.log(`📝 Event ${receipt.logs.indexOf(log) + 1}:`);
      console.log(`   Contract: ${log.address}`);
      console.log(`   Topics: ${log.topics.length} topics`);
      console.log(`   Topic[0]: ${log.topics[0]} (event signature)`);
      
      // Check if event is from MP Staking contract
      if (log.address.toLowerCase() === CONTRACTS.mpStaking.toLowerCase()) {
        mpStakingEvents.push(log);
        console.log(`   🎯 MP STAKING EVENT FOUND!`);
      }
      
      // Check if event is from MP Token contract
      if (log.address.toLowerCase() === CONTRACTS.mpToken.toLowerCase()) {
        mpTokenEvents.push(log);
        console.log(`   💰 MP TOKEN EVENT FOUND!`);
      }
      
      console.log('');
    }
    
    console.log(`🎯 MP Staking Events Found: ${mpStakingEvents.length}`);
    console.log(`💰 MP Token Events Found: ${mpTokenEvents.length}`);
    console.log('');
    
    // Step 4: Check if transaction is in our indexing range
    console.log('🔍 STEP 4: Indexing Range Check');
    console.log('════════════════════════════════════════');
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    console.log(`Transaction block: ${tx.blockNumber}`);
    console.log(`Blocks behind: ${currentBlock - tx.blockNumber}`);
    
    // Check our indexer state
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
        console.log(`Transaction block: ${tx.blockNumber}`);
        
        if (tx.blockNumber > lastIndexedBlock) {
          console.log(`❌ ISSUE FOUND: Transaction is AFTER last indexed block!`);
          console.log(`   Indexer needs to process ${tx.blockNumber - lastIndexedBlock} more blocks`);
        } else {
          console.log(`✅ Transaction block is within indexed range`);
        }
      }
    }
    console.log('');
    
    // Step 5: Check if events exist in our database
    console.log('🗄️ STEP 5: Database Check');
    console.log('═══════════════════════════════════════');
    
    // Check mp_staking_hourly table
    const mpStakingUrl = `${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*&order=hour.desc&limit=10`;
    const mpStakingResponse = await fetch(mpStakingUrl, { headers });
    
    if (mpStakingResponse.ok) {
      const mpStakingData = await mpStakingResponse.json();
      console.log(`📊 MP Staking records in database: ${mpStakingData.length}`);
      
      if (mpStakingData.length > 0) {
        console.log(`Latest record: ${mpStakingData[0].hour}`);
        console.log(`Latest amount: ${mpStakingData[0].total_staked_mp || 0} MP`);
      }
    }
    
    // Check if this specific transaction hash exists anywhere
    const allTablesQueries = [
      'vault_events',
      'mp_staking_hourly', 
      'tvl_snapshots'
    ];
    
    console.log('🔍 Searching for transaction hash in all tables...');
    
    for (const table of allTablesQueries) {
      try {
        const searchUrl = `${SUPABASE_URL}/rest/v1/${table}?select=*&transaction_hash=eq.${STAKING_TX_HASH}`;
        const searchResponse = await fetch(searchUrl, { headers });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log(`   ${table}: ${searchData.length} records`);
          
          if (searchData.length > 0) {
            console.log(`   ✅ FOUND in ${table}!`);
          }
        }
      } catch (error) {
        // Skip tables that don't have transaction_hash column
        continue;
      }
    }
    console.log('');
    
    // Step 6: Trigger indexer to catch up
    console.log('🚀 STEP 6: Trigger Indexer');
    console.log('════════════════════════════════════════');
    
    console.log('Triggering indexer to process recent blocks...');
    
    try {
      const indexerResponse = await fetch('https://mp-indexer.vercel.app/api/alchemy-cron', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (indexerResponse.ok) {
        const indexerResult = await indexerResponse.json();
        console.log('✅ Indexer triggered successfully');
        console.log(`📊 Result: ${indexerResult.message || 'Processing completed'}`);
        
        if (indexerResult.results) {
          console.log(`   Vault events: ${indexerResult.results.vaultEvents || 0}`);
          console.log(`   MP staking updated: ${indexerResult.results.mpStakingUpdated ? '✅' : '❌'}`);
        }
      } else {
        console.log('❌ Failed to trigger indexer');
      }
    } catch (error) {
      console.log(`❌ Error triggering indexer: ${error.message}`);
    }
    
    console.log('');
    console.log('🎯 DIAGNOSIS SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Transaction: ${STAKING_TX_HASH}`);
    console.log(`Block: ${tx.blockNumber}`);
    console.log(`To MP Staking: ${isToMPStaking ? '✅' : '❌'}`);
    console.log(`MP Events: ${mpStakingEvents.length + mpTokenEvents.length}`);
    console.log(`Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    console.log('');
    
    if (!isToMPStaking && !isToMPToken) {
      console.log('💡 POSSIBLE ISSUE: Transaction is not to MP contracts');
      console.log('   The indexer only tracks MP Staking contract events');
    } else if (mpStakingEvents.length === 0 && mpTokenEvents.length === 0) {
      console.log('💡 POSSIBLE ISSUE: No MP-related events found');
      console.log('   Transaction might not have triggered staking events');
    } else {
      console.log('✅ Transaction looks valid for MP staking');
      console.log('   Check if indexer has processed this block range');
    }
    
  } catch (error) {
    console.error('❌ Error investigating MP staking transaction:', error);
  }
}

investigateMPStakingTx();