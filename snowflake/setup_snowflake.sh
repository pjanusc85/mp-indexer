#!/bin/bash

echo "==================================="
echo "Snowflake Analytics Setup for MP Indexer"
echo "==================================="
echo ""

# Check if .env.snowflake exists
if [ ! -f ".env.snowflake" ]; then
    echo "❌ .env.snowflake file not found!"
    echo "Please create it from .env.snowflake.example and add your credentials"
    exit 1
fi

# Load environment variables
source .env.snowflake

# Check required variables
if [ -z "$SNOWFLAKE_USER" ] || [ -z "$SNOWFLAKE_PASSWORD" ] || [ -z "$SNOWFLAKE_ACCOUNT" ]; then
    echo "❌ Missing required Snowflake credentials in .env.snowflake"
    echo "Please add: SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT"
    exit 1
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Missing Supabase credentials in .env.snowflake"
    echo "Please add: SUPABASE_URL, SUPABASE_ANON_KEY"
    echo ""
    echo "You can get these from your Vercel project environment variables:"
    echo "https://vercel.com/pjanusc85/mp-indexer/settings/environment-variables"
    exit 1
fi

echo "✅ Configuration loaded successfully"
echo ""
echo "Step 1: Installing Python dependencies..."
echo "----------------------------------------"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r snowflake/requirements.txt

echo ""
echo "Step 2: Running Snowflake SQL setup..."
echo "----------------------------------------"
echo "Please run the following SQL scripts in your Snowflake console:"
echo ""
echo "1. First, run the API integration:"
echo "   snowflake/api_integration.sql"
echo ""
echo "2. Then, run the analytics setup:"
echo "   snowflake/analytics_setup.sql"
echo ""
echo "Or use SnowSQL CLI:"
echo "snowsql -a $SNOWFLAKE_ACCOUNT -u $SNOWFLAKE_USER -f snowflake/analytics_setup.sql"
echo ""

read -p "Have you run the SQL scripts in Snowflake? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please run the SQL scripts first, then run this setup again."
    exit 1
fi

echo ""
echo "Step 3: Testing connection..."
echo "----------------------------------------"

python3 snowflake/test_connection.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete! Connection successful."
    echo ""
    echo "Step 4: Initial data sync"
    echo "----------------------------------------"
    read -p "Would you like to run the initial data sync now? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Running initial sync..."
        python3 snowflake/sync_to_snowflake.py
    else
        echo "You can run the sync later with:"
        echo "python3 snowflake/sync_to_snowflake.py"
    fi
else
    echo ""
    echo "❌ Connection test failed. Please check your credentials."
    exit 1
fi

echo ""
echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Run sync manually: python3 snowflake/sync_to_snowflake.py"
echo "2. Set up scheduled sync (cron job or Airflow)"
echo "3. Connect your BI tools to Snowflake"
echo ""