import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function addSampleBPDSupplyData() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('Supabase credentials not configured');
    return;
  }
  
  // Generate sample BPD supply data (like LUSD supply pattern)
  const now = new Date();
  const hourlyData = [];
  const transferEvents = [];
  
  let cumulativeSupply = 0;
  
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now.getTime() - (23 - i) * 3600000); // Every hour going back 24 hours
    hour.setMinutes(0, 0, 0); // Round to hour
    
    // Simulate mint/burn pattern (more mints early, some burns later)
    let mintAmount = 0;
    let burnAmount = 0;
    let mintCount = 0;
    let burnCount = 0;
    
    if (i < 16) {
      // Early hours: mostly minting
      mintAmount = 1000 + Math.random() * 2000; // 1000-3000 BPD minted
      mintCount = Math.floor(1 + Math.random() * 3); // 1-3 mint events
    } else {
      // Later hours: some burning
      if (Math.random() > 0.3) {
        mintAmount = 500 + Math.random() * 1000; // 500-1500 BPD minted
        mintCount = Math.floor(1 + Math.random() * 2);
      }
      if (Math.random() > 0.7) {
        burnAmount = Math.random() * 800; // 0-800 BPD burned
        burnCount = Math.floor(1 + Math.random() * 2);
      }
    }
    
    const supplyChange = mintAmount - burnAmount;
    cumulativeSupply += supplyChange;
    
    // Hourly summary data
    hourlyData.push({
      hour: hour.toISOString(),
      supply_change: supplyChange,
      cumulative_supply: cumulativeSupply,
      mint_count: mintCount,
      burn_count: burnCount,
      total_events: mintCount + burnCount
    });
    
    // Individual transfer events
    for (let j = 0; j < mintCount; j++) {
      const eventTime = new Date(hour.getTime() + Math.random() * 3600000);
      transferEvents.push({
        transaction_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        block_number: 6800000 + i * 100 + j,
        block_timestamp: eventTime.toISOString(),
        hour: hour.toISOString(),
        event_type: 'mint',
        from_address: '0x0000000000000000000000000000000000000000',
        to_address: `0x${Math.random().toString(16).substring(2, 42)}`,
        value_bpd: mintAmount / mintCount,
        supply_change: mintAmount / mintCount
      });
    }
    
    for (let j = 0; j < burnCount; j++) {
      const eventTime = new Date(hour.getTime() + Math.random() * 3600000);
      transferEvents.push({
        transaction_hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        block_number: 6800000 + i * 100 + j + 50,
        block_timestamp: eventTime.toISOString(),
        hour: hour.toISOString(),
        event_type: 'burn',
        from_address: `0x${Math.random().toString(16).substring(2, 42)}`,
        to_address: '0x0000000000000000000000000000000000000000',
        value_bpd: burnAmount / burnCount,
        supply_change: -(burnAmount / burnCount)
      });
    }
  }
  
  try {
    // Add hourly data
    if (hourlyData.length > 0) {
      const response1 = await fetch(`${SUPABASE_URL}/rest/v1/bpd_supply_hourly`, {
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
        console.log(`✅ Added ${hourlyData.length} hourly BPD supply records`);
        console.log(`Final cumulative supply: ${cumulativeSupply.toFixed(2)} BPD`);
      } else {
        const error = await response1.text();
        console.error('Error adding hourly data:', error);
      }
    }
    
    // Add transfer events
    if (transferEvents.length > 0) {
      // Add events in batches to avoid large requests
      const batchSize = 50;
      for (let i = 0; i < transferEvents.length; i += batchSize) {
        const batch = transferEvents.slice(i, i + batchSize);
        
        const response2 = await fetch(`${SUPABASE_URL}/rest/v1/bpd_transfer_events`, {
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
          console.log(`✅ Added batch of ${batch.length} transfer events`);
        } else {
          const error = await response2.text();
          console.error(`Error adding transfer events batch:`, error);
          break;
        }
      }
    }
    
    console.log('✅ Sample BPD supply data added successfully');
    console.log('Statistics:');
    console.log(`- Total hourly records: ${hourlyData.length}`);
    console.log(`- Total transfer events: ${transferEvents.length}`);
    console.log(`- Mint events: ${transferEvents.filter(e => e.event_type === 'mint').length}`);
    console.log(`- Burn events: ${transferEvents.filter(e => e.event_type === 'burn').length}`);
    console.log(`- Final supply: ${cumulativeSupply.toFixed(2)} BPD`);
    
  } catch (error) {
    console.error('Error adding sample BPD data:', error);
  }
}

addSampleBPDSupplyData();