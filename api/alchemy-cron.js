import { ethers } from 'ethers';
// Removed unreliable src/contracts import - implementing MP staking logic directly
import { 
  getPoolBalanceChanges, 
  calculateHourlyBalances, 
  saveBalanceEvents, 
  saveHourlyBalances,
  getDetailedBalanceEvents 
} from '../src/contracts/BalanceTracker.js';

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CONTRACTS = {
  vaultManager: process.env.VAULT_MANAGER_ADDRESS || '0xf1df1d059E67E19b270b083bd13AC791C573968b',
  borrowerOperations: process.env.BORROWER_OPERATIONS_ADDRESS || '0xf721a6c73676628Bb708Ee6Cfe7f9e2328a020eF',
  sortedVaults: process.env.SORTED_VAULTS_ADDRESS || '0x045cf0431C72AA2bcF100f730e3226Ef4dbF7486',
  activePool: process.env.ACTIVE_POOL_ADDRESS || '0x4C02Dc259a09B759Ef20013697d4465203f8Fac0',
  stabilityPool: process.env.STABILITY_POOL_ADDRESS || '0xdA30a81004d4530e4C632D3Fa11F53558dB6209b',
  mpStaking: process.env.MP_STAKING_ADDRESS || '0x614720C2D9dA3e2eC10F1214bD9e8Cb0fe06123D',
  mpToken: process.env.MP_TOKEN_ADDRESS || '0x411a65a1db8693529Dbb3bbf13814B4464EbcE97B'
};

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10',
  
  // MP Staking event signatures from actual transactions
  MPStake: '0x6b5cf27595af4428271524e0a5abd2b63f6fee1a61e31970490f5a10e257a1cd',
  MPStakeUpdate: '0x35f39baa268d9f8633216b097bd56e9e819f581f96b99f9a2a7cb8b91d93e858',
  MPRewardUpdate: '0x39df0e5286a3ef2f42a0bf52f32cfe2c58e5b0405f47fe512f2c2439e4cfe204',
  MPBalanceUpdate: '0xf744d34ca1cb25acfa4180df5f09a67306107110a9f4b6ed99bb3be259738215'
};

// === VAULT EVENT INDEXING ===
async function getLastIndexedBlock() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state?select=last_block&order=updated_at.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // If no data or block is too old, start from recent block to catch MP staking
    const lastBlock = data.length > 0 ? data[0].last_block : 6713000;
    return lastBlock < 6713000 ? 6713000 : lastBlock;
  } catch (error) {
    console.error('Error getting last indexed block:', error);
    return 6713000; // Updated fallback to recent block
  }
}

async function updateLastIndexedBlock(blockNumber) {
  try {
    // First try to update existing record (id=2 based on current state)
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state?id=eq.2`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        last_block: blockNumber,
        updated_at: new Date().toISOString()
      })
    });

    if (updateResponse.ok) {
      console.log(`✅ Updated last processed block to ${blockNumber}`);
    } else {
      console.log(`⚠️ Update failed: ${updateResponse.status}`);
      // If update fails, try insert
      const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          last_block: blockNumber,
          updated_at: new Date().toISOString()
        })
      });
      
      if (insertResponse.ok) {
        console.log(`✅ Created new indexer state at block ${blockNumber}`);
      } else {
        throw new Error(`Both update and insert failed: ${insertResponse.status}`);
      }
    }
  } catch (error) {
    console.error('❌ Error updating last indexed block:', error);
  }
}

async function saveVaultEvent(eventData) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/vault_events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) {
      if (response.status === 409) {
        console.log(`📝 ${eventData.event_type} event already exists in database`);
        return true;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`✅ Saved ${eventData.event_type} event to Supabase`);
    return true;
  } catch (error) {
    console.error('❌ Error saving vault event:', error);
    return false;
  }
}

async function getLogsWithRetry(provider, fromBlock, toBlock, eventType, maxRetries = 3) {
  const filter = {
    address: CONTRACTS.vaultManager,
    topics: [EVENT_SIGNATURES[eventType]],
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: `0x${toBlock.toString(16)}`
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const logs = await provider.send('eth_getLogs', [filter]);
      return logs || [];
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed for ${eventType}:`, error.message);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// === TVL TRACKING ===
async function calculateTVL(blockNumber) {
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    const activePoolBalance = await provider.getBalance(CONTRACTS.activePool, blockNumber);
    const defaultPoolBalance = await provider.getBalance(CONTRACTS.defaultPool, blockNumber);
    
    const totalBTC = ethers.formatEther(activePoolBalance + defaultPoolBalance);
    
    return {
      block_number: blockNumber,
      active_pool_btc: parseFloat(ethers.formatEther(activePoolBalance)),
      default_pool_btc: parseFloat(ethers.formatEther(defaultPoolBalance)),
      total_btc: parseFloat(totalBTC),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error calculating TVL:', error);
    throw error;
  }
}

async function saveTVLSnapshot(tvlData) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tvl_snapshots`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(tvlData)
    });

    if (!response.ok) {
      throw new Error(`TVL save failed: ${response.status}`);
    }

    console.log('✅ TVL snapshot saved');
    return true;
    
  } catch (error) {
    console.error('❌ Error saving TVL snapshot:', error);
    return false;
  }
}

// === STAKING GAINS DATA ===
async function fetchStakingGainsData() {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const url = `${SUPABASE_URL}/rest/v1/staking_gains_daily?select=*&order=day.desc`;
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Retrieved ${data.length} days of staking gains data`);
      return data;
    } else {
      console.warn('⚠️ Staking gains data not available');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching staking gains:', error);
    return [];
  }
}

