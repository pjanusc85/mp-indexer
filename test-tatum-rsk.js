import { ethers } from 'ethers';

const TATUM_API_KEY = 't-6892e2f865dcacffdeb948d9-306d302ca2024913a4ca4218';
// Try different URL formats for Tatum RSK
const TATUM_RSK_ENDPOINTS = [
  `https://api.tatum.io/v3/blockchain/node/rsk-mainnet/${TATUM_API_KEY}`,
  'https://api.tatum.io/v3/blockchain/node/rsk-mainnet',
  'https://api.tatum.io/v3/blockchain/node/rsk-testnet',
  `https://api.tatum.io/v3/blockchain/node/rsk-testnet/${TATUM_API_KEY}`
];

async function testTatumRSK() {
  console.log('=== Testing Tatum RSK RPC endpoint ===');
  console.log(`Endpoint: ${TATUM_RSK_RPC}`);
  
  try {
    const provider = new ethers.JsonRpcProvider(TATUM_RSK_RPC);
    
    // Test basic connectivity
    console.log('Testing basic connectivity...');
    const blockNumber = await provider.getBlockNumber();
    console.log(`✓ Connected. Latest block: ${blockNumber}`);
    
    // Test eth_getLogs with a simple filter
    console.log('Testing eth_getLogs...');
    const filter = {
      fromBlock: blockNumber - 100, // Last 100 blocks
      toBlock: 'latest'
    };
    
    console.log(`Requesting logs from block ${filter.fromBlock} to latest...`);
    const logs = await provider.getLogs(filter);
    console.log(`✓ eth_getLogs works! Found ${logs.length} logs`);
    
    if (logs.length > 0) {
      console.log('Sample log:');
      console.log({
        address: logs[0].address,
        blockNumber: logs[0].blockNumber,
        transactionHash: logs[0].transactionHash,
        topicsCount: logs[0].topics.length,
        data: logs[0].data.substring(0, 20) + '...'
      });
    }
    
    // Test with a more specific filter (contract address)
    if (logs.length > 0) {
      const contractAddress = logs[0].address;
      console.log(`\nTesting with specific contract address: ${contractAddress}`);
      
      const specificFilter = {
        address: contractAddress,
        fromBlock: blockNumber - 1000,
        toBlock: 'latest'
      };
      
      const specificLogs = await provider.getLogs(specificFilter);
      console.log(`✓ Contract-specific logs: ${specificLogs.length} logs found`);
    }
    
    return { success: true, logsCount: logs.length };
    
  } catch (error) {
    console.log(`✗ Error: ${error.message}`);
    
    // Check if it's an API key issue
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log('This might be an API key authentication issue.');
    }
    
    return { success: false, error: error.message };
  }
}

async function main() {
  const result = await testTatumRSK();
  
  console.log('\n=== SUMMARY ===');
  if (result.success) {
    console.log('✓ Tatum RSK RPC: WORKING');
    console.log(`✓ eth_getLogs: SUPPORTED (${result.logsCount} logs found)`);
  } else {
    console.log('✗ Tatum RSK RPC: FAILED');
    console.log(`✗ Error: ${result.error}`);
  }
}

main().catch(console.error);