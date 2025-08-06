#!/usr/bin/env node

import { config } from 'dotenv';
import { ethers } from 'ethers';

config({ path: '.env.local' });

const RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';
const VAULT_MANAGER = '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2';
const CREATOR_ADDRESS = '0xd1C775899DAeB0af9644cAb2fE9AAC3F1af99F4F';

console.log('🔍 Finding Vault Creation Blocks for Address:', CREATOR_ADDRESS);
console.log('📍 VaultManager Contract:', VAULT_MANAGER);
console.log('');

async function findVaultCreationBlocks() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    console.log(`📍 Current RSK block: ${currentBlock}`);
    
    // Search in larger chunks going backwards
    const chunkSize = 50000; // Larger chunks for faster searching
    const maxChunks = 50; // Search up to 2.5M blocks back
    
    let foundTransactions = [];
    
    for (let i = 0; i < maxChunks; i++) {
      const toBlock = currentBlock - (i * chunkSize);
      const fromBlock = Math.max(0, toBlock - chunkSize + 1);
      
      console.log(`\n🔍 Searching blocks ${fromBlock} to ${toBlock}...`);
      
      try {
        // Look for VaultUpdated events (vault creation shows as VaultUpdated)
        const logs = await provider.getLogs({
          address: VAULT_MANAGER,
          topics: [
            '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c', // VaultUpdated
            null, // Any vault ID
            ethers.zeroPadValue(CREATOR_ADDRESS.toLowerCase(), 32) // Creator address as second indexed parameter
          ],
          fromBlock: fromBlock,
          toBlock: toBlock
        });
        
        if (logs.length > 0) {
          console.log(`🎉 FOUND ${logs.length} VAULT EVENTS FROM THIS ADDRESS!`);
          
          for (const log of logs) {
            const block = await provider.getBlock(log.blockNumber);
            const date = new Date(block.timestamp * 1000);
            
            console.log(`📋 Block ${log.blockNumber} (${date.toISOString()})`);
            console.log(`   Transaction: ${log.transactionHash}`);
            console.log(`   Vault ID: ${log.topics[1]}`);
            console.log(`   Topics: ${log.topics.length}`);
            
            foundTransactions.push({
              block: log.blockNumber,
              tx: log.transactionHash,
              vaultId: log.topics[1],
              timestamp: block.timestamp
            });
          }
          
          // If we found events, we can stop searching
          if (foundTransactions.length > 0) {
            break;
          }
        } else {
          console.log(`   No vault events from this address`);
        }
        
      } catch (error) {
        console.log(`   Error: ${error.message}`);
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (foundTransactions.length > 0) {
      const earliestBlock = Math.min(...foundTransactions.map(tx => tx.block));
      
      console.log(`\n🎯 SOLUTION: Update indexer to start from block ${earliestBlock}`);
      console.log(`\n📋 SQL to run in Supabase:`);
      console.log(`UPDATE indexer_state SET last_block = ${earliestBlock - 1000}, updated_at = NOW() WHERE id = 1;`);
      console.log(`\n💡 This will make the indexer capture these vault creation events!`);
      
      // Show summary
      console.log(`\n📊 Summary:`);
      console.log(`   • Found ${foundTransactions.length} vault transactions`);
      console.log(`   • Earliest block: ${earliestBlock}`);
      console.log(`   • Address: ${CREATOR_ADDRESS}`);
      console.log(`   • These events will be captured when indexer processes these blocks`);
      
    } else {
      console.log(`\n❓ No vault events found for address ${CREATOR_ADDRESS}`);
      console.log(`💡 The vault might have been created by a different address`);
      console.log(`💡 Or the events might be even older than searched range`);
    }
    
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

findVaultCreationBlocks().catch(console.error);