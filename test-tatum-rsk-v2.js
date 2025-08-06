const TATUM_API_KEY = 't-6892e2f865dcacffdeb948d9-306d302ca2024913a4ca4218';

// Test different Tatum RSK endpoint formats
const ENDPOINTS = [
  {
    name: 'RSK Mainnet (with API key in URL)',
    url: `https://api.tatum.io/v3/blockchain/node/rsk-mainnet/${TATUM_API_KEY}`,
    headers: {}
  },
  {
    name: 'RSK Mainnet (with x-api-key header)',
    url: 'https://api.tatum.io/v3/blockchain/node/rsk-mainnet',
    headers: { 'x-api-key': TATUM_API_KEY }
  },
  {
    name: 'RSK Mainnet (with Authorization Bearer)',
    url: 'https://api.tatum.io/v3/blockchain/node/rsk-mainnet',
    headers: { 'Authorization': `Bearer ${TATUM_API_KEY}` }
  },
  {
    name: 'RSK Testnet (with API key in URL)', 
    url: `https://api.tatum.io/v3/blockchain/node/rsk-testnet/${TATUM_API_KEY}`,
    headers: {}
  },
  {
    name: 'RSK Testnet (with x-api-key header)',
    url: 'https://api.tatum.io/v3/blockchain/node/rsk-testnet',
    headers: { 'x-api-key': TATUM_API_KEY }
  },
  {
    name: 'RSK Testnet (with Authorization Bearer)',
    url: 'https://api.tatum.io/v3/blockchain/node/rsk-testnet',
    headers: { 'Authorization': `Bearer ${TATUM_API_KEY}` }
  }
];

async function testTatumEndpoint(endpoint) {
  console.log(`\n=== Testing ${endpoint.name} ===`);
  console.log(`URL: ${endpoint.url}`);
  
  try {
    // Test basic connectivity first
    const blockNumberRequest = {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    };
    
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...endpoint.headers
      },
      body: JSON.stringify(blockNumberRequest)
    });
    
    if (!response.ok) {
      console.log(`✗ HTTP Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`Response: ${text}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const blockData = await response.json();
    
    if (blockData.error) {
      console.log(`✗ JSON-RPC Error: ${blockData.error.message}`);
      return { success: false, error: blockData.error.message };
    }
    
    const blockNumber = parseInt(blockData.result, 16);
    console.log(`✓ Connected. Latest block: ${blockNumber}`);
    
    // Now test eth_getLogs
    const logsRequest = {
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{
        fromBlock: `0x${(blockNumber - 100).toString(16)}`,
        toBlock: 'latest'
      }],
      id: 2
    };
    
    const logsResponse = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...endpoint.headers
      },
      body: JSON.stringify(logsRequest)
    });
    
    if (!logsResponse.ok) {
      console.log(`✗ eth_getLogs HTTP Error: ${logsResponse.status}`);
      return { success: false, error: `HTTP ${logsResponse.status}` };
    }
    
    const logsData = await logsResponse.json();
    
    if (logsData.error) {
      console.log(`✗ eth_getLogs Error: ${logsData.error.message}`);
      return { success: false, error: logsData.error.message };
    }
    
    const logs = logsData.result;
    console.log(`✓ eth_getLogs works! Found ${logs.length} logs`);
    
    if (logs.length > 0) {
      console.log('Sample log:');
      console.log({
        address: logs[0].address,
        blockNumber: parseInt(logs[0].blockNumber, 16),
        transactionHash: logs[0].transactionHash,
        topicsCount: logs[0].topics.length
      });
    }
    
    return { success: true, logsCount: logs.length, blockNumber };
    
  } catch (error) {
    console.log(`✗ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('Testing Tatum RSK RPC endpoints for eth_getLogs support...\n');
  
  const results = [];
  
  for (const endpoint of ENDPOINTS) {
    const result = await testTatumEndpoint(endpoint);
    results.push({ endpoint: endpoint.name, ...result });
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  for (const result of results) {
    const status = result.success ? '✓ WORKING' : '✗ FAILED';
    const detail = result.success 
      ? `(Block: ${result.blockNumber}, Logs: ${result.logsCount})` 
      : `(${result.error})`;
    console.log(`${result.endpoint}: ${status} ${detail}`);
  }
  
  const workingEndpoints = results.filter(r => r.success);
  if (workingEndpoints.length > 0) {
    console.log(`\n✓ Found ${workingEndpoints.length} working endpoint(s) with eth_getLogs support!`);
  } else {
    console.log('\n✗ No working endpoints found.');
  }
}

main().catch(console.error);