// === MP STAKING TRACKING ===
async function getMPStakingEventsSimple(provider, fromBlock, toBlock) {
  try {
    const mpStakingContract = CONTRACTS.mpStaking;
    
    // Get all MP staking events from the actual contract
    const allMPEvents = [];
    
    for (const [eventName, signature] of Object.entries(EVENT_SIGNATURES)) {
      if (eventName.startsWith('MP')) {
        try {
          const logs = await provider.getLogs({
            address: mpStakingContract,
            topics: [signature],
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock: `0x${toBlock.toString(16)}`
          });
          
          logs.forEach(log => {
            allMPEvents.push({
              ...log,
              eventType: eventName,
              blockNumber: log.blockNumber
            });
          });
          
        } catch (error) {
          console.warn(`Could not fetch ${eventName} events:`, error.message);
        }
      }
    }
    
    return allMPEvents;
    
  } catch (error) {
    console.error('Error fetching MP staking events:', error);
    return [];
  }
}

async function processMPStakingEventsSimple(events, provider) {
  if (events.length === 0) {
    console.log('📊 No MP staking events to process');
    return { hourlyData: [], individualEvents: [] };
  }
  
  console.log(`🔄 Processing ${events.length} MP staking events...`);
  
  // Group events by hour
  const hourlyData = [];
  const individualEvents = [];
  const currentHour = new Date();
  currentHour.setMinutes(0, 0, 0); // Round to current hour
  
  // Decode actual values from events
  let totalMPStaked = 0;
  let totalMPClaimed = 0;
  let mpClaimedInHour = 0;
  
  for (const event of events) {
    try {
      console.log(`🔍 Decoding event: ${event.eventType} in block ${event.blockNumber}`);
      
      // Get block timestamp and transaction details
      let blockTimestamp = new Date();
      let fromAddress = null;
      let toAddress = null;
      
      try {
        const block = await provider.getBlock(event.blockNumber);
        blockTimestamp = new Date(block.timestamp * 1000);
        
        const tx = await provider.getTransaction(event.transactionHash);
        fromAddress = tx.from;
        toAddress = tx.to;
      } catch (txError) {
        console.warn(`Could not get transaction details for ${event.transactionHash}:`, txError.message);
      }
      
      let eventAmount = 0;
      
      if (event.eventType === 'MPStakeUpdate' && event.data && event.data !== '0x') {
        // MPStakeUpdate contains system totals, not individual amounts - skip for aggregation
        const dataWithoutPrefix = event.data.slice(2);
        if (dataWithoutPrefix.length >= 64) {
          const systemTotal = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
          eventAmount = parseFloat(ethers.formatEther(systemTotal));
          console.log(`  📊 System Total: ${eventAmount} MP (not used for individual tracking)`);
        }
      }
      
      if (event.eventType === 'MPRewardUpdate' && event.data && event.data !== '0x') {
        // MPRewardUpdate contains individual staking amounts (corrected logic)
        const dataWithoutPrefix = event.data.slice(2);
        if (dataWithoutPrefix.length >= 64) {
          const stakingAmount = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
          eventAmount = parseFloat(ethers.formatEther(stakingAmount));
          totalMPStaked += eventAmount; // Add individual staking amounts
          console.log(`  💰 Individual MP Stake: ${eventAmount} MP`);
        }
      }
      
      // Save individual event to database (corrected logic)
      const individualEvent = {
        event_type: event.eventType,
        block_number: event.blockNumber,
        transaction_hash: event.transactionHash,
        timestamp: blockTimestamp.toISOString(),
        total_mp_staked: event.eventType === 'MPRewardUpdate' ? eventAmount : null, // MPRewardUpdate has individual stakes
        amount_claimed: null, // No actual reward claims in these events
        from_address: fromAddress,
        to_address: toAddress,
        log_index: event.logIndex || 0,
        processed_at: new Date().toISOString()
      };
      
      individualEvents.push(individualEvent);
      console.log(`  📝 Prepared individual event: ${event.eventType} - ${eventAmount} MP`);
      
    } catch (error) {
      console.warn(`⚠️ Error decoding event ${event.eventType}:`, error.message);
    }
  }
  
  // Create a record with actual decoded values
  const stakingRecord = {
    hour: currentHour.toISOString(),
    total_mp_staked: totalMPStaked,
    mp_claimed_in_hour: mpClaimedInHour,
    total_mp_claimed: totalMPClaimed
  };
  
  console.log('✅ Created MP staking record with real values:', JSON.stringify(stakingRecord, null, 2));
  console.log(`✅ Created ${individualEvents.length} individual event records`);
  
  hourlyData.push(stakingRecord);
  return { hourlyData, individualEvents };
}

