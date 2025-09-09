import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function addSampleTVLData() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('Supabase credentials not configured');
    return;
  }
  
  // Generate sample TVL data over time (like a growing protocol)
  const now = new Date();
  const sampleData = [];
  
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(now.getTime() - (19 - i) * 3600000); // Every hour going back 20 hours
    const baseAmount = 0.04 + (i * 0.002); // Growing from 0.04 to ~0.08 RBTC
    
    sampleData.push({
      timestamp: timestamp.toISOString(),
      block_number: 6805000 + i * 100,
      active_pool_btc: baseAmount,
      default_pool_btc: 0,
      total_btc: baseAmount,
      btc_price_usd: null,
      total_usd: null
    });
  }
  
  try {
    for (const data of sampleData) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/tvl_snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        console.log(`Added TVL data point: ${data.timestamp} - ${data.active_pool_btc} RBTC`);
      } else {
        const error = await response.text();
        console.error('Error:', error);
        break;
      }
    }
    
    console.log('✅ Sample TVL data added successfully');
    
  } catch (error) {
    console.error('Error adding sample data:', error);
  }
}

addSampleTVLData();