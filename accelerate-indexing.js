#!/usr/bin/env node

const INDEXER_URL = 'https://mp-indexer-3bylmrhs2-pjanusc85s-projects.vercel.app/api/cron-indexer';

console.log('🚀 Accelerated Indexing Script');
console.log('📍 Target: Process blocks 2,965,933 to 3,300,000');
console.log('🎯 Goal: Find vault creation events\n');

let totalBlocksProcessed = 0;
let totalEventsFound = 0;
let runCount = 0;
let startTime = Date.now();

async function runIndexer() {
  try {
    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    runCount++;
    totalBlocksProcessed += data.blocksProcessed || 0;
    totalEventsFound += data.eventsProcessed || 0;
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`[${runCount.toString().padStart(3)}] ${data.fromBlock} → ${data.toBlock} | ` +
               `Blocks: ${data.blocksProcessed} | Events: ${data.eventsProcessed} | ` +
               `Time: ${data.timeElapsed}ms | Elapsed: ${elapsed}s`);
    
    if (data.eventsProcessed > 0) {
      console.log(`🎉 FOUND ${data.eventsProcessed} VAULT EVENTS! 🎉`);
    }
    
    return {
      success: true,
      fromBlock: data.fromBlock,
      toBlock: data.toBlock,
      blocksProcessed: data.blocksProcessed,
      eventsProcessed: data.eventsProcessed,
      currentBlock: data.currentBlock
    };
    
  } catch (error) {
    console.log(`[${runCount + 1}] ❌ Error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function accelerateIndexing(options = {}) {
  const {
    maxRuns = 50,           // Maximum number of runs
    concurrent = 3,         // Number of concurrent requests
    delayMs = 500,          // Delay between batch starts (ms)
    targetBlock = 3300000,  // Stop when we reach this block
    checkInterval = 5       // Show progress every N runs
  } = options;
  
  console.log(`⚙️  Configuration:`);
  console.log(`   Max runs: ${maxRuns}`);
  console.log(`   Concurrent requests: ${concurrent}`);
  console.log(`   Delay between batches: ${delayMs}ms`);
  console.log(`   Target block: ${targetBlock.toLocaleString()}`);
  console.log(`   Progress updates every: ${checkInterval} runs\n`);
  
  let completedRuns = 0;
  let errorCount = 0;
  let currentBlock = 0;
  
  while (completedRuns < maxRuns) {
    // Create a batch of concurrent requests
    const batchSize = Math.min(concurrent, maxRuns - completedRuns);
    const batch = [];
    
    for (let i = 0; i < batchSize; i++) {
      batch.push(runIndexer());
    }
    
    // Wait for all requests in the batch to complete
    const results = await Promise.all(batch);
    completedRuns += batchSize;
    
    // Process results
    for (const result of results) {
      if (result.success) {
        currentBlock = Math.max(currentBlock, result.toBlock);
        
        // Check if we've reached the target block
        if (result.toBlock >= targetBlock) {
          console.log(`\n🎯 Reached target block ${targetBlock}! Stopping acceleration.`);
          break;
        }
      } else {
        errorCount++;
      }
    }
    
    // Show progress summary
    if (completedRuns % checkInterval === 0 || completedRuns >= maxRuns) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const blocksPerSecond = (totalBlocksProcessed / elapsed).toFixed(1);
      const progress = targetBlock > 0 ? ((currentBlock - 2965933) / (targetBlock - 2965933) * 100).toFixed(1) : 0;
      
      console.log(`\n📊 Progress Summary (${completedRuns}/${maxRuns} runs):`);
      console.log(`   Current block: ${currentBlock.toLocaleString()}`);
      console.log(`   Progress: ${progress}% to target (${targetBlock.toLocaleString()})`);
      console.log(`   Total blocks processed: ${totalBlocksProcessed.toLocaleString()}`);
      console.log(`   Total events found: ${totalEventsFound}`);
      console.log(`   Processing rate: ${blocksPerSecond} blocks/second`);
      console.log(`   Errors: ${errorCount}`);
      console.log(`   Time elapsed: ${elapsed}s\n`);
    }
    
    // Stop if we've reached the target
    if (currentBlock >= targetBlock) {
      break;
    }
    
    // Add delay between batches to avoid overwhelming the server
    if (completedRuns < maxRuns && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Final summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const avgBlocksPerSecond = (totalBlocksProcessed / totalElapsed).toFixed(1);
  
  console.log(`\n🏁 Acceleration Complete!`);
  console.log(`📊 Final Statistics:`);
  console.log(`   Runs completed: ${runCount}`);
  console.log(`   Total blocks processed: ${totalBlocksProcessed.toLocaleString()}`);
  console.log(`   Total events found: ${totalEventsFound}`);
  console.log(`   Current block reached: ${currentBlock.toLocaleString()}`);
  console.log(`   Total time: ${totalElapsed}s`);
  console.log(`   Average rate: ${avgBlocksPerSecond} blocks/second`);
  console.log(`   Errors: ${errorCount}`);
  
  if (totalEventsFound > 0) {
    console.log(`\n🎉 SUCCESS! Found ${totalEventsFound} vault events!`);
    console.log(`💡 Check your Supabase vault_events table to see the data.`);
  } else {
    console.log(`\n💡 No events found yet. The vault creation events might be in blocks ${currentBlock} - ${targetBlock}.`);
    console.log(`💡 Continue running the script or let the daily cron job continue processing.`);
  }
}

// Configuration options - modify these as needed
const config = {
  maxRuns: 100,          // Process up to 100 batches (10,000 blocks)
  concurrent: 2,         // 2 concurrent requests (be nice to Vercel)
  delayMs: 1000,         // 1 second between batches
  targetBlock: 3300000,  // Stop when we reach block 3.3M
  checkInterval: 10      // Show progress every 10 runs
};

// Start the acceleration
console.log('Starting in 3 seconds...\n');
setTimeout(() => {
  accelerateIndexing(config).catch(console.error);
}, 3000);