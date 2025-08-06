#!/usr/bin/env node

import { ethers } from 'ethers';

const RPC_URL = 'https://public-node.testnet.rsk.co';
const VAULT_MANAGER = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
};

// Supabase config - you'll need to set these
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qvjekspjaqjtenzoqlpr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
    
    console.log(`✅ Saved ${eventData.event_type} event to database`);
    return true;
  } catch (error) {
    console.error('❌ Error saving vault event:', error);
    return false;
  }
}

async function insertHistoricalEvents() {
  console.log('🔍 Extracting historical vault events from RSK testnet');
  console.log(`Target block: 3141681\n`);
  
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_ANON_KEY environment variable not set');
    console.log('Set it with: export SUPABASE_ANON_KEY="your_key_here"');
    return;
  }
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    // Get block with transactions
    const block = await provider.getBlock(3141681, true);
    
    if (!block) {
      console.log('❌ Block not found');
      return;
    }
    
    console.log(`✅ Block found with ${block.transactions.length} transactions`);
    console.log(`Block timestamp: ${new Date(block.timestamp * 1000).toISOString()}\n`);
    
    let eventsInserted = 0;
    
    // Process the transaction we know contains vault events
    const targetTxHash = '0x2125a31f529d996abd5da025f0374da2b77005a4cca8b392a441e70a7f5b522f';
    console.log(`🔍 Processing transaction: ${targetTxHash}`);
    
    const receipt = await provider.getTransactionReceipt(targetTxHash);
    if (!receipt || !receipt.logs) {
      console.log('❌ No transaction receipt or logs found');
      return;
    }
    
    console.log(`Found ${receipt.logs.length} logs in transaction\n`);
    
    // Process each log
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      
      // Check if this is from VaultManager
      if (log.address.toLowerCase() === VAULT_MANAGER.toLowerCase()) {
        console.log(`Log ${i}: VaultManager event - ${log.topics[0]}`);
        
        // Check if this is a vault event we care about
        const eventType = Object.keys(EVENT_SIGNATURES).find(key => 
          EVENT_SIGNATURES[key] === log.topics[0]
        );
        
        if (eventType) {
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
          
          console.log(`🎉 Found ${eventType} event for vault ${eventData.vault_id}`);
          
          const success = await saveVaultEvent(eventData);
          if (success) {
            eventsInserted++;
          }
        } else {
          console.log(`  Unknown VaultManager event: ${log.topics[0]}`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`Events inserted: ${eventsInserted}`);
    
    if (eventsInserted > 0) {
      console.log(`\n🎉 Historical vault events successfully inserted!`);
      console.log(`💡 You can now check your Supabase vault_events table.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

insertHistoricalEvents().catch(console.error);