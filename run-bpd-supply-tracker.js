import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RSK_RPC_URL = process.env.RSK_RPC_URL || 'https://www.intrinsic.network';

// Contract addresses
const BPD_TOKEN_ADDRESS = process.env.BPD_TOKEN_ADDRESS || '0x8E2646c8fEF01a0Bb94c5836717E571C772De1B9';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// BPD Token ABI (just Transfer event)
const BPD_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

async function fetchBPDSupplyEvents(fromBlock, toBlock) {
  try {
    const provider = new ethers.JsonRpcProvider(RSK_RPC_URL);
    const bpdContract = new ethers.Contract(BPD_TOKEN_ADDRESS, BPD_ABI, provider);
    
    console.log(`Fetching BPD Transfer events from block ${fromBlock} to ${toBlock}`);
    console.log(`BPD Token Contract: ${BPD_TOKEN_ADDRESS}`);
    
    // Get Transfer events where from = 0x0 (mint) or to = 0x0 (burn)
    const mintFilter = bpdContract.filters.Transfer(ZERO_ADDRESS, null);
    const burnFilter = bpdContract.filters.Transfer(null, ZERO_ADDRESS);
    
    const [mintEvents, burnEvents] = await Promise.all([
      bpdContract.queryFilter(mintFilter, fromBlock, toBlock),
      bpdContract.queryFilter(burnFilter, fromBlock, toBlock)
    ]);
    
    console.log(`Found ${mintEvents.length} mint events and ${burnEvents.length} burn events`);
    
    // Combine and process events
    const allEvents = [...mintEvents, ...burnEvents];
    const processedEvents = [];
    
    for (const event of allEvents) {
      const block = await provider.getBlock(event.blockNumber);
      const isMint = event.args.from === ZERO_ADDRESS;
      const value = ethers.formatEther(event.args.value);
      
      processedEvents.push({
        transaction_hash: event.transactionHash,
        block_number: event.blockNumber,
        block_timestamp: new Date(block.timestamp * 1000).toISOString(),
        hour: new Date(block.timestamp * 1000).toISOString().slice(0, 13) + ':00:00.000Z',
        event_type: isMint ? 'mint' : 'burn',
        from_address: event.args.from,
        to_address: event.args.to,
        value_bpd: parseFloat(value),
        supply_change: isMint ? parseFloat(value) : -parseFloat(value)
      });
    }
    
    // Sort by block number
    processedEvents.sort((a, b) => a.block_number - b.block_number);
    
    console.log(`Processed ${processedEvents.length} BPD supply events`);
    return processedEvents;
    
  } catch (error) {
    console.error('Error fetching BPD supply events:', error);
    throw error;
  }
}

async function calculateHourlySupplyChanges(events) {
  // Group events by hour and sum the supply changes
  const hourlyChanges = {};
  
  for (const event of events) {
    const hour = event.hour;
    if (!hourlyChanges[hour]) {
      hourlyChanges[hour] = {
        hour,
        supply_change: 0,
        mint_count: 0,
        burn_count: 0,
        total_events: 0
      };
    }
    
    hourlyChanges[hour].supply_change += event.supply_change;
    hourlyChanges[hour].total_events += 1;
    
    if (event.event_type === 'mint') {
      hourlyChanges[hour].mint_count += 1;
    } else {
      hourlyChanges[hour].burn_count += 1;
    }
  }
  
  // Convert to array and sort by hour
  const hourlyArray = Object.values(hourlyChanges);
  hourlyArray.sort((a, b) => new Date(a.hour) - new Date(b.hour));
  
  // Calculate cumulative supply
  let cumulativeSupply = 0;
  for (const hourData of hourlyArray) {
    cumulativeSupply += hourData.supply_change;
    hourData.cumulative_supply = cumulativeSupply;
  }
  
  return hourlyArray;
}

async function saveBPDSupplyData(events, hourlyData) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('Supabase credentials not configured, skipping save');
    return;
  }
  
  try {
    // Save individual events
    if (events.length > 0) {
      const response1 = await fetch(`${SUPABASE_URL}/rest/v1/bpd_transfer_events`, {
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
        console.log(`Saved ${events.length} BPD transfer events`);
      } else {
        const error = await response1.text();
        console.error('Error saving events:', error);
      }
    }
    
    // Save hourly supply data
    if (hourlyData.length > 0) {
      const response2 = await fetch(`${SUPABASE_URL}/rest/v1/bpd_supply_hourly`, {
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
        console.log(`Saved ${hourlyData.length} hourly BPD supply records`);
      } else {
        const error = await response2.text();
        console.error('Error saving hourly data:', error);
      }
    }
    
  } catch (error) {
    console.error('Error saving BPD supply data:', error);
    throw error;
  }
}

async function getCurrentBPDSupply() {
  try {
    const provider = new ethers.JsonRpcProvider(RSK_RPC_URL);
    const bpdContract = new ethers.Contract(BPD_TOKEN_ADDRESS, BPD_ABI, provider);
    
    const totalSupply = await bpdContract.totalSupply();
    const totalSupplyFormatted = ethers.formatEther(totalSupply);
    
    console.log(`Current BPD Total Supply: ${totalSupplyFormatted} BPD`);
    return parseFloat(totalSupplyFormatted);
    
  } catch (error) {
    console.error('Error fetching current BPD supply:', error);
    return 0;
  }
}

async function main() {
  console.log('🚀 BPD Supply Tracker Starting...');
  console.log(`BPD Token Address: ${BPD_TOKEN_ADDRESS}`);
  
  try {
    const provider = new ethers.JsonRpcProvider(RSK_RPC_URL);
    const latestBlock = await provider.getBlockNumber();
    
    // Get current supply first
    const currentSupply = await getCurrentBPDSupply();
    
    // Fetch recent events (last 10,000 blocks)
    const fromBlock = Math.max(1, latestBlock - 10000);
    const events = await fetchBPDSupplyEvents(fromBlock, latestBlock);
    
    if (events.length === 0) {
      console.log('No BPD transfer events found in recent blocks');
      return;
    }
    
    // Calculate hourly supply changes
    const hourlyData = await calculateHourlySupplyChanges(events);
    
    console.log('Supply Analysis:');
    console.log(`- Total events processed: ${events.length}`);
    console.log(`- Mint events: ${events.filter(e => e.event_type === 'mint').length}`);
    console.log(`- Burn events: ${events.filter(e => e.event_type === 'burn').length}`);
    console.log(`- Hourly data points: ${hourlyData.length}`);
    console.log(`- Current supply from contract: ${currentSupply} BPD`);
    
    if (hourlyData.length > 0) {
      const latestHour = hourlyData[hourlyData.length - 1];
      console.log(`- Latest calculated supply: ${latestHour.cumulative_supply} BPD`);
    }
    
    // Save to database
    await saveBPDSupplyData(events, hourlyData);
    
    console.log('✅ BPD supply tracking completed successfully');
    
  } catch (error) {
    console.error('❌ BPD supply tracking failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { fetchBPDSupplyEvents, calculateHourlySupplyChanges, getCurrentBPDSupply };