import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/index.js';
import web3Provider from '../utils/web3.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VaultManagerContract {
  constructor() {
    this.contract = null;
    this.abi = null;
    this.address = config.contracts.vaultManager;
  }

  async initialize() {
    try {
      // Load ABI
      const abiPath = join(__dirname, 'VaultManager.json');
      this.abi = JSON.parse(readFileSync(abiPath, 'utf8'));
      
      // Initialize contract
      const provider = web3Provider.getProvider();
      this.contract = new ethers.Contract(this.address, this.abi, provider);
      
      logger.info(`VaultManager contract initialized at ${this.address}`);
      return this.contract;
    } catch (error) {
      logger.error('Failed to initialize VaultManager contract:', error);
      throw error;
    }
  }

  getContract() {
    if (!this.contract) {
      throw new Error('VaultManager contract not initialized. Call initialize() first.');
    }
    return this.contract;
  }

  // Event filter helpers
  getVaultUpdatedFilter() {
    const contract = this.getContract();
    return contract.filters.VaultUpdated();
  }

  getVaultLiquidatedFilter() {
    const contract = this.getContract();
    return contract.filters.VaultLiquidated();
  }

  // Parse event data
  parseVaultUpdatedEvent(log) {
    try {
      const contract = this.getContract();
      const parsed = contract.interface.parseLog(log);
      
      return {
        eventName: 'VaultUpdated',
        borrower: parsed.args._borrower,
        debt: parsed.args._debt,
        collateral: parsed.args._coll,
        stake: parsed.args._stake,
        operation: parsed.args._operation,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      };
    } catch (error) {
      logger.error('Failed to parse VaultUpdated event:', error);
      throw error;
    }
  }

  parseVaultLiquidatedEvent(log) {
    try {
      const contract = this.getContract();
      const parsed = contract.interface.parseLog(log);
      
      return {
        eventName: 'VaultLiquidated',
        borrower: parsed.args._borrower,
        debt: parsed.args._debt,
        collateral: parsed.args._coll,
        operation: parsed.args._operation,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      };
    } catch (error) {
      logger.error('Failed to parse VaultLiquidated event:', error);
      throw error;
    }
  }

  // Utility functions
  formatWeiToEther(weiValue) {
    return parseFloat(ethers.formatEther(weiValue));
  }

  calculateCollateralRatio(collateral, debt) {
    if (debt === 0n) return null;
    const collateralEther = this.formatWeiToEther(collateral);
    const debtEther = this.formatWeiToEther(debt);
    return (collateralEther / debtEther) * 100;
  }

  // Vault status enum mapping
  getVaultStatus(operation) {
    // Based on VaultManagerOperation enum from contract
    const operationMap = {
      0: 1, // applyPendingRewards -> active
      1: 3, // liquidateInNormalMode -> liquidated
      2: 3, // liquidateInRecoveryMode -> liquidated
      3: 4, // redeemCollateral -> redeemed
    };
    
    return operationMap[operation] || 1; // Default to active
  }
}

export default new VaultManagerContract();