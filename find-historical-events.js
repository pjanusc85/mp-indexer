#!/usr/bin/env node

import { config } from 'dotenv';
import { ethers } from 'ethers';

config({ path: '.env.local' });

const RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';
const VAULT_MANAGER = '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2';

console.log('🔍 Searching for Historical Vault Events\n');

async function findHistoricalEvents() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    console.log(`📍 Current block: ${currentBlock}`);
    
    // Search in chunks going backwards in time
    const chunkSize = 10000;
    const maxChunks = 20; // Search up to 200k blocks back
    
    for (let i = 0; i < maxChunks; i++) {
      const toBlock = currentBlock - (i * chunkSize);
      const fromBlock = toBlock - chunkSize + 1;
      
      if (fromBlock < 0) break;
      
      console.log(`\n🔍 Searching blocks ${fromBlock} to ${toBlock}...`);
      
      try {
        const logs = await provider.getLogs({
          address: VAULT_MANAGER,
          fromBlock: fromBlock,
          toBlock: toBlock
        });
        
        if (logs.length > 0) {
          console.log(`🎉 FOUND ${logs.length} EVENTS!`);
          
          // Group events by type
          const eventTypes = {};
          const eventSignatures = {
            VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
            VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
          };
          
          for (const log of logs) {
            const eventType = Object.keys(eventSignatures).find(key =>
              eventSignatures[key] === log.topics[0]
            ) || `Unknown (${log.topics[0]})`;
            
            eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;
          }
          
          console.log('📊 Event breakdown:');
          for (const [eventType, count] of Object.entries(eventTypes)) {
            console.log(`   ${eventType}: ${count} events`);
          }
          
          // Show first few events
          console.log('\n📋 Sample events:');
          for (const log of logs.slice(0, 5)) {
            const block = await provider.getBlock(log.blockNumber);
            const date = new Date(block.timestamp * 1000);
            console.log(`   Block ${log.blockNumber} (${date.toISOString().split('T')[0]}): ${log.transactionHash}`);
          }
          
          console.log(`\n🎯 Recommendation: Update your indexer to start from block ${fromBlock} to capture these events!`);
          break; // Found events, stop searching
        } else {
          console.log(`   No events found`);
        }
        
      } catch (error) {
        console.log(`   Error: ${error.message}`);
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

findHistoricalEvents().catch(console.error);