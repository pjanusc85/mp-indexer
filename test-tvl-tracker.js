import { ethers } from 'ethers';

// Test the TVL tracker functionality
const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';

const CONTRACTS = {
  activePool: '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F',
  vaultManager: '0x0ecCcA821f078f394F2Bb1f3d615aD73729A9892',
  defaultPool: '0x9BcA57F7D3712f46cd2D650a78f68e7928e866E2'
};

async function testTVLCalculation() {
  console.log('Testing TVL calculation...');
  
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    console.log(`Current block: ${currentBlock}`);
    
    // Get balances
    const activePoolBalance = await provider.getBalance(CONTRACTS.activePool, currentBlock);
    const defaultPoolBalance = await provider.getBalance(CONTRACTS.defaultPool, currentBlock);
    
    console.log('Balances:');
    console.log(`Active Pool: ${ethers.formatEther(activePoolBalance)} BTC`);
    console.log(`Default Pool: ${ethers.formatEther(defaultPoolBalance)} BTC`);
    console.log(`Total TVL: ${ethers.formatEther(activePoolBalance + defaultPoolBalance)} BTC`);
    
    // Test if we can get vault events
    const vaultUpdatedLogs = await provider.getLogs({
      address: CONTRACTS.vaultManager,
      topics: ['0x1682adcf84a5197a236a80c9ffe2e7233619140acb7839754c27cdc21799192c'],
      fromBlock: currentBlock - 1000,
      toBlock: 'latest'
    });
    
    console.log(`Found ${vaultUpdatedLogs.length} VaultUpdated events in last 1000 blocks`);
    
    if (vaultUpdatedLogs.length > 0) {
      console.log('Sample event:', {
        blockNumber: vaultUpdatedLogs[0].blockNumber,
        transactionHash: vaultUpdatedLogs[0].transactionHash,
        topics: vaultUpdatedLogs[0].topics
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

async function callTVLTrackerAPI() {
  console.log('\nTesting TVL tracker API...');
  
  try {
    const response = await fetch('http://localhost:3000/api/tvl-tracker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('API Response:', result);
    } else {
      console.error('API Error:', response.status, await response.text());
    }
    
  } catch (error) {
    console.error('API call failed:', error);
  }
}

async function main() {
  await testTVLCalculation();
  
  // Uncomment to test API (requires local development server)
  // await callTVLTrackerAPI();
}

main().catch(console.error);