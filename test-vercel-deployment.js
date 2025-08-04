#!/usr/bin/env node

// Test script for deployed Vercel functions
// Usage: node test-vercel-deployment.js https://your-app.vercel.app

const deploymentUrl = process.argv[2];

if (!deploymentUrl) {
  console.log('❌ Please provide your Vercel deployment URL');
  console.log('Usage: node test-vercel-deployment.js https://your-app.vercel.app');
  process.exit(1);
}

console.log(`🧪 Testing Vercel Deployment: ${deploymentUrl}\n`);

async function testCronIndexer() {
  console.log('1️⃣ Testing cron indexer endpoint...');
  
  try {
    const response = await fetch(`${deploymentUrl}/api/cron-indexer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Cron indexer working');
      console.log(`   📊 Result: ${data.message}`);
      console.log(`   📍 Blocks processed: ${data.blocksProcessed || 0}`);
      console.log(`   🎯 Events found: ${data.eventsProcessed || 0}`);
    } else {
      console.log('   ❌ Cron indexer failed');
      console.log(`   💥 Error: ${data.error || 'Unknown error'}`);
    }
    
    return response.ok;
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return false;
  }
}

async function testProcessBlocks() {
  console.log('\n2️⃣ Testing manual block processing...');
  
  try {
    // Test with a small block range
    const payload = {
      fromBlock: 6049000,
      toBlock: 6049100
    };
    
    const response = await fetch(`${deploymentUrl}/api/process-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Manual processing working');
      console.log(`   📊 Result: ${data.message}`);
      console.log(`   📍 Blocks processed: ${data.blocksProcessed}`);
      console.log(`   🎯 Events found: ${data.eventsProcessed}`);
    } else {
      console.log('   ❌ Manual processing failed');
      console.log(`   💥 Error: ${data.error || 'Unknown error'}`);
    }
    
    return response.ok;
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const cronTest = await testCronIndexer();
  const manualTest = await testProcessBlocks();
  
  console.log('\n📊 Test Results:');
  console.log(`   Cron Indexer: ${cronTest ? '✅' : '❌'}`);
  console.log(`   Manual Processing: ${manualTest ? '✅' : '❌'}`);
  
  if (cronTest && manualTest) {
    console.log('\n🚀 Deployment successful!');
    console.log('\n📋 What happens next:');
    console.log('   • Cron job runs every 5 minutes automatically');
    console.log('   • Check Vercel Functions tab for logs');
    console.log('   • Monitor Supabase tables for new data');
    console.log('   • RSK testnet has low activity, so events may be rare');
  } else {
    console.log('\n⚠️  Some tests failed. Check:');
    console.log('   • Environment variables are set in Vercel');
    console.log('   • Supabase credentials are correct');
    console.log('   • Function deployment completed successfully');
  }
}

runTests().catch(console.error);