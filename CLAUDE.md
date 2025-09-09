# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Money Protocol Indexer is a real-time blockchain indexer for Money Protocol vault events on RSK testnet. It supports multiple deployment modes: local development, serverless on Vercel, and Streamlit analytics dashboard.

## Common Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Install Python dependencies for Streamlit
pip install -r requirements.txt

# Test connections
npm run test
node src/test-scanner.js

# Start indexer (block scanner - recommended for public nodes)
npm run start:scanner
npm run dev:scanner

# Start indexer (eth_getLogs - requires API key)
npm start
npm run dev

# Manual contract testing
npm run check-contracts
```

### Vercel Serverless Deployment
```bash
# Local development
npm run vercel-dev

# Deploy to production
npm run vercel-deploy
```

### Streamlit Analytics Dashboard
```bash
# Run locally
streamlit run streamlit_app.py

# Deploy to Streamlit Cloud
# (Push to GitHub and connect via Streamlit Cloud interface)
```

### Database Operations
```bash
# Run database schema setup
psql -h localhost -U superset -d analytics -f supabase-schema.sql

# Test Supabase connection
node test-supabase.js
python test_supabase_connection.py
```

## Architecture

### Core Architecture
```
RSK Testnet → VaultManager Contract → Event Parser → Database → Analytics
```

### Key Components
- **Indexer Types**:
  - `src/index.js` - eth_getLogs approach (requires RPC with full API)
  - `src/index-block-scanner.js` - Block-by-block scanner (works with public nodes)
- **Contract Interfaces**: `src/contracts/` - VaultManager, BorrowerOperations, MPStaking
- **Database Layer**: `src/database/` - PostgreSQL/Supabase connection and event storage
- **Serverless Functions**: `api/` - Vercel cron jobs and manual triggers
- **Analytics**: `streamlit_app.py` - Interactive dashboard

### Deployment Modes
1. **Local**: Direct PostgreSQL connection for development
2. **Serverless**: Vercel + Supabase for production
3. **Analytics**: Streamlit dashboard consuming database data

## Important Configuration

### Environment Variables
- `RSK_RPC_URL`: RSK testnet endpoint (default: public-node.testnet.rsk.co)
- `VAULT_MANAGER_ADDRESS`: Main contract address
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### Key Contracts (Latest Deployment: c6b0a06a40367f4e776d55029ee92749abfa14b1)
- VaultManager: `0xf1df1d059E67E19b270b083bd13AC791C573968b`
- BorrowerOperations: `0xf721a6c73676628Bb708Ee6Cfe7f9e2328a020eF`
- SortedVaults: `0x045cf0431C72AA2bcF100f730e3226Ef4dbF7486`
- MPStaking: `0x614720C2D9dA3e2eC10F1214bD9e8Cb0fe06123D`
- StabilityPool: `0xdA30a81004d4530e4C632D3Fa11F53558dB6209b`
- BPD Token: `0x8E2646c8fEF01a0Bb94c5836717E571C772De1B9`
- MP Token: `0x411a65a1db8693529Dbb3bbf13814B4464EbcE97B`

### Database Schema
- `vault_events`: Raw blockchain events
- `vault_states`: Current vault states
- `vault_history`: Historical vault data
- Analytics views: `open_vaults_by_date`, `daily_vault_metrics`, `vault_summary`

## RSK Public Node Limitations

**Important**: RSK public nodes disable `eth_getLogs` for performance reasons. Use the block scanner approach (`npm run start:scanner`) for development with public nodes. The eth_getLogs approach requires a paid RPC provider.

## Testing and Debugging

### Available Test Scripts
- `src/test.js` - Basic connection tests
- `src/test-scanner.js` - Block scanner functionality
- `test-serverless.js` - Serverless function testing
- Various debug scripts: `debug-*.js`, `check-*.js`

### Debugging Tools
- Many utility scripts for investigating specific vault events and states
- `alchemy-indexer.js` - Alternative indexer using Alchemy API
- Balance tracking and MP staking analysis tools

## Data Flow

1. **Event Detection**: Monitor RSK testnet for VaultUpdated/VaultLiquidated events
2. **Event Processing**: Parse event data and update vault states
3. **Database Storage**: Store raw events and computed states
4. **Analytics Views**: Generate time-series data for dashboards
5. **Visualization**: Streamlit dashboard consumes analytics views

## Development Notes

- The codebase uses ES6 modules (`"type": "module"` in package.json)
- Primary focus is RSK testnet vault monitoring
- Supports both PostgreSQL (local) and Supabase (serverless)
- Extensive logging with Winston for monitoring
- Multiple indexing strategies to handle different RPC provider capabilities