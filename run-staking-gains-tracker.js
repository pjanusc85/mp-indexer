// Script to run staking gains tracker

const VERCEL_URL = 'https://mp-indexer.vercel.app';
const LOCAL_URL = 'http://localhost:3000';

async function runStakingGainsTracker(useLocal = false) {
  const url = useLocal ? LOCAL_URL : VERCEL_URL;
  
  console.log(`Running staking gains tracker at ${url}/api/staking-gains-tracker`);
  console.log('Starting at:', new Date().toISOString());
  
  try {
    const response = await fetch(`${url}/api/staking-gains-tracker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Staking Gains Tracker Success!');
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (result.data) {
        console.log('\n📊 Staking Gains Summary:');
        console.log(`  Block: ${result.data.blockNumber}`);
        console.log(`  Total Events: ${result.data.totalEventsProcessed}`);
        console.log(`  Borrowing Fee Events: ${result.data.borrowingFeeEvents}`);
        console.log(`  Redemption Events: ${result.data.redemptionEvents}`);
        console.log(`  Staking Gains Events: ${result.data.stakingGainsEvents}`);
      }
      
      return result;
    } else {
      console.error('❌ Staking Gains Tracker Error:', response.status);
      const text = await response.text();
      console.error('Response:', text);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Failed to run staking gains tracker:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Tip: Make sure the server is running or use the Vercel deployment');
    }
    return null;
  }
}

// Main execution
async function main() {
  console.log('🚀 Money Protocol Staking Gains Tracker');
  console.log('=======================================\n');
  
  // Run on Vercel deployment
  const result = await runStakingGainsTracker(false);
  
  if (result && result.success) {
    console.log('\n✅ Staking gains tracking complete!');
    console.log('Check your Streamlit dashboard to see the staking gains data.');
  } else {
    console.log('\n❌ Staking gains tracking failed. Check the error messages above.');
  }
}

main().catch(console.error);