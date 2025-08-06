#!/usr/bin/env node

import { ethers } from 'ethers';
import pkg from 'pg';
const { Pool } = pkg;

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const VAULT_MANAGER = '0x0eccca821f078f394f2bb1f3d615ad73729a9892';

const EVENT_SIGNATURES = {
  VaultUpdated: '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c',
  VaultLiquidated: '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'
};

// PostgreSQL connection
const pool = new Pool({
  user: process.env.PGUSER || 'mp-indexer',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'mp_indexer',
  password: process.env.PGPASSWORD || 'mp-indexer',
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
      console.log(`✅ Saved ${eventData.event_type} event to database (ID: ${result.rows[0].id})`);
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

async function getLastProcessedBlock() {
  const client = await pool.connect();
  try {
    const query = 'SELECT last_processed_block FROM indexer_state WHERE contract_address = $1';
    const result = await client.query(query, [VAULT_MANAGER]);
    return result.rows.length > 0 ? result.rows[0].last_processed_block : 0;
  } catch (error) {
    console.error('❌ Error getting last processed block:', error.message);
    return 0;
  } finally {
    client.release();
  }
}

async function updateLastProcessedBlock(blockNumber) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO indexer_state (contract_address, last_processed_block, last_updated)
      VALUES ($1, $2, NOW())
      ON CONFLICT (contract_address) 
      DO UPDATE SET last_processed_block = $2, last_updated = NOW()
    `;
    await client.query(query, [VAULT_MANAGER, blockNumber]);
    console.log(`📝 Updated last processed block to ${blockNumber.toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error updating last processed block:', error.message);
  } finally {
    client.release();
  }
}

async function getLogsWithRetry(provider, fromBlock, toBlock, eventType, maxRetries = 3) {
  const filter = {
    address: VAULT_MANAGER,
    topics: [EVENT_SIGNATURES[eventType]],
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: `0x${toBlock.toString(16)}`
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const logs = await provider.send('eth_getLogs', [filter]);
      return logs || [];
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed for ${eventType}:`, error.message);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
}

async function processVaultEvents(fromBlock, toBlock, lookbackBlocks = 1000) {
  console.log('🚀 Alchemy-Powered Vault Event Indexer');
  console.log('=====================================\n');
  console.log(`🔗 RPC: Alchemy RSK Testnet`);
  console.log(`🗄️ Database: ${process.env.PGDATABASE || 'mp_indexer'}\n`);
  
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
  
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connection successful\n');
    
    const currentBlock = await provider.getBlockNumber();
    let startBlock, endBlock;
    
    if (fromBlock && toBlock) {
      startBlock = fromBlock;
      endBlock = toBlock;
      console.log(`📋 Processing specified range: ${startBlock.toLocaleString()} to ${endBlock.toLocaleString()}`);
    } else {
      const lastProcessed = await getLastProcessedBlock();
      
      if (lastProcessed === 0) {
        startBlock = Math.max(currentBlock - lookbackBlocks, 0);
        console.log(`🔍 First run - scanning recent ${lookbackBlocks} blocks`);
      } else {
        startBlock = lastProcessed + 1;
        console.log(`📈 Continuing from last processed block`);
      }
      
      endBlock = currentBlock;
    }
    
    console.log(`Current block: ${currentBlock.toLocaleString()}`);
    console.log(`Scanning blocks ${startBlock.toLocaleString()} to ${endBlock.toLocaleString()}\n`);
    
    if (startBlock > endBlock) {
      console.log('💡 No new blocks to process');
      return;
    }
    
    let totalEventsFound = 0;
    
    // Process in chunks to avoid RPC limits
    const chunkSize = 1000; // Alchemy can handle larger chunks than direct RSK RPC
    
    for (let chunkStart = startBlock; chunkStart <= endBlock; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize - 1, endBlock);
      
      console.log(`🔍 Processing blocks ${chunkStart.toLocaleString()} to ${chunkEnd.toLocaleString()}...`);
      
      // Query both event types in parallel
      const [vaultUpdatedLogs, vaultLiquidatedLogs] = await Promise.all([
        getLogsWithRetry(provider, chunkStart, chunkEnd, 'VaultUpdated'),
        getLogsWithRetry(provider, chunkStart, chunkEnd, 'VaultLiquidated')
      ]);
      
      // Process VaultUpdated events
      for (const log of vaultUpdatedLogs) {
        totalEventsFound++;
        
        // Get block timestamp
        const block = await provider.getBlock(parseInt(log.blockNumber, 16));
        
        const eventData = {
          contract_address: log.address.toLowerCase(),
          event_type: 'VaultUpdated',
          transaction_hash: log.transactionHash,
          block_number: parseInt(log.blockNumber, 16),
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          topics: log.topics,
          data: log.data,
          vault_id: log.topics[1] || null,
          processed_at: new Date().toISOString()
        };
        
        console.log(`\n🎉 FOUND VaultUpdated EVENT!`);
        console.log(`   Block: ${eventData.block_number.toLocaleString()}`);
        console.log(`   Vault: ${eventData.vault_id}`);
        console.log(`   Transaction: ${eventData.transaction_hash}`);
        console.log(`   Timestamp: ${eventData.timestamp}`);
        
        await saveVaultEvent(eventData);
      }
      
      // Process VaultLiquidated events
      for (const log of vaultLiquidatedLogs) {
        totalEventsFound++;
        
        // Get block timestamp
        const block = await provider.getBlock(parseInt(log.blockNumber, 16));
        
        const eventData = {
          contract_address: log.address.toLowerCase(),
          event_type: 'VaultLiquidated',
          transaction_hash: log.transactionHash,
          block_number: parseInt(log.blockNumber, 16),
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          topics: log.topics,
          data: log.data,
          vault_id: log.topics[1] || null,
          processed_at: new Date().toISOString()
        };
        
        console.log(`\n🔥 FOUND VaultLiquidated EVENT!`);
        console.log(`   Block: ${eventData.block_number.toLocaleString()}`);
        console.log(`   Vault: ${eventData.vault_id}`);
        console.log(`   Transaction: ${eventData.transaction_hash}`);
        console.log(`   Timestamp: ${eventData.timestamp}`);
        
        await saveVaultEvent(eventData);
      }
      
      if (vaultUpdatedLogs.length > 0 || vaultLiquidatedLogs.length > 0) {
        console.log(`✅ Processed ${vaultUpdatedLogs.length + vaultLiquidatedLogs.length} events in chunk`);
      }
      
      // Update progress after each chunk
      await updateLastProcessedBlock(chunkEnd);
      
      // Small delay between chunks to be respectful to the RPC
      if (chunkStart + chunkSize <= endBlock) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n📊 Indexing Complete:`);
    console.log(`   Blocks processed: ${(endBlock - startBlock + 1).toLocaleString()}`);
    console.log(`   Vault events found: ${totalEventsFound}`);
    
    if (totalEventsFound === 0) {
      console.log(`\n💡 No vault events found in the processed range.`);
      console.log(`💡 This is normal - vault activity is rare on RSK testnet.`);
    } else {
      console.log(`\n🎉 Found ${totalEventsFound} vault events! Check your database:`);
      console.log(`   psql -d mp_indexer -c "SELECT * FROM vault_events ORDER BY block_number DESC LIMIT 10;"`);
    }
    
    // Show final database stats
    const dbClient = await pool.connect();
    const result = await dbClient.query('SELECT COUNT(*) as total_events FROM vault_events');
    console.log(`\n📊 Total events in database: ${result.rows[0].total_events}`);
    dbClient.release();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let fromBlock, toBlock, lookbackBlocks;

if (args.length >= 2) {
  fromBlock = parseInt(args[0]);
  toBlock = parseInt(args[1]);
} else if (args.length === 1) {
  lookbackBlocks = parseInt(args[0]);
}

processVaultEvents(fromBlock, toBlock, lookbackBlocks || 1000).catch(console.error);