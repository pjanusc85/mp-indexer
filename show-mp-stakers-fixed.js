import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';

// MP Staking contract and event signatures
const MP_STAKING_CONTRACT = '0x9Ea9FA0e1605382aE217966173E26E2f5EE73ac6';
const EVENT_SIGNATURES = {
  MPStakeUpdate: '0x35f39baa268d9f8633216b097bd56e9e819f581f96b99f9a2a7cb8b91d93e858',
  MPRewardUpdate: '0x39df0e5286a3ef2f42a0bf52f32cfe2c58e5b0405f47fe512f2c2439e4cfe204'
};

async function showMPStakersFixed() {
  console.log('👥 MP STAKING WALLET ADDRESSES (FIXED EXTRACTION)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🏦 MP Staking Contract: ${MP_STAKING_CONTRACT}`);
  console.log('');

  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Focus on a smaller recent block range to avoid timeouts
    const endBlock = 6713920;
    const startBlock = 6713500; // Smaller range
    
    console.log(`🔍 Searching blocks ${startBlock} to ${endBlock}...`);
    console.log('');
    
    const allStakers = new Map();
    
    // Process MPStakeUpdate events first (these have the staking amounts)
    console.log('🔍 Processing MPStakeUpdate events...');
    
    const stakeUpdateLogs = await provider.getLogs({
      address: MP_STAKING_CONTRACT,
      topics: [EVENT_SIGNATURES.MPStakeUpdate],
      fromBlock: `0x${startBlock.toString(16)}`,
      toBlock: `0x${endBlock.toString(16)}`
    });
    
    console.log(`   Found ${stakeUpdateLogs.length} MPStakeUpdate events`);
    
    for (const log of stakeUpdateLogs) {
      try {
        // Get transaction to find staker address
        const tx = await provider.getTransaction(log.transactionHash);
        const stakerAddress = tx.from;
        
        // Extract staked amount from data
        let stakedAmount = 0;
        if (log.data && log.data !== '0x') {
          const dataWithoutPrefix = log.data.slice(2);
          if (dataWithoutPrefix.length >= 64) {
            const amount = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
            stakedAmount = parseFloat(ethers.formatEther(amount));
          }
        }
        
        console.log(`   📊 ${stakerAddress} staked ${stakedAmount.toLocaleString()} MP (Block ${log.blockNumber})`);
        
        if (!allStakers.has(stakerAddress)) {
          allStakers.set(stakerAddress, {
            address: stakerAddress,
            totalStaked: 0,
            totalRewards: 0,
            transactions: []
          });
        }
        
        const staker = allStakers.get(stakerAddress);
        staker.totalStaked = stakedAmount; // Current total stake
        staker.transactions.push({
          type: 'MPStakeUpdate',
          hash: log.transactionHash,
          block: log.blockNumber,
          amount: stakedAmount
        });
        
      } catch (error) {
        console.warn(`   ⚠️ Error processing stake update: ${error.message}`);
      }
    }
    
    // Process reward events
    console.log('\\n🔍 Processing MPRewardUpdate events...');
    
    const rewardLogs = await provider.getLogs({
      address: MP_STAKING_CONTRACT,
      topics: [EVENT_SIGNATURES.MPRewardUpdate],
      fromBlock: `0x${startBlock.toString(16)}`,
      toBlock: `0x${endBlock.toString(16)}`
    });
    
    console.log(`   Found ${rewardLogs.length} MPRewardUpdate events`);
    
    for (const log of rewardLogs) {
      try {
        // Extract staker address from indexed topic
        let stakerAddress = null;
        if (log.topics.length > 1) {
          const topic1 = log.topics[1];
          if (topic1.startsWith('0x000000000000000000000000')) {
            stakerAddress = '0x' + topic1.slice(26);
          }
        }
        
        // Extract reward amount from data
        let rewardAmount = 0;
        if (log.data && log.data !== '0x') {
          const dataWithoutPrefix = log.data.slice(2);
          if (dataWithoutPrefix.length >= 64) {
            const amount = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
            rewardAmount = parseFloat(ethers.formatEther(amount));
          }
        }
        
        if (stakerAddress) {
          console.log(`   🎁 ${stakerAddress} earned ${rewardAmount.toLocaleString()} MP rewards (Block ${log.blockNumber})`);
          
          if (!allStakers.has(stakerAddress)) {
            allStakers.set(stakerAddress, {
              address: stakerAddress,
              totalStaked: 0,
              totalRewards: 0,
              transactions: []
            });
          }
          
          const staker = allStakers.get(stakerAddress);
          staker.totalRewards += rewardAmount;
          staker.transactions.push({
            type: 'MPRewardUpdate',
            hash: log.transactionHash,
            block: log.blockNumber,
            amount: rewardAmount
          });
        }
        
      } catch (error) {
        console.warn(`   ⚠️ Error processing reward update: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('👥 FINAL MP STAKERS RESULTS:');
    console.log('═══════════════════════════════');
    
    if (allStakers.size === 0) {
      console.log('❌ No MP stakers found in the searched block range');
    } else {
      const stakersList = Array.from(allStakers.values());
      stakersList.sort((a, b) => b.totalStaked - a.totalStaked);
      
      console.log(`Found ${stakersList.length} unique MP staker addresses:`);
      console.log('');
      
      stakersList.forEach((staker, i) => {
        console.log(`${i + 1}. 👤 ${staker.address}`);
        console.log(`   💰 Total MP Staked: ${staker.totalStaked.toLocaleString()} MP`);
        console.log(`   🎁 Total Rewards: ${staker.totalRewards.toLocaleString()} MP`);
        console.log(`   📊 Transactions: ${staker.transactions.length}`);
        
        // Show transaction details
        staker.transactions.forEach(tx => {
          console.log(`      ${tx.type}: ${tx.amount.toLocaleString()} MP (${tx.hash})`);
        });
        
        // Highlight if this is your transaction
        const yourTx = '0xfbbfcfd022bae6860e2ecf4194cbe165f387ca5c917cf9879236fe757907403c';
        const hasYourTx = staker.transactions.some(tx => tx.hash === yourTx);
        if (hasYourTx) {
          console.log(`   🎯 ✅ THIS INCLUDES YOUR TRANSACTION!`);
        }
        
        console.log('');
      });
      
      // Summary
      console.log('📊 SUMMARY:');
      console.log('═══════════════');
      const totalStaked = stakersList.reduce((sum, s) => sum + s.totalStaked, 0);
      const totalRewards = stakersList.reduce((sum, s) => sum + s.totalRewards, 0);
      console.log(`Total MP Staked across all users: ${totalStaked.toLocaleString()} MP`);
      console.log(`Total MP Rewards across all users: ${totalRewards.toLocaleString()} MP`);
    }
    
  } catch (error) {
    console.error('❌ Error showing MP stakers:', error);
  }
}

showMPStakersFixed();