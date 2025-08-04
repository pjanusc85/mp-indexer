import database from './connection.js';
import logger from '../utils/logger.js';

class DatabaseSchema {
  async initializeTables() {
    try {
      logger.info('Initializing database tables...');

      // Create vault_events table
      await database.query(`
        CREATE TABLE IF NOT EXISTS vault_events (
          id SERIAL PRIMARY KEY,
          block_number BIGINT NOT NULL,
          transaction_hash VARCHAR(66) NOT NULL,
          log_index INTEGER NOT NULL,
          event_name VARCHAR(50) NOT NULL,
          contract_address VARCHAR(42) NOT NULL,
          borrower_address VARCHAR(42) NOT NULL,
          debt_amount DECIMAL(78,0),
          collateral_amount DECIMAL(78,0),
          stake_amount DECIMAL(78,0),
          operation_type INTEGER,
          block_timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(transaction_hash, log_index)
        );
      `);

      // Create vault_states table
      await database.query(`
        CREATE TABLE IF NOT EXISTS vault_states (
          id SERIAL PRIMARY KEY,
          vault_owner VARCHAR(42) NOT NULL,
          collateral_amount DECIMAL(38,18) NOT NULL,
          debt_amount DECIMAL(38,18) NOT NULL,
          collateral_ratio DECIMAL(10,4),
          status INTEGER NOT NULL,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL,
          liquidated_at TIMESTAMP NULL,
          closed_at TIMESTAMP NULL,
          last_event_block BIGINT NOT NULL,
          UNIQUE(vault_owner)
        );
      `);

      // Create vault_history table
      await database.query(`
        CREATE TABLE IF NOT EXISTS vault_history (
          id SERIAL PRIMARY KEY,
          vault_owner VARCHAR(42) NOT NULL,
          collateral_amount DECIMAL(38,18) NOT NULL,
          debt_amount DECIMAL(38,18) NOT NULL,
          collateral_ratio DECIMAL(10,4),
          status INTEGER NOT NULL,
          operation_type INTEGER,
          block_number BIGINT NOT NULL,
          transaction_hash VARCHAR(66) NOT NULL,
          timestamp TIMESTAMP NOT NULL
        );
      `);

      // Create indexes
      await this.createIndexes();

      // Create or update analytics views
      await this.createViews();

      logger.info('Database tables initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database tables:', error);
      throw error;
    }
  }

  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_vault_events_borrower ON vault_events(borrower_address);',
      'CREATE INDEX IF NOT EXISTS idx_vault_events_block ON vault_events(block_number);',
      'CREATE INDEX IF NOT EXISTS idx_vault_events_timestamp ON vault_events(block_timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_vault_states_status ON vault_states(status);',
      'CREATE INDEX IF NOT EXISTS idx_vault_history_timestamp ON vault_history(timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_vault_history_owner ON vault_history(vault_owner);'
    ];

    for (const indexQuery of indexes) {
      await database.query(indexQuery);
    }

    logger.info('Database indexes created');
  }

  async createViews() {
    // Drop existing views to recreate them
    await database.query('DROP VIEW IF EXISTS daily_vault_metrics CASCADE;');
    await database.query('DROP VIEW IF EXISTS open_vaults_by_date CASCADE;');
    await database.query('DROP VIEW IF EXISTS current_vault_status CASCADE;');

    // Daily vault metrics view
    await database.query(`
      CREATE VIEW daily_vault_metrics AS
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as new_vaults,
        AVG(collateral_amount) as avg_collateral,
        AVG(debt_amount) as avg_debt,
        AVG(collateral_ratio) as avg_collateral_ratio,
        SUM(collateral_amount) as total_collateral,
        SUM(debt_amount) as total_debt
      FROM vault_history 
      GROUP BY DATE(timestamp)
      ORDER BY date;
    `);

    // Open vaults by date view (compatible with existing Superset charts)
    await database.query(`
      CREATE VIEW open_vaults_by_date AS
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as vaults_opened,
        COUNT(*) FILTER (WHERE status = 1) as active_vaults,
        COUNT(*) FILTER (WHERE status = 3) as liquidated_vaults,
        COUNT(*) FILTER (WHERE status IN (2, 4)) as closed_vaults,
        SUM(COUNT(*)) OVER (ORDER BY DATE(timestamp)) as cumulative_vaults_created
      FROM vault_history 
      GROUP BY DATE(timestamp)
      ORDER BY date;
    `);

    // Current vault status view
    await database.query(`
      CREATE VIEW current_vault_status AS
      SELECT 
        vs.*,
        CASE 
          WHEN vs.status = 1 THEN 'Active'
          WHEN vs.status = 2 THEN 'Closed by Owner'
          WHEN vs.status = 3 THEN 'Liquidated'
          WHEN vs.status = 4 THEN 'Redeemed'
          ELSE 'Unknown'
        END as status_name,
        CASE 
          WHEN vs.collateral_ratio < 110 THEN 'At Risk'
          WHEN vs.collateral_ratio < 150 THEN 'Low'
          WHEN vs.collateral_ratio < 200 THEN 'Medium'
          ELSE 'Safe'
        END as risk_level
      FROM vault_states vs
      WHERE vs.status = 1
      ORDER BY vs.collateral_ratio ASC;
    `);

    logger.info('Database views created');
  }
}

export default new DatabaseSchema();