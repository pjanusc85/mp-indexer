#!/usr/bin/env node

import { ethers } from 'ethers';

const RPC_URL = 'https://www.intrinsic.network';
const VAULT_MANAGER = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';

async function checkRecentEvents() {
  console.log('🔍 Checking for VaultManager events in recent blocks on intrinsic.network');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const currentBlock = await provider.getBlockNumber();
  
  console.log(`Current block: ${currentBlock}`);
  console.log(`Searching last 10,000 blocks for VaultManager events...\n`);
  
  try {
    const logs = await provider.getLogs({
      address: VAULT_MANAGER,
      fromBlock: Math.max(1, currentBlock - 10000),
      toBlock: currentBlock
    });
    
    console.log(`Found ${logs.length} VaultManager events in recent blocks\n`);
    
    if (logs.length > 0) {
      console.log('📋 Recent VaultManager Events:');
      for (let i = 0; i < Math.min(5, logs.length); i++) {
        const log = logs[i];
        const block = await provider.getBlock(log.blockNumber);
        console.log(`Block ${log.blockNumber} (${new Date(block.timestamp * 1000).toISOString()}): ${log.topics[0]}`);
      }
    } else {
      console.log('💡 No VaultManager events found in recent blocks');
      console.log('💡 This suggests the vault activity happened on a different network/RPC');
      
      // Check if the contract exists
      console.log('\n🔍 Checking if VaultManager contract exists...');
      const code = await provider.getCode(VAULT_MANAGER);
      if (code === '0x') {
        console.log('❌ VaultManager contract does not exist at this address');
      } else {
        console.log('✅ VaultManager contract exists');
        console.log(`Contract code length: ${code.length} characters`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRecentEvents().catch(console.error);