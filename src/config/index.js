import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // RSK Testnet Configuration
  rsk: {
    rpcUrl: process.env.RSK_RPC_URL || 'https://public-node.testnet.rsk.co',
    networkId: 31, // RSK Testnet
    blockTime: 30, // RSK average block time in seconds
  },
  
  // Contract Addresses (RSK Testnet)
  contracts: {
    vaultManager: process.env.VAULT_MANAGER_ADDRESS || '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2',
    sortedVaults: process.env.SORTED_VAULTS_ADDRESS || '0xDBA59981bda70CCBb5458e907f5A0729F1d24a05',
  },
  
  // PostgreSQL Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'analytics',
    user: process.env.DB_USER || 'superset',
    password: process.env.DB_PASSWORD || 'superset',
    ssl: process.env.DB_SSL === 'true',
  },
  
  // Indexer Configuration
  indexer: {
    startBlock: process.env.START_BLOCK || 'latest',
    pollInterval: parseInt(process.env.POLL_INTERVAL) || 12000, // 12 seconds
    batchSize: parseInt(process.env.BATCH_SIZE) || 100,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'indexer.log',
  },
};