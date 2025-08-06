#!/usr/bin/env node

import { ethers } from 'ethers';

const RPC_URL = process.env.RSK_RPC_URL || 'https://mycrypto.testnet.rsk.co';
const VAULT_MANAGER = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';
const SUPABASE_URL = 'https://qvjekspjaqjtenzoqlpr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
};

async function saveVaultEvent(eventData) {
  if (!SUPABASE_ANON_KEY) {
    console.log(`📝 Would save: ${eventData.event_type} event for vault ${eventData.vault_id} at block ${eventData.block_number}`);
    return true;
  }

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
    
    console.log(`✅ Saved ${eventData.event_type} event to database`);
    return true;
  } catch (error) {
    console.error('❌ Error saving vault event:', error);
    return false;
  }
}

async function monitorRecentBlocks(lookbackBlocks = 1000) {
  console.log('🔍 Monitoring recent blocks for vault events');
  console.log(`Looking back ${lookbackBlocks} blocks from current block\n`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - lookbackBlocks;
    
    console.log(`Current block: ${currentBlock.toLocaleString()}`);
    console.log(`Scanning blocks ${fromBlock.toLocaleString()} to ${currentBlock.toLocaleString()}\n`);
    
    let eventsFound = 0;
    let blocksScanned = 0;
    
    // Process in chunks to avoid overwhelming the RPC
    const chunkSize = 50;
    for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      console.log(`Processing blocks ${start} to ${end}...`);
      
      for (let blockNumber = start; blockNumber <= end; blockNumber++) {
        try {
          const block = await provider.getBlock(blockNumber, true);
          if (!block || !block.transactions || block.transactions.length === 0) {
            continue;
          }
          
          blocksScanned++;
          
          // Process each transaction
          for (const txHash of block.transactions) {
            try {
              const receipt = await provider.getTransactionReceipt(txHash);
              if (!receipt || !receipt.logs) continue;
              
              // Check logs for vault events
              for (const log of receipt.logs) {
                if (log.address.toLowerCase() === VAULT_MANAGER.toLowerCase()) {
                  const eventType = Object.keys(EVENT_SIGNATURES).find(key => 
                    EVENT_SIGNATURES[key] === log.topics[0]
                  );
                  
                  if (eventType) {
                    eventsFound++;
                    
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
                    
                    console.log(`\n🎉 FOUND ${eventType} EVENT!`);
                    console.log(`   Block: ${blockNumber}`);
                    console.log(`   Vault: ${eventData.vault_id}`);
                    console.log(`   Transaction: ${txHash}`);
                    console.log(`   Timestamp: ${eventData.timestamp}`);
                    
                    await saveVaultEvent(eventData);
                  }
                }
              }
            } catch (error) {
              console.error(`Error processing transaction ${txHash}:`, error.message);
            }
          }
        } catch (error) {
          console.error(`Error processing block ${blockNumber}:`, error.message);
        }
      }
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Scan Complete:`);
    console.log(`   Blocks scanned: ${blocksScanned.toLocaleString()}`);
    console.log(`   Vault events found: ${eventsFound}`);
    
    if (eventsFound === 0) {
      console.log(`\n💡 No vault events found in recent ${lookbackBlocks} blocks.`);
      console.log(`💡 This is normal - vault activity is rare on RSK testnet.`);
      console.log(`💡 The indexer will continue monitoring for new activity.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Parse command line arguments
const lookbackBlocks = process.argv[2] ? parseInt(process.argv[2]) : 1000;

if (!SUPABASE_ANON_KEY) {
  console.log('💡 SUPABASE_ANON_KEY not set - will show events but not save to database');
  console.log('💡 Set with: export SUPABASE_ANON_KEY="your_key_here"\n');
}

monitorRecentBlocks(lookbackBlocks).catch(console.error);