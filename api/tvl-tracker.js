import { ethers } from 'ethers';

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Money Protocol contract addresses
const CONTRACTS = {
  activePool: '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F',
  vaultManager: '0x0ecCcA821f078f394F2Bb1f3d615aD73729A9892',
  defaultPool: '0x9BcA57F7D3712f46cd2D650a78f68e7928e866E2',
  stabilityPool: '0x11ad81e3E29DBA233aF88dCb4b169670FA2b8C65',
  borrowerOperations: '0xA8437A34a61B64764EA261e9cf85403c0Bb57e25'
};

// Event signatures for TVL tracking
const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10',
  ActivePoolBTCBalanceUpdated: '0x', // We'll need to find this
  StabilityPoolBTCBalanceUpdated: '0x' // We'll need to find this
};

// ABI for decoding vault events
const VAULT_UPDATED_ABI = [
  'event VaultUpdated(address indexed _borrower, uint _debt, uint _coll, uint8 _operation)'
];

const VAULT_LIQUIDATED_ABI = [
  'event VaultLiquidated(address indexed _borrower, uint _debt, uint _coll, uint8 _operation)'
];

async function calculateTVL(blockNumber) {
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Get ActivePool balance (main collateral)
    const activePoolBalance = await provider.getBalance(CONTRACTS.activePool, blockNumber);
    
    // Get DefaultPool balance (liquidated collateral)
    const defaultPoolBalance = await provider.getBalance(CONTRACTS.defaultPool, blockNumber);
    
    // Total locked value (excluding Stability Pool as requested)
    const totalBTC = ethers.formatEther(activePoolBalance + defaultPoolBalance);
    
    return {
      blockNumber,
      activePoolBTC: ethers.formatEther(activePoolBalance),
      defaultPoolBTC: ethers.formatEther(defaultPoolBalance),
      totalBTC: parseFloat(totalBTC),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error calculating TVL:', error);
    throw error;
  }
}

async function getVaultOperations(fromBlock, toBlock) {
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Get VaultUpdated events
    const vaultUpdatedLogs = await provider.getLogs({
      address: CONTRACTS.vaultManager,
      topics: [EVENT_SIGNATURES.VaultUpdated],
      fromBlock,
      toBlock
    });
    
    // Get VaultLiquidated events  
    const vaultLiquidatedLogs = await provider.getLogs({
      address: CONTRACTS.vaultManager,
      topics: [EVENT_SIGNATURES.VaultLiquidated],
      fromBlock,
      toBlock
    });
    
    // Decode and process events
    const iface = new ethers.Interface([...VAULT_UPDATED_ABI, ...VAULT_LIQUIDATED_ABI]);
    
    const operations = [];
    
    // Process VaultUpdated events
    for (const log of vaultUpdatedLogs) {
      try {
        const decoded = iface.parseLog(log);
        const block = await provider.getBlock(log.blockNumber);
        
        operations.push({
          type: 'VaultUpdated',
          borrower: decoded.args._borrower,
          debt: ethers.formatEther(decoded.args._debt),
          collateral: ethers.formatEther(decoded.args._coll),
          operation: decoded.args._operation,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          logIndex: log.logIndex
        });
      } catch (decodeError) {
        console.warn('Failed to decode VaultUpdated log:', decodeError);
      }
    }
    
    // Process VaultLiquidated events
    for (const log of vaultLiquidatedLogs) {
      try {
        const decoded = iface.parseLog(log);
        const block = await provider.getBlock(log.blockNumber);
        
        operations.push({
          type: 'VaultLiquidated', 
          borrower: decoded.args._borrower,
          debt: ethers.formatEther(decoded.args._debt),
          collateral: ethers.formatEther(decoded.args._coll),
          operation: decoded.args._operation,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          logIndex: log.logIndex
        });
      } catch (decodeError) {
        console.warn('Failed to decode VaultLiquidated log:', decodeError);
      }
    }
    
    // Sort by block number and log index
    operations.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber;
      }
      return a.logIndex - b.logIndex;
    });
    
    return operations;
    
  } catch (error) {
    console.error('Error getting vault operations:', error);
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('TVL snapshot saved:', result);
    return result;
    
  } catch (error) {
    console.error('Error saving TVL snapshot:', error);
    throw error;
  }
}

async function saveVaultOperations(operations) {
  try {
    if (operations.length === 0) return;
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/vault_operations`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(operations)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Saved ${operations.length} vault operations`);
    return result;
    
  } catch (error) {
    console.error('Error saving vault operations:', error);
    throw error;
  }
}

// Main TVL tracking function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    // Get the last processed block
    const lastProcessedResponse = await fetch(`${SUPABASE_URL}/rest/v1/tvl_snapshots?select=block_number&order=block_number.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    let fromBlock = 6680000; // Default start block
    
    if (lastProcessedResponse.ok) {
      const lastData = await lastProcessedResponse.json();
      if (lastData.length > 0) {
        fromBlock = lastData[0].block_number + 1;
      }
    }
    
    console.log(`Processing TVL from block ${fromBlock} to ${currentBlock}`);
    
    // Get vault operations in this range
    const operations = await getVaultOperations(fromBlock, currentBlock);
    
    // Calculate current TVL
    const tvlData = await calculateTVL(currentBlock);
    
    // Save the data
    await Promise.all([
      saveTVLSnapshot(tvlData),
      saveVaultOperations(operations)
    ]);
    
    return res.status(200).json({
      success: true,
      message: `Processed blocks ${fromBlock} to ${currentBlock}`,
      tvl: tvlData,
      operationsFound: operations.length
    });
    
  } catch (error) {
    console.error('TVL tracking error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}