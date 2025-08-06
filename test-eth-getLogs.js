import { ethers } from 'ethers';
import WebSocket from 'ws';

const rpcEndpoints = [
  'https://mycrypto.testnet.rsk.co',
  'https://rootstock-testnet.drpc.org'
];

const wsEndpoint = 'wss://rootstock-testnet.drpc.org';

async function testEthGetLogs(rpcUrl) {
  console.log(`\n=== Testing ${rpcUrl} ===`);
  
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Test basic connectivity first
    const blockNumber = await provider.getBlockNumber();
    console.log(`✓ Connected. Latest block: ${blockNumber}`);
    
    // Test eth_getLogs with a simple filter
    const filter = {
      fromBlock: blockNumber - 100, // Last 100 blocks
      toBlock: 'latest'
    };
    
    console.log(`Testing eth_getLogs from block ${filter.fromBlock} to latest...`);
    const logs = await provider.getLogs(filter);
    console.log(`✓ eth_getLogs works! Found ${logs.length} logs`);
    
    if (logs.length > 0) {
      console.log(`Sample log:`, {
        address: logs[0].address,
        blockNumber: logs[0].blockNumber,
        transactionHash: logs[0].transactionHash,
        topics: logs[0].topics.length
      });
    }
    
    return { success: true, logsCount: logs.length };
    
  } catch (error) {
    console.log(`✗ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testWebSocketEthGetLogs(wsUrl) {
  console.log(`\n=== Testing ${wsUrl} ===`);
  
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('✗ WebSocket connection timeout');
        ws.terminate();
        resolve({ success: false, error: 'Connection timeout' });
      }
    }, 10000);
    
    ws.on('open', async () => {
      console.log('✓ WebSocket connected');
      
      try {
        // Get latest block number first
        const blockRequest = {
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        };
        
        ws.send(JSON.stringify(blockRequest));
        
      } catch (error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.log(`✗ Error sending request: ${error.message}`);
          ws.terminate();
          resolve({ success: false, error: error.message });
        }
      }
    });
    
    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        
        if (response.id === 1) {
          // Block number response
          const blockNumber = parseInt(response.result, 16);
          console.log(`✓ Latest block: ${blockNumber}`);
          
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
          
          ws.send(JSON.stringify(logsRequest));
          
        } else if (response.id === 2) {
          // eth_getLogs response
          if (response.error) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              console.log(`✗ eth_getLogs error: ${response.error.message}`);
              ws.terminate();
              resolve({ success: false, error: response.error.message });
            }
          } else {
            const logs = response.result;
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              console.log(`✓ eth_getLogs works! Found ${logs.length} logs`);
              
              if (logs.length > 0) {
                console.log(`Sample log:`, {
                  address: logs[0].address,
                  blockNumber: parseInt(logs[0].blockNumber, 16),
                  transactionHash: logs[0].transactionHash,
                  topics: logs[0].topics.length
                });
              }
              
              ws.terminate();
              resolve({ success: true, logsCount: logs.length });
            }
          }
        }
        
      } catch (error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.log(`✗ Error parsing response: ${error.message}`);
          ws.terminate();
          resolve({ success: false, error: error.message });
        }
      }
    });
    
    ws.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`✗ WebSocket error: ${error.message}`);
        resolve({ success: false, error: error.message });
      }
    });
  });
}

async function main() {
  console.log('Testing eth_getLogs on RSK testnet nodes...\n');
  
  const results = {};
  
  // Test HTTP/HTTPS endpoints
  for (const rpcUrl of rpcEndpoints) {
    const result = await testEthGetLogs(rpcUrl);
    results[rpcUrl] = result;
  }
  
  // Test WebSocket endpoint
  const wsResult = await testWebSocketEthGetLogs(wsEndpoint);
  results[wsEndpoint] = wsResult;
  
  // Summary
  console.log('\n=== SUMMARY ===');
  for (const [endpoint, result] of Object.entries(results)) {
    const status = result.success ? '✓ WORKING' : '✗ FAILED';
    const detail = result.success ? `(${result.logsCount} logs)` : `(${result.error})`;
    console.log(`${endpoint}: ${status} ${detail}`);
  }
}

main().catch(console.error);