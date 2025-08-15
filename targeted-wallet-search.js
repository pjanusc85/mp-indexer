import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CONTRACTS = {
  vaultManager: '0x0eccca821f078f394f2bb1f3d615ad73729a9892',
  activePool: '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F'
};

async function targetedWalletSearch() {
  console.log('🎯 Targeted search for wallet addresses in the 1.0111 BTC...');
  
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Strategy 1: Check our existing vault events from database
    console.log('📊 Strategy 1: Check existing vault events in database');
    console.log('═══════════════════════════════════════════════════');
    
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const eventsUrl = `${SUPABASE_URL}/rest/v1/vault_events?select=*&order=block_number.desc`;
    const eventsResponse = await fetch(eventsUrl, { headers });
    
    let databaseVaultUsers = [];
    
    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      console.log(`✅ Found ${events.length} vault events in database`);
      
      // Extract transaction details for each event
      for (const event of events) {
        try {
          const tx = await provider.getTransaction(event.transaction_hash);
          if (tx) {
            databaseVaultUsers.push({
              userAddress: tx.from,
              vaultId: event.vault_id,
              blockNumber: event.block_number,
              txHash: event.transaction_hash,
              eventType: event.event_type
            });
            
            console.log(`🏦 Vault ${event.vault_id?.substring(0, 10)}... operated by ${tx.from} (${event.event_type})`);
          }
        } catch (txError) {
          console.warn(`Could not fetch transaction ${event.transaction_hash}`);
        }
      }
    }
    
    // Strategy 2: Use Alchemy's enhanced API features to trace transfers
    console.log('');
    console.log('📊 Strategy 2: Use targeted block sampling');
    console.log('═══════════════════════════════════════════');
    
    const currentBlock = await provider.getBlockNumber();
    
    // Sample key blocks that likely contain vault activity
    const keyBlocks = [
      currentBlock - 10,
      currentBlock - 100, 
      currentBlock - 500,
      currentBlock - 1000,
      6709000, // Recent round number
      6700000, // Earlier round number
      6680000  // Start of our indexing
    ];
    
    const foundTransactions = [];
    
    for (const blockNum of keyBlocks) {
      if (blockNum < 1) continue;
      
      try {
        console.log(`🔍 Checking block ${blockNum}...`);
        const block = await provider.getBlock(blockNum, true);
        
        if (block && block.transactions) {
          for (const txHash of block.transactions) {
            const tx = await provider.getTransaction(txHash);
            
            // Check for transactions TO Active Pool
            if (tx && tx.to && tx.to.toLowerCase() === CONTRACTS.activePool.toLowerCase() && 
                tx.value && tx.value !== '0') {
              
              const amount = parseFloat(ethers.formatEther(tx.value));
              foundTransactions.push({
                from: tx.from,
                amount: amount,
                block: blockNum,
                txHash: tx.hash
              });
              
              console.log(`💰 FOUND: ${amount.toFixed(6)} BTC from ${tx.from} in block ${blockNum}`);
            }
            
            // Check for transactions TO Vault Manager (vault operations)
            if (tx && tx.to && tx.to.toLowerCase() === CONTRACTS.vaultManager.toLowerCase() && 
                tx.value && tx.value !== '0') {
              
              const amount = parseFloat(ethers.formatEther(tx.value));
              foundTransactions.push({
                from: tx.from,
                amount: amount,
                block: blockNum,
                txHash: tx.hash,
                type: 'vault_operation'
              });
              
              console.log(`🏦 VAULT OP: ${amount.toFixed(6)} BTC from ${tx.from} to VaultManager in block ${blockNum}`);
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
        
      } catch (error) {
        console.warn(`Error checking block ${blockNum}: ${error.message}`);
      }
    }
    
    // Strategy 3: Check very recent activity for Active Pool
    console.log('');
    console.log('📊 Strategy 3: Recent Active Pool balance history');
    console.log('═══════════════════════════════════════════════');
    
    // Check balance at different recent points to see when it changed
    const recentBlocks = [
      currentBlock,
      currentBlock - 10,
      currentBlock - 100,
      currentBlock - 1000
    ];
    
    console.log('Balance history:');
    for (const blockNum of recentBlocks) {
      try {
        const balance = await provider.getBalance(CONTRACTS.activePool, blockNum);
        const balanceBTC = parseFloat(ethers.formatEther(balance));
        console.log(`Block ${blockNum}: ${balanceBTC.toFixed(8)} BTC`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Could not get balance for block ${blockNum}`);
      }
    }
    
    // Summary of findings
    console.log('');
    console.log('🎯 WALLET ADDRESS SUMMARY:');
    console.log('═══════════════════════════════════════════');
    
    // Combine all found addresses
    const allAddresses = new Set();
    
    // From database vault events
    databaseVaultUsers.forEach(user => allAddresses.add(user.userAddress));
    
    // From found transactions
    foundTransactions.forEach(tx => allAddresses.add(tx.from));
    
    if (allAddresses.size > 0) {
      console.log(`✅ Found ${allAddresses.size} unique wallet addresses:`);
      console.log('');
      
      let addressIndex = 1;
      for (const address of allAddresses) {
        console.log(`${addressIndex}. ${address}`);
        
        // Show their activities
        const userDbEvents = databaseVaultUsers.filter(u => u.userAddress === address);
        const userTxs = foundTransactions.filter(tx => tx.from === address);
        
        if (userDbEvents.length > 0) {
          console.log(`   Database events: ${userDbEvents.length}`);
          userDbEvents.forEach(event => {
            console.log(`     - ${event.eventType} for vault ${event.vaultId?.substring(0, 10)}...`);
          });
        }
        
        if (userTxs.length > 0) {
          console.log(`   Direct transactions: ${userTxs.length}`);
          const totalAmount = userTxs.reduce((sum, tx) => sum + tx.amount, 0);
          console.log(`     - Total amount: ${totalAmount.toFixed(6)} BTC`);
        }
        
        console.log('');
        addressIndex++;
      }
      
      const totalFoundAmount = foundTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      console.log(`📊 Total BTC traced: ${totalFoundAmount.toFixed(6)} BTC`);
      console.log(`🎯 Target amount: 1.0110968111 BTC`);
      console.log(`📈 Coverage: ${((totalFoundAmount / 1.0110968111) * 100).toFixed(1)}%`);
      
    } else {
      console.log('❌ No wallet addresses found in the searched data');
      console.log('');
      console.log('💡 This suggests the 1.0111 BTC was deposited:');
      console.log('1. Before our indexing started (before block 6680000)');
      console.log('2. Through complex contract interactions');
      console.log('3. Via internal contract calls not visible as external transactions');
      console.log('');
      console.log('✅ However, the balance is REAL and verified on-chain!');
    }
    
  } catch (error) {
    console.error('❌ Error in targeted wallet search:', error);
  }
}

targetedWalletSearch();