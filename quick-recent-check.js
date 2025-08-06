#!/usr/bin/env node

import { ethers } from 'ethers';

const RPC_URL = process.env.RSK_RPC_URL || 'https://mycrypto.testnet.rsk.co';

async function quickCheck() {
  console.log('🔍 Quick Recent Block Check');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock.toLocaleString()}`);
    
    // Check last 10 blocks for activity
    console.log(`\n📋 Last 10 blocks activity:`);
    
    for (let i = 9; i >= 0; i--) {
      const blockNumber = currentBlock - i;
      const block = await provider.getBlock(blockNumber);
      
      if (block) {
        const age = Math.floor((Date.now() - block.timestamp * 1000) / 1000);
        console.log(`Block ${blockNumber}: ${block.transactions.length} tx, ${age}s ago`);
      }
    }
    
    console.log(`\n💡 Current status:`);
    console.log(`   - Network is at block ${currentBlock.toLocaleString()}`);
    console.log(`   - Reset your indexer to start from ~${(currentBlock - 100).toLocaleString()} for recent monitoring`);
    console.log(`   - Daily cron will then catch new events going forward`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickCheck();