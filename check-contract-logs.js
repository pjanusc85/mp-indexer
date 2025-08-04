#!/usr/bin/env node

import { ethers } from 'ethers';

// Configuration
const RPC_URL = 'https://www.intrinsic.network';
const CONTRACTS = {
  vaultManager: '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2',
  sortedVaults: '0xDBA59981bda70CCBb5458e907f5A0729F1d24a05'
};

// Event signatures
const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10',
  NodeAdded: '0x...',  // Add if needed
  NodeRemoved: '0x...' // Add if needed
};

async function checkContractLogs() {
  console.log('🔍 Checking Money Protocol Contract Activity on RSK Testnet\n');
  
  try {
    // Connect to RSK
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    console.log(`📍 Current RSK block: ${currentBlock}`);
    
    // Check different time ranges
    const ranges = [
      { name: 'Last 100 blocks', blocks: 100 },
      { name: 'Last 1000 blocks', blocks: 1000 },
      { name: 'Last 10000 blocks', blocks: 10000 }
    ];
    
    for (const range of ranges) {
      console.log(`\n📊 ${range.name} (${currentBlock - range.blocks} to ${currentBlock}):`);
      
      for (const [contractName, contractAddress] of Object.entries(CONTRACTS)) {
        console.log(`\n🔗 ${contractName.toUpperCase()}: ${contractAddress}`);
        
        try {
          // Check ALL logs for this contract (any event)
          const allLogs = await provider.getLogs({
            address: contractAddress,
            fromBlock: currentBlock - range.blocks,
            toBlock: currentBlock
          });
          
          console.log(`   📝 Total events found: ${allLogs.length}`);
          
          if (allLogs.length > 0) {
            // Group by event signature
            const eventCounts = {};
            const recentEvents = [];
            
            for (const log of allLogs) {
              const topic0 = log.topics[0];
              eventCounts[topic0] = (eventCounts[topic0] || 0) + 1;
              
              // Keep track of recent events
              if (recentEvents.length < 5) {
                recentEvents.push({
                  hash: log.transactionHash,
                  block: log.blockNumber,
                  topic0: topic0
                });
              }
            }
            
            // Show event breakdown
            console.log('   📋 Event breakdown:');
            for (const [topic, count] of Object.entries(eventCounts)) {
              const eventName = Object.keys(EVENT_SIGNATURES).find(key => 
                EVENT_SIGNATURES[key] === topic
              ) || 'Unknown Event';
              console.log(`      ${eventName} (${topic.substring(0, 10)}...): ${count} events`);
            }
            
            // Show recent events
            console.log('   🕐 Recent events:');
            for (const event of recentEvents) {
              console.log(`      Block ${event.block}: ${event.hash} (${event.topic0.substring(0, 10)}...)`);
            }
          } else {
            console.log('   ❌ No events found');
          }
          
        } catch (error) {
          console.log(`   ❌ Error checking logs: ${error.message}`);
        }
      }
      
      // Don't overwhelm the RPC
      if (range.blocks > 1000) {
        console.log('   ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Check if contracts have code
    console.log('\n🔧 Contract Code Verification:');
    for (const [contractName, contractAddress] of Object.entries(CONTRACTS)) {
      try {
        const code = await provider.getCode(contractAddress);
        const hasCode = code !== '0x';
        console.log(`   ${contractName}: ${hasCode ? '✅ Has code' : '❌ No code (not deployed?)'}`);
      } catch (error) {
        console.log(`   ${contractName}: ❌ Error checking code: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('   • If you see events: The indexer should detect them');
    console.log('   • If no events: Either low activity or wrong contract addresses');  
    console.log('   • If no code: Contract addresses may be incorrect');
    console.log('\n🚀 Run this script anytime to check for new activity!');
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
checkContractLogs().catch(console.error);