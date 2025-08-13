import { ethers } from 'ethers';

const ALCHEMY_RPC_URL = 'https://rootstock-testnet.g.alchemy.com/v2/xZF7o-Vl3z94HOqwaQtrZP06swu4_E15';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CONTRACTS = {
  activePool: '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F',
  defaultPool: '0x9BcA57F7D3712f46cd2D650a78f68e7928e866E2'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting simple TVL capture...');
    
    // Get current state
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const currentBlock = await provider.getBlockNumber();
    
    // Get balances
    const activePoolBalance = await provider.getBalance(CONTRACTS.activePool);
    const defaultPoolBalance = await provider.getBalance(CONTRACTS.defaultPool);
    
    const activePoolBTC = parseFloat(ethers.formatEther(activePoolBalance));
    const defaultPoolBTC = parseFloat(ethers.formatEther(defaultPoolBalance));
    const totalBTC = activePoolBTC + defaultPoolBTC;
    
    console.log('TVL calculated:', { activePoolBTC, defaultPoolBTC, totalBTC });
    
    // Prepare data for Supabase
    const tvlData = {
      block_number: currentBlock,
      timestamp: new Date().toISOString(),
      active_pool_btc: activePoolBTC,
      default_pool_btc: defaultPoolBTC,
      total_btc: totalBTC
    };
    
    console.log('Saving to Supabase:', tvlData);
    
    // Save to Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tvl_snapshots`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(tvlData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase error:', response.status, errorText);
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Saved successfully:', result);
    
    return res.status(200).json({
      success: true,
      message: `TVL snapshot saved for block ${currentBlock}`,
      data: {
        blockNumber: currentBlock,
        activePoolBTC,
        defaultPoolBTC,
        totalBTC,
        timestamp: tvlData.timestamp
      },
      supabaseResult: result
    });
    
  } catch (error) {
    console.error('Simple TVL error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
}