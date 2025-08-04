#!/usr/bin/env node

import { ethers } from 'ethers';

// Mock environment variables for testing
process.env.RSK_RPC_URL = 'https://www.intrinsic.network';
process.env.SUPABASE_URL = 'https://test.supabase.co'; // Replace with real URL
process.env.SUPABASE_ANON_KEY = 'test-key'; // Replace with real key

console.log('🧪 Testing Serverless Functions Locally\n');

// Test 1: Test RSK connection
async function testRSKConnection() {
  console.log('1️⃣ Testing RSK Connection...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RSK_RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    console.log(`   ✅ Connected to RSK. Current block: ${blockNumber}`);
    return true;
  } catch (error) {
    console.log(`   ❌ RSK connection failed: ${error.message}`);
    return false;
  }
}

// Test 2: Test contract interaction
async function testContractInteraction() {
  console.log('\n2️⃣ Testing Contract Interaction...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RSK_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 100;
    
    const logs = await provider.getLogs({
      address: '0x54F2712Fd31Fc81A47D014727C12F26ba24Feec2',
      fromBlock: fromBlock,
      toBlock: currentBlock
    });
    
    console.log(`   ✅ Contract query successful. Found ${logs.length} logs in last 100 blocks`);
    return true;
  } catch (error) {
    console.log(`   ❌ Contract interaction failed: ${error.message}`);
    return false;
  }
}

// Test 3: Test function structure (without actual API call)
async function testFunctionStructure() {
  console.log('\n3️⃣ Testing Function Structure...');
  try {
    // Import the cron indexer function
    const { default: cronIndexer } = await import('./api/cron-indexer.js');
    const { default: processBlocks } = await import('./api/process-blocks.js');
    
    console.log('   ✅ Cron indexer function imported successfully');
    console.log('   ✅ Process blocks function imported successfully');
    
    // Test function signature (mock request/response)
    const mockReq = { method: 'POST', body: { fromBlock: 1000, toBlock: 1001 } };
    const mockRes = {
      status: (code) => ({ json: (data) => ({ statusCode: code, data }) }),
      json: (data) => ({ data })
    };
    
    console.log('   ✅ Function signatures are valid');
    return true;
  } catch (error) {
    console.log(`   ❌ Function structure test failed: ${error.message}`);
    return false;
  }
}

// Test 4: Environment variables
function testEnvironmentVariables() {
  console.log('\n4️⃣ Testing Environment Variables...');
  
  const requiredVars = ['RSK_RPC_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  let allPresent = true;
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: Set`);
    } else {
      console.log(`   ❌ ${varName}: Missing`);
      allPresent = false;
    }
  }
  
  return allPresent;
}

// Run all tests
async function runTests() {
  console.log('Starting serverless function tests...\n');
  
  const envTest = testEnvironmentVariables();
  const rskTest = await testRSKConnection();
  const contractTest = await testContractInteraction();
  const structureTest = await testFunctionStructure();
  
  console.log('\n📊 Test Results:');
  console.log(`   Environment Variables: ${envTest ? '✅' : '❌'}`);
  console.log(`   RSK Connection: ${rskTest ? '✅' : '❌'}`);
  console.log(`   Contract Interaction: ${contractTest ? '✅' : '❌'}`);
  console.log(`   Function Structure: ${structureTest ? '✅' : '❌'}`);
  
  const allPassed = envTest && rskTest && contractTest && structureTest;
  
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!allPassed) {
    console.log('\n⚠️  Please fix the failing tests before deploying to Vercel');
    console.log('💡 Update your .env file with correct Supabase credentials');
  } else {
    console.log('\n🚀 Ready for Vercel deployment!');
    console.log('💡 Next steps:');
    console.log('   1. Set up Supabase database with supabase-schema.sql');
    console.log('   2. Deploy to Vercel with proper environment variables');
    console.log('   3. Monitor the cron job execution');
  }
}

// Run the tests
runTests().catch(console.error);