import { ethers } from 'ethers';

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Money Protocol BPD token address
const BPD_TOKEN_ADDRESS = '0xF023155DE70A8D1De2D0C31B70BbEDf06Fd36f23';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ERC20 Transfer ABI
const TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function getBPDTransferEvents(fromBlock, toBlock) {
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    console.log(`Fetching BPD transfers from block ${fromBlock} to ${toBlock}`);
    
    // Get all Transfer events for BPD token
    const logs = await provider.getLogs({
      address: BPD_TOKEN_ADDRESS,
      topics: [TRANSFER_EVENT_SIGNATURE],
      fromBlock,
      toBlock
    });
    
    console.log(`Found ${logs.length} BPD transfer events`);
    
    // Filter for mint/burn events only
    const iface = new ethers.Interface(TRANSFER_ABI);
    const supplyEvents = [];
    
    for (const log of logs) {
      try {
        const decoded = iface.parseLog(log);
        const { from, to, value } = decoded.args;
        
        // Only process mint (from zero) or burn (to zero) events
        if (from === ZERO_ADDRESS || to === ZERO_ADDRESS) {
          const block = await provider.getBlock(log.blockNumber);
          const valueInBPD = parseFloat(ethers.formatEther(value));
          
          // Determine if this is a mint or burn
          const isMint = from === ZERO_ADDRESS;
          const supplyChange = isMint ? valueInBPD : -valueInBPD;
          
          supplyEvents.push({
            transaction_hash: log.transactionHash,
            block_number: log.blockNumber,
            log_index: log.logIndex,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            event_type: isMint ? 'mint' : 'burn',
            from_address: from,
            to_address: to,
            value_bpd: valueInBPD,
            supply_change: supplyChange
          });
        }
      } catch (decodeError) {
        console.warn('Failed to decode transfer log:', decodeError);
      }
    }
    
    // Sort by block number and log index
    supplyEvents.sort((a, b) => {
      if (a.block_number !== b.block_number) {
        return a.block_number - b.block_number;
      }
      return a.log_index - b.log_index;
    });
    
    console.log(`Processed ${supplyEvents.length} mint/burn events`);
    return supplyEvents;
    
  } catch (error) {
    console.error('Error fetching BPD transfer events:', error);
    throw error;
  }
}

async function calculateBPDSupply(blockNumber) {
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Get total supply using ERC20 totalSupply() method
    const abi = ['function totalSupply() view returns (uint256)'];
    const contract = new ethers.Contract(BPD_TOKEN_ADDRESS, abi, provider);
    
    const totalSupplyWei = await contract.totalSupply({ blockTag: blockNumber });
    const totalSupplyBPD = parseFloat(ethers.formatEther(totalSupplyWei));
    
    return {
      blockNumber,
      totalSupplyBPD,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error calculating BPD supply:', error);
    throw error;
  }
}

async function getLastProcessedBlock() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bpd_supply_snapshots?select=block_number&order=block_number.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.length > 0 ? data[0].block_number : 6680000; // Default start block
    } else {
      console.warn('Could not get last processed block:', response.status);
      return 6680000; // Default start block
    }
  } catch (error) {
    console.error('Error getting last processed block:', error);
    return 6680000; // Default start block
  }
}

async function saveBPDSupplySnapshot(supplyData) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bpd_supply_snapshots`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        block_number: supplyData.blockNumber,
        timestamp: supplyData.timestamp,
        total_supply_bpd: supplyData.totalSupplyBPD
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase supply snapshot error:', response.status, errorText);
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    return await response.json();
    
  } catch (error) {
    console.error('Error saving BPD supply snapshot:', error);
    throw error;
  }
}

async function saveBPDSupplyEvents(events) {
  try {
    if (events.length === 0) return [];
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bpd_supply_events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(events)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase supply events error:', response.status, errorText);
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`Saved ${events.length} BPD supply events`);
    return result;
    
  } catch (error) {
    console.error('Error saving BPD supply events:', error);
    throw error;
  }
}

// Main BPD supply tracking function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting BPD supply tracking...');
    
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    // Get the last processed block
    const fromBlock = await getLastProcessedBlock();
    
    console.log(`Processing BPD supply from block ${fromBlock} to ${currentBlock}`);
    
    // Get mint/burn events in this range
    const supplyEvents = await getBPDTransferEvents(fromBlock, currentBlock);
    
    // Calculate current total supply
    const supplyData = await calculateBPDSupply(currentBlock);
    
    // Save the data
    const [snapshotResult, eventsResult] = await Promise.all([
      saveBPDSupplySnapshot(supplyData),
      saveBPDSupplyEvents(supplyEvents)
    ]);
    
    return res.status(200).json({
      success: true,
      message: `Processed BPD supply from block ${fromBlock} to ${currentBlock}`,
      data: {
        blockNumber: currentBlock,
        totalSupplyBPD: supplyData.totalSupplyBPD,
        eventsProcessed: supplyEvents.length,
        mintEvents: supplyEvents.filter(e => e.event_type === 'mint').length,
        burnEvents: supplyEvents.filter(e => e.event_type === 'burn').length
      },
      results: {
        snapshot: snapshotResult,
        eventsCount: eventsResult.length
      }
    });
    
  } catch (error) {
    console.error('BPD supply tracking error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}