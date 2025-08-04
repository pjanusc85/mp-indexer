import web3Provider from './utils/web3.js';
import database from './database/connection.js';
import databaseSchema from './database/schema.js';
import eventStorage from './database/events.js';
import vaultManagerContract from './contracts/VaultManager.js';
import logger from './utils/logger.js';
import { config } from './config/index.js';

class BlockScannerIndexer {
  constructor() {
    this.isRunning = false;
    this.lastProcessedBlock = null;
    this.currentBlock = null;
    this.eventSignatures = {
      // VaultUpdated event signature
      VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
      // VaultLiquidated event signature  
      VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
    };
  }

  async initialize() {
    try {
      logger.info('Initializing Block Scanner Indexer (no eth_getLogs required)...');
      
      // Connect to database and web3
      await database.connect();
      await web3Provider.connect();
      
      // Initialize database schema
      await databaseSchema.initializeTables();
      
      // Initialize contracts
      await vaultManagerContract.initialize();
      
      // Get starting block
      this.lastProcessedBlock = await eventStorage.getLastProcessedBlock();
      this.currentBlock = await web3Provider.getLatestBlock();
      
      if (!this.lastProcessedBlock) {
        // Start from recent block if no previous data
        this.lastProcessedBlock = this.currentBlock - 1000; // Last ~8 hours on RSK
        logger.info(`Starting from block ${this.lastProcessedBlock} (no previous data)`);
      } else {
        logger.info(`Resuming from block ${this.lastProcessedBlock}`);
      }
      
      logger.info('Block Scanner Indexer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize block scanner:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Block scanner is already running');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Starting Block Scanner Indexer...');
      
      // Start the main scanning loop
      await this.scanningLoop();
    } catch (error) {
      logger.error('Block scanner encountered an error:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async scanningLoop() {
    while (this.isRunning) {
      try {
        await this.processNewBlocks();
        
        // Wait before next iteration
        await this.sleep(config.indexer.pollInterval);
      } catch (error) {
        logger.error('Error in scanning loop:', error);
        
        // Wait longer before retrying
        await this.sleep(config.indexer.pollInterval * 2);
      }
    }
  }

  async processNewBlocks() {
    try {
      const latestBlock = await web3Provider.getLatestBlock();
      
      if (latestBlock <= this.lastProcessedBlock) {
        logger.debug(`No new blocks. Latest: ${latestBlock}, Last processed: ${this.lastProcessedBlock}`);
        return;
      }

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(latestBlock, fromBlock + 10 - 1); // Process 10 blocks at a time
      
      logger.info(`Scanning blocks ${fromBlock} to ${toBlock} for vault events`);
      
      // Scan blocks one by one
      for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
        await this.scanBlock(blockNumber);
      }
      
      this.lastProcessedBlock = toBlock;
      
      // Log progress
      const vaultCount = await eventStorage.getVaultCount();
      logger.info(`Processed up to block ${toBlock}. Active vaults: ${vaultCount}`);
      
    } catch (error) {
      logger.error('Failed to process new blocks:', error);
      throw error;
    }
  }

  async scanBlock(blockNumber) {
    try {
      const provider = web3Provider.getProvider();
      const block = await provider.getBlock(blockNumber, true); // Include transactions
      
      if (!block || !block.transactions) {
        logger.debug(`Block ${blockNumber} has no transactions`);
        return;
      }

      logger.debug(`Scanning block ${blockNumber} with ${block.transactions.length} transactions`);
      
      // Check each transaction for our contract interactions
      for (const tx of block.transactions) {
        if (tx.to && tx.to.toLowerCase() === config.contracts.vaultManager.toLowerCase()) {
          await this.processTransaction(tx, block);
        }
      }
      
    } catch (error) {
      logger.error(`Failed to scan block ${blockNumber}:`, error);
      // Don't throw - continue with next block
    }
  }

  async processTransaction(transaction, block) {
    try {
      const provider = web3Provider.getProvider();
      const receipt = await provider.getTransactionReceipt(transaction.hash);
      
      if (!receipt || !receipt.logs) {
        return;
      }

      logger.debug(`Processing transaction ${transaction.hash} with ${receipt.logs.length} logs`);
      
      // Process each log in the transaction
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === config.contracts.vaultManager.toLowerCase()) {
          await this.processLog(log, block);
        }
      }
      
    } catch (error) {
      logger.error(`Failed to process transaction ${transaction.hash}:`, error);
      // Don't throw - continue with other transactions
    }
  }

  async processLog(log, block) {
    try {
      // Check if this is a VaultUpdated or VaultLiquidated event
      const topic0 = log.topics[0];
      const blockTimestamp = new Date(block.timestamp * 1000);
      
      let eventData = null;
      
      if (topic0 === this.eventSignatures.VaultUpdated) {
        eventData = vaultManagerContract.parseVaultUpdatedEvent(log);
        logger.debug(`Found VaultUpdated event for ${eventData.borrower} at block ${log.blockNumber}`);
      } else if (topic0 === this.eventSignatures.VaultLiquidated) {
        eventData = vaultManagerContract.parseVaultLiquidatedEvent(log);
        logger.debug(`Found VaultLiquidated event for ${eventData.borrower} at block ${log.blockNumber}`);
      }
      
      if (eventData) {
        // Store raw event
        await eventStorage.storeVaultEvent(eventData, blockTimestamp);
        
        // Update vault state
        await eventStorage.updateVaultState(eventData, blockTimestamp);
        
        logger.info(`✅ Processed ${eventData.eventName} for vault ${eventData.borrower}`);
      }
      
    } catch (error) {
      logger.error('Failed to process log:', error);
      // Don't throw - continue with other logs
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop() {
    logger.info('Stopping block scanner...');
    this.isRunning = false;
    
    // Close database connection
    await database.close();
    
    logger.info('Block scanner stopped');
  }
}

export default BlockScannerIndexer;