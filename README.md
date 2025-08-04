# Money Protocol Indexer

Real-time blockchain indexer for Money Protocol vault events on RSK testnet.

## Features

- 🔄 Real-time event indexing from RSK testnet
- 📊 Vault state tracking and history
- 🗄️ PostgreSQL database with optimized schema
- 📈 Compatible with existing Superset analytics
- 🔧 Configurable and resumable
- 📝 Comprehensive logging

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL database (running via Docker from Superset POC)
- RSK testnet access

### 2. Installation
```bash
npm install
```

### 3. Configuration
The default `.env` configuration works with RSK public testnet:
```env
RSK_RPC_URL=https://public-node.testnet.rsk.co
DB_HOST=localhost
DB_PORT=5432
DB_NAME=analytics
DB_USER=superset
DB_PASSWORD=superset
```

### 4. Test Connections
```bash
npm run test              # Test basic connections
node src/test-scanner.js  # Test block scanning approach
```

### 5. Run Indexer

**⚠️ Important: Use Block Scanner (Recommended)**
```bash
npm run start:scanner    # Uses block-by-block scanning (works with public nodes)
npm run dev:scanner      # Development mode with auto-restart
```

**Alternative: eth_getLogs Approach (Requires API Key)**
```bash
npm start                # Requires RPC provider that supports eth_getLogs
npm run dev              # Development mode
```

## Architecture

```
RSK Testnet → VaultManager Contract → Event Parser → PostgreSQL → Superset
```

### Key Components

- **Event Listeners**: Monitor VaultUpdated and VaultLiquidated events
- **Contract Interface**: Parse and decode Money Protocol events
- **Database Layer**: Store raw events and computed vault states
- **State Management**: Track vault lifecycle and collateral ratios

### Database Schema

- `vault_events`: Raw blockchain events
- `vault_states`: Current vault states
- `vault_history`: Historical vault data
- Views: `open_vaults_by_date`, `daily_vault_metrics`

## Monitored Events

### VaultUpdated
- Vault creation, updates, and status changes
- Collateral and debt amounts
- Vault operations (liquidation, redemption)

### VaultLiquidated  
- Liquidation events with details
- Debt and collateral recovery amounts

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `RSK_RPC_URL` | RSK testnet RPC endpoint | public-node.testnet.rsk.co |
| `START_BLOCK` | Block to start indexing from | latest-1000 |
| `POLL_INTERVAL` | Polling interval in ms | 12000 |
| `BATCH_SIZE` | Blocks to process per batch | 100 |
| `LOG_LEVEL` | Logging level | info |

## Monitoring

The indexer logs:
- Connection status
- Blocks processed
- Events found and processed
- Active vault count
- Errors and retries

## RSK Public Node Limitations

**eth_getLogs Not Supported**: RSK public nodes disable `eth_getLogs` for performance reasons, returning:
> "the method eth_getLogs does not exist/is not available"

**Solutions**:
1. **Block Scanner** (✅ Recommended): Scans blocks individually - works with any public node
2. **Paid RPC Provider**: GetBlock.io, Alchemy, etc. with `eth_getLogs` support
3. **Self-hosted RSK Node**: Full control over RPC methods

## Integration with Superset

The indexer creates the same database views as the mock data:
- `open_vaults_by_date` - For cumulative vault charts
- `daily_vault_metrics` - For collateral/debt analytics
- `current_vault_status` - For risk analysis

Your existing Superset charts will automatically show real data once the indexer runs.

## Development

```bash
# Run tests
npm test

# Development mode with auto-restart
npm run dev

# Check logs
tail -f indexer.log
```

## Production Deployment

1. Use process manager (PM2, systemd)
2. Set up monitoring and alerting  
3. Configure log rotation
4. Use dedicated database credentials
5. Consider WebSocket RPC for real-time updates