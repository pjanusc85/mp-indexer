import { ethers } from 'ethers';

const RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CONTRACTS = {
  vaultManager: process.env.VAULT_MANAGER_ADDRESS || '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2',
  sortedVaults: process.env.SORTED_VAULTS_ADDRESS || '0xDBA59981bda70CCBb5458e907f5A0729F1d24a05'
};

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
};

async function getLastIndexedBlock() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state?select=last_block&order=id.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    const data = await response.json();
    return data.length > 0 ? data[0].last_block : null;
  } catch (error) {
    console.error('Error getting last indexed block:', error);
    return null;
  }
}

async function updateLastIndexedBlock(blockNumber) {
  try {
    // First, try to update the existing record
    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        last_block: blockNumber,
        updated_at: new Date().toISOString()
      })
    });
    
    if (updateResponse.ok) {
      console.log(`✅ Updated indexer state to block ${blockNumber}`);
      return;
    }
    
    // If PATCH fails, try using RPC call
    console.log('PATCH failed, trying RPC approach...');
    const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_indexer_state`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        new_block: blockNumber
      })
    });
    
    if (rpcResponse.ok) {
      console.log(`✅ Updated indexer state via RPC to block ${blockNumber}`);
    } else {
      const errorText = await rpcResponse.text();
      throw new Error(`RPC call failed! status: ${rpcResponse.status}, body: ${errorText}`);
    }
    
  } catch (error) {
    console.error('❌ Error updating last indexed block:', error);
    // Don't throw - let the indexer continue even if state update fails
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error saving vault event:', error);
  }
}

async function processVaultEvents(fromBlock, toBlock) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  let eventsProcessed = 0;
  
  for (const [contractName, contractAddress] of Object.entries(CONTRACTS)) {
    try {
      console.log(`Processing ${contractName} from block ${fromBlock} to ${toBlock}`);
      
      const logs = await provider.getLogs({
        address: contractAddress,
        fromBlock: fromBlock,
        toBlock: toBlock
      });
      
      for (const log of logs) {
        const eventType = Object.keys(EVENT_SIGNATURES).find(key => 
          EVENT_SIGNATURES[key] === log.topics[0]
        );
        
        if (eventType) {
          const block = await provider.getBlock(log.blockNumber);
          
          const eventData = {
            contract_address: log.address.toLowerCase(),
            event_type: eventType,
            transaction_hash: log.transactionHash,
            block_number: log.blockNumber,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            topics: log.topics,
            data: log.data,
            vault_id: log.topics[1] || null,
            processed_at: new Date().toISOString()
          };
          
          await saveVaultEvent(eventData);
          eventsProcessed++;
          
          console.log(`Saved ${eventType} event for vault ${eventData.vault_id} at block ${log.blockNumber}`);
        }
      }
    } catch (error) {
      console.error(`Error processing ${contractName}:`, error);
    }
  }
  
  return eventsProcessed;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('🚀 Starting cron indexer job');
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    const lastIndexedBlock = await getLastIndexedBlock();
    
    const fromBlock = lastIndexedBlock ? lastIndexedBlock + 1 : currentBlock - 100;
    const toBlock = currentBlock;
    
    console.log(`Current block: ${currentBlock}, Last indexed: ${lastIndexedBlock}`);
    console.log(`Processing blocks ${fromBlock} to ${toBlock}`);
    
    if (fromBlock > toBlock) {
      console.log('No new blocks to process');
      return res.status(200).json({ 
        message: 'No new blocks to process',
        currentBlock,
        lastIndexedBlock
      });
    }
    
    const eventsProcessed = await processVaultEvents(fromBlock, toBlock);
    await updateLastIndexedBlock(toBlock);
    
    console.log(`✅ Indexer job completed. Processed ${eventsProcessed} events`);
    
    return res.status(200).json({
      message: 'Indexer job completed successfully',
      blocksProcessed: toBlock - fromBlock + 1,
      eventsProcessed,
      fromBlock,
      toBlock,
      currentBlock
    });
    
  } catch (error) {
    console.error('❌ Indexer job failed:', error);
    
    return res.status(500).json({
      error: 'Indexer job failed',
      details: error.message
    });
  }
}