// === MP STAKING TRACKING ===
async function saveMPStakingEvents(eventData) {
  try {
    if (eventData.length === 0) {
      console.log('📊 No MP staking events to save');
      return true;
    }
    
    console.log(`💾 Attempting to save ${eventData.length} MP staking event records...`);
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ MP staking events save failed: ${response.status}`);
      console.error('Response body:', errorText);
      throw new Error(`MP staking events save failed: ${response.status} - ${errorText}`);
    }

    console.log(`✅ Saved ${eventData.length} MP staking event records`);
    return true;
    
  } catch (error) {
    console.error('❌ Error saving MP staking events:', error.message);
    return false;
  }
}

async function saveMPStakingData(stakingData) {
  try {
    if (stakingData.length === 0) {
      console.log('📊 No MP staking data to save');
      return true;
    }
    
    console.log(`💾 Attempting to save ${stakingData.length} MP staking records...`);
    console.log('Data to save:', JSON.stringify(stakingData, null, 2));
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_hourly`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(stakingData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ MP staking save failed: ${response.status}`);
      console.error('Response body:', errorText);
      throw new Error(`MP staking save failed: ${response.status} - ${errorText}`);
    }

    const responseData = await response.text();
    console.log(`✅ Saved ${stakingData.length} MP staking data points`);
    console.log('Save response:', responseData);
    return true;
    
  } catch (error) {
    console.error('❌ Error saving MP staking data:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

async function fetchMPStakingData() {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const url = `${SUPABASE_URL}/rest/v1/mp_staking_hourly?select=*&order=hour.desc&limit=168`; // Last 7 days hourly
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Retrieved ${data.length} hours of MP staking data`);
      return data;
    } else {
      console.warn('⚠️ MP staking data not available');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching MP staking data:', error);
    return [];
  }
}

async function fetchBalanceTrackingData() {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const url = `${SUPABASE_URL}/rest/v1/pool_balance_hourly?select=*&order=hour.desc&limit=168`; // Last 7 days hourly
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Retrieved ${data.length} balance tracking records`);
      return data;
    } else {
      console.warn('⚠️ Balance tracking data not available');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching balance tracking data:', error);
    return [];
  }
}

async function fetchCurrentBalances() {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const url = `${SUPABASE_URL}/rest/v1/pool_balances_current?select=*`;
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Retrieved current balances for ${data.length} pools`);
      return data;
    } else {
      console.warn('⚠️ Current balances data not available');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching current balances:', error);
    return [];
  }
}

