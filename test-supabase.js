#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log('🧪 Testing Supabase Database Connection\n');

async function testSupabaseConnection() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Missing Supabase credentials in .env.local');
    console.log('Please update .env.local with your Supabase URL and API key');
    return false;
  }

  console.log(`🔗 Connecting to: ${SUPABASE_URL}`);
  console.log(`🔑 Using API key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);

  try {
    // Test 1: Check if we can connect
    console.log('\n1️⃣ Testing basic connection...');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('   ✅ Basic connection successful');

    // Test 2: Check if tables exist
    console.log('\n2️⃣ Checking if tables exist...');
    const tables = ['indexer_state', 'vault_events', 'vault_states', 'vault_history'];
    
    for (const table of tables) {
      try {
        const tableResponse = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });

        if (tableResponse.ok) {
          console.log(`   ✅ Table '${table}' exists`);
        } else {
          console.log(`   ❌ Table '${table}' not found or inaccessible`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking table '${table}': ${error.message}`);
      }
    }

    // Test 3: Check indexer_state initialization
    console.log('\n3️⃣ Checking indexer state...');
    const stateResponse = await fetch(`${SUPABASE_URL}/rest/v1/indexer_state`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (stateResponse.ok) {
      const stateData = await stateResponse.json();
      console.log(`   ✅ Indexer state records: ${stateData.length}`);
      if (stateData.length > 0) {
        console.log(`   📍 Last indexed block: ${stateData[0].last_block}`);
      }
    } else {
      console.log('   ❌ Could not read indexer_state table');
    }

    // Test 4: Check analytics views
    console.log('\n4️⃣ Testing analytics views...');
    const views = ['open_vaults_by_date', 'daily_vault_metrics', 'vault_summary'];
    
    for (const view of views) {
      try {
        const viewResponse = await fetch(`${SUPABASE_URL}/rest/v1/${view}?limit=1`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });

        if (viewResponse.ok) {
          console.log(`   ✅ View '${view}' accessible`);
        } else {
          console.log(`   ❌ View '${view}' not accessible`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking view '${view}': ${error.message}`);
      }
    }

    console.log('\n🎯 Supabase setup test completed!');
    return true;

  } catch (error) {
    console.log(`\n❌ Connection test failed: ${error.message}`);
    console.log('\n💡 Check:');
    console.log('   - Supabase URL is correct');
    console.log('   - API key is valid');
    console.log('   - Schema was run successfully');
    return false;
  }
}

async function insertSampleData() {
  console.log('\n5️⃣ Inserting sample data for testing...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/insert_sample_vault_data`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('   ✅ Sample data inserted successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Failed to insert sample data: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error inserting sample data: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const connectionTest = await testSupabaseConnection();
  
  if (connectionTest) {
    const sampleDataTest = await insertSampleData();
    
    if (sampleDataTest) {
      console.log('\n🚀 Database is ready for the indexer!');
      console.log('\n📋 Next steps:');
      console.log('   1. Deploy to Vercel with these environment variables');
      console.log('   2. Test the cron job execution');
      console.log('   3. Monitor vault events in the database');
    }
  }
}

runTests().catch(console.error);