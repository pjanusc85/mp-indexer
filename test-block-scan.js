#!/usr/bin/env node

import { ethers } from 'ethers';

const RPC_URL = 'https://public-node.testnet.rsk.co';
const VAULT_MANAGER = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
};

async function testBlockScan() {
  console.log('🔍 Testing block-scanning approach on RSK testnet');
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Target block: 3141681\n`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    // Get block with transactions
    console.log('📦 Getting block 3141681 with transactions...');
    const block = await provider.getBlock(3141681, true);
    
    if (!block) {
      console.log('❌ Block not found');
      return;
    }
    
    console.log(`✅ Block found with ${block.transactions.length} transactions`);
    console.log(`Block timestamp: ${new Date(block.timestamp * 1000).toISOString()}\n`);
    
    let vaultEventsFound = 0;
    let totalLogs = 0;
    
    // Check what format block.transactions is in
    console.log('🔍 Checking transaction format...');
    console.log(`First transaction type: ${typeof block.transactions[0]}`);
    console.log(`First transaction: ${JSON.stringify(block.transactions[0], null, 2).substring(0, 200)}...\n`);
    
    // Process each transaction
    for (let i = 0; i < block.transactions.length; i++) {
      const tx = block.transactions[i];
      const txHash = typeof tx === 'string' ? tx : tx.hash;
      console.log(`🔍 Processing transaction ${i + 1}/${block.transactions.length}: ${txHash}`);
      
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt || !receipt.logs) {
          console.log('  No logs in transaction');
          continue;
        }
        
        console.log(`  Found ${receipt.logs.length} logs`);
        totalLogs += receipt.logs.length;
        
        // Check each log
        for (let j = 0; j < receipt.logs.length; j++) {
          const log = receipt.logs[j];
          console.log(`    Log ${j}: address=${log.address}, topic0=${log.topics[0]}`);
          
          // Check if this is from VaultManager
          if (log.address.toLowerCase() === VAULT_MANAGER.toLowerCase()) {
            console.log(`    ✅ VaultManager log found!`);
            
            // Check if this is a vault event
            const eventType = Object.keys(EVENT_SIGNATURES).find(key => 
              EVENT_SIGNATURES[key] === log.topics[0]
            );
            
            if (eventType) {
              vaultEventsFound++;
              console.log(`    🎉 ${eventType} event found!`);
              console.log(`    Vault ID: ${log.topics[1]}`);
              console.log(`    Transaction: ${log.transactionHash}`);
            } else {
              console.log(`    Unknown VaultManager event: ${log.topics[0]}`);
            }
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing transaction: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`Total transactions: ${block.transactions.length}`);
    console.log(`Total logs: ${totalLogs}`);
    console.log(`Vault events found: ${vaultEventsFound}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBlockScan().catch(console.error);