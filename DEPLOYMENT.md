# Money Protocol Indexer - Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
3. **GitHub Repository**: Push your code to GitHub

## Step 1: Set up Supabase Database

1. Create a new Supabase project
2. Go to the SQL Editor in your Supabase dashboard
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the SQL to create all tables, indexes, and views
5. Note down your:
   - Project URL (https://your-project-id.supabase.co)
   - Anon key (from Settings > API)

## Step 2: Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Set up environment variables in Vercel:
   - Go to your project settings
   - Add the following environment variables:
     - `RSK_RPC_URL`: `https://www.intrinsic.network`
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_ANON_KEY`: Your Supabase anon key

3. Deploy the project

## Step 3: Verify Deployment

1. Check the Functions tab in Vercel dashboard
2. Look for:
   - `/api/cron-indexer` (runs every 5 minutes)
   - `/api/process-blocks` (manual trigger)

## Step 4: Test the Indexer

### Test Manual Processing
```bash
curl -X POST https://your-vercel-app.vercel.app/api/process-blocks \
  -H "Content-Type: application/json" \
  -d '{"fromBlock": 5000000, "toBlock": 5000100}'
```

### Check Cron Job Status
- Go to Vercel dashboard > Functions tab
- Check the cron job logs

## Step 5: Monitor the Database

1. Go to Supabase dashboard > Table Editor
2. Check these tables for data:
   - `vault_events` - Raw blockchain events
   - `vault_states` - Current vault states
   - `vault_history` - Historical changes
   - `indexer_state` - Last processed block

## Step 6: View Analytics

Query the analytics views in Supabase:

```sql
-- See daily vault creation
SELECT * FROM open_vaults_by_date ORDER BY date DESC LIMIT 30;

-- See daily metrics
SELECT * FROM daily_vault_metrics ORDER BY date DESC LIMIT 30;

-- See overall summary
SELECT * FROM vault_summary;
```

## Troubleshooting

### Cron Job Not Running
- Check Vercel dashboard > Functions > cron-indexer logs
- Verify environment variables are set correctly
- Check Supabase connection in SQL Editor

### No Events Being Found
- RSK testnet has low activity
- Run the `check-contract-logs.js` script locally to verify
- Try processing a larger block range manually

### Database Connection Issues
- Verify Supabase URL and API key
- Check Row Level Security policies
- Ensure tables exist by running the schema again

## Free Tier Limits

- **Vercel**: 100GB bandwidth, 100 deployments per day
- **Supabase**: 50,000 monthly active users, 500MB database
- **Cron Jobs**: Run every 5 minutes (12 per hour, 288 per day)

## Next Steps

After successful deployment, consider:
1. Setting up Streamlit dashboard for visualization
2. Adding more analytics views
3. Implementing alerting for liquidation events
4. Adding support for mainnet contracts