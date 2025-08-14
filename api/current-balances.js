const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: 'Missing environment variables',
        details: 'SUPABASE_URL and SUPABASE_ANON_KEY are required'
      });
    }

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // Get current balances from the view
    const url = `${SUPABASE_URL}/rest/v1/pool_balances_current?select=*`;
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      
      return res.status(200).json({
        success: true,
        message: `Retrieved current balances for ${data.length} pools`,
        data: data,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(response.status).json({
        error: 'Failed to fetch current balances',
        status: response.status
      });
    }
    
  } catch (error) {
    console.error('❌ Error in current balances API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}