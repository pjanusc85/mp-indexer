import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RSK_RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';

// Contract addresses
const VAULT_MANAGER_ADDRESS = process.env.VAULT_MANAGER_ADDRESS || '0xf1df1d059E67E19b270b083bd13AC791C573968b';
const BORROWER_OPERATIONS_ADDRESS = process.env.BORROWER_OPERATIONS_ADDRESS || '0xf721a6c73676628Bb708Ee6Cfe7f9e2328a020eF';

// Event signatures for vault lifecycle
const VAULT_CREATED_SIGNATURE = '0x'; // VaultCreated event signature
const VAULT_UPDATED_SIGNATURE = '0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c'; // VaultUpdated
const VAULT_LIQUIDATED_SIGNATURE = '0x7495fe27166ca7c7fb38d10e09b0d0f029a5704bac8952a9545063644de73c10'; // VaultLiquidated

// Contract ABIs
const VAULT_MANAGER_ABI = [
  "event VaultUpdated(address indexed _borrower, uint256 _debt, uint256 _coll, uint8 operation)",
  "event VaultLiquidated(address indexed _borrower, uint256 _debt, uint256 _coll, uint8 operation)"
];

const BORROWER_OPERATIONS_ABI = [
  "event VaultUpdated(address indexed _borrower, uint256 _debt, uint256 _coll, uint8 operation)"
];

async function fetchVaultCountEvents(fromBlock, toBlock) {
  try {
    const provider = new ethers.JsonRpcProvider(RSK_RPC_URL);
    const vaultManager = new ethers.Contract(VAULT_MANAGER_ADDRESS, VAULT_MANAGER_ABI, provider);
    const borrowerOperations = new ethers.Contract(BORROWER_OPERATIONS_ADDRESS, BORROWER_OPERATIONS_ABI, provider);
    
    console.log(`Fetching vault events from block ${fromBlock} to ${toBlock}`);
    console.log(`VaultManager: ${VAULT_MANAGER_ADDRESS}`);
    console.log(`BorrowerOperations: ${BORROWER_OPERATIONS_ADDRESS}`);
    
    // Get VaultUpdated events from both contracts
    const [vaultManagerEvents, borrowerOpsEvents, liquidationEvents] = await Promise.all([
      vaultManager.queryFilter(vaultManager.filters.VaultUpdated(), fromBlock, toBlock),
      borrowerOperations.queryFilter(borrowerOperations.filters.VaultUpdated(), fromBlock, toBlock),
      vaultManager.queryFilter(vaultManager.filters.VaultLiquidated(), fromBlock, toBlock)
    ]);
    
    console.log(`Found ${vaultManagerEvents.length} VaultManager events, ${borrowerOpsEvents.length} BorrowerOps events, ${liquidationEvents.length} liquidation events`);
    
    // Process all events
    const allEvents = [...vaultManagerEvents, ...borrowerOpsEvents, ...liquidationEvents];
    const processedEvents = [];
    
    for (const event of allEvents) {
      const block = await provider.getBlock(event.blockNumber);
      
      // Determine event type based on collateral and debt values
      let eventType = 'update';
      let vaultCountChange = 0;
      
      if (event.fragment.name === 'VaultLiquidated') {
        eventType = 'liquidated';
        vaultCountChange = -1; // Liquidation closes vault
      } else {
        // VaultUpdated - check if it's creation or closure
        const coll = event.args._coll;
        const debt = event.args._debt;
        
        // If collateral becomes 0, it's likely a vault closure
        if (coll.toString() === '0') {
          eventType = 'closed';
          vaultCountChange = -1;
        } else {
          // Check if this is the first time we see this vault (creation)
          // For simplicity, we'll mark operations with significant collateral as potential creations
          const collValue = parseFloat(ethers.formatEther(coll));
          const debtValue = parseFloat(ethers.formatEther(debt));
          
          if (collValue > 0 && debtValue > 0) {
            // This could be a creation or update - we'll need to track vault states
            // For now, assume it's an update unless we have specific creation logic
            eventType = 'update';
            vaultCountChange = 0;
            
            // Simple heuristic: if it's a large collateral amount, might be creation
            if (collValue > 0.01) { // More than 0.01 RBTC
              eventType = 'created';
              vaultCountChange = 1;
            }
          }
        }
      }
      
      processedEvents.push({
        transaction_hash: event.transactionHash,
        block_number: event.blockNumber,
        block_timestamp: new Date(block.timestamp * 1000).toISOString(),
        hour: new Date(block.timestamp * 1000).toISOString().slice(0, 13) + ':00:00.000Z',
        vault_address: event.args._borrower,
        event_type: eventType,
        collateral_amount: parseFloat(ethers.formatEther(event.args._coll || 0)),
        debt_amount: parseFloat(ethers.formatEther(event.args._debt || 0)),
        vault_count_change: vaultCountChange,
        contract_source: event.address.toLowerCase() === VAULT_MANAGER_ADDRESS.toLowerCase() ? 'VaultManager' : 'BorrowerOperations'
      });
    }
    
    // Sort by block number
    processedEvents.sort((a, b) => a.block_number - b.block_number);
    
    console.log(`Processed ${processedEvents.length} vault lifecycle events`);
    return processedEvents;
    
  } catch (error) {
    console.error('Error fetching vault count events:', error);
    throw error;
  }
}

