import MoneyProtocolIndexer from './indexer.js';
import logger from './utils/logger.js';

async function main() {
  const indexer = new MoneyProtocolIndexer();
  
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
    // Initialize and start indexer
    await indexer.initialize();
    await indexer.start();
  } catch (error) {
    logger.error('Failed to start indexer:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});