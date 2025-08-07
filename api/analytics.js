const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { timeRange = '7d', metric = 'all' } = req.query;

  try {
    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch(timeRange) {
      case '24h':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    const queries = {
      // Daily event counts
      dailyEvents: `
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) FILTER (WHERE event_type = 'VaultUpdated') as vaults_updated,
          COUNT(*) FILTER (WHERE event_type = 'VaultLiquidated') as vaults_liquidated,
          COUNT(*) as total_events
        FROM vault_events
        WHERE timestamp >= '${startDate.toISOString()}'
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `,
      
      // Hourly events for last 24h
      hourlyEvents: `
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as event_count,
          event_type
        FROM vault_events
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', timestamp), event_type
        ORDER BY hour ASC
      `,
      
      // Top vaults by activity
      topVaults: `
        SELECT 
          vault_id,
          COUNT(*) as event_count,
          COUNT(*) FILTER (WHERE event_type = 'VaultUpdated') as updates,
          COUNT(*) FILTER (WHERE event_type = 'VaultLiquidated') as liquidations,
          MIN(timestamp) as first_seen,
          MAX(timestamp) as last_seen
        FROM vault_events
        WHERE timestamp >= '${startDate.toISOString()}'
          AND vault_id IS NOT NULL
        GROUP BY vault_id
        ORDER BY event_count DESC
        LIMIT 10
      `,
      
      // Summary statistics
      summary: `
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT vault_id) as unique_vaults,
          COUNT(*) FILTER (WHERE event_type = 'VaultUpdated') as total_updates,
          COUNT(*) FILTER (WHERE event_type = 'VaultLiquidated') as total_liquidations,
          MIN(timestamp) as earliest_event,
          MAX(timestamp) as latest_event,
          MAX(block_number) as latest_block
        FROM vault_events
        WHERE timestamp >= '${startDate.toISOString()}'
      `
    };

    const results = {};

    // Execute queries based on requested metric
    if (metric === 'all' || metric === 'daily') {
      const dailyResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/query`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: queries.dailyEvents })
        }
      );
      
      // Fallback to direct table query if RPC doesn't work
      if (!dailyResponse.ok) {
        const fallbackResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/vault_events?select=*&timestamp=gte.${startDate.toISOString()}&order=timestamp.asc`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );
        
        if (fallbackResponse.ok) {
          const events = await fallbackResponse.json();
          
          // Process events into daily aggregates
          const dailyData = {};
          events.forEach(event => {
            const date = new Date(event.timestamp).toISOString().split('T')[0];
            if (!dailyData[date]) {
              dailyData[date] = {
                date,
                vaults_updated: 0,
                vaults_liquidated: 0,
                total_events: 0
              };
            }
            dailyData[date].total_events++;
            if (event.event_type === 'VaultUpdated') {
              dailyData[date].vaults_updated++;
            } else if (event.event_type === 'VaultLiquidated') {
              dailyData[date].vaults_liquidated++;
            }
          });
          
          results.dailyEvents = Object.values(dailyData).sort((a, b) => 
            new Date(a.date) - new Date(b.date)
          );
        }
      } else {
        results.dailyEvents = await dailyResponse.json();
      }
    }

    if (metric === 'all' || metric === 'summary') {
      // Get summary statistics
      const summaryResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/vault_events?select=*&timestamp=gte.${startDate.toISOString()}`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (summaryResponse.ok) {
        const events = await summaryResponse.json();
        
        const uniqueVaults = new Set();
        let totalUpdates = 0;
        let totalLiquidations = 0;
        let latestBlock = 0;
        
        events.forEach(event => {
          if (event.vault_id) uniqueVaults.add(event.vault_id);
          if (event.event_type === 'VaultUpdated') totalUpdates++;
          if (event.event_type === 'VaultLiquidated') totalLiquidations++;
          if (event.block_number > latestBlock) latestBlock = event.block_number;
        });
        
        results.summary = {
          total_events: events.length,
          unique_vaults: uniqueVaults.size,
          total_updates: totalUpdates,
          total_liquidations: totalLiquidations,
          earliest_event: events.length > 0 ? events[0].timestamp : null,
          latest_event: events.length > 0 ? events[events.length - 1].timestamp : null,
          latest_block: latestBlock
        };
      }
    }

    if (metric === 'all' || metric === 'topVaults') {
      // Get top vaults
      const vaultsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/vault_events?select=vault_id,event_type,timestamp&timestamp=gte.${startDate.toISOString()}&vault_id=not.is.null`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (vaultsResponse.ok) {
        const events = await vaultsResponse.json();
        
        const vaultStats = {};
        events.forEach(event => {
          if (!vaultStats[event.vault_id]) {
            vaultStats[event.vault_id] = {
              vault_id: event.vault_id,
              event_count: 0,
              updates: 0,
              liquidations: 0,
              first_seen: event.timestamp,
              last_seen: event.timestamp
            };
          }
          
          vaultStats[event.vault_id].event_count++;
          if (event.event_type === 'VaultUpdated') {
            vaultStats[event.vault_id].updates++;
          } else if (event.event_type === 'VaultLiquidated') {
            vaultStats[event.vault_id].liquidations++;
          }
          
          if (new Date(event.timestamp) < new Date(vaultStats[event.vault_id].first_seen)) {
            vaultStats[event.vault_id].first_seen = event.timestamp;
          }
          if (new Date(event.timestamp) > new Date(vaultStats[event.vault_id].last_seen)) {
            vaultStats[event.vault_id].last_seen = event.timestamp;
          }
        });
        
        results.topVaults = Object.values(vaultStats)
          .sort((a, b) => b.event_count - a.event_count)
          .slice(0, 10);
      }
    }

    return res.status(200).json({
      success: true,
      timeRange,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      data: results
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics data',
      details: error.message 
    });
  }
}