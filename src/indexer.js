import web3Provider from './utils/web3.js';
import database from './database/connection.js';
import databaseSchema from './database/schema.js';
import eventStorage from './database/events.js';
import vaultManagerContract from './contracts/VaultManager.js';
import logger from './utils/logger.js';
import { config } from './config/index.js';

class MoneyProtocolIndexer {
  constructor() {
    this.isRunning = false;
    this.lastProcessedBlock = null;
    this.currentBlock = null;
  }

  async initialize() {
    try {
      logger.info('Initializing Money Protocol Indexer...');
      
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
      
      logger.info('Indexer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize indexer:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Indexer is already running');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Starting Money Protocol Indexer...');
      
      // Start the main indexing loop
      await this.indexingLoop();
    } catch (error) {
      logger.error('Indexer encountered an error:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async indexingLoop() {
    while (this.isRunning) {
      try {
        await this.processNewBlocks();
        
        // Wait before next iteration
        await this.sleep(config.indexer.pollInterval);
      } catch (error) {
        logger.error('Error in indexing loop:', error);
        
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
      const toBlock = Math.min(latestBlock, fromBlock + config.indexer.batchSize - 1);
      
      logger.info(`Processing blocks ${fromBlock} to ${toBlock}`);
      
      // Get VaultUpdated events
      await this.processVaultUpdatedEvents(fromBlock, toBlock);
      
      // Get VaultLiquidated events  
      await this.processVaultLiquidatedEvents(fromBlock, toBlock);
      
      this.lastProcessedBlock = toBlock;
      
      // Log progress
      const vaultCount = await eventStorage.getVaultCount();
      logger.info(`Processed up to block ${toBlock}. Active vaults: ${vaultCount}`);
      
    } catch (error) {
      logger.error('Failed to process new blocks:', error);
      throw error;
    }
  }

  async processVaultUpdatedEvents(fromBlock, toBlock) {
    try {
      const contract = vaultManagerContract.getContract();
      const filter = vaultManagerContract.getVaultUpdatedFilter();
      
      const logs = await contract.queryFilter(filter, fromBlock, toBlock);
      
      logger.debug(`Found ${logs.length} VaultUpdated events in blocks ${fromBlock}-${toBlock}`);
      
      for (const log of logs) {
        await this.processVaultEvent(log, 'VaultUpdated');
      }
    } catch (error) {
      logger.error('Failed to process VaultUpdated events:', error);
      throw error;
    }
  }

  async processVaultLiquidatedEvents(fromBlock, toBlock) {
    try {
      const contract = vaultManagerContract.getContract();
      const filter = vaultManagerContract.getVaultLiquidatedFilter();
      
      const logs = await contract.queryFilter(filter, fromBlock, toBlock);
      
      logger.debug(`Found ${logs.length} VaultLiquidated events in blocks ${fromBlock}-${toBlock}`);
      
      for (const log of logs) {
        await this.processVaultEvent(log, 'VaultLiquidated');
      }
    } catch (error) {
      logger.error('Failed to process VaultLiquidated events:', error);
      throw error;
    }
  }

  async processVaultEvent(log, eventType) {
    try {
      // Parse event based on type
      let eventData;
      if (eventType === 'VaultUpdated') {
        eventData = vaultManagerContract.parseVaultUpdatedEvent(log);
      } else if (eventType === 'VaultLiquidated') {
        eventData = vaultManagerContract.parseVaultLiquidatedEvent(log);
      }
      
      // Get block timestamp
      const block = await web3Provider.getBlock(log.blockNumber);
      const blockTimestamp = new Date(block.timestamp * 1000);
      
      // Store raw event
      await eventStorage.storeVaultEvent(eventData, blockTimestamp);
      
      // Update vault state
      await eventStorage.updateVaultState(eventData, blockTimestamp);
      
      logger.debug(`Processed ${eventType} for vault ${eventData.borrower} at block ${log.blockNumber}`);
      
    } catch (error) {
      logger.error(`Failed to process ${eventType} event:`, error);
      // Don't throw - continue with other events
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop() {
    logger.info('Stopping indexer...');
    this.isRunning = false;
    
    // Close database connection
    await database.close();
    
    logger.info('Indexer stopped');
  }
}

export default MoneyProtocolIndexer;