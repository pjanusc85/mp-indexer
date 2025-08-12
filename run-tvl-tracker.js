// Using built-in fetch (Node.js 18+) or polyfill

const VERCEL_URL = 'https://mp-indexer.vercel.app';
const LOCAL_URL = 'http://localhost:3000';

async function runTVLTracker(useLocal = false) {
  const url = useLocal ? LOCAL_URL : VERCEL_URL;
  
  console.log(`Running TVL tracker at ${url}/api/tvl-tracker`);
  console.log('Starting at:', new Date().toISOString());
  
  try {
    const response = await fetch(`${url}/api/tvl-tracker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ TVL Tracker Success!');
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (result.tvl) {
        console.log('\n📊 Current TVL:');
        console.log(`  Active Pool: ${result.tvl.activePoolBTC} BTC`);
        console.log(`  Default Pool: ${result.tvl.defaultPoolBTC} BTC`);
        console.log(`  Total TVL: ${result.tvl.totalBTC} BTC`);
      }
      
      if (result.operationsFound !== undefined) {
        console.log(`\n📝 Operations found: ${result.operationsFound}`);
      }
      
      return result;
    } else {
      console.error('❌ TVL Tracker Error:', response.status);
      const text = await response.text();
      console.error('Response:', text);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Failed to run TVL tracker:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Tip: Make sure the server is running or use the Vercel deployment');
    }
    return null;
  }
}

// Run multiple times to build historical data
async function runMultipleTimes(count = 1, delay = 5000) {
  console.log(`Running TVL tracker ${count} times with ${delay}ms delay between runs`);
  
  const results = [];
  
  for (let i = 0; i < count; i++) {
    console.log(`\n--- Run ${i + 1}/${count} ---`);
    const result = await runTVLTracker(false); // Use Vercel deployment
    results.push(result);
    
    if (i < count - 1) {
      console.log(`Waiting ${delay}ms before next run...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log('\n=== Summary ===');
  const successful = results.filter(r => r && r.success).length;
  console.log(`Successful runs: ${successful}/${count}`);
  
  return results;
}

// Main execution
async function main() {
  console.log('🚀 Money Protocol TVL Tracker');
  console.log('================================\n');
  
  // Run once (or multiple times if you want to build history)
  await runMultipleTimes(1, 5000);
  
  console.log('\n✅ TVL tracking complete!');
  console.log('Check your Streamlit dashboard to see the TVL data.');
}

main().catch(console.error);