async function fetchMPStakingWalletBreakdown(provider) {
  try {
    console.log('👥 Fetching MP staking wallet breakdown...');
    
    // Query recent blocks for MP staking events
    const currentBlock = await provider.getBlockNumber();
    const startBlock = Math.max(currentBlock - 10000, 6801509); // Look back 10k blocks or start from minimum deployment block
    const endBlock = currentBlock;
    
    console.log(`🔍 Scanning blocks ${startBlock} to ${endBlock} for MP staking events...`);
    
    const allStakers = new Map();
    
    // Get all MP staking events from recent blocks
    for (const [eventName, signature] of Object.entries(EVENT_SIGNATURES)) {
      if (eventName.startsWith('MP')) {
        try {
          const logs = await provider.getLogs({
            address: CONTRACTS.mpStaking,
            topics: [signature],
            fromBlock: `0x${startBlock.toString(16)}`,
            toBlock: `0x${endBlock.toString(16)}`
          });
          
          console.log(`   Found ${logs.length} ${eventName} events`);
          
          for (const log of logs) {
            let stakerAddress = null;
            let amount = 0;
            
            // Get transaction to find staker address
            try {
              const tx = await provider.getTransaction(log.transactionHash);
              stakerAddress = tx.from;
            } catch (e) {
              console.warn(`Could not get transaction for ${log.transactionHash}`);
              continue;
            }
            
            // Extract amount from data
            if (log.data && log.data !== '0x') {
              try {
                const dataWithoutPrefix = log.data.slice(2);
                if (dataWithoutPrefix.length >= 64) {
                  const firstValue = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
                  amount = parseFloat(ethers.formatEther(firstValue));
                }
              } catch (e) {
                // Skip if can't decode
              }
            }
            
            // Record staker data
            if (stakerAddress && stakerAddress !== '0x0000000000000000000000000000000000000000') {
              if (!allStakers.has(stakerAddress)) {
                allStakers.set(stakerAddress, {
                  address: stakerAddress,
                  totalStaked: 0,
                  totalRewards: 0,
                  lastActivity: log.blockNumber,
                  transactionCount: 0
                });
              }
              
              const staker = allStakers.get(stakerAddress);
              staker.lastActivity = Math.max(staker.lastActivity, log.blockNumber);
              staker.transactionCount++;
              
              // Update amounts based on event type
              if (eventName === 'MPStakeUpdate') {
                staker.totalStaked = amount; // Current total stake
              } else if (eventName === 'MPRewardUpdate') {
                staker.totalRewards += amount;
              }
            }
          }
          
        } catch (error) {
          console.warn(`Could not fetch ${eventName} events:`, error.message);
        }
      }
    }
    
    // Convert to array and sort by total staked
    const walletBreakdown = Array.from(allStakers.values()).map(staker => ({
      wallet_address: staker.address,
      total_mp_staked: staker.totalStaked,
      total_mp_rewards: staker.totalRewards,
      last_activity_block: staker.lastActivity,
      transaction_count: staker.transactionCount,
      percentage_of_total: 0 // Will calculate below
    })).sort((a, b) => b.total_mp_staked - a.total_mp_staked);
    
    // Calculate percentages
    const totalStaked = walletBreakdown.reduce((sum, w) => sum + w.total_mp_staked, 0);
    walletBreakdown.forEach(wallet => {
      wallet.percentage_of_total = totalStaked > 0 ? (wallet.total_mp_staked / totalStaked * 100) : 0;
    });
    
    console.log(`✅ Found ${walletBreakdown.length} MP staking wallets with total ${totalStaked.toLocaleString()} MP staked`);
    
    return walletBreakdown;
    
  } catch (error) {
    console.error('❌ Error fetching MP staking wallet breakdown:', error);
    return [];
  }
}