async function calculateHourlyVaultCounts(events) {
  // Group events by hour and sum the vault count changes
  const hourlyChanges = {};
  
  for (const event of events) {
    const hour = event.hour;
    if (!hourlyChanges[hour]) {
      hourlyChanges[hour] = {
        hour,
        vault_count_change: 0,
        created_count: 0,
        closed_count: 0,
        liquidated_count: 0,
        updated_count: 0,
        total_events: 0
      };
    }
    
    hourlyChanges[hour].vault_count_change += event.vault_count_change;
    hourlyChanges[hour].total_events += 1;
    
    switch (event.event_type) {
      case 'created':
        hourlyChanges[hour].created_count += 1;
        break;
      case 'closed':
        hourlyChanges[hour].closed_count += 1;
        break;
      case 'liquidated':
        hourlyChanges[hour].liquidated_count += 1;
        break;
      case 'update':
        hourlyChanges[hour].updated_count += 1;
        break;
    }
  }
  
  // Convert to array and sort by hour
  const hourlyArray = Object.values(hourlyChanges);
  hourlyArray.sort((a, b) => new Date(a.hour) - new Date(b.hour));
  
  // Calculate cumulative vault count (Number of Vaults)
  let cumulativeVaultCount = 0;
  for (const hourData of hourlyArray) {
    cumulativeVaultCount += hourData.vault_count_change;
    hourData.number_of_vaults = Math.max(0, cumulativeVaultCount); // Ensure non-negative
  }
  
  return hourlyArray;
}

async function saveVaultCountData(events, hourlyData) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('Supabase credentials not configured, skipping save');
    return;
  }
  
  try {
    // Save individual vault events
    if (events.length > 0) {
      const response1 = await fetch(`${SUPABASE_URL}/rest/v1/vault_lifecycle_events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(events)
      });
      
      if (response1.ok) {
        console.log(`Saved ${events.length} vault lifecycle events`);
      } else {
        const error = await response1.text();
        console.error('Error saving vault events:', error);
      }
    }
    
    // Save hourly vault count data
    if (hourlyData.length > 0) {
      const response2 = await fetch(`${SUPABASE_URL}/rest/v1/vault_count_hourly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(hourlyData)
      });
      
      if (response2.ok) {
        console.log(`Saved ${hourlyData.length} hourly vault count records`);
      } else {
        const error = await response2.text();
        console.error('Error saving hourly vault count data:', error);
      }
    }
    
  } catch (error) {
    console.error('Error saving vault count data:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Vault Count Tracker Starting...');
  console.log(`VaultManager Address: ${VAULT_MANAGER_ADDRESS}`);
  console.log(`BorrowerOperations Address: ${BORROWER_OPERATIONS_ADDRESS}`);
  
  try {
    const provider = new ethers.JsonRpcProvider(RSK_RPC_URL);
    const latestBlock = await provider.getBlockNumber();
    
    // Fetch recent events (last 10,000 blocks)
    const fromBlock = Math.max(1, latestBlock - 10000);
    const events = await fetchVaultCountEvents(fromBlock, latestBlock);
    
    if (events.length === 0) {
      console.log('No vault events found in recent blocks');
      return;
    }
    
    // Calculate hourly vault counts
    const hourlyData = await calculateHourlyVaultCounts(events);
    
    console.log('Vault Count Analysis:');
    console.log(`- Total events processed: ${events.length}`);
    console.log(`- Created vaults: ${events.filter(e => e.event_type === 'created').length}`);
    console.log(`- Closed vaults: ${events.filter(e => e.event_type === 'closed').length}`);
    console.log(`- Liquidated vaults: ${events.filter(e => e.event_type === 'liquidated').length}`);
    console.log(`- Updated vaults: ${events.filter(e => e.event_type === 'update').length}`);
    console.log(`- Hourly data points: ${hourlyData.length}`);
    
    if (hourlyData.length > 0) {
      const latestHour = hourlyData[hourlyData.length - 1];
      console.log(`- Current number of vaults: ${latestHour.number_of_vaults}`);
    }
    
    // Save to database
    await saveVaultCountData(events, hourlyData);
    
    console.log('✅ Vault count tracking completed successfully');
    
  } catch (error) {
    console.error('❌ Vault count tracking failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { fetchVaultCountEvents, calculateHourlyVaultCounts };