import BlockScannerIndexer from './indexer-block-scanner.js';
import logger from './utils/logger.js';

async function main() {
  const indexer = new BlockScannerIndexer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await indexer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await indexer.stop();
    process.exit(0);
  });

  try {
    // Initialize and start block scanner
    await indexer.initialize();
    await indexer.start();
  } catch (error) {
    logger.error('Failed to start block scanner:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error('Unhandled error:', error);  
  process.exit(1);
});