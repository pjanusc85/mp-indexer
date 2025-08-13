import { ethers } from 'ethers';

// MP Staking contract configuration for RSK testnet
export const MP_STAKING_CONFIG = {
  // Money Protocol Staking contract address - REAL ADDRESS
  address: process.env.MP_STAKING_ADDRESS || '0x6651E5d0C04CBefCa1ce9eDDd479BA8f7B4A6976',
  
  // Event signatures for MP staking - REAL SIGNATURES from blockchain
  events: {
    // Equivalent to TotalLQTYStakedUpdated - found from contract logs
    TotalMPStakedUpdated: '0xb2b3cfae184c4d1b9099b4e0ba91c76319a2a3f31f8908cd2849701b2c910a6b',
    
    // MP token transfer events for tracking claims
    Transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
  },
  
  // Reward distribution addresses (equivalent to Liquity's reward pools)
  // Based on MP token transfers from communityIssuance contract
  rewardSources: [
    '0x995695A5c83F6a152327f17548A8078C91f6a02F', // Community Issuance (main reward source)
    '0x11ad81e3E29DBA233aF88dCb4b169670FA2b8C65', // Stability Pool rewards
    '0x2053B98364d8CDb88627267712De6c3Ec574084D'  // Unipool LP rewards
  ]
};

// ABI for decoding staking events
export const MP_STAKING_ABI = [
  // Total MP staked updated event
  'event TotalMPStakedUpdated(uint256 _totalMPStaked)',
  
  // MP token transfer event
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

/**
 * Get MP staking events from a block range
 */
export async function getMPStakingEvents(provider, fromBlock, toBlock) {
  try {
    const stakingContract = MP_STAKING_CONFIG.address;
    
    // Get TotalMPStakedUpdated events
    const stakingLogs = await provider.getLogs({
      address: stakingContract,
      topics: [MP_STAKING_CONFIG.events.TotalMPStakedUpdated],
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`
    });
    
    // Get MP token transfer events from reward sources
    const claimLogs = [];
    for (const rewardSource of MP_STAKING_CONFIG.rewardSources) {
      if (rewardSource !== '0x0000000000000000000000000000000000000000') {
        const logs = await provider.getLogs({
          address: process.env.MP_TOKEN_ADDRESS, // MP token contract
          topics: [
            MP_STAKING_CONFIG.events.Transfer,
            ethers.zeroPadValue(rewardSource, 32) // from address
          ],
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`
        });
        claimLogs.push(...logs);
      }
    }
    
    return {
      stakingEvents: stakingLogs,
      claimEvents: claimLogs
    };
    
  } catch (error) {
    console.error('Error fetching MP staking events:', error);
    throw error;
  }
}

/**
 * Process and decode MP staking events
 */
export async function processMPStakingEvents(provider, stakingEvents, claimEvents) {
  const iface = new ethers.Interface(MP_STAKING_ABI);
  const processedEvents = [];
  
  // Process staking events
  for (const log of stakingEvents) {
    try {
      const decoded = iface.parseLog(log);
      const block = await provider.getBlock(log.blockNumber);
      
      processedEvents.push({
        type: 'staking_update',
        block_number: log.blockNumber,
        transaction_hash: log.transactionHash,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        total_mp_staked: ethers.formatEther(decoded.args._totalMPStaked),
        log_index: log.logIndex
      });
    } catch (error) {
      console.warn('Failed to decode staking event:', error);
    }
  }
  
  // Process claim events
  for (const log of claimEvents) {
    try {
      const decoded = iface.parseLog(log);
      const block = await provider.getBlock(log.blockNumber);
      
      processedEvents.push({
        type: 'mp_claimed',
        block_number: log.blockNumber,
        transaction_hash: log.transactionHash,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        amount_claimed: ethers.formatEther(decoded.args.value),
        from_address: decoded.args.from,
        to_address: decoded.args.to,
        log_index: log.logIndex
      });
    } catch (error) {
      console.warn('Failed to decode claim event:', error);
    }
  }
  
  // Sort by block number and log index
  processedEvents.sort((a, b) => {
    if (a.block_number !== b.block_number) {
      return a.block_number - b.block_number;
    }
    return a.log_index - b.log_index;
  });
  
  return processedEvents;
}

/**
 * Calculate MP staking metrics similar to Dune query
 */
export function calculateMPStakingMetrics(events) {
  const hourlyData = new Map();
  
  for (const event of events) {
    const hour = new Date(event.timestamp);
    hour.setMinutes(0, 0, 0); // Truncate to hour
    const hourKey = hour.toISOString();
    
    if (!hourlyData.has(hourKey)) {
      hourlyData.set(hourKey, {
        hour: hourKey,
        total_mp_staked: 0,
        mp_claimed_in_hour: 0
      });
    }
    
    const hourData = hourlyData.get(hourKey);
    
    if (event.type === 'staking_update') {
      hourData.total_mp_staked = parseFloat(event.total_mp_staked);
    } else if (event.type === 'mp_claimed') {
      hourData.mp_claimed_in_hour += parseFloat(event.amount_claimed);
    }
  }
  
  // Convert to array and calculate cumulative claims
  const sortedData = Array.from(hourlyData.values())
    .sort((a, b) => new Date(a.hour) - new Date(b.hour));
  
  let cumulativeClaimed = 0;
  for (const data of sortedData) {
    cumulativeClaimed += data.mp_claimed_in_hour;
    data.total_mp_claimed = cumulativeClaimed;
  }
  
  return sortedData;
}