// === REDEMPTION GAINS DATA ===
async function fetchRedemptionGainsData() {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const url = `${SUPABASE_URL}/rest/v1/redemption_gains_daily?select=*&order=day.desc`;
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Retrieved ${data.length} days of redemption gains data`);
      return data;
    } else {
      console.warn('⚠️ Redemption gains data not available');
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching redemption gains:', error);
    return [];
  }
}

// === UNIFIED API HANDLER ===
export default async function handler(req, res) {
  console.log(`🚀 Unified Money Protocol Indexer Started - ${new Date().toISOString()}`);
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ 
      error: 'Missing environment variables',
      details: 'SUPABASE_URL and SUPABASE_ANON_KEY are required'
    });
  }

  // Handle different endpoints based on URL path or query parameters
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;
  const endpoint = url.searchParams.get('endpoint') || pathname;
  
  console.log(`🔍 URL Debug: pathname='${pathname}', endpoint='${endpoint}', query=${JSON.stringify(Object.fromEntries(url.searchParams))}`);

  // API endpoint routing
  if (endpoint.includes('daily-staking-gains')) {
    const stakingData = await fetchStakingGainsData();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${stakingData.length} days of staking gains data`,
      data: stakingData
    });
  }

  if (endpoint.includes('redemption-gains')) {
    const redemptionData = await fetchRedemptionGainsData();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${redemptionData.length} days of redemption gains data`,
      data: redemptionData
    });
  }

  if (endpoint.includes('mp-staking-data')) {
    const mpStakingData = await fetchMPStakingData();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${mpStakingData.length} hours of MP staking data`,
      data: mpStakingData
    });
  }

  if (endpoint.includes('balance-tracking-data')) {
    const balanceTrackingData = await fetchBalanceTrackingData();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${balanceTrackingData.length} balance tracking records`,
      data: balanceTrackingData
    });
  }

  if (endpoint.includes('current-balances')) {
    const currentBalances = await fetchCurrentBalances();
    return res.status(200).json({
      success: true,
      message: `Retrieved current balances for ${currentBalances.length} pools`,
      data: currentBalances
    });
  }

  if (endpoint.includes('mp-staking-wallets')) {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const walletBreakdown = await fetchMPStakingWalletBreakdown(provider);
    return res.status(200).json({
      success: true,
      message: `Retrieved MP staking data for ${walletBreakdown.length} wallets`,
      data: walletBreakdown
    });
  }

  // Default: Main indexing functionality
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const lastProcessed = await getLastIndexedBlock();
    
    console.log(`Current block: ${currentBlock}`);
    console.log(`Last processed: ${lastProcessed}`);
    
    if (lastProcessed >= currentBlock) {
      console.log('✅ Already up to date');
      return res.status(200).json({
        message: 'Already up to date',
        currentBlock,
        lastProcessed
      });
    }
    
    const startBlock = lastProcessed + 1;
    const endBlock = Math.min(startBlock + 99, currentBlock); // Process max 100 blocks per run
    
    console.log(`Processing blocks ${startBlock} to ${endBlock}`);
    
    let totalEventsFound = 0;
    let results = {
      vaultEvents: 0,
      tvlUpdated: false,
      stakingGains: 0,
      redemptionGains: 0,
      mpStakingUpdated: false
    };
    
    // 1. Process vault events (main indexing)
    const [vaultUpdatedLogs, vaultLiquidatedLogs] = await Promise.all([
      getLogsWithRetry(provider, startBlock, endBlock, 'VaultUpdated'),
      getLogsWithRetry(provider, startBlock, endBlock, 'VaultLiquidated')
    ]);
    
    // Process VaultUpdated events
    for (const log of vaultUpdatedLogs) {
      const block = await provider.getBlock(parseInt(log.blockNumber, 16));
      
      const eventData = {
        contract_address: log.address.toLowerCase(),
        event_type: 'VaultUpdated',
        transaction_hash: log.transactionHash,
        block_number: parseInt(log.blockNumber, 16),
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        topics: log.topics,
        data: log.data,
        vault_id: log.topics[1] || null,
        processed_at: new Date().toISOString()
      };
      
      console.log(`🎉 Found VaultUpdated event in block ${eventData.block_number}`);
      await saveVaultEvent(eventData);
      totalEventsFound++;
    }
    
    // Process VaultLiquidated events
    for (const log of vaultLiquidatedLogs) {
      const block = await provider.getBlock(parseInt(log.blockNumber, 16));
      
      const eventData = {
        contract_address: log.address.toLowerCase(),
        event_type: 'VaultLiquidated',
        transaction_hash: log.transactionHash,
        block_number: parseInt(log.blockNumber, 16),
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        topics: log.topics,
        data: log.data,
        vault_id: log.topics[1] || null,
        processed_at: new Date().toISOString()
      };
      
      console.log(`🔥 Found VaultLiquidated event in block ${eventData.block_number}`);
      await saveVaultEvent(eventData);
      totalEventsFound++;
    }
    
    results.vaultEvents = totalEventsFound;
    
    // 2. Update TVL snapshot (every run)
    try {
      const tvlData = await calculateTVL(currentBlock);
      const tvlSaved = await saveTVLSnapshot(tvlData);
      results.tvlUpdated = tvlSaved;
    } catch (tvlError) {
      console.warn('⚠️ TVL update failed:', tvlError.message);
    }
    
    // 3. Process MP staking events (using actual event signatures)
    try {
      const mpStakingEvents = await getMPStakingEventsSimple(provider, startBlock, endBlock);
      if (mpStakingEvents.length > 0) {
        console.log(`🎯 Found ${mpStakingEvents.length} MP staking events!`);
        console.log(`   Event types: ${mpStakingEvents.map(e => e.eventType).join(', ')}`);
        
        const { hourlyData, individualEvents } = await processMPStakingEventsSimple(mpStakingEvents, provider);
        
        // Save both hourly aggregated data and individual events
        const hourlyDataSaved = await saveMPStakingData(hourlyData);
        const individualEventsSaved = await saveMPStakingEvents(individualEvents);
        
        results.mpStakingUpdated = hourlyDataSaved && individualEventsSaved;
        
        console.log(`✅ MP staking processed: ${hourlyData.length} hourly records, ${individualEvents.length} individual events`);
        console.log(`✅ Save results: hourly=${hourlyDataSaved}, events=${individualEventsSaved}`);
      } else {
        console.log('📊 No MP staking events found in this block range');
        results.mpStakingUpdated = true; // Mark as successful even if no events
      }
    } catch (mpError) {
      console.warn('⚠️ MP staking update failed:', mpError.message);
      results.mpStakingUpdated = false;
    }

    // 4. Enhanced balance tracking (Dune Analytics style)
    try {
      console.log('📊 Starting balance tracking analysis...');
      
      // Get pool balance changes for the current block range
      const balanceChanges = await getPoolBalanceChanges(provider, startBlock, endBlock);
      
      if (balanceChanges.length > 0) {
        console.log(`🔄 Found ${balanceChanges.length} pool balance changes`);
        
        // Calculate hourly aggregations
        const currentHour = new Date();
        currentHour.setMinutes(0, 0, 0); // Round to current hour
        const hourlyBalances = calculateHourlyBalances(balanceChanges, currentHour.toISOString());
        
        // Save balance events and hourly data
        const balanceEventsSaved = await saveBalanceEvents(balanceChanges, SUPABASE_URL, SUPABASE_ANON_KEY);
        const hourlyBalancesSaved = await saveHourlyBalances(hourlyBalances, SUPABASE_URL, SUPABASE_ANON_KEY);
        
        results.balanceTrackingUpdated = balanceEventsSaved && hourlyBalancesSaved;
        console.log(`✅ Balance tracking: ${balanceChanges.length} events, ${hourlyBalances.length} hourly records`);
      } else {
        console.log('📊 No significant balance changes detected in this block range');
        results.balanceTrackingUpdated = true; // Mark as successful even if no changes
      }
      
    } catch (balanceError) {
      console.warn('⚠️ Balance tracking failed:', balanceError.message);
      results.balanceTrackingUpdated = false;
    }

    // 5. Cache staking and redemption gains (for API endpoints)
    const stakingGains = await fetchStakingGainsData();
    const redemptionGains = await fetchRedemptionGainsData();
    results.stakingGains = stakingGains.length;
    results.redemptionGains = redemptionGains.length;
    
    // Update progress
    await updateLastIndexedBlock(endBlock);
    
    console.log(`✅ Processing complete - Events: ${totalEventsFound}, TVL: ${results.tvlUpdated ? 'Updated' : 'Failed'}`);
    
    return res.status(200).json({
      success: true,
      message: 'Unified indexing completed successfully',
      blocksProcessed: endBlock - startBlock + 1,
      currentBlock,
      processedRange: `${startBlock}-${endBlock}`,
      results,
      rpcEndpoint: 'Alchemy RSK Testnet',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Unified indexing failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Unified indexing failed',
      details: error.message,
      rpcEndpoint: 'Alchemy RSK Testnet'
    });
  }
}