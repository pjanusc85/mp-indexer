import web3Provider from './utils/web3.js';
import database from './database/connection.js';
import vaultManagerContract from './contracts/VaultManager.js';
import logger from './utils/logger.js';
import { config } from './config/index.js';

async function testBlockScanner() {
  try {
    logger.info('Testing Block Scanner approach (no eth_getLogs required)...');
    
    // Test basic connections
    await database.connect();
    await web3Provider.connect();
    await vaultManagerContract.initialize();
    
    const provider = web3Provider.getProvider();
    const blockNumber = await web3Provider.getLatestBlock();
    
    logger.info(`✅ Connected to RSK testnet, latest block: ${blockNumber}`);
    
    // Test block scanning (last 10 blocks)
    const fromBlock = blockNumber - 10;
    logger.info(`Testing block scanning from ${fromBlock} to ${blockNumber}...`);
    
    let totalTransactions = 0;
    let vaultManagerTxs = 0;
    
    for (let i = fromBlock; i <= blockNumber; i++) {
      try {
        const block = await provider.getBlock(i, true); // Include transactions
        
        if (block && block.transactions) {
          totalTransactions += block.transactions.length;
          
          // Check for VaultManager transactions
          for (const tx of block.transactions) {
            if (tx.to && tx.to.toLowerCase() === config.contracts.vaultManager.toLowerCase()) {
              vaultManagerTxs++;
              logger.info(`📝 Found VaultManager transaction: ${tx.hash} in block ${i}`);
              
              // Get transaction receipt to see logs
              const receipt = await provider.getTransactionReceipt(tx.hash);
              if (receipt && receipt.logs) {
                logger.info(`   └─ Transaction has ${receipt.logs.length} logs`);
                
                // Check for our event signatures
                for (const log of receipt.logs) {
                  if (log.address.toLowerCase() === config.contracts.vaultManager.toLowerCase()) {
                    const topic0 = log.topics[0];
                    if (topic0 === '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c') {
                      logger.info(`   └─ ✅ Found VaultUpdated event!`);
                    } else if (topic0 === '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10') {
                      logger.info(`   └─ ✅ Found VaultLiquidated event!`);
                    }
                  }
                }
              }
            }
          }
        }
        
        logger.debug(`Block ${i}: ${block?.transactions?.length || 0} transactions`);
      } catch (error) {
        logger.error(`Failed to scan block ${i}:`, error.message);
      }
    }
    
    logger.info(`✅ Block scanning successful!`);
    logger.info(`   Total transactions scanned: ${totalTransactions}`);
    logger.info(`   VaultManager transactions found: ${vaultManagerTxs}`);
    
    if (vaultManagerTxs === 0) {
      logger.info(`ℹ️  No recent VaultManager activity in last 10 blocks`);
      logger.info(`   This is normal - vault activity might be sporadic on testnet`);
    }
    
    logger.info('✅ Block scanner approach works! Ready to index historical data.');
    
    // Close connections
    await database.close();
    
  } catch (error) {
    logger.error('❌ Block scanner test failed:', error);
    process.exit(1);
  }
}

testBlockScanner();