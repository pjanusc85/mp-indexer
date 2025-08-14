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
    
    // Get the most recent balance tracking data
    const url = `${SUPABASE_URL}/rest/v1/pool_balance_hourly?select=*&order=hour.desc&limit=50`;
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      
      return res.status(200).json({
        success: true,
        message: `Retrieved ${data.length} balance tracking records`,
        data: data,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(response.status).json({
        error: 'Failed to fetch balance tracking data',
        status: response.status
      });
    }
    
  } catch (error) {
    console.error('❌ Error in balance tracking API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}