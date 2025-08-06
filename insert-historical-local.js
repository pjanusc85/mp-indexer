#!/usr/bin/env node

import { ethers } from 'ethers';
import pkg from 'pg';
const { Pool } = pkg;

const RPC_URL = process.env.RSK_RPC_URL || 'https://mycrypto.testnet.rsk.co';
const VAULT_MANAGER = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
};

// PostgreSQL connection
const pool = new Pool({
  user: process.env.PGUSER || process.env.USER,
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'mp_indexer',
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
});

async function saveVaultEvent(eventData) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO vault_events (
        contract_address, event_type, transaction_hash, block_number, 
        timestamp, topics, data, vault_id, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (transaction_hash, event_type, vault_id) DO NOTHING
      RETURNING id
    `;
    
    const values = [
      eventData.contract_address,
      eventData.event_type,
      eventData.transaction_hash,
      eventData.block_number,
      eventData.timestamp,
      eventData.topics,
      eventData.data,
      eventData.vault_id,
      eventData.processed_at
    ];
    
    const result = await client.query(query, values);
    
    if (result.rowCount > 0) {
      console.log(`✅ Saved ${eventData.event_type} event to local database (ID: ${result.rows[0].id})`);
      return true;
    } else {
      console.log(`📝 ${eventData.event_type} event already exists in database`);
      return true;
    }
  } catch (error) {
    console.error('❌ Error saving vault event:', error.message);
    return false;
  } finally {
    client.release();
  }
}

async function insertHistoricalEvents() {
  console.log('🔍 Inserting historical vault events into local PostgreSQL');
  console.log(`Target block: 3141681\n`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connection successful\n');
    
    // Get block with transactions
    const block = await provider.getBlock(3141681, true);
    
    if (!block) {
      console.log('❌ Block not found');
      return;
    }
    
    console.log(`✅ Block found with ${block.transactions.length} transactions`);
    console.log(`Block timestamp: ${new Date(block.timestamp * 1000).toISOString()}\n`);
    
    let eventsInserted = 0;
    
    // Process the transaction we know contains vault events
    const targetTxHash = '0x2125a31f529d996abd5da025f0374da2b77005a4cca8b392a441e70a7f5b522f';
    console.log(`🔍 Processing transaction: ${targetTxHash}`);
    
    const receipt = await provider.getTransactionReceipt(targetTxHash);
    if (!receipt || !receipt.logs) {
      console.log('❌ No transaction receipt or logs found');
      return;
    }
    
    console.log(`Found ${receipt.logs.length} logs in transaction\n`);
    
    // Process each log
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      
      // Check if this is from VaultManager
      if (log.address.toLowerCase() === VAULT_MANAGER.toLowerCase()) {
        console.log(`Log ${i}: VaultManager event - ${log.topics[0]}`);
        
        // Check if this is a vault event we care about
        const eventType = Object.keys(EVENT_SIGNATURES).find(key => 
          EVENT_SIGNATURES[key] === log.topics[0]
        );
        
        if (eventType) {
          const eventData = {
            contract_address: log.address.toLowerCase(),
            event_type: eventType,
            transaction_hash: log.transactionHash,
            block_number: log.blockNumber,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            topics: log.topics,
            data: log.data,
            vault_id: log.topics[1] || null,
            processed_at: new Date().toISOString()
          };
          
          console.log(`🎉 Found ${eventType} event for vault ${eventData.vault_id}`);
          
          const success = await saveVaultEvent(eventData);
          if (success) {
            eventsInserted++;
          }
        } else {
          console.log(`  Unknown VaultManager event: ${log.topics[0]}`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`Events inserted: ${eventsInserted}`);
    
    if (eventsInserted > 0) {
      console.log(`\n🎉 Historical vault events successfully inserted!`);
      console.log(`💡 Check your local database:`);
      console.log(`   psql -d mp_indexer -c "SELECT * FROM vault_events ORDER BY block_number DESC;"`);
    }
    
    // Show final database stats
    const dbClient = await pool.connect();
    const result = await dbClient.query('SELECT COUNT(*) as total_events FROM vault_events');
    console.log(`\n📊 Total events in local database: ${result.rows[0].total_events}`);
    dbClient.release();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

console.log('🚀 Insert Historical Events to Local PostgreSQL');
console.log('===============================================\n');

insertHistoricalEvents().catch(console.error);