import { ethers } from 'ethers';
import { config } from '../config/index.js';
import logger from './logger.js';

class Web3Provider {
  constructor() {
    this.provider = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      logger.info(`Connecting to RSK testnet: ${config.rsk.rpcUrl}`);
      
      this.provider = new ethers.JsonRpcProvider(config.rsk.rpcUrl);
      
      // Test connection
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      
      logger.info(`Connected to RSK testnet (Chain ID: ${network.chainId}, Block: ${blockNumber})`);
      this.isConnected = true;
      
      return this.provider;
    } catch (error) {
      logger.error('Failed to connect to RSK testnet:', error);
      throw error;
    }
  }

  getProvider() {
    if (!this.isConnected || !this.provider) {
      throw new Error('Web3 provider not connected. Call connect() first.');
    }
    return this.provider;
  }

  async getLatestBlock() {
    const provider = this.getProvider();
    return await provider.getBlockNumber();
  }

  async getBlock(blockNumber) {
    const provider = this.getProvider();
    return await provider.getBlock(blockNumber);
  }
}

export default new Web3Provider();