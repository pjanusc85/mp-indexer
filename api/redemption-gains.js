// API endpoint to fetch daily redemption gains data (last 7 days)
// For the "Redemption Gain from MP Staking" chart

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Fetching daily redemption gains data...');
    
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // Fetch from the redemption gains daily view
    const url = `${SUPABASE_URL}/rest/v1/redemption_gains_daily?select=*&order=day.desc`;
    
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      
      return res.status(200).json({
        success: true,
        message: `Retrieved ${data.length} days of redemption gains data`,
        data: data
      });
      
    } else {
      const errorText = await response.text();
      console.error('Supabase error:', response.status, errorText);
      
      return res.status(response.status).json({
        success: false,
        error: `Database error: ${response.status}`,
        details: errorText
      });
    }
    
  } catch (error) {
    console.error('Redemption gains API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}