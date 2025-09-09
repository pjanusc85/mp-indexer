import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function addSampleVaultCountData() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('Supabase credentials not configured');
    return;
  }
  
  // Generate sample vault count data (like Number of Troves pattern)
  const now = new Date();
  const hourlyData = [];
  const lifecycleEvents = [];
  
  let cumulativeVaultCount = 0;
  
  for (let i = 0; i < 30; i++) {
    const hour = new Date(now.getTime() - (29 - i) * 3600000); // Every hour going back 30 hours
    hour.setMinutes(0, 0, 0); // Round to hour
    
    // Simulate vault lifecycle pattern (growth with some liquidations)
    let vaultCountChange = 0;
    let createdCount = 0;
    let closedCount = 0;
    let liquidatedCount = 0;
    
    if (i < 20) {
      // Early hours: mostly vault creation (growth phase)
      if (Math.random() > 0.3) {
        createdCount = Math.floor(1 + Math.random() * 4); // 1-4 vaults created
        vaultCountChange += createdCount;
      }
      
      // Occasional liquidations
      if (Math.random() > 0.8) {
        liquidatedCount = Math.floor(1 + Math.random() * 2); // 1-2 liquidations
        vaultCountChange -= liquidatedCount;
      }
    } else {
      // Later hours: mixed activity with more closures
      if (Math.random() > 0.5) {
        createdCount = Math.floor(1 + Math.random() * 2); // 1-2 vaults created
        vaultCountChange += createdCount;
      }
      
      if (Math.random() > 0.6) {
        closedCount = Math.floor(1 + Math.random() * 2); // 1-2 closures
        vaultCountChange -= closedCount;
      }
      
      if (Math.random() > 0.7) {
        liquidatedCount = Math.floor(1 + Math.random() * 2); // 1-2 liquidations
        vaultCountChange -= liquidatedCount;
      }
    }
    
    cumulativeVaultCount = Math.max(0, cumulativeVaultCount + vaultCountChange); // Ensure non-negative
    
    // Hourly summary data
    hourlyData.push({
      hour: hour.toISOString(),
      vault_count_change: vaultCountChange,
      number_of_vaults: cumulativeVaultCount,
      created_count: createdCount,
      closed_count: closedCount,
      liquidated_count: liquidatedCount,
      updated_count: 0, // We'll simulate some updates separately
      total_events: createdCount + closedCount + liquidatedCount
    });
    
    // Individual vault lifecycle events
    for (let j = 0; j < createdCount; j++) {
      const eventTime = new Date(hour.getTime() + Math.random() * 3600000);
      lifecycleEvents.push({
        transaction_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        block_number: 6800000 + i * 10 + j,
        block_timestamp: eventTime.toISOString(),
        hour: hour.toISOString(),
        vault_address: `0x${Math.random().toString(16).substring(2, 42)}`,
        event_type: 'created',
        collateral_amount: 0.05 + Math.random() * 0.2, // 0.05-0.25 RBTC
        debt_amount: 1000 + Math.random() * 3000, // 1000-4000 BPD
        vault_count_change: 1,
        contract_source: 'BorrowerOperations'
      });
    }
    
    for (let j = 0; j < closedCount; j++) {
      const eventTime = new Date(hour.getTime() + Math.random() * 3600000);
      lifecycleEvents.push({
        transaction_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        block_number: 6800000 + i * 10 + j + 20,
        block_timestamp: eventTime.toISOString(),
        hour: hour.toISOString(),
        vault_address: `0x${Math.random().toString(16).substring(2, 42)}`,
        event_type: 'closed',
        collateral_amount: 0,
        debt_amount: 0,
        vault_count_change: -1,
        contract_source: 'BorrowerOperations'
      });
    }
    
    for (let j = 0; j < liquidatedCount; j++) {
      const eventTime = new Date(hour.getTime() + Math.random() * 3600000);
      lifecycleEvents.push({
        transaction_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        block_number: 6800000 + i * 10 + j + 40,
        block_timestamp: eventTime.toISOString(),
        hour: hour.toISOString(),
        vault_address: `0x${Math.random().toString(16).substring(2, 42)}`,
        event_type: 'liquidated',
        collateral_amount: 0.02 + Math.random() * 0.1, // Small remaining collateral
        debt_amount: 500 + Math.random() * 1500, // Remaining debt
        vault_count_change: -1,
        contract_source: 'VaultManager'
      });
    }
  }
  
  try {
    // Add hourly data
    if (hourlyData.length > 0) {
      const response1 = await fetch(`${SUPABASE_URL}/rest/v1/vault_count_hourly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(hourlyData)
      });
      
      if (response1.ok) {
        console.log(`✅ Added ${hourlyData.length} hourly vault count records`);
        console.log(`Final vault count: ${cumulativeVaultCount} vaults`);
      } else {
        const error = await response1.text();
        console.error('Error adding hourly data:', error);
      }
    }
    
    // Add lifecycle events
    if (lifecycleEvents.length > 0) {
      // Add events in batches
      const batchSize = 50;
      for (let i = 0; i < lifecycleEvents.length; i += batchSize) {
        const batch = lifecycleEvents.slice(i, i + batchSize);
        
        const response2 = await fetch(`${SUPABASE_URL}/rest/v1/vault_lifecycle_events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(batch)
        });
        
        if (response2.ok) {
          console.log(`✅ Added batch of ${batch.length} lifecycle events`);
        } else {
          const error = await response2.text();
          console.error(`Error adding lifecycle events batch:`, error);
          break;
        }
      }
    }
    
    console.log('✅ Sample vault count data added successfully');
    console.log('Statistics:');
    console.log(`- Total hourly records: ${hourlyData.length}`);
    console.log(`- Total lifecycle events: ${lifecycleEvents.length}`);
    console.log(`- Created vaults: ${lifecycleEvents.filter(e => e.event_type === 'created').length}`);
    console.log(`- Closed vaults: ${lifecycleEvents.filter(e => e.event_type === 'closed').length}`);
    console.log(`- Liquidated vaults: ${lifecycleEvents.filter(e => e.event_type === 'liquidated').length}`);
    console.log(`- Final vault count: ${cumulativeVaultCount} vaults`);
    
  } catch (error) {
    console.error('Error adding sample vault count data:', error);
  }
}

addSampleVaultCountData();