import { ethers } from 'ethers';
import { getMPStakingEvents, processMPStakingEvents, calculateMPStakingMetrics } from '../src/contracts/MPStaking.js';
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
  vaultManager: process.env.VAULT_MANAGER_ADDRESS || '0x0eccca821f078f394f2bb1f3d615ad73729a9892',
  sortedVaults: process.env.SORTED_VAULTS_ADDRESS || '0x4DdE9ddE9e084cbC59105175407137fdD7B43F7C',
  activePool: '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F',
  defaultPool: '0x9BcA57F7D3712f46cd2D650a78f68e7928e866E2',
  stabilityPool: '0x11ad81e3E29DBA233aF88dCb4b169670FA2b8C65',
  mpStaking: process.env.MP_STAKING_ADDRESS || '0x9Ea9FA0e1605382aE217966173E26E2f5EE73ac6', // Updated MP staking address
  mpToken: process.env.MP_TOKEN_ADDRESS || '0x08a181f4Fc6C78258fFbaf166f2C7326DCc3C946' // Real MP token address
};

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
};

// === VAULT EVENT INDEXING ===
async function getLastIndexedBlock() {
  try {
    // TEMPORARY: Force indexer to start from recent blocks to catch MP staking
    // This will be removed after MP staking is properly indexed
    return 6713000;
    
    /* Original code - temporarily disabled
    const response = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state?select=last_block&contract_address=eq.${CONTRACTS.vaultManager}&order=last_updated.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.length > 0 ? data[0].last_block : 6713000; // Updated to recent block to catch MP staking
    */
  } catch (error) {
    console.error('Error getting last indexed block:', error);
    return 6713000; // Updated fallback to recent block
  }
}

async function updateLastIndexedBlock(blockNumber) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        contract_address: CONTRACTS.vaultManager,
        last_block: blockNumber,
        last_updated: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log(`✅ Updated last processed block to ${blockNumber}`);
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
async function saveMPStakingData(stakingData) {
  try {
    if (stakingData.length === 0) return true;
    
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
      throw new Error(`MP staking save failed: ${response.status}`);
    }

    console.log(`✅ Saved ${stakingData.length} MP staking data points`);
    return true;
    
  } catch (error) {
    console.error('❌ Error saving MP staking data:', error);
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

  // Handle different endpoints based on URL path
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  // API endpoint routing
  if (pathname.includes('daily-staking-gains')) {
    const stakingData = await fetchStakingGainsData();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${stakingData.length} days of staking gains data`,
      data: stakingData
    });
  }

  if (pathname.includes('redemption-gains')) {
    const redemptionData = await fetchRedemptionGainsData();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${redemptionData.length} days of redemption gains data`,
      data: redemptionData
    });
  }

  if (pathname.includes('mp-staking-data')) {
    const mpStakingData = await fetchMPStakingData();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${mpStakingData.length} hours of MP staking data`,
      data: mpStakingData
    });
  }

  if (pathname.includes('balance-tracking-data')) {
    const balanceTrackingData = await fetchBalanceTrackingData();
    return res.status(200).json({
      success: true,
      message: `Retrieved ${balanceTrackingData.length} balance tracking records`,
      data: balanceTrackingData
    });
  }

  if (pathname.includes('current-balances')) {
    const currentBalances = await fetchCurrentBalances();
    return res.status(200).json({
      success: true,
      message: `Retrieved current balances for ${currentBalances.length} pools`,
      data: currentBalances
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
    
    // 3. Process MP staking events (real contract configured)
    try {
      const mpStakingEvents = await getMPStakingEvents(provider, startBlock, endBlock);
      if (mpStakingEvents.stakingEvents.length > 0 || mpStakingEvents.claimEvents.length > 0) {
        console.log(`🎯 Found ${mpStakingEvents.stakingEvents.length} staking events and ${mpStakingEvents.claimEvents.length} claim events`);
        const processedStaking = await processMPStakingEvents(
          provider, 
          mpStakingEvents.stakingEvents, 
          mpStakingEvents.claimEvents
        );
        const stakingMetrics = calculateMPStakingMetrics(processedStaking);
        const stakingSaved = await saveMPStakingData(stakingMetrics);
        results.mpStakingUpdated = stakingSaved;
      } else {
        console.log('📊 No MP staking events found in this block range');
        results.mpStakingUpdated = true; // Mark as successful even if no events
      }
    } catch (mpError) {
      console.warn('⚠️ MP staking update failed:', mpError.message);
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