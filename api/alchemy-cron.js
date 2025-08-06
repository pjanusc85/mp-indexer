import { ethers } from 'ethers';

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CONTRACTS = {
  vaultManager: process.env.VAULT_MANAGER_ADDRESS || '0x0eccca821f078f394f2bb1f3d615ad73729a9892',
  sortedVaults: process.env.SORTED_VAULTS_ADDRESS || '0xDBA59981bda70CCBb5458e907f5A0729F1d24a05'
};

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
};

async function getLastIndexedBlock() {
  try {
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
    return data.length > 0 ? data[0].last_block : 6680000; // Default start block
  } catch (error) {
    console.error('Error getting last indexed block:', error);
    return 6680000; // Default fallback
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
      // Check if it's a unique constraint violation (event already exists)
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
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
}

export default async function handler(req, res) {
  console.log('🚀 Alchemy-Powered Cron Indexer Started');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ 
      error: 'Missing environment variables',
      details: 'SUPABASE_URL and SUPABASE_ANON_KEY are required'
    });
  }

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
    
    // Query both event types in parallel
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
    
    // Update progress
    await updateLastIndexedBlock(endBlock);
    
    console.log(`✅ Processed ${endBlock - startBlock + 1} blocks, found ${totalEventsFound} events`);
    
    return res.status(200).json({
      message: 'Indexing completed successfully',
      blocksProcessed: endBlock - startBlock + 1,
      eventsFound: totalEventsFound,
      processedRange: `${startBlock}-${endBlock}`,
      currentBlock,
      rpcEndpoint: 'Alchemy RSK Testnet'
    });
    
  } catch (error) {
    console.error('❌ Indexing failed:', error);
    
    return res.status(500).json({
      error: 'Indexing failed',
      details: error.message,
      rpcEndpoint: 'Alchemy RSK Testnet'
    });
  }
}