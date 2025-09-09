import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // RSK Testnet Configuration
  rsk: {
    rpcUrl: process.env.RSK_RPC_URL || 'https://public-node.testnet.rsk.co',
    networkId: 31, // RSK Testnet
    blockTime: 30, // RSK average block time in seconds
  },
  
  // Contract Addresses (RSK Testnet) - Latest deployment c6b0a06a40367f4e776d55029ee92749abfa14b1
  contracts: {
    vaultManager: process.env.VAULT_MANAGER_ADDRESS || '0xf1df1d059E67E19b270b083bd13AC791C573968b',
    borrowerOperations: process.env.BORROWER_OPERATIONS_ADDRESS || '0xf721a6c73676628Bb708Ee6Cfe7f9e2328a020eF',
    sortedVaults: process.env.SORTED_VAULTS_ADDRESS || '0x045cf0431C72AA2bcF100f730e3226Ef4dbF7486',
    mpStaking: process.env.MP_STAKING_ADDRESS || '0x614720C2D9dA3e2eC10F1214bD9e8Cb0fe06123D',
    stabilityPool: process.env.STABILITY_POOL_ADDRESS || '0xdA30a81004d4530e4C632D3Fa11F53558dB6209b',
    activePool: process.env.ACTIVE_POOL_ADDRESS || '0x4C02Dc259a09B759Ef20013697d4465203f8Fac0',
    priceFeed: process.env.PRICE_FEED_ADDRESS || '0x531FfeE0cAbb47718Cbe7489862Cfc7A4BD430Df',
    bpdToken: process.env.BPD_TOKEN_ADDRESS || '0x8E2646c8fEF01a0Bb94c5836717E571C772De1B9',
    mpToken: process.env.MP_TOKEN_ADDRESS || '0x411a65a1db8693529Dbb3bbf13814B4464EbcE97B',
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
    startBlock: process.env.START_BLOCK || '6801519',
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