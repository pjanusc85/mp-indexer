import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RSK_RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';
const ALCHEMY_RPC_URL = process.env.ALCHEMY_RPC_URL;

// Use Alchemy if available, otherwise public RSK node
const RPC_URL = ALCHEMY_RPC_URL || RSK_RPC_URL;

// Your deployment transactions
const TARGET_TRANSACTIONS = [
  { hash: '0xab5234d4de1633722695b7baf9bea967890307a2e100b86f6c5961c394d3195e', expectedRBTC: 0.013 },
  { hash: '0xcdcf2463c82579874dd6ef7d950d91f71e2d8c05b7c2eda3cfccc7d4660c7205', expectedRBTC: 0.012 },
  { hash: '0x1e3b2eb3dba0d7769e88b9aa216b39221586866ff1423c49913e38e0397cd8de', expectedRBTC: 0.015 },
  { hash: '0x16bec24739870472e2b357e87f70b4723a1c360dd5a3497be32eb6a5ac4bc75e', expectedRBTC: 0.0 }
];

// Contract addresses from your deployment
const BORROWER_OPERATIONS_ADDRESS = '0xf721a6c73676628Bb708Ee6Cfe7f9e2328a020eF';
const VAULT_MANAGER_ADDRESS = '0xf1df1d059E67E19b270b083bd13AC791C573968b';

async function debugMissingVaults() {
  console.log('🔍 DEBUGGING MISSING VAULT EVENTS');
  console.log(`📡 Using RPC: ${RPC_URL.includes('alchemy') ? 'Alchemy' : 'Public RSK'}`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  for (const tx of TARGET_TRANSACTIONS) {
    try {
      console.log(`\n📋 Analyzing transaction: ${tx.hash}`);
      
      // Get transaction receipt with logs
      const receipt = await provider.getTransactionReceipt(tx.hash);
      
      if (!receipt) {
        console.log(`❌ Transaction not found`);
        continue;
      }
      
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed}`);
      console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
      console.log(`   Logs: ${receipt.logs.length}`);
      
      // Check if any logs are from our contracts
      const relevantLogs = receipt.logs.filter(log => 
        log.address.toLowerCase() === BORROWER_OPERATIONS_ADDRESS.toLowerCase() ||
        log.address.toLowerCase() === VAULT_MANAGER_ADDRESS.toLowerCase()
      );
      
      console.log(`   Relevant logs (from our contracts): ${relevantLogs.length}`);
      
      // Look for VaultUpdated event signature
      const VAULT_UPDATED_SIGNATURE = '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c';
      
      const vaultUpdatedLogs = receipt.logs.filter(log => 
        log.topics[0] === VAULT_UPDATED_SIGNATURE
      );
      
      console.log(`   VaultUpdated events: ${vaultUpdatedLogs.length}`);
      
      if (vaultUpdatedLogs.length > 0) {
        console.log('   ✅ Found VaultUpdated events - indexer should have caught these!');
        
        for (const log of vaultUpdatedLogs) {
          console.log(`      - Address: ${log.address}`);
          console.log(`      - Topics: ${log.topics.length}`);
          if (log.topics[1]) {
            // Decode borrower address from topic[1]
            const borrower = '0x' + log.topics[1].slice(-40);
            console.log(`      - Borrower: ${borrower}`);
          }
        }
      }
      
      // Show all log topics for debugging
      if (receipt.logs.length > 0) {
        console.log('   🔍 All event signatures in this tx:');
        const signatures = [...new Set(receipt.logs.map(log => log.topics[0]))];
        signatures.forEach(sig => {
          const count = receipt.logs.filter(log => log.topics[0] === sig).length;
          console.log(`      ${sig} (${count}x)`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Error analyzing ${tx.hash}:`, error.message);
    }
  }
  
  console.log('\n🎯 Expected Results:');
  console.log('   - 3 vault creation transactions');
  console.log('   - Total 0.04 RBTC locked');
  console.log('   - VaultUpdated events from BorrowerOperations');
  console.log('\n💡 If VaultUpdated events exist but indexer missed them:');
  console.log('   - Check event signature matching');
  console.log('   - Verify contract address filtering');
  console.log('   - Ensure block range coverage includes all target blocks');
}

debugMissingVaults().catch(console.error);