import database from './connection.js';
import logger from '../utils/logger.js';
import { ethers } from 'ethers';

class EventStorage {
  
  async storeVaultEvent(eventData, blockTimestamp) {
    try {
      const query = `
        INSERT INTO vault_events (
          block_number, transaction_hash, log_index, event_name, 
          contract_address, borrower_address, debt_amount, 
          collateral_amount, stake_amount, operation_type, block_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (transaction_hash, log_index) DO NOTHING
        RETURNING id;
      `;

      const values = [
        eventData.blockNumber,
        eventData.transactionHash,
        eventData.logIndex,
        eventData.eventName,
        eventData.contractAddress || '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2',
        eventData.borrower,
        eventData.debt?.toString() || null,
        eventData.collateral?.toString() || null,
        eventData.stake?.toString() || null,
        eventData.operation || null,
        blockTimestamp
      ];

      const result = await database.query(query, values);
      
      if (result.rows.length > 0) {
        logger.debug(`Stored ${eventData.eventName} event for vault ${eventData.borrower}`);
        return result.rows[0].id;
      } else {
        logger.debug(`Event already exists: ${eventData.transactionHash}:${eventData.logIndex}`);
        return null;
      }
    } catch (error) {
      logger.error('Failed to store vault event:', error);
      throw error;
    }
  }

  async updateVaultState(eventData, blockTimestamp) {
    try {
      const collateralEther = eventData.collateral ? 
        parseFloat(ethers.formatEther(eventData.collateral)) : 0;
      const debtEther = eventData.debt ? 
        parseFloat(ethers.formatEther(eventData.debt)) : 0;
      
      const collateralRatio = debtEther > 0 ? 
        (collateralEther / debtEther) * 100 : null;

      // Determine vault status based on operation
      let status = 1; // Default: active
      let liquidatedAt = null;
      let closedAt = null;

      if (eventData.operation === 1 || eventData.operation === 2) {
        status = 3; // liquidated
        liquidatedAt = blockTimestamp;
      } else if (eventData.operation === 3) {
        status = 4; // redeemed
        closedAt = blockTimestamp;
      }

      // Insert or update vault state
      const query = `
        INSERT INTO vault_states (
          vault_owner, collateral_amount, debt_amount, collateral_ratio,
          status, created_at, updated_at, liquidated_at, closed_at, last_event_block
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (vault_owner) DO UPDATE SET
          collateral_amount = EXCLUDED.collateral_amount,
          debt_amount = EXCLUDED.debt_amount,
          collateral_ratio = EXCLUDED.collateral_ratio,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at,
          liquidated_at = COALESCE(vault_states.liquidated_at, EXCLUDED.liquidated_at),
          closed_at = COALESCE(vault_states.closed_at, EXCLUDED.closed_at),
          last_event_block = EXCLUDED.last_event_block
        RETURNING id;
      `;

      const values = [
        eventData.borrower,
        collateralEther,
        debtEther,
        collateralRatio,
        status,
        blockTimestamp, // created_at
        blockTimestamp, // updated_at
        liquidatedAt,
        closedAt,
        eventData.blockNumber
      ];

      const result = await database.query(query, values);
      logger.debug(`Updated vault state for ${eventData.borrower}`);
      
      // Also store in history
      await this.storeVaultHistory(eventData, blockTimestamp, collateralEther, debtEther, collateralRatio, status);
      
      return result.rows[0].id;
    } catch (error) {
      logger.error('Failed to update vault state:', error);
      throw error;
    }
  }

  async storeVaultHistory(eventData, blockTimestamp, collateralEther, debtEther, collateralRatio, status) {
    try {
      const query = `
        INSERT INTO vault_history (
          vault_owner, collateral_amount, debt_amount, collateral_ratio,
          status, operation_type, block_number, transaction_hash, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `;

      const values = [
        eventData.borrower,
        collateralEther,
        debtEther,
        collateralRatio,
        status,
        eventData.operation,
        eventData.blockNumber,
        eventData.transactionHash,
        blockTimestamp
      ];

      await database.query(query, values);
      logger.debug(`Stored vault history for ${eventData.borrower}`);
    } catch (error) {
      logger.error('Failed to store vault history:', error);
      throw error;
    }
  }

  async getLastProcessedBlock() {
    try {
      const result = await database.query(
        'SELECT MAX(block_number) as last_block FROM vault_events'
      );
      
      const lastBlock = result.rows[0].last_block;
      return lastBlock ? parseInt(lastBlock) : null;
    } catch (error) {
      logger.error('Failed to get last processed block:', error);
      return null;
    }
  }

  async getVaultCount() {
    try {
      const result = await database.query(
        'SELECT COUNT(*) as total_vaults FROM vault_states WHERE status = 1'
      );
      
      return parseInt(result.rows[0].total_vaults);
    } catch (error) {
      logger.error('Failed to get vault count:', error);
      return 0;
    }
  }
}

export default new EventStorage();