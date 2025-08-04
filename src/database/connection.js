import pkg from 'pg';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

const { Pool } = pkg;

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      logger.info('Connecting to PostgreSQL database...');
      
      this.pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        user: config.database.user,
        password: config.database.password,
        ssl: config.database.ssl,
        max: 20, // Maximum number of clients in pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();

      logger.info(`Connected to database: ${config.database.database} at ${result.rows[0].current_time}`);
      this.isConnected = true;

      return this.pool;
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  getPool() {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  async query(text, params) {
    const pool = this.getPool();
    const start = Date.now();
    
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 100)}...`);
      return result;
    } catch (error) {
      logger.error(`Query failed: ${text}`, error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }
}

export default new Database();