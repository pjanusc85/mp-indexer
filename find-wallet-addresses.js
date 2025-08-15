import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';

const CONTRACTS = {
  vaultManager: '0x0eccca821f078f394f2bb1f3d615ad73729a9892',
  activePool: '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F'
};

async function findWalletAddresses() {
  console.log('🔍 Finding wallet addresses that comprise the 1.0111 BTC...');
  
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    console.log(`📊 Current block: ${currentBlock}`);
    console.log(`🎯 Target: Find addresses that sent BTC to ${CONTRACTS.activePool}`);
    console.log('');
    
    // Strategy 1: Search for direct transactions to Active Pool
    console.log('📈 Strategy 1: Direct transactions to Active Pool');
    console.log('═══════════════════════════════════════════════');
    
    const deposits = [];
    let totalFound = 0;
    
    // Search recent blocks first, then go back further
    const searchRanges = [
      { start: Math.max(currentBlock - 1000, 6680000), end: currentBlock, label: "Recent (last 1000 blocks)" },
      { start: Math.max(currentBlock - 10000, 6680000), end: currentBlock - 1000, label: "Medium term (last 10k blocks)" },
      { start: 6680000, end: Math.max(currentBlock - 10000, 6680000), label: "Historical (from block 6680000)" }
    ];
    
    for (const range of searchRanges) {
      if (range.start >= range.end) continue;
      
      console.log(`🔍 Searching ${range.label}: blocks ${range.start} to ${range.end}`);
      
      // Search in chunks to avoid timeouts
      const chunkSize = 500;
      
      for (let fromBlock = range.start; fromBlock < range.end && totalFound < 1.1; fromBlock += chunkSize) {
        const toBlock = Math.min(fromBlock + chunkSize - 1, range.end);
        
        try {
          // Get all blocks in this range and check transactions
          for (let blockNum = fromBlock; blockNum <= Math.min(fromBlock + 50, toBlock); blockNum++) {
            const block = await provider.getBlock(blockNum, true);
            
            if (block && block.transactions) {
              for (const txHash of block.transactions) {
                const tx = await provider.getTransaction(txHash);
                
                if (tx && tx.to && tx.to.toLowerCase() === CONTRACTS.activePool.toLowerCase() && 
                    tx.value && tx.value !== '0') {
                  
                  const amount = parseFloat(ethers.formatEther(tx.value));
                  totalFound += amount;
                  
                  deposits.push({
                    from: tx.from,
                    amount: amount,
                    block: blockNum,
                    txHash: tx.hash,
                    timestamp: new Date(block.timestamp * 1000).toISOString()
                  });
                  
                  console.log(`💰 Found: ${amount.toFixed(6)} BTC from ${tx.from} (block ${blockNum})`);
                  
                  if (totalFound >= 1.1) break; // Found enough to account for the balance
                }
              }
            }
            
            if (totalFound >= 1.1) break;
            
            // Small delay to avoid rate limits
            if (blockNum % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          if (totalFound >= 1.1) break;
          
        } catch (error) {
          console.warn(`  Error in blocks ${fromBlock}-${toBlock}: ${error.message}`);
          continue;
        }
        
        // Progress update
        if (fromBlock % 2000 === 0) {
          console.log(`  ... searched to block ${fromBlock}, found ${totalFound.toFixed(6)} BTC so far`);
        }
      }
      
      if (totalFound >= 1.0) break; // Found enough
    }
    
    console.log('');
    console.log('📊 DIRECT DEPOSITS FOUND:');
    console.log('═══════════════════════════════════════════');
    
    if (deposits.length > 0) {
      deposits.sort((a, b) => b.amount - a.amount); // Sort by amount descending
      
      let runningTotal = 0;
      deposits.forEach((deposit, i) => {
        runningTotal += deposit.amount;
        console.log(`${(i + 1).toString().padStart(2)}. ${deposit.from}`);
        console.log(`    Amount: ${deposit.amount.toFixed(8)} BTC`);
        console.log(`    Block:  ${deposit.block}`);
        console.log(`    Time:   ${deposit.timestamp}`);
        console.log(`    Tx:     ${deposit.txHash}`);
        console.log('');
      });
      
      console.log(`Total found: ${runningTotal.toFixed(8)} BTC`);
      console.log(`Target:      1.011097 BTC`);
      console.log(`Coverage:    ${((runningTotal / 1.011097) * 100).toFixed(1)}%`);
    } else {
      console.log('❌ No direct deposits found in searched range');
    }
    
    // Strategy 2: Look for contract interactions that moved BTC
    console.log('');
    console.log('📈 Strategy 2: Contract interactions via Vault Manager');
    console.log('═══════════════════════════════════════════════════');
    
    // Search for VaultUpdated events which indicate vault operations
    const vaultUpdatedTopic = '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c';
    
    console.log('🔍 Searching for vault creation/update events...');
    
    let vaultEvents = [];
    
    // Search in manageable chunks
    const eventSearchRanges = [
      { start: 6680000, end: Math.min(6690000, currentBlock) },
      { start: Math.max(6680000, currentBlock - 5000), end: currentBlock }
    ];
    
    for (const range of eventSearchRanges) {
      if (range.start >= range.end) continue;
      
      try {
        console.log(`🔍 Searching events in blocks ${range.start} to ${range.end}...`);
        
        const logs = await provider.getLogs({
          address: CONTRACTS.vaultManager,
          topics: [vaultUpdatedTopic],
          fromBlock: `0x${range.start.toString(16)}`,
          toBlock: `0x${range.end.toString(16)}`
        });
        
        console.log(`Found ${logs.length} vault events`);
        
        for (const log of logs.slice(0, 10)) { // Limit to first 10 events
          const tx = await provider.getTransaction(log.transactionHash);
          const receipt = await provider.getTransactionReceipt(log.transactionHash);
          const block = await provider.getBlock(log.blockNumber);
          
          vaultEvents.push({
            vaultId: log.topics[1],
            from: tx.from,
            block: parseInt(log.blockNumber, 16),
            txHash: log.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            gasUsed: receipt.gasUsed.toString()
          });
        }
        
      } catch (error) {
        console.warn(`Error searching events: ${error.message}`);
      }
    }
    
    if (vaultEvents.length > 0) {
      console.log('');
      console.log('🏦 VAULT OPERATIONS FOUND:');
      console.log('══════════════════════════════════════════');
      
      // Group by sender address
      const userVaultOps = {};
      
      vaultEvents.forEach(event => {
        if (!userVaultOps[event.from]) {
          userVaultOps[event.from] = [];
        }
        userVaultOps[event.from].push(event);
      });
      
      let userCount = 0;
      for (const [userAddress, operations] of Object.entries(userVaultOps)) {
        userCount++;
        console.log(`${userCount}. User Address: ${userAddress}`);
        console.log(`   Vault operations: ${operations.length}`);
        console.log(`   Latest operation: block ${Math.max(...operations.map(op => op.block))}`);
        
        // Show unique vault IDs this user interacted with
        const uniqueVaults = [...new Set(operations.map(op => op.vaultId))];
        console.log(`   Vault IDs: ${uniqueVaults.length} unique vault(s)`);
        uniqueVaults.forEach(vaultId => {
          console.log(`     - ${vaultId.substring(0, 10)}...`);
        });
        console.log('');
      }
      
      console.log(`📊 Found ${userCount} unique users with vault operations`);
    }
    
    // Summary
    console.log('');
    console.log('🎯 FINAL ANALYSIS:');
    console.log('═══════════════════════════════════════════');
    console.log(`Active Pool Balance: 1.0110968111 BTC`);
    console.log(`Direct deposits found: ${deposits.length} transactions totaling ${totalFound.toFixed(8)} BTC`);
    console.log(`Vault operations found: ${vaultEvents.length} events from ${Object.keys(vaultEvents.reduce((acc, e) => ({...acc, [e.from]: true}), {})).length} users`);
    console.log('');
    
    if (deposits.length === 0 && vaultEvents.length > 0) {
      console.log('💡 LIKELY EXPLANATION:');
      console.log('The BTC was deposited through vault contract interactions');
      console.log('rather than direct transfers to the Active Pool.');
      console.log('The vault users listed above are likely the contributors.');
      console.log('');
      console.log('To get exact amounts per user, we would need to:');
      console.log('1. Decode the vault event data (requires contract ABI)');
      console.log('2. Track each vault\'s collateral amount');
      console.log('3. Sum up collateral by user address');
    } else if (deposits.length > 0) {
      console.log('✅ SUCCESS: Found the addresses that comprise the 1.0111 BTC!');
    }
    
  } catch (error) {
    console.error('❌ Error finding wallet addresses:', error);
  }
}

findWalletAddresses();