import { ethers } from 'ethers';

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Money Protocol contract addresses from deployment
const BORROWER_OPERATIONS_ADDRESS = '0xA8437A34a61B64764EA261e9cf85403c0Bb57e25';
const VAULT_MANAGER_ADDRESS = '0x0ecCcA821f078f394F2Bb1f3d615aD73729A9892';
const MP_STAKING_ADDRESS = '0x6651E5d0C04CBefCa1ce9eDDd479BA8f7B4A6976';

// Event signatures - calculated from event names
const BPD_BORROWING_FEE_PAID_SIGNATURE = '0xe3f81eee9eb7b21bda5672f049187ddcd1833f6de3018f5ff2a716efba828df0';
const REDEMPTION_SIGNATURE = '0x43a3f4082a4dbc33d78e317d2497d3a730bc7fc3574159dcea1056e62e5d9ad8';
const STAKING_GAINS_WITHDRAWN_SIGNATURE = '0xf744d34ca1cb25acfa4180df5f09a67306107110a9f4b6ed99bb3be259738215';

// Event ABIs
const BORROWING_FEE_ABI = [
  'event BPDBorrowingFeePaid(address indexed _borrower, uint256 _BPDFee)'
];

const REDEMPTION_ABI = [
  'event Redemption(uint256 _attemptedBPDAmount, uint256 _actualBPDAmount, uint256 _BTCSent, uint256 _BTCFee)'
];

const STAKING_GAINS_ABI = [
  'event StakingGainsWithdrawn(address indexed _staker, uint256 _BPDGain, uint256 _BTCGain)'
];

async function getBorrowingFeeEvents(fromBlock, toBlock) {
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    console.log(`Fetching BPD borrowing fee events from block ${fromBlock} to ${toBlock}`);
    
    // Get BPDBorrowingFeePaid events
    const logs = await provider.getLogs({
      address: BORROWER_OPERATIONS_ADDRESS,
      topics: [BPD_BORROWING_FEE_PAID_SIGNATURE],
      fromBlock,
      toBlock
    });
    
    console.log(`Found ${logs.length} BPD borrowing fee events`);
    
    const iface = new ethers.Interface(BORROWING_FEE_ABI);
    const events = [];
    
    for (const log of logs) {
      try {
        const decoded = iface.parseLog(log);
        const { _borrower, _BPDFee } = decoded.args;
        
        const block = await provider.getBlock(log.blockNumber);
        
        events.push({
          transaction_hash: log.transactionHash,
          block_number: log.blockNumber,
          log_index: log.logIndex,
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          borrower_address: _borrower,
          bpd_fee: _BPDFee.toString()
        });
      } catch (decodeError) {
        console.warn('Failed to decode borrowing fee log:', decodeError);
      }
    }
    
    return events;
    
  } catch (error) {
    console.error('Error fetching borrowing fee events:', error);
    throw error;
  }
}

async function getRedemptionEvents(fromBlock, toBlock) {
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    console.log(`Fetching redemption events from block ${fromBlock} to ${toBlock}`);
    
    // Get Redemption events
    const logs = await provider.getLogs({
      address: VAULT_MANAGER_ADDRESS,
      topics: [REDEMPTION_SIGNATURE],
      fromBlock,
      toBlock
    });
    
    console.log(`Found ${logs.length} redemption events`);
    
    const iface = new ethers.Interface(REDEMPTION_ABI);
    const events = [];
    
    for (const log of logs) {
      try {
        const decoded = iface.parseLog(log);
        const { _attemptedBPDAmount, _actualBPDAmount, _BTCSent, _BTCFee } = decoded.args;
        
        const block = await provider.getBlock(log.blockNumber);
        
        events.push({
          transaction_hash: log.transactionHash,
          block_number: log.blockNumber,
          log_index: log.logIndex,
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          redeemer_address: log.topics[1] ? ethers.getAddress('0x' + log.topics[1].slice(26)) : null, // Extract from indexed param if available
          bpd_amount: _actualBPDAmount.toString(),
          btc_sent: _BTCSent.toString(),
          btc_fee: _BTCFee.toString()
        });
      } catch (decodeError) {
        console.warn('Failed to decode redemption log:', decodeError);
      }
    }
    
    return events;
    
  } catch (error) {
    console.error('Error fetching redemption events:', error);
    throw error;
  }
}

async function getStakingGainsEvents(fromBlock, toBlock) {
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    console.log(`Fetching staking gains events from block ${fromBlock} to ${toBlock}`);
    
    // Get StakingGainsWithdrawn events
    const logs = await provider.getLogs({
      address: MP_STAKING_ADDRESS,
      topics: [STAKING_GAINS_WITHDRAWN_SIGNATURE],
      fromBlock,
      toBlock
    });
    
    console.log(`Found ${logs.length} staking gains events`);
    
    const iface = new ethers.Interface(STAKING_GAINS_ABI);
    const events = [];
    
    for (const log of logs) {
      try {
        const decoded = iface.parseLog(log);
        const { _staker, _BPDGain, _BTCGain } = decoded.args;
        
        const block = await provider.getBlock(log.blockNumber);
        
        events.push({
          transaction_hash: log.transactionHash,
          block_number: log.blockNumber,
          log_index: log.logIndex,
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          staker_address: _staker,
          bpd_gain: _BPDGain.toString(),
          btc_gain: _BTCGain.toString()
        });
      } catch (decodeError) {
        console.warn('Failed to decode staking gains log:', decodeError);
      }
    }
    
    return events;
    
  } catch (error) {
    console.error('Error fetching staking gains events:', error);
    throw error;
  }
}

async function getLastProcessedBlock(table) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=block_number&order=block_number.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.length > 0 ? data[0].block_number : 6680000; // Default start block
    } else {
      console.warn(`Could not get last processed block from ${table}:`, response.status);
      return 6680000; // Default start block
    }
  } catch (error) {
    console.error(`Error getting last processed block from ${table}:`, error);
    return 6680000; // Default start block
  }
}

async function saveEvents(table, events) {
  try {
    if (events.length === 0) return [];
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
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
      console.error(`Supabase ${table} error:`, response.status, errorText);
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`Saved ${events.length} events to ${table}`);
    return result;
    
  } catch (error) {
    console.error(`Error saving events to ${table}:`, error);
    throw error;
  }
}

// Main staking gains tracking function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting staking gains tracking...');
    
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    // Get the last processed blocks for each event type
    const [borrowingFromBlock, redemptionFromBlock, stakingFromBlock] = await Promise.all([
      getLastProcessedBlock('borrowing_fee_events'),
      getLastProcessedBlock('redemption_events'),
      getLastProcessedBlock('staking_gains_events')
    ]);
    
    const fromBlock = Math.min(borrowingFromBlock, redemptionFromBlock, stakingFromBlock);
    
    console.log(`Processing staking gains from block ${fromBlock} to ${currentBlock}`);
    
    // Get all events in parallel
    const [borrowingEvents, redemptionEvents, stakingEvents] = await Promise.all([
      getBorrowingFeeEvents(fromBlock, currentBlock),
      getRedemptionEvents(fromBlock, currentBlock),
      getStakingGainsEvents(fromBlock, currentBlock)
    ]);
    
    // Save all events in parallel
    const [borrowingResult, redemptionResult, stakingResult] = await Promise.all([
      saveEvents('borrowing_fee_events', borrowingEvents),
      saveEvents('redemption_events', redemptionEvents),
      saveEvents('staking_gains_events', stakingEvents)
    ]);
    
    const totalEvents = borrowingEvents.length + redemptionEvents.length + stakingEvents.length;
    
    return res.status(200).json({
      success: true,
      message: `Processed staking gains from block ${fromBlock} to ${currentBlock}`,
      data: {
        blockNumber: currentBlock,
        totalEventsProcessed: totalEvents,
        borrowingFeeEvents: borrowingEvents.length,
        redemptionEvents: redemptionEvents.length,
        stakingGainsEvents: stakingEvents.length
      },
      results: {
        borrowingFee: borrowingResult.length,
        redemption: redemptionResult.length,
        stakingGains: stakingResult.length
      }
    });
    
  } catch (error) {
    console.error('Staking gains tracking error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}