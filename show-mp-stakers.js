import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// MP Staking contract and event signatures
const MP_STAKING_CONTRACT = '0x9Ea9FA0e1605382aE217966173E26E2f5EE73ac6';
const EVENT_SIGNATURES = {
  MPStake: '0x6b5cf27595af4428271524e0a5abd2b63f6fee1a61e31970490f5a10e257a1cd',
  MPStakeUpdate: '0x35f39baa268d9f8633216b097bd56e9e819f581f96b99f9a2a7cb8b91d93e858',
  MPRewardUpdate: '0x39df0e5286a3ef2f42a0bf52f32cfe2c58e5b0405f47fe512f2c2439e4cfe204',
  MPBalanceUpdate: '0xf744d34ca1cb25acfa4180df5f09a67306107110a9f4b6ed99bb3be259738215'
};

async function showMPStakers() {
  console.log('👥 MP STAKING WALLET ADDRESSES DETECTED');
  console.log('═══════════════════════════════════════════════');
  console.log(`🏦 MP Staking Contract: ${MP_STAKING_CONTRACT}`);
  console.log('');

  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Get current indexer state to see what blocks have been processed
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const stateResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state?select=*`, { headers });
    const stateData = await stateResponse.json();
    
    let startBlock = 6700000; // Recent blocks
    let endBlock = 6720000;
    
    if (stateData.length > 0) {
      const lastProcessed = stateData[0].last_block;
      console.log(`📊 Indexer last processed block: ${lastProcessed}`);
      endBlock = Math.min(lastProcessed, 6720000);
      console.log(`🔍 Searching blocks ${startBlock} to ${endBlock}...`);
    }
    
    console.log('');
    
    // Search for all MP staking events in recent blocks
    const allStakers = new Map(); // address -> { events, totalStaked, totalRewards, firstSeen, lastSeen }
    
    for (const [eventName, signature] of Object.entries(EVENT_SIGNATURES)) {
      console.log(`🔍 Searching for ${eventName} events...`);
      
      try {
        const logs = await provider.getLogs({
          address: MP_STAKING_CONTRACT,
          topics: [signature],
          fromBlock: `0x${startBlock.toString(16)}`,
          toBlock: `0x${endBlock.toString(16)}`
        });
        
        console.log(`   Found ${logs.length} ${eventName} events`);
        
        for (const log of logs) {
          const blockNumber = log.blockNumber;
          let stakerAddress = null;
          let amount = 0;
          
          // Extract staker address from topics (if indexed) or transaction
          if (log.topics.length > 1) {
            // Check if topic[1] is an address
            const topic1 = log.topics[1];
            if (topic1.startsWith('0x000000000000000000000000')) {
              stakerAddress = '0x' + topic1.slice(26);
            }
          } else if (eventName === 'MPStakeUpdate') {
            // For MPStakeUpdate, get staker address from transaction
            try {
              const tx = await provider.getTransaction(log.transactionHash);
              stakerAddress = tx.from;
            } catch (e) {
              console.warn(`Could not get transaction for ${log.transactionHash}`);
            }
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
          
          // If we found a staker address, record it
          if (stakerAddress && stakerAddress !== '0x0000000000000000000000000000000000000000') {
            if (!allStakers.has(stakerAddress)) {
              allStakers.set(stakerAddress, {
                address: stakerAddress,
                events: [],
                totalStaked: 0,
                totalRewards: 0,
                firstSeen: blockNumber,
                lastSeen: blockNumber,
                eventCounts: {}
              });
            }
            
            const staker = allStakers.get(stakerAddress);
            staker.events.push({
              eventType: eventName,
              blockNumber: blockNumber,
              amount: amount,
              transactionHash: log.transactionHash
            });
            
            staker.lastSeen = Math.max(staker.lastSeen, blockNumber);
            staker.firstSeen = Math.min(staker.firstSeen, blockNumber);
            
            // Count events by type
            if (!staker.eventCounts[eventName]) {
              staker.eventCounts[eventName] = 0;
            }
            staker.eventCounts[eventName]++;
            
            // Accumulate amounts based on event type
            if (eventName === 'MPStakeUpdate') {
              // MPStakeUpdate represents the total current stake amount
              staker.totalStaked = amount; // Use the current stake amount
            } else if (eventName === 'MPRewardUpdate') {
              staker.totalRewards += amount;
            }
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Error searching ${eventName}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('👥 MP STAKERS FOUND:');
    console.log('═══════════════════════');
    
    if (allStakers.size === 0) {
      console.log('❌ No MP stakers found in the searched block range');
      console.log('💡 This could mean:');
      console.log('   - No staking activity in recent blocks');
      console.log('   - Different event signatures needed');
      console.log('   - Different contract address for staking');
    } else {
      const stakersList = Array.from(allStakers.values());
      stakersList.sort((a, b) => b.totalStaked - a.totalStaked); // Sort by total staked
      
      console.log(`Found ${stakersList.length} unique MP staker addresses:`);
      console.log('');
      
      stakersList.forEach((staker, i) => {
        console.log(`${i + 1}. 👤 ${staker.address}`);
        console.log(`   💰 Total MP Staked: ${staker.totalStaked.toLocaleString()} MP`);
        console.log(`   🎁 Total Rewards: ${staker.totalRewards.toLocaleString()} MP`);
        console.log(`   📊 Events: ${staker.events.length} total`);
        
        // Show event breakdown
        const eventTypes = Object.entries(staker.eventCounts)
          .map(([type, count]) => `${type}(${count})`)
          .join(', ');
        console.log(`   📝 Event types: ${eventTypes}`);
        
        console.log(`   📅 Active: Block ${staker.firstSeen} to ${staker.lastSeen}`);
        
        // Show recent transactions
        const recentTxs = [...new Set(staker.events.map(e => e.transactionHash))].slice(0, 3);
        console.log(`   🔗 Recent transactions:`);
        recentTxs.forEach(tx => {
          console.log(`      ${tx}`);
        });
        
        console.log('');
      });
      
      // Summary
      console.log('📊 SUMMARY:');
      console.log('═══════════════');
      const totalStaked = stakersList.reduce((sum, s) => sum + s.totalStaked, 0);
      const totalRewards = stakersList.reduce((sum, s) => sum + s.totalRewards, 0);
      console.log(`Total MP Staked across all users: ${totalStaked.toLocaleString()} MP`);
      console.log(`Total MP Rewards across all users: ${totalRewards.toLocaleString()} MP`);
      
      // Check if user's address is in the list
      const userAddress = '0xd1C775899DAeB0af9644cAb2fE9AAC3F1af99F4F'; // Your known wallet
      const userStaker = stakersList.find(s => s.address.toLowerCase() === userAddress.toLowerCase());
      if (userStaker) {
        console.log(`\n🎯 YOUR WALLET FOUND: ${userAddress}`);
        console.log(`   Staked: ${userStaker.totalStaked.toLocaleString()} MP`);
        console.log(`   Rewards: ${userStaker.totalRewards.toLocaleString()} MP`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error showing MP stakers:', error);
  }
}

showMPStakers();