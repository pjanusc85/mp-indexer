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
    console.error('❌ Error saving vault event to PostgreSQL:', error.message);
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
    console.log(`📝 Updated last processed block to ${blockNumber}`);
  } catch (error) {
    console.error('❌ Error updating last processed block:', error.message);
  } finally {
    client.release();
  }
}

async function monitorVaultEvents(lookbackBlocks = 100) {
  console.log('🔍 Starting vault event monitoring with local PostgreSQL');
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Database: ${process.env.PGDATABASE || 'mp_indexer'}\n`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connection successful\n');
    
    const currentBlock = await provider.getBlockNumber();
    const lastProcessed = await getLastProcessedBlock();
    
    console.log(`Current block: ${currentBlock.toLocaleString()}`);
    console.log(`Last processed: ${lastProcessed.toLocaleString()}`);
    
    // Determine scanning range
    let fromBlock;
    if (lastProcessed === 0) {
      // First run - start from recent blocks
      fromBlock = Math.max(currentBlock - lookbackBlocks, 0);
      console.log(`First run - scanning recent ${lookbackBlocks} blocks`);
    } else {
      // Continue from last processed block
      fromBlock = lastProcessed + 1;
      console.log(`Continuing from last processed block`);
    }
    
    const toBlock = currentBlock;
    console.log(`Scanning blocks ${fromBlock.toLocaleString()} to ${toBlock.toLocaleString()}\n`);
    
    let eventsFound = 0;
    let blocksScanned = 0;
    
    // Process in chunks
    const chunkSize = 50;
    for (let start = fromBlock; start <= toBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, toBlock);
      
      console.log(`Processing blocks ${start} to ${end}...`);
      
      for (let blockNumber = start; blockNumber <= end; blockNumber++) {
        try {
          const block = await provider.getBlock(blockNumber, true);
          if (!block || !block.transactions || block.transactions.length === 0) {
            continue;
          }
          
          blocksScanned++;
          
          // Process each transaction
          for (const tx of block.transactions) {
            try {
              const txHash = typeof tx === 'string' ? tx : tx.hash;
              const receipt = await provider.getTransactionReceipt(txHash);
              if (!receipt || !receipt.logs) continue;
              
              // Check logs for vault events
              for (const log of receipt.logs) {
                if (log.address.toLowerCase() === VAULT_MANAGER.toLowerCase()) {
                  const eventType = Object.keys(EVENT_SIGNATURES).find(key => 
                    EVENT_SIGNATURES[key] === log.topics[0]
                  );
                  
                  if (eventType) {
                    eventsFound++;
                    
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
                    
                    console.log(`\n🎉 FOUND ${eventType} EVENT!`);
                    console.log(`   Block: ${blockNumber}`);
                    console.log(`   Vault: ${eventData.vault_id}`);
                    console.log(`   Transaction: ${txHash}`);
                    console.log(`   Timestamp: ${eventData.timestamp}`);
                    
                    await saveVaultEvent(eventData);
                  }
                }
              }
            } catch (error) {
              console.error(`Error processing transaction ${typeof tx === 'string' ? tx : tx.hash}:`, error.message);
            }
          }
          
          // Update progress every 100 blocks
          if (blockNumber % 100 === 0) {
            await updateLastProcessedBlock(blockNumber);
          }
        } catch (error) {
          console.error(`Error processing block ${blockNumber}:`, error.message);
        }
      }
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final state update
    await updateLastProcessedBlock(toBlock);
    
    console.log(`\n📊 Scan Complete:`);
    console.log(`   Blocks scanned: ${blocksScanned.toLocaleString()}`);
    console.log(`   Vault events found: ${eventsFound}`);
    
    if (eventsFound === 0) {
      console.log(`\n💡 No vault events found in scanned range.`);
      console.log(`💡 This is normal - vault activity is rare on RSK testnet.`);
    } else {
      console.log(`\n🎉 Found ${eventsFound} vault events! Check your local database.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Parse command line arguments
const lookbackBlocks = process.argv[2] ? parseInt(process.argv[2]) : 100;

console.log('🚀 Money Protocol Local Indexer');
console.log('================================\n');

monitorVaultEvents(lookbackBlocks).catch(console.error);