// Simple test endpoint to check environment variables
export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const envCheck = {
      hasRskUrl: !!process.env.RSK_RPC_URL,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
      hasVaultManager: !!process.env.VAULT_MANAGER_ADDRESS,
      hasSortedVaults: !!process.env.SORTED_VAULTS_ADDRESS,
      rskUrl: process.env.RSK_RPC_URL?.substring(0, 20) + '...' || 'Not set',
      supabaseUrl: process.env.SUPABASE_URL?.substring(0, 30) + '...' || 'Not set',
      supabaseKey: process.env.SUPABASE_ANON_KEY?.substring(0, 20) + '...' || 'Not set',
      vaultManager: process.env.VAULT_MANAGER_ADDRESS || 'Using fallback',
      sortedVaults: process.env.SORTED_VAULTS_ADDRESS || 'Using fallback',
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'unknown'
    };
    
    return res.status(200).json({
      message: 'Environment check completed',
      ...envCheck
    });
    
  } catch (error) {
    return res.status(500).json({
      error: 'Environment check failed',
      details: error.message
    });
  }
}