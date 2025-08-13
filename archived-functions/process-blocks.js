import { ethers } from 'ethers';

const RPC_URL = process.env.RSK_RPC_URL || 'https://mycrypto.testnet.rsk.co';
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
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }
  } catch (error) {
    console.error('Error saving vault event:', error);
    throw error;
  }
}

async function processBlockRange(fromBlock, toBlock) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  let eventsProcessed = 0;
  const errors = [];
  const debugInfo = [];
  
  console.log(`Processing blocks ${fromBlock} to ${toBlock} (block-scanning mode)`);
  
  // Process each block individually since RSK testnet doesn't support eth_getLogs
  for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
    try {
      const block = await provider.getBlock(blockNumber, true);
      if (!block || !block.transactions) {
        continue;
      }
      
      console.log(`Scanning block ${blockNumber} with ${block.transactions.length} transactions`);
      
      if (blockNumber === 3141681) {
        console.log(`🔍 SPECIAL DEBUG for block 3141681:`);
        console.log(`Transactions: ${JSON.stringify(block.transactions)}`);
        debugInfo.push(`Block ${blockNumber}: ${block.transactions.length} transactions`);
        debugInfo.push(`Transactions: ${JSON.stringify(block.transactions)}`);
      }
      
      // Check each transaction for events  
      for (const tx of block.transactions) {
        const txHash = typeof tx === 'string' ? tx : tx.hash;
        try {
          const receipt = await provider.getTransactionReceipt(txHash);
          if (!receipt || !receipt.logs) {
            continue;
          }
          
          // Check logs in this transaction
          for (const log of receipt.logs) {
            if (blockNumber === 3141681) {
              console.log(`  Log address: ${log.address}, topic0: ${log.topics[0]}`);
              debugInfo.push(`  Log: ${log.address} -> ${log.topics[0]}`);
            }
            
            // Check if this log is from one of our target contracts
            const isTargetContract = Object.values(CONTRACTS).some(addr => 
              addr.toLowerCase() === log.address.toLowerCase()
            );
            
            if (blockNumber === 3141681 && isTargetContract) {
              console.log(`  ✅ VaultManager log found! Topic: ${log.topics[0]}`);
            }
            
            if (!isTargetContract) {
              continue;
            }
            
            // Check if this is one of our target events
            const eventType = Object.keys(EVENT_SIGNATURES).find(key => 
              EVENT_SIGNATURES[key] === log.topics[0]
            );
            
            if (eventType) {
              try {
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
                
                console.log(`✅ Found ${eventType} event for vault ${eventData.vault_id} in block ${blockNumber} tx ${txHash}`);
              } catch (error) {
                console.error(`Error processing event:`, error);
                errors.push(`Event processing error: ${error.message}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing transaction ${txHash}:`, error);
          errors.push(`Transaction error: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Error processing block ${blockNumber}:`, error);
      errors.push(`Block ${blockNumber}: ${error.message}`);
    }
  }
  
  return { eventsProcessed, errors, debugInfo };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { fromBlock, toBlock } = req.body;
    
    if (!fromBlock || !toBlock) {
      return res.status(400).json({ 
        error: 'Missing required parameters: fromBlock and toBlock' 
      });
    }
    
    if (fromBlock > toBlock) {
      return res.status(400).json({ 
        error: 'fromBlock cannot be greater than toBlock' 
      });
    }
    
    const blockRange = toBlock - fromBlock + 1;
    if (blockRange > 1000) {
      return res.status(400).json({ 
        error: 'Block range too large. Maximum 1000 blocks per request' 
      });
    }
    
    console.log(`🚀 Processing block range: ${fromBlock} to ${toBlock}`);
    
    const result = await processBlockRange(fromBlock, toBlock);
    
    console.log(`✅ Completed processing. Events: ${result.eventsProcessed}, Errors: ${result.errors.length}`);
    
    return res.status(200).json({
      message: 'Block processing completed',
      fromBlock,
      toBlock,
      blocksProcessed: blockRange,
      eventsProcessed: result.eventsProcessed,
      errors: result.errors,
      debugInfo: result.debugInfo,
      success: result.errors.length === 0
    });
    
  } catch (error) {
    console.error('❌ Block processing failed:', error);
    
    return res.status(500).json({
      error: 'Block processing failed',
      details: error.message
    });
  }
}