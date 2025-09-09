import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RSK_RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';

// Contract addresses from updated config
const CONTRACTS = {
  activePool: process.env.ACTIVE_POOL_ADDRESS || '0x4C02Dc259a09B759Ef20013697d4465203f8Fac0',
  vaultManager: process.env.VAULT_MANAGER_ADDRESS || '0xf1df1d059E67E19b270b083bd13AC791C573968b',
  stabilityPool: process.env.STABILITY_POOL_ADDRESS || '0xdA30a81004d4530e4C632D3Fa11F53558dB6209b'
};

async function fetchTVLFromActivePool() {
  try {
    const provider = new ethers.JsonRpcProvider(RSK_RPC_URL);
    const latestBlock = await provider.getBlockNumber();
    
    console.log(`Fetching TVL data from Active Pool at block ${latestBlock}`);
    
    // Get current RBTC balance in Active Pool (equivalent to ETH balance in Dune query)
    const activePoolBalance = await provider.getBalance(CONTRACTS.activePool);
    const activePoolBTC = ethers.formatEther(activePoolBalance);
    
    // Get current RBTC balance in Stability Pool 
    const stabilityPoolBalance = await provider.getBalance(CONTRACTS.stabilityPool);
    const stabilityPoolBTC = ethers.formatEther(stabilityPoolBalance);
    
    // Calculate total TVL (excluding Stability Pool as per Dune query)
    const totalTVL = parseFloat(activePoolBTC);
    
    console.log(`Active Pool Balance: ${activePoolBTC} RBTC`);
    console.log(`Stability Pool Balance: ${stabilityPoolBTC} RBTC`);
    console.log(`Total TVL (excluding Stability Pool): ${totalTVL} RBTC`);
    
    // Get block timestamp for time-series data
    const block = await provider.getBlock(latestBlock);
    const timestamp = new Date(block.timestamp * 1000);
    
    const tvlData = {
      timestamp: timestamp.toISOString(),
      block_number: latestBlock,
      active_pool_btc: parseFloat(activePoolBTC),
      stability_pool_btc: parseFloat(stabilityPoolBTC),
      total_btc: totalTVL,
      default_pool_btc: 0, // We'll track this separately if needed
      btc_price_usd: null, // We can add price API later
      total_usd: null
    };
    
    return tvlData;
    
  } catch (error) {
    console.error('Error fetching TVL data:', error);
    throw error;
  }
}

async function saveTVLToSupabase(tvlData) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Supabase credentials not configured, skipping save');
      return;
    }
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tvl_snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(tvlData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('TVL data saved to Supabase:', result);
    } else {
      const error = await response.text();
      console.error('Error saving to Supabase:', error);
    }
    
  } catch (error) {
    console.error('Error saving TVL data:', error);
    throw error;
  }
}

async function fetchHistoricalTVL(fromBlock, toBlock) {
  try {
    const provider = new ethers.JsonRpcProvider(RSK_RPC_URL);
    const blockStep = 100; // Process in chunks
    const tvlHistory = [];
    
    console.log(`Fetching historical TVL from block ${fromBlock} to ${toBlock}`);
    
    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += blockStep) {
      try {
        const block = await provider.getBlock(blockNumber);
        if (!block) continue;
        
        // Get balance at this specific block
        const activePoolBalance = await provider.getBalance(CONTRACTS.activePool, blockNumber);
        const activePoolBTC = ethers.formatEther(activePoolBalance);
        
        const stabilityPoolBalance = await provider.getBalance(CONTRACTS.stabilityPool, blockNumber);
        const stabilityPoolBTC = ethers.formatEther(stabilityPoolBalance);
        
        const tvlData = {
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          block_number: blockNumber,
          active_pool_btc: parseFloat(activePoolBTC),
          stability_pool_btc: parseFloat(stabilityPoolBTC),
          total_btc: parseFloat(activePoolBTC), // Excluding stability pool
          default_pool_btc: 0,
          btc_price_usd: null,
          total_usd: null
        };
        
        tvlHistory.push(tvlData);
        
        if (blockNumber % 1000 === 0) {
          console.log(`Processed block ${blockNumber}, TVL: ${activePoolBTC} RBTC`);
        }
        
      } catch (blockError) {
        console.error(`Error processing block ${blockNumber}:`, blockError);
        continue;
      }
    }
    
    return tvlHistory;
    
  } catch (error) {
    console.error('Error fetching historical TVL:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Enhanced TVL Tracker Starting...');
  console.log('Contract addresses:');
  console.log(`Active Pool: ${CONTRACTS.activePool}`);
  console.log(`Stability Pool: ${CONTRACTS.stabilityPool}`);
  
  try {
    // Fetch current TVL
    const currentTVL = await fetchTVLFromActivePool();
    console.log('Current TVL data:', currentTVL);
    
    // Save to Supabase
    await saveTVLToSupabase(currentTVL);
    
    // Optionally fetch historical data (uncomment if needed)
    // const provider = new ethers.JsonRpcProvider(RSK_RPC_URL);
    // const latestBlock = await provider.getBlockNumber();
    // const fromBlock = Math.max(1, latestBlock - 10000); // Last ~10k blocks
    // const historicalData = await fetchHistoricalTVL(fromBlock, latestBlock);
    // console.log(`Collected ${historicalData.length} historical data points`);
    
    console.log('✅ TVL tracking completed successfully');
    
  } catch (error) {
    console.error('❌ TVL tracking failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { fetchTVLFromActivePool, saveTVLToSupabase, fetchHistoricalTVL };