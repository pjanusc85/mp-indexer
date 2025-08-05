#!/usr/bin/env node

import { config } from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
config({ path: '.env.local' });

const RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CONTRACTS = {
  vaultManager: process.env.VAULT_MANAGER_ADDRESS || '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2',
  sortedVaults: process.env.SORTED_VAULTS_ADDRESS || '0xDBA59981bda70CCBb5458e907f5A0729F1d24a05'
};

console.log('🔍 Local Debug - Money Protocol Indexer\n');

async function getLastIndexedBlock() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state?select=last_block&order=id.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    const data = await response.json();
    return data.length > 0 ? data[0].last_block : null;
  } catch (error) {
    console.error('Error getting last indexed block:', error);
    return null;
  }
}

async function testBlockProcessing() {
  try {
    console.log('1️⃣ Connecting to RSK...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const startTime = Date.now();
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`   ✅ Current block: ${currentBlock} (${Date.now() - startTime}ms)`);
    
    console.log('\n2️⃣ Getting last indexed block...');
    const lastIndexedBlock = await getLastIndexedBlock();
    console.log(`   ✅ Last indexed: ${lastIndexedBlock}`);
    
    const fromBlock = lastIndexedBlock ? lastIndexedBlock + 1 : currentBlock - 100;
    const maxBlocksPerRun = 50; // Start with smaller range for testing
    const toBlock = Math.min(currentBlock, fromBlock + maxBlocksPerRun - 1);
    
    console.log(`\n3️⃣ Processing ${toBlock - fromBlock + 1} blocks (${fromBlock} to ${toBlock})...`);
    
    let totalLogs = 0;
    
    for (const [contractName, contractAddress] of Object.entries(CONTRACTS)) {
      console.log(`\n🔗 Checking ${contractName} (${contractAddress})...`);
      const contractStartTime = Date.now();
      
      try {
        const logs = await provider.getLogs({
          address: contractAddress,
          fromBlock: fromBlock,
          toBlock: toBlock
        });
        
        const contractTime = Date.now() - contractStartTime;
        console.log(`   ✅ Found ${logs.length} logs in ${contractTime}ms`);
        totalLogs += logs.length;
        
        // If this is taking too long, break
        if (contractTime > 5000) {
          console.log(`   ⚠️ Contract query took ${contractTime}ms - this might be the bottleneck`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\n📊 Summary:`);
    console.log(`   • Total time: ${totalTime}ms`);
    console.log(`   • Blocks processed: ${toBlock - fromBlock + 1}`);
    console.log(`   • Total logs found: ${totalLogs}`);
    console.log(`   • Time per block: ${(totalTime / (toBlock - fromBlock + 1)).toFixed(2)}ms`);
    
    if (totalTime > 8000) {
      console.log(`\n⚠️ This would likely timeout on Vercel (${totalTime}ms > 8000ms)`);
      console.log(`💡 Try reducing maxBlocksPerRun to: ${Math.floor((toBlock - fromBlock + 1) * 8000 / totalTime)}`);
    } else {
      console.log(`\n✅ This should work on Vercel (${totalTime}ms < 8000ms)`);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
testBlockProcessing().catch(console.error);