# Snowflake Analytics Integration

This directory contains scripts and configurations for syncing Money Protocol vault events to Snowflake for advanced analytics.

## 📋 Prerequisites

1. **Snowflake Account**: You need an active Snowflake account
2. **Supabase Credentials**: Get from your Vercel project environment variables
3. **Python 3.8+**: Required for the sync scripts

## 🚀 Quick Setup

### Step 1: Configure Credentials

Edit `.env.snowflake` file with your credentials:

```bash
# Snowflake Configuration
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_ACCOUNT=abc12345.us-east-1  # Your account identifier
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=ACCOUNTADMIN

# Supabase Configuration (from Vercel)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

**Getting Supabase credentials from Vercel:**
1. Go to: https://vercel.com/pjanusc85/mp-indexer/settings/environment-variables
2. Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` values

### Step 2: Run Setup Script

```bash
cd snowflake
./setup_snowflake.sh
```

This will:
- Install Python dependencies
- Guide you through SQL setup
- Test connections
- Optionally run initial data sync

### Step 3: Manual SQL Setup (if needed)

If you prefer to run SQL manually in Snowflake:

1. **Create API Integration** (run `api_integration.sql`):
```sql
CREATE OR REPLACE API INTEGRATION mp_indexer
    API_PROVIDER = git_https_api
    API_ALLOWED_PREFIXES = ('https://github.com/pjanusc85/mp-indexer.git')
    ENABLED = true
    ALLOWED_AUTHENTICATION_SECRETS = all;
```

2. **Create Database and Tables** (run `analytics_setup.sql`):
```sql
CREATE DATABASE IF NOT EXISTS MP_ANALYTICS;
-- (rest of the script)
```

### Step 4: Test Connection

```bash
python3 test_connection.py
```

### Step 5: Run Data Sync

```bash
python3 sync_to_snowflake.py
```

## 📊 Available Analytics Views

After setup, you'll have these views in Snowflake:

- **`daily_vault_metrics`** - Daily aggregated metrics
- **`hourly_vault_activity`** - Hourly activity breakdown
- **`top_active_vaults`** - Most active vaults ranking

## 🔄 Scheduling Sync

### Option 1: Cron Job (Linux/Mac)

Add to crontab (`crontab -e`):
```bash
# Run every 6 hours
0 */6 * * * cd /path/to/mp-indexer && python3 snowflake/sync_to_snowflake.py
```

### Option 2: Snowflake Tasks

The setup creates a scheduled task in Snowflake that runs every 6 hours.

### Option 3: GitHub Actions

Create `.github/workflows/snowflake-sync.yml`:
```yaml
name: Sync to Snowflake
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
      - run: |
          pip install -r snowflake/requirements.txt
          python snowflake/sync_to_snowflake.py
        env:
          SNOWFLAKE_USER: ${{ secrets.SNOWFLAKE_USER }}
          SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }}
          SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

## 📈 Connecting BI Tools

Once data is in Snowflake, you can connect:

- **Tableau**: Native Snowflake connector
- **Power BI**: Snowflake connector available
- **Looker**: Direct integration
- **Metabase**: JDBC connection
- **Grafana**: Snowflake plugin

## 🛠️ Troubleshooting

### Connection Issues

1. **Snowflake authentication failed**:
   - Check account identifier format: `abc12345.us-east-1`
   - Verify user has correct permissions
   - Check if IP is whitelisted (if network policy exists)

2. **Supabase connection failed**:
   - Ensure URL includes `https://`
   - Check if API key is valid
   - Verify RLS policies allow read access

3. **No data syncing**:
   - Check if vault_events table exists in Supabase
   - Verify timestamp filtering in sync script
   - Look for duplicate key errors in logs

### Performance Optimization

For large datasets:
1. Adjust batch size in `sync_to_snowflake.py`
2. Use Snowpipe for real-time ingestion
3. Enable auto-clustering on large tables

## 📝 Files

- `api_integration.sql` - Git API integration setup
- `analytics_setup.sql` - Database, tables, and views creation
- `sync_to_snowflake.py` - Main sync script
- `test_connection.py` - Connection testing utility
- `setup_snowflake.sh` - Automated setup script
- `requirements.txt` - Python dependencies

## 🔒 Security Notes

- Never commit `.env.snowflake` to version control
- Use Snowflake roles for access control
- Rotate API keys regularly
- Consider using Snowflake private keys instead of passwords