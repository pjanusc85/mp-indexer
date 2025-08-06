#!/usr/bin/env node

import { ethers } from 'ethers';

const RPC_URL = 'https://www.intrinsic.network';
const VAULT_MANAGER = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';

async function debugLogs() {
  console.log('🔍 Debug provider.getLogs() call');
  console.log(`RPC: ${RPC_URL}`);
  console.log(`VaultManager: ${VAULT_MANAGER}`);
  console.log(`Target block: 3141681\n`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // First, let's check basic network info
  console.log('🌐 Network Info:');
  try {
    const network = await provider.getNetwork();
    const currentBlock = await provider.getBlockNumber();
    const targetBlock = await provider.getBlock(3141681);
    
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`Current block: ${currentBlock}`);
    console.log(`Target block exists: ${targetBlock ? 'Yes' : 'No'}`);
    if (targetBlock) {
      console.log(`Target block timestamp: ${new Date(targetBlock.timestamp * 1000).toISOString()}`);
      console.log(`Target block transactions: ${targetBlock.transactions.length}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Network info error:', error.message);
  }
  
  try {
    // Let's check what's the earliest block available on intrinsic.network
    console.log('🔍 Finding earliest available block on intrinsic.network');
    
    const currentBlock = await provider.getBlockNumber();
    let searchBlock = Math.max(1, currentBlock - 1000000); // Start 1M blocks back
    let earliestFound = null;
    
    // Binary search for earliest block
    let low = 1;
    let high = currentBlock;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      try {
        const block = await provider.getBlock(mid);
        if (block) {
          earliestFound = mid;
          high = mid - 1; // Try to find an earlier block
        } else {
          low = mid + 1;
        }
      } catch (error) {
        low = mid + 1;
      }
    }
    
    if (earliestFound) {
      const block = await provider.getBlock(earliestFound);
      console.log(`Earliest block: ${earliestFound}`);
      console.log(`Earliest timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
    }
    
    // Test 1: Get all logs from the VaultManager contract in block 3141681
    console.log('\n📋 Test 1: All logs from VaultManager in block 3141681');
    const logs = await provider.getLogs({
      address: VAULT_MANAGER,
      fromBlock: 3141681,
      toBlock: 3141681
    });
    
    console.log(`Found ${logs.length} logs`);
    for (let i = 0; i < logs.length; i++) {
      console.log(`  Log ${i}: ${logs[i].topics[0]}`);
    }
    
    // Test 2: Get all logs from block 3141681 (no address filter)
    console.log('\n📋 Test 2: All logs in block 3141681 (no address filter)');
    const allLogs = await provider.getLogs({
      fromBlock: 3141681,
      toBlock: 3141681
    });
    
    console.log(`Found ${allLogs.length} total logs in block`);
    
    // Filter for VaultManager logs
    const vaultManagerLogs = allLogs.filter(log => 
      log.address.toLowerCase() === VAULT_MANAGER.toLowerCase()
    );
    
    console.log(`VaultManager logs: ${vaultManagerLogs.length}`);
    for (let i = 0; i < vaultManagerLogs.length; i++) {
      console.log(`  VaultManager Log ${i}: ${vaultManagerLogs[i].topics[0]}`);
    }
    
    // Test 3: Check specific event signatures
    console.log('\n🎯 Test 3: Looking for specific event signatures');
    const vaultUpdatedSig = '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c';
    const vaultLiquidatedSig = '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10';
    
    const vaultUpdatedLogs = allLogs.filter(log => log.topics[0] === vaultUpdatedSig);
    const vaultLiquidatedLogs = allLogs.filter(log => log.topics[0] === vaultLiquidatedSig);
    
    console.log(`VaultUpdated events: ${vaultUpdatedLogs.length}`);
    console.log(`VaultLiquidated events: ${vaultLiquidatedLogs.length}`);
    
    if (vaultUpdatedLogs.length > 0) {
      console.log('✅ Found VaultUpdated event!');
      console.log(`Address: ${vaultUpdatedLogs[0].address}`);
      console.log(`Vault ID: ${vaultUpdatedLogs[0].topics[1]}`);
    }
    
    if (vaultLiquidatedLogs.length > 0) {
      console.log('✅ Found VaultLiquidated event!');
      console.log(`Address: ${vaultLiquidatedLogs[0].address}`);
      console.log(`Vault ID: ${vaultLiquidatedLogs[0].topics[1]}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugLogs().catch(console.error);