// Script to run BPD supply tracker

const VERCEL_URL = 'https://mp-indexer.vercel.app';
const LOCAL_URL = 'http://localhost:3000';

async function runBPDTracker(useLocal = false) {
  const url = useLocal ? LOCAL_URL : VERCEL_URL;
  
  console.log(`Running BPD supply tracker at ${url}/api/bpd-supply-tracker`);
  console.log('Starting at:', new Date().toISOString());
  
  try {
    const response = await fetch(`${url}/api/bpd-supply-tracker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ BPD Supply Tracker Success!');
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (result.data) {
        console.log('\n📊 Current BPD Supply:');
        console.log(`  Block: ${result.data.blockNumber}`);
        console.log(`  Total Supply: ${result.data.totalSupplyBPD} BPD`);
        console.log(`  Events Processed: ${result.data.eventsProcessed}`);
        console.log(`  Mint Events: ${result.data.mintEvents}`);
        console.log(`  Burn Events: ${result.data.burnEvents}`);
      }
      
      return result;
    } else {
      console.error('❌ BPD Supply Tracker Error:', response.status);
      const text = await response.text();
      console.error('Response:', text);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Failed to run BPD supply tracker:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Tip: Make sure the server is running or use the Vercel deployment');
    }
    return null;
  }
}

// Main execution
async function main() {
  console.log('🚀 Money Protocol BPD Supply Tracker');
  console.log('=====================================\n');
  
  // Run on Vercel deployment
  const result = await runBPDTracker(false);
  
  if (result && result.success) {
    console.log('\n✅ BPD supply tracking complete!');
    console.log('Check your Streamlit dashboard to see the BPD supply data.');
  } else {
    console.log('\n❌ BPD supply tracking failed. Check the error messages above.');
  }
}

main().catch(console.error);