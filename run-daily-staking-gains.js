// Script to run daily staking gains data collection and display

const VERCEL_URL = 'https://mp-indexer.vercel.app';
const LOCAL_URL = 'http://localhost:3000';

async function runDailyStakingGainsData(useLocal = false) {
  const url = useLocal ? LOCAL_URL : VERCEL_URL;
  
  console.log(`Fetching daily staking gains data from ${url}/api/daily-staking-gains`);
  console.log('Starting at:', new Date().toISOString());
  
  try {
    const response = await fetch(`${url}/api/daily-staking-gains`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Daily Staking Gains Data Success!');
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (result.data && result.data.length > 0) {
        console.log('\n📊 Daily Staking Gains Summary:');
        console.log(`  Days Available: ${result.data.length}`);
        
        // Show daily breakdown
        result.data.forEach((day, index) => {
          const date = new Date(day.day).toLocaleDateString();
          console.log(`  ${date}:`);
          console.log(`    BPD Fees Generated: ${day.bpd_paid || 0} BPD`);
          console.log(`    BPD Gains Claimed: ${day.bpd_claimed || 0} BPD`);
          if (index < result.data.length - 1) console.log('');
        });
        
        // Calculate totals
        const totalFees = result.data.reduce((sum, day) => sum + (day.bpd_paid || 0), 0);
        const totalClaimed = result.data.reduce((sum, day) => sum + (day.bpd_claimed || 0), 0);
        
        console.log('\n📈 7-Day Totals:');
        console.log(`  Total BPD Fees Generated: ${totalFees.toFixed(2)} BPD`);
        console.log(`  Total BPD Gains Claimed: ${totalClaimed.toFixed(2)} BPD`);
        console.log(`  Net Balance: ${(totalFees - totalClaimed).toFixed(2)} BPD`);
        
      } else {
        console.log('\n📊 Daily Staking Gains Summary:');
        console.log('  No staking activity in the last 7 days');
        console.log('  This is normal for testnets with low activity');
      }
      
      return result;
    } else {
      console.error('❌ Daily Staking Gains Error:', response.status);
      const text = await response.text();
      console.error('Response:', text);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch daily staking gains data:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Tip: Make sure the server is running or use the Vercel deployment');
    }
    return null;
  }
}

async function runDataCollection() {
  console.log('🔄 Running staking gains tracker to collect borrowing fee data...');
  
  try {
    const response = await fetch('https://mp-indexer.vercel.app/api/staking-gains-tracker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Data collection completed');
      console.log(`  Borrowing Fee Events: ${result.data?.borrowingFeeEvents || 0}`);
      console.log(`  Staking Gains Events: ${result.data?.stakingGainsEvents || 0}`);
      return true;
    } else {
      console.error('❌ Data collection failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Data collection error:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Money Protocol Daily Staking Gains Chart');
  console.log('==========================================\n');
  
  // First, collect latest data
  console.log('Step 1: Collecting latest blockchain data...');
  const collectionSuccess = await runDataCollection();
  
  if (!collectionSuccess) {
    console.log('⚠️  Data collection failed, but continuing with existing data...\n');
  } else {
    console.log('✅ Data collection successful\n');
  }
  
  // Then, fetch and display the daily staking gains data
  console.log('Step 2: Fetching daily staking gains chart data...');
  const result = await runDailyStakingGainsData(false);
  
  if (result && result.success) {
    console.log('\n✅ Daily staking gains data ready!');
    console.log('Check your Streamlit dashboard to see the "Daily Issuance Gain from MP Staking" chart.');
    console.log('🔗 Dashboard: Your Streamlit Cloud URL');
  } else {
    console.log('\n❌ Failed to fetch daily staking gains data.');
    console.log('💡 This may be because:');
    console.log('   - No borrowing activity on testnet yet');
    console.log('   - Database views not yet created');
    console.log('   - API endpoint needs time to deploy');
  }
}

main().catch(console.error);