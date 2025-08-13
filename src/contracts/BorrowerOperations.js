import { ethers } from 'ethers';
import web3Provider from '../utils/web3.js';
import logger from '../utils/logger.js';

class BorrowerOperationsContract {
  constructor() {
    this.contract = null;
    this.address = '0xA8437A34a61B64764EA261e9cf85403c0Bb57e25'; // From deployment
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
              "name": "_borrower",
              "type": "address"
            },
            {
              "indexed": false,
              "internalType": "uint256",
              "name": "_BPDFee",
              "type": "uint256"
            }
          ],
          "name": "BPDBorrowingFeePaid",
          "type": "event"
        }
      ];

      this.contract = new ethers.Contract(
        this.address,
        abi,
        web3Provider.getProvider()
      );

      logger.info(`BorrowerOperations contract initialized at ${this.address}`);
    } catch (error) {
      logger.error('Failed to initialize BorrowerOperations contract:', error);
      throw error;
    }
  }

  getContract() {
    if (!this.contract) {
      throw new Error('BorrowerOperations contract not initialized');
    }
    return this.contract;
  }

  getBorrowingFeePaidFilter() {
    return this.contract.filters.BPDBorrowingFeePaid();
  }

  parseBorrowingFeePaidEvent(log) {
    try {
      const parsed = this.contract.interface.parseLog(log);
      
      return {
        borrower: parsed.args._borrower,
        bpdFee: parsed.args._BPDFee.toString(),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex
      };
    } catch (error) {
      logger.error('Failed to parse BPDBorrowingFeePaid event:', error);
      throw error;
    }
  }
}

export default new BorrowerOperationsContract();