import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { 
  getPoolBalanceChanges, 
  calculateHourlyBalances, 
  saveBalanceEvents, 
  saveHourlyBalances,
  getProtocolTVLSummary 
} from './src/contracts/BalanceTracker.js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function testBalanceTracking() {
  console.log('🧪 Testing Balance Tracking Module...');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing environment variables');
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    console.log(`📊 Current block: ${currentBlock}`);
    
    // Test with a recent range of blocks (last 50 blocks)
    const startBlock = currentBlock - 50;
    const endBlock = currentBlock;
    
    console.log(`🔍 Testing blocks ${startBlock} to ${endBlock}`);
    
    // 1. Get protocol TVL summary first
    const tvlSummary = await getProtocolTVLSummary(provider, currentBlock);
    console.log('💰 Protocol TVL Summary:');
    console.log(JSON.stringify(tvlSummary, null, 2));
    
    // 2. Get pool balance changes
    const balanceChanges = await getPoolBalanceChanges(provider, startBlock, endBlock);
    console.log(`🔄 Found ${balanceChanges.length} pool balance changes`);
    
    if (balanceChanges.length > 0) {
      console.log('Sample balance change:', JSON.stringify(balanceChanges[0], null, 2));
      
      // 3. Calculate hourly aggregations
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0); // Round to current hour
      const hourlyBalances = calculateHourlyBalances(balanceChanges, currentHour.toISOString());
      
      console.log(`⏰ Generated ${hourlyBalances.length} hourly balance records`);
      
      // 4. Test saving to database
      console.log('💾 Attempting to save to database...');
      
      const balanceEventsSaved = await saveBalanceEvents(balanceChanges, SUPABASE_URL, SUPABASE_ANON_KEY);
      const hourlyBalancesSaved = await saveHourlyBalances(hourlyBalances, SUPABASE_URL, SUPABASE_ANON_KEY);
      
      console.log(`✅ Balance events saved: ${balanceEventsSaved}`);
      console.log(`✅ Hourly balances saved: ${hourlyBalancesSaved}`);
      
    } else {
      console.log('📊 No balance changes detected - pools are stable');
      
      // Still create hourly snapshot of current balances
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);
      
      const syntheticHourlyData = [];
      for (const [poolName, poolData] of Object.entries(tvlSummary.pools)) {
        syntheticHourlyData.push({
          hour: currentHour.toISOString(),
          pool_address: poolData.address.toLowerCase(),
          pool_type: poolData.type,
          hourly_change_btc: 0, // No change
          ending_balance_btc: poolData.balance_btc,
          transaction_count: 0,
          btc_price_usd: null,
          ending_balance_usd: null
        });
      }
      
      console.log(`⏰ Creating ${syntheticHourlyData.length} hourly snapshots with current balances`);
      const hourlyBalancesSaved = await saveHourlyBalances(syntheticHourlyData, SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log(`✅ Hourly snapshots saved: ${hourlyBalancesSaved}`);
    }
    
    console.log('🎉 Balance tracking test completed successfully!');
    
  } catch (error) {
    console.error('❌ Balance tracking test failed:', error);
  }
}

testBalanceTracking();