# 🚀 Snowflake Setup Instructions

## Step 1: Add Your Credentials

Edit the `.env.snowflake` file with your actual credentials:

```bash
nano .env.snowflake
# or
vi .env.snowflake
# or open in any text editor
```

### Required Information:

#### From Snowflake:
1. **SNOWFLAKE_USER**: Your Snowflake username
2. **SNOWFLAKE_PASSWORD**: Your Snowflake password
3. **SNOWFLAKE_ACCOUNT**: Your account identifier
   - Find in Snowflake UI → Admin → Accounts
   - Format: `abc12345.us-east-1`
   - From URL: `https://abc12345.us-east-1.snowflakecomputing.com`

#### From Vercel (get these from your dashboard):
Go to: https://vercel.com/pjanusc85/mp-indexer/settings/environment-variables

4. **SUPABASE_URL**: Copy the value (e.g., `https://xxxxx.supabase.co`)
5. **SUPABASE_ANON_KEY**: Copy the value (long string starting with `eyJ...`)

## Step 2: Test Your Connection

After adding credentials, test the connection:

```bash
cd /Users/Paulcalinawa/Documents/mp-indexer
python3 snowflake/test_connection.py
```

## Step 3: Run SQL Setup in Snowflake

Log into your Snowflake account and run these SQL commands:

### 3.1 Create API Integration:
```sql
CREATE OR REPLACE API INTEGRATION mp_indexer
    API_PROVIDER = git_https_api
    API_ALLOWED_PREFIXES = ('https://github.com/pjanusc85/mp-indexer.git')
    ENABLED = true
    ALLOWED_AUTHENTICATION_SECRETS = all
    COMMENT = 'API integration for Money Protocol indexer repository';
```

### 3.2 Create Database and Tables:
Run the entire contents of `snowflake/analytics_setup.sql` in Snowflake.

Or use SnowSQL CLI:
```bash
snowsql -a YOUR_ACCOUNT -u YOUR_USER -f snowflake/analytics_setup.sql
```

## Step 4: Run Initial Data Sync

Once everything is configured:

```bash
python3 snowflake/sync_to_snowflake.py
```

## Example .env.snowflake:

```env
# Snowflake Configuration
SNOWFLAKE_USER=john_doe
SNOWFLAKE_PASSWORD=MySecurePass123!
SNOWFLAKE_ACCOUNT=abc12345.us-east-1
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_ROLE=ACCOUNTADMIN

# Supabase Configuration
SUPABASE_URL=https://xyzabc123.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFiYzEyMyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2MjM5MDIyLCJleHAiOjE5NjE4MTUwMjJ9.AbCdEfGhIjKlMnOpQrStUvWxYz
```

## Need Help?

- **Snowflake Account Format**: Should include region (e.g., `abc12345.us-east-1`)
- **Supabase URL**: Must start with `https://`
- **File Permissions**: The script will set secure permissions automatically

Once you've added your credentials, let me know and we'll test the connection!