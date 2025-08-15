import { ethers } from 'ethers';

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';

const MP_STAKING_CONTRACT = '0x9Ea9FA0e1605382aE217966173E26E2f5EE73ac6';
const EVENT_SIGNATURES = {
  MPStake: '0x6b5cf27595af4428271524e0a5abd2b63f6fee1a61e31970490f5a10e257a1cd',
  MPStakeUpdate: '0x35f39baa268d9f8633216b097bd56e9e819f581f96b99f9a2a7cb8b91d93e858',
  MPRewardUpdate: '0x39df0e5286a3ef2f42a0bf52f32cfe2c58e5b0405f47fe512f2c2439e4cfe204',
  MPBalanceUpdate: '0xf744d34ca1cb25acfa4180df5f09a67306107110a9f4b6ed99bb3be259738215'
};

export default async function handler(req, res) {
  console.log('👥 MP Staking Wallets API Called');
  
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Query recent blocks for MP staking events
    const currentBlock = await provider.getBlockNumber();
    const startBlock = Math.max(currentBlock - 10000, 6713000); // Look back 10k blocks or start from known MP staking block
    const endBlock = currentBlock;
    
    console.log(`🔍 Scanning blocks ${startBlock} to ${endBlock} for MP staking events...`);
    
    const allStakers = new Map();
    
    // Get all MP staking events from recent blocks
    for (const [eventName, signature] of Object.entries(EVENT_SIGNATURES)) {
      if (eventName.startsWith('MP')) {
        try {
          const logs = await provider.getLogs({
            address: MP_STAKING_CONTRACT,
            topics: [signature],
            fromBlock: `0x${startBlock.toString(16)}`,
            toBlock: `0x${endBlock.toString(16)}`
          });
          
          console.log(`   Found ${logs.length} ${eventName} events`);
          
          for (const log of logs) {
            let stakerAddress = null;
            let amount = 0;
            
            // Get transaction to find staker address
            try {
              const tx = await provider.getTransaction(log.transactionHash);
              stakerAddress = tx.from;
            } catch (e) {
              console.warn(`Could not get transaction for ${log.transactionHash}`);
              continue;
            }
            
            // Extract amount from data
            if (log.data && log.data !== '0x') {
              try {
                const dataWithoutPrefix = log.data.slice(2);
                if (dataWithoutPrefix.length >= 64) {
                  const firstValue = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
                  amount = parseFloat(ethers.formatEther(firstValue));
                }
              } catch (e) {
                // Skip if can't decode
              }
            }
            
            // Record staker data
            if (stakerAddress && stakerAddress !== '0x0000000000000000000000000000000000000000') {
              if (!allStakers.has(stakerAddress)) {
                allStakers.set(stakerAddress, {
                  address: stakerAddress,
                  totalStaked: 0,
                  totalRewards: 0,
                  lastActivity: log.blockNumber,
                  transactionCount: 0,
                  transactions: []
                });
              }
              
              const staker = allStakers.get(stakerAddress);
              staker.lastActivity = Math.max(staker.lastActivity, log.blockNumber);
              staker.transactionCount++;
              staker.transactions.push({
                hash: log.transactionHash,
                block: log.blockNumber,
                eventType: eventName,
                amount: amount
              });
              
              // Update amounts based on event type and transaction analysis
              if (eventName === 'MPStakeUpdate') {
                // This represents the current total stake for this wallet
                staker.totalStaked = amount;
              } else if (eventName === 'MPRewardUpdate') {
                // Analysis shows these are often additional staking amounts, not rewards
                // Let's analyze the pattern: if it's a large round number, it's likely staking
                if (amount >= 1000 && amount % 1 === 0) {
                  // Large round amounts are likely the TOTAL staking amount, not additional
                  // Only update if this is larger than current stake (shouldn't double count)
                  if (amount > staker.totalStaked) {
                    staker.totalStaked = amount;
                  }
                } else {
                  // Small amounts or non-round amounts are likely actual rewards
                  staker.totalRewards += amount;
                }
              }
            }
          }
          
        } catch (error) {
          console.warn(`Could not fetch ${eventName} events:`, error.message);
        }
      }
    }
    
    // Convert to array and sort by total staked
    const walletBreakdown = Array.from(allStakers.values()).map(staker => ({
      wallet_address: staker.address,
      total_mp_staked: staker.totalStaked,
      total_mp_rewards: staker.totalRewards,
      last_activity_block: staker.lastActivity,
      transaction_count: staker.transactionCount,
      recent_transactions: staker.transactions.slice(-3), // Last 3 transactions
      percentage_of_total: 0 // Will calculate below
    })).sort((a, b) => b.total_mp_staked - a.total_mp_staked);
    
    // Calculate percentages
    const totalStaked = walletBreakdown.reduce((sum, w) => sum + w.total_mp_staked, 0);
    const totalRewards = walletBreakdown.reduce((sum, w) => sum + w.total_mp_rewards, 0);
    
    walletBreakdown.forEach(wallet => {
      wallet.percentage_of_total = totalStaked > 0 ? (wallet.total_mp_staked / totalStaked * 100) : 0;
    });
    
    console.log(`✅ Found ${walletBreakdown.length} MP staking wallets with total ${totalStaked.toLocaleString()} MP staked`);
    
    // Include summary statistics
    return res.status(200).json({
      success: true,
      message: `Retrieved MP staking data for ${walletBreakdown.length} wallets`,
      summary: {
        total_wallets: walletBreakdown.length,
        total_mp_staked: totalStaked,
        total_mp_rewards: totalRewards,
        blocks_scanned: `${startBlock}-${endBlock}`,
        current_block: currentBlock
      },
      wallets: walletBreakdown
    });
    
  } catch (error) {
    console.error('❌ Error fetching MP staking wallet breakdown:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch MP staking wallet breakdown',
      details: error.message
    });
  }
}