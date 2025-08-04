import web3Provider from './utils/web3.js';
import database from './database/connection.js';
import vaultManagerContract from './contracts/VaultManager.js';
import logger from './utils/logger.js';

async function testConnections() {
  try {
    logger.info('Testing Money Protocol Indexer connections...');
    
    // Test database connection
    logger.info('Testing database connection...');
    await database.connect();
    const dbResult = await database.query('SELECT NOW() as current_time');
    logger.info(`✅ Database connected: ${dbResult.rows[0].current_time}`);
    
    // Test RSK connection
    logger.info('Testing RSK testnet connection...');
    await web3Provider.connect();
    const blockNumber = await web3Provider.getLatestBlock();
    logger.info(`✅ RSK testnet connected: Latest block ${blockNumber}`);
    
    // Test contract
    logger.info('Testing VaultManager contract...');
    await vaultManagerContract.initialize();
    const contract = vaultManagerContract.getContract();
    logger.info(`✅ VaultManager contract loaded at ${contract.target}`);
    
    // Test event filters
    const vaultUpdatedFilter = vaultManagerContract.getVaultUpdatedFilter();
    const vaultLiquidatedFilter = vaultManagerContract.getVaultLiquidatedFilter();
    logger.info('✅ Event filters created successfully');
    
    // Query recent events (last 100 blocks)
    const fromBlock = blockNumber - 100;
    logger.info(`Checking for events in blocks ${fromBlock} to ${blockNumber}...`);
    
    const vaultUpdatedLogs = await contract.queryFilter(vaultUpdatedFilter, fromBlock, blockNumber);
    const vaultLiquidatedLogs = await contract.queryFilter(vaultLiquidatedFilter, fromBlock, blockNumber);
    
    logger.info(`Found ${vaultUpdatedLogs.length} VaultUpdated events`);
    logger.info(`Found ${vaultLiquidatedLogs.length} VaultLiquidated events`);
    
    if (vaultUpdatedLogs.length > 0) {
      const firstEvent = vaultManagerContract.parseVaultUpdatedEvent(vaultUpdatedLogs[0]);
      logger.info('Sample VaultUpdated event:', {
        borrower: firstEvent.borrower,
        debt: firstEvent.debt?.toString(),
        collateral: firstEvent.collateral?.toString(),
        operation: firstEvent.operation,
        blockNumber: firstEvent.blockNumber
      });
    }
    
    logger.info('✅ All connections and contract interactions working!');
    
    // Close connections
    await database.close();
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testConnections();