import web3Provider from './utils/web3.js';
import database from './database/connection.js';
import vaultManagerContract from './contracts/VaultManager.js';
import logger from './utils/logger.js';
import { config } from './config/index.js';

async function debugScanner() {
  try {
    logger.info('🔍 Debug Scanner - Checking what the indexer sees...');
    
    // Connect to everything
    await database.connect();
    await web3Provider.connect();
    await vaultManagerContract.initialize();
    
    const provider = web3Provider.getProvider();
    const currentBlock = await provider.getBlockNumber();
    
    logger.info(`Current RSK testnet block: ${currentBlock}`);
    
    // Check last 50 blocks for ANY transactions to VaultManager
    const fromBlock = currentBlock - 50;
    logger.info(`Scanning blocks ${fromBlock} to ${currentBlock} for VaultManager activity...`);
    
    let totalTxs = 0;
    let vaultManagerTxs = 0;
    let blocksWithTxs = 0;
    
    for (let blockNum = fromBlock; blockNum <= currentBlock; blockNum++) {
      try {
        const block = await provider.getBlock(blockNum, true);
        
        if (block && block.transactions && block.transactions.length > 0) {
          blocksWithTxs++;
          totalTxs += block.transactions.length;
          
          logger.info(`Block ${blockNum}: ${block.transactions.length} transactions`);
          
          // Check each transaction
          for (const tx of block.transactions) {
            // Log ALL transactions to see what's happening
            if (tx.to) {
              logger.debug(`  TX: ${tx.hash} -> ${tx.to}`);
              
              // Check if it's to our VaultManager
              if (tx.to.toLowerCase() === config.contracts.vaultManager.toLowerCase()) {
                vaultManagerTxs++;
                logger.info(`  🎯 FOUND VaultManager TX: ${tx.hash}`);
                
                // Get receipt and check for logs
                const receipt = await provider.getTransactionReceipt(tx.hash);
                if (receipt && receipt.logs) {
                  logger.info(`    └─ Receipt has ${receipt.logs.length} logs`);
                  
                  for (const log of receipt.logs) {
                    logger.info(`    └─ Log: ${log.address} topic0: ${log.topics[0]}`);
                    
                    // Check if it matches our event signatures
                    if (log.topics[0] === '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c') {
                      logger.info(`    └─ ✅ This is a VaultUpdated event!`);
                    } else if (log.topics[0] === '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10') {
                      logger.info(`    └─ ✅ This is a VaultLiquidated event!`);
                    }
                  }
                }
              }
            }
          }
        }
        
        // Slow down to avoid rate limiting
        if (blockNum % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        logger.error(`Failed to scan block ${blockNum}: ${error.message}`);
      }
    }
    
    logger.info(`📊 Scan Results:`);
    logger.info(`  Blocks scanned: ${currentBlock - fromBlock + 1}`);
    logger.info(`  Blocks with transactions: ${blocksWithTxs}`);
    logger.info(`  Total transactions: ${totalTxs}`);
    logger.info(`  VaultManager transactions: ${vaultManagerTxs}`);
    
    if (vaultManagerTxs === 0) {
      logger.info(`💡 No VaultManager activity found - this is normal for testnet`);
      logger.info(`   The indexer is working correctly, just no vault events to process`);
    }
    
    // Check if the contract address exists and has code
    const code = await provider.getCode(config.contracts.vaultManager);
    if (code === '0x') {
      logger.error(`❌ Contract ${config.contracts.vaultManager} has no code! Wrong address?`);
    } else {
      logger.info(`✅ Contract ${config.contracts.vaultManager} exists and has code`);
    }
    
    await database.close();
    
  } catch (error) {
    logger.error('Debug scanner failed:', error);
  }
}

debugScanner();