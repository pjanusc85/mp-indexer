import { ethers } from 'ethers';
import web3Provider from '../utils/web3.js';
import logger from '../utils/logger.js';

class MPStakingContract {
  constructor() {
    this.contract = null;
    this.address = '0x6651E5d0C04CBefCa1ce9eDDd479BA8f7B4A6976'; // From deployment
  }

  async initialize() {
    try {
      const abi = [
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "internalType": "address",
              "name": "_staker",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "_BPDGain",
              "type": "uint256"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "_BTCGain",
              "type": "uint256"
            }
          ],
          "name": "StakingGainsWithdrawn",
          "type": "event"
        }
      ];

      this.contract = new ethers.Contract(
        this.address,
        abi,
        web3Provider.getProvider()
      );

      logger.info(`MPStaking contract initialized at ${this.address}`);
    } catch (error) {
      logger.error('Failed to initialize MPStaking contract:', error);
      throw error;
    }
  }

  getContract() {
    if (!this.contract) {
      throw new Error('MPStaking contract not initialized');
    }
    return this.contract;
  }

  getStakingGainsWithdrawnFilter() {
    return this.contract.filters.StakingGainsWithdrawn();
  }

  parseStakingGainsWithdrawnEvent(log) {
    try {
      const parsed = this.contract.interface.parseLog(log);
      
      return {
        staker: parsed.args._staker,
        bpdGain: parsed.args._BPDGain.toString(),
        btcGain: parsed.args._BTCGain.toString(),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex
      };
    } catch (error) {
      logger.error('Failed to parse StakingGainsWithdrawn event:', error);
      throw error;
    }
  }
}

export default new MPStakingContract();