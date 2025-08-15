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

async function backfillMPStakingEvents() {
  console.log('🔄 BACKFILLING MP STAKING EVENTS TO DATABASE');
  console.log('═══════════════════════════════════════════════');
  console.log(`🏦 MP Staking Contract: ${MP_STAKING_CONTRACT}`);
  console.log('');

  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Focus on block range that contains our known transactions
    const startBlock = 6713600;
    const endBlock = 6713900;
    
    console.log(`🔍 Backfilling blocks ${startBlock} to ${endBlock}...`);
    console.log('');
    
    const allEvents = [];
    
    // Get all MP staking events
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
          allEvents.push({
            ...log,
            eventType: eventName,
            blockNumber: log.blockNumber
          });
        }
        
      } catch (error) {
        console.warn(`Could not fetch ${eventName} events:`, error.message);
      }
    }
    
    console.log(`\\n📊 Total events found: ${allEvents.length}`);
    
    if (allEvents.length === 0) {
      console.log('❌ No events found to backfill');
      return;
    }
    
    // Process each event and prepare for database
    const individualEvents = [];
    
    for (const event of allEvents) {
      try {
        console.log(`🔍 Processing ${event.eventType} in block ${event.blockNumber}`);
        
        // Get block timestamp and transaction details
        const block = await provider.getBlock(event.blockNumber);
        const blockTimestamp = new Date(block.timestamp * 1000);
        
        const tx = await provider.getTransaction(event.transactionHash);
        const fromAddress = tx.from;
        const toAddress = tx.to;
        
        let eventAmount = 0;
        
        if (event.eventType === 'MPStakeUpdate' && event.data && event.data !== '0x') {
          const dataWithoutPrefix = event.data.slice(2);
          if (dataWithoutPrefix.length >= 64) {
            const stakedAmount = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
            eventAmount = parseFloat(ethers.formatEther(stakedAmount));
            console.log(`  💰 MP Staked: ${eventAmount} MP`);
          }
        }
        
        if (event.eventType === 'MPRewardUpdate' && event.data && event.data !== '0x') {
          const dataWithoutPrefix = event.data.slice(2);
          if (dataWithoutPrefix.length >= 64) {
            const rewardAmount = BigInt('0x' + dataWithoutPrefix.slice(0, 64));
            eventAmount = parseFloat(ethers.formatEther(rewardAmount));
            console.log(`  🎁 MP Reward: ${eventAmount} MP`);
          }
        }
        
        // Prepare individual event for database - map to allowed event types
        let mappedEventType = event.eventType;
        if (event.eventType === 'MPStakeUpdate') mappedEventType = 'MPStake';
        if (event.eventType === 'MPRewardUpdate') mappedEventType = 'MPClaim';
        
        const individualEvent = {
          event_type: mappedEventType,
          block_number: event.blockNumber,
          transaction_hash: event.transactionHash,
          timestamp: blockTimestamp.toISOString(),
          total_mp_staked: event.eventType === 'MPStakeUpdate' ? eventAmount : null,
          amount_claimed: event.eventType === 'MPRewardUpdate' ? eventAmount : null,
          from_address: fromAddress,
          to_address: toAddress,
          log_index: event.logIndex || 0,
          processed_at: new Date().toISOString()
        };
        
        individualEvents.push(individualEvent);
        console.log(`  📝 Prepared: ${event.eventType} - ${eventAmount} MP`);
        
      } catch (error) {
        console.warn(`⚠️ Error processing ${event.eventType}:`, error.message);
      }
    }
    
    console.log(`\\n💾 Saving ${individualEvents.length} events to database...`);
    
    // Save to database
    const response = await fetch(`${SUPABASE_URL}/rest/v1/mp_staking_events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(individualEvents)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Save failed: ${response.status}`);
      console.error('Response:', errorText);
      return;
    }

    console.log(`✅ Successfully saved ${individualEvents.length} MP staking events to database!`);
    
    // Show summary by wallet
    console.log('\\n👥 EVENTS BY WALLET:');
    console.log('═══════════════════════');
    
    const walletSummary = {};
    individualEvents.forEach(event => {
      const wallet = event.from_address;
      if (!walletSummary[wallet]) {
        walletSummary[wallet] = {
          stakeEvents: 0,
          rewardEvents: 0,
          totalStaked: 0,
          totalRewards: 0
        };
      }
      
      if (event.event_type === 'MPStakeUpdate') {
        walletSummary[wallet].stakeEvents++;
        walletSummary[wallet].totalStaked = event.total_mp_staked; // Current total
      } else if (event.event_type === 'MPRewardUpdate') {
        walletSummary[wallet].rewardEvents++;
        walletSummary[wallet].totalRewards += event.amount_claimed;
      }
    });
    
    Object.entries(walletSummary).forEach(([wallet, summary]) => {
      console.log(`👤 ${wallet}`);
      console.log(`   💰 Total Staked: ${summary.totalStaked.toLocaleString()} MP`);
      console.log(`   🎁 Total Rewards: ${summary.totalRewards.toLocaleString()} MP`);
      console.log(`   📊 Events: ${summary.stakeEvents} stakes, ${summary.rewardEvents} rewards`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error backfilling MP staking events:', error);
  }
}

backfillMPStakingEvents();