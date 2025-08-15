import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';

const ACTUAL_CONTRACT = '0x9Ea9FA0e1605382aE217966173E26E2f5EE73ac6'; // From the transaction
const CONFIGURED_CONTRACT = '0x6651E5d0C04CBefCa1ce9eDDd479BA8f7B4A6976'; // What's in our config

async function checkNewMPContract() {
  console.log('🔍 CHECKING MP STAKING CONTRACT MISMATCH');
  console.log('═══════════════════════════════════════════════');
  console.log(`🎯 Your transaction went to: ${ACTUAL_CONTRACT}`);
  console.log(`⚙️ Our indexer monitors: ${CONFIGURED_CONTRACT}`);
  console.log('🔍 Let\'s investigate what this new contract is');
  console.log('');
  
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Check both contracts
    console.log('📊 CONTRACT ANALYSIS');
    console.log('═══════════════════════════════════════════');
    
    const actualCode = await provider.getCode(ACTUAL_CONTRACT);
    const configuredCode = await provider.getCode(CONFIGURED_CONTRACT);
    
    console.log(`Actual contract (${ACTUAL_CONTRACT}):`);
    console.log(`   Has code: ${actualCode.length > 2 ? '✅ YES' : '❌ NO'}`);
    console.log(`   Code size: ${actualCode.length} bytes`);
    console.log('');
    
    console.log(`Configured contract (${CONFIGURED_CONTRACT}):`);
    console.log(`   Has code: ${configuredCode.length > 2 ? '✅ YES' : '❌ NO'}`);
    console.log(`   Code size: ${configuredCode.length} bytes`);
    console.log('');
    
    // Check recent transactions to both contracts
    console.log('📈 RECENT ACTIVITY ANALYSIS');
    console.log('═══════════════════════════════════════');
    
    const currentBlock = await provider.getBlockNumber();
    const searchBlocks = 1000; // Last 1000 blocks
    
    let actualContractTxs = 0;
    let configuredContractTxs = 0;
    
    console.log(`Searching last ${searchBlocks} blocks for activity...`);
    
    for (let i = 0; i < 10; i++) { // Sample 10 blocks
      const blockNum = currentBlock - (i * 100);
      
      try {
        const block = await provider.getBlock(blockNum, true);
        if (block && block.transactions) {
          for (const txHash of block.transactions) {
            const tx = await provider.getTransaction(txHash);
            
            if (tx && tx.to) {
              if (tx.to.toLowerCase() === ACTUAL_CONTRACT.toLowerCase()) {
                actualContractTxs++;
              }
              if (tx.to.toLowerCase() === CONFIGURED_CONTRACT.toLowerCase()) {
                configuredContractTxs++;
              }
            }
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    console.log(`Transactions to actual contract: ${actualContractTxs}`);
    console.log(`Transactions to configured contract: ${configuredContractTxs}`);
    console.log('');
    
    // Check what events the actual contract emits
    console.log('🔍 EVENT SIGNATURE ANALYSIS');
    console.log('═══════════════════════════════════════');
    
    const STAKING_TX_HASH = '0xfbbfcfd022bae6860e2ecf4194cbe165f387ca5c917cf9879236fe757907403c';
    const receipt = await provider.getTransactionReceipt(STAKING_TX_HASH);
    
    console.log('Event signatures from your staking transaction:');
    
    const eventSignatures = new Set();
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === ACTUAL_CONTRACT.toLowerCase()) {
        eventSignatures.add(log.topics[0]);
        console.log(`📝 ${log.topics[0]} (from actual contract)`);
      }
    }
    
    console.log('');
    
    // Check current MP staking configuration
    console.log('⚙️ CURRENT INDEXER CONFIGURATION');
    console.log('═══════════════════════════════════════');
    
    // Read the current alchemy-cron.js to see MP staking config
    console.log('Current MP Staking contract in indexer:');
    console.log(`   ${CONFIGURED_CONTRACT}`);
    console.log('');
    console.log('Actual contract being used:');
    console.log(`   ${ACTUAL_CONTRACT}`);
    console.log('');
    
    // Recommend fix
    console.log('🔧 RECOMMENDED FIX');
    console.log('═══════════════════════════════════════');
    
    if (actualContractTxs > configuredContractTxs) {
      console.log('✅ ISSUE IDENTIFIED: Contract address mismatch!');
      console.log('');
      console.log('The MP Staking contract address in the indexer needs to be updated:');
      console.log('');
      console.log('UPDATE FROM:');
      console.log(`   mpStaking: '${CONFIGURED_CONTRACT}'`);
      console.log('');
      console.log('UPDATE TO:');
      console.log(`   mpStaking: '${ACTUAL_CONTRACT}'`);
      console.log('');
      console.log('Files to update:');
      console.log('   1. api/alchemy-cron.js - CONTRACTS object');
      console.log('   2. src/contracts/MPStaking.js - if it exists');
      console.log('   3. Any other config files');
      console.log('');
      console.log('After updating, your MP staking transactions will be indexed correctly!');
    } else {
      console.log('🤔 Both contracts have similar activity levels');
      console.log('Need to investigate which one is the correct current MP staking contract');
    }
    
    // Check if this is a new deployment
    console.log('');
    console.log('📅 CONTRACT DEPLOYMENT CHECK');
    console.log('═══════════════════════════════════════');
    
    // Try to find deployment block for actual contract
    console.log('Checking when the actual contract was deployed...');
    
    const deploymentBlocks = [6700000, 6710000, currentBlock - 5000];
    
    for (const blockNum of deploymentBlocks) {
      try {
        const block = await provider.getBlock(blockNum, true);
        if (block && block.transactions) {
          for (const txHash of block.transactions) {
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (receipt && receipt.contractAddress && 
                receipt.contractAddress.toLowerCase() === ACTUAL_CONTRACT.toLowerCase()) {
              console.log(`✅ Found deployment at block ${blockNum}`);
              console.log(`   Transaction: ${txHash}`);
              console.log(`   Deployer: ${receipt.from}`);
              break;
            }
          }
        }
      } catch (error) {
        continue;
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking MP contract:', error);
  }
}

checkNewMPContract();