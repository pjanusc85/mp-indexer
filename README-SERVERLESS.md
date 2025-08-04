# Money Protocol Indexer - Serverless Architecture

## Overview

This is a serverless implementation of the Money Protocol indexer, designed to run on Vercel with Supabase as the database. The indexer monitors RSK testnet for vault events and stores them for analytics.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vercel Cron   │───▶│  Serverless API  │───▶│   Supabase DB   │
│  (Every 5 min)  │    │    Functions     │    │  (PostgreSQL)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │   RSK Testnet   │
                       │  (intrinsic.network) │
                       └─────────────────┘
```

## Files Structure

```
mp-indexer/
├── api/
│   ├── cron-indexer.js      # Cron job trigger (runs every 5 min)
│   └── process-blocks.js    # Manual block processing
├── src/                     # Original indexer code (legacy)
├── vercel.json             # Vercel configuration + cron jobs
├── supabase-schema.sql     # Database schema for Supabase
├── test-serverless.js      # Local testing script
├── DEPLOYMENT.md           # Deployment guide
└── .env.example           # Environment variables template
```

## Key Features

- ⏰ **Automated**: Runs every 5 minutes via Vercel cron jobs
- 🔄 **Stateless**: Each function call is independent
- 📊 **Analytics Ready**: Creates views for dashboard integration
- 🆓 **Free Tier**: Runs entirely on free services
- 🔍 **Monitoring**: Built-in logging and error handling

## API Endpoints

### `/api/cron-indexer` (POST)
- **Purpose**: Automated cron job endpoint
- **Trigger**: Every 5 minutes via Vercel
- **Function**: Processes new blocks since last run
- **Timeout**: 10 seconds max

### `/api/process-blocks` (POST)
- **Purpose**: Manual block processing
- **Payload**: `{"fromBlock": 123, "toBlock": 456}`
- **Function**: Process specific block range
- **Limit**: Max 1000 blocks per request

## Database Tables

- `indexer_state`: Tracks last processed block
- `vault_events`: Raw blockchain events
- `vault_states`: Current vault states
- `vault_history`: Historical changes
- Analytics views: `open_vaults_by_date`, `daily_vault_metrics`, `vault_summary`

## Environment Variables

```env
RSK_RPC_URL=https://www.intrinsic.network
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Quick Start

1. **Set up Supabase**:
   ```sql
   -- Run supabase-schema.sql in Supabase SQL Editor
   ```

2. **Test locally**:
   ```bash
   node test-serverless.js
   ```

3. **Deploy to Vercel**:
   ```bash
   npm run vercel-deploy
   ```

## Monitoring

- **Vercel Dashboard**: Functions tab shows cron job logs
- **Supabase**: Table editor shows indexed data
- **Manual Testing**: Use process-blocks endpoint

## Limitations

- **10-second timeout**: Limits block processing per run
- **No persistent state**: Each function call is stateless
- **Rate limits**: Subject to RSK RPC and Supabase limits
- **Free tier quotas**: 100 deployments/day, 288 cron jobs/day

## Troubleshooting

1. **No data appearing**: Check cron job logs in Vercel
2. **Database errors**: Verify Supabase credentials and schema
3. **RPC errors**: Confirm intrinsic.network RPC is accessible
4. **Timeout errors**: Reduce block range per processing cycle

## Next Steps

- Deploy Streamlit dashboard for visualization
- Set up alerting for liquidation events
- Add support for mainnet contracts
- Implement data export functionality