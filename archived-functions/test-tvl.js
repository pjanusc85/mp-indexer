import { ethers } from 'ethers';

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CONTRACTS = {
  activePool: '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F',
  vaultManager: '0x0ecCcA821f078f394F2Bb1f3d615aD73729A9892',
  defaultPool: '0x9BcA57F7D3712f46cd2D650a78f68e7928e866E2'
};

export default async function handler(req, res) {
  try {
    console.log('Testing TVL components...');
    
    // Test 1: Check Supabase connection
    const supabaseTest = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    console.log('Supabase connection:', supabaseTest.status);
    
    // Test 2: Check if TVL tables exist
    const tablesResponse = await fetch(`${SUPABASE_URL}/rest/v1/tvl_snapshots?select=count&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    console.log('TVL snapshots table:', tablesResponse.status);
    
    // Test 3: Check Alchemy connection
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    console.log('Current block:', currentBlock);
    
    // Test 4: Get contract balances
    const activePoolBalance = await provider.getBalance(CONTRACTS.activePool);
    const defaultPoolBalance = await provider.getBalance(CONTRACTS.defaultPool);
    
    const totalBTC = parseFloat(ethers.formatEther(activePoolBalance + defaultPoolBalance));
    
    console.log('TVL calculation successful');
    
    return res.status(200).json({
      success: true,
      tests: {
        supabase: supabaseTest.status === 200,
        tvlTable: tablesResponse.status === 200,
        alchemy: currentBlock > 0,
        tvlCalculation: totalBTC >= 0
      },
      data: {
        currentBlock,
        activePoolBTC: ethers.formatEther(activePoolBalance),
        defaultPoolBTC: ethers.formatEther(defaultPoolBalance),
        totalBTC
      },
      errors: {
        tablesError: tablesResponse.status !== 200 ? await tablesResponse.text() : null
      }
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}