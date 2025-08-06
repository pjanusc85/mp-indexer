async function testRSKTestnet() {
  const endpoint = 'https://rsk-testnet.gateway.tatum.io/';
  console.log(`Testing ${endpoint}`);
  
  try {
    // Test basic connectivity
    const blockNumberRequest = {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(blockNumberRequest)
    });
    
    if (!response.ok) {
      console.log(`✗ HTTP Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`Response: ${text}`);
      return;
    }
    
    const blockData = await response.json();
    
    if (blockData.error) {
      console.log(`✗ Block number error: ${blockData.error.message}`);
      return;
    }
    
    const blockNumber = parseInt(blockData.result, 16);
    console.log(`✓ Connected. Latest block: ${blockNumber}`);
    
    // Test eth_getLogs
    console.log('Testing eth_getLogs...');
    const logsRequest = {
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{
        fromBlock: `0x${(blockNumber - 100).toString(16)}`,
        toBlock: 'latest'
      }],
      id: 2
    };
    
    const logsResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logsRequest)
    });
    
    if (!logsResponse.ok) {
      console.log(`✗ eth_getLogs HTTP Error: ${logsResponse.status}`);
      const text = await logsResponse.text();
      console.log(`Response: ${text}`);
      return;
    }
    
    const logsData = await logsResponse.json();
    
    if (logsData.error) {
      console.log(`✗ eth_getLogs Error: ${logsData.error.code} - ${logsData.error.message}`);
      return;
    }
    
    const logs = logsData.result;
    console.log(`✓ eth_getLogs works! Found ${logs.length} logs`);
    
    if (logs.length > 0) {
      console.log('Sample log:');
      console.log({
        address: logs[0].address,
        blockNumber: parseInt(logs[0].blockNumber, 16),
        transactionHash: logs[0].transactionHash,
        topics: logs[0].topics.length
      });
    }
    
    console.log('\n✅ SUCCESS: eth_getLogs is available on RSK testnet!');
    
  } catch (error) {
    console.log(`✗ Error: ${error.message}`);
  }
}

testRSKTestnet();