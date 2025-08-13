import { ethers } from 'ethers';

/**
 * Balance Tracking Module - Equivalent to Dune Analytics Balance Tracking
 * Tracks BTC balance changes for Money Protocol pools using transfer analysis
 */

export const POOL_CONFIG = {
    activePool: {
        address: '0x061c6A8EBb521fe74d3E07c9b835A236ac051e8F',
        type: 'active'
    },
    defaultPool: {
        address: '0x9BcA57F7D3712f46cd2D650a78f68e7928e866E2', 
        type: 'default'
    },
    stabilityPool: {
        address: '0x11ad81e3E29DBA233aF88dCb4b169670FA2b8C65',
        type: 'stability'
    },
    collSurplusPool: {
        address: '0x753D525ac3cd099d4a4eFc2685b0Cc665513b5D5',
        type: 'coll_surplus'
    }
};

/**
 * Get BTC balance changes for pools (equivalent to Dune's traces query)
 */
export async function getPoolBalanceChanges(provider, fromBlock, toBlock) {
    const balanceEvents = [];
    
    try {
        for (const [poolName, config] of Object.entries(POOL_CONFIG)) {
            // Get current balance at end block
            const currentBalance = await provider.getBalance(config.address, toBlock);
            const currentBalanceBTC = ethers.formatEther(currentBalance);
            
            // Get balance at start block for comparison
            const startBalance = await provider.getBalance(config.address, fromBlock);
            const startBalanceBTC = ethers.formatEther(startBalance);
            
            // Calculate change
            const balanceChange = parseFloat(currentBalanceBTC) - parseFloat(startBalanceBTC);
            
            if (Math.abs(balanceChange) > 0.000001) { // Only record significant changes
                balanceEvents.push({
                    pool_address: config.address,
                    pool_type: config.type,
                    pool_name: poolName,
                    start_balance_btc: parseFloat(startBalanceBTC),
                    end_balance_btc: parseFloat(currentBalanceBTC),
                    balance_change_btc: balanceChange,
                    from_block: fromBlock,
                    to_block: toBlock,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        return balanceEvents;
        
    } catch (error) {
        console.error('Error getting pool balance changes:', error);
        throw error;
    }
}

/**
 * Calculate hourly balance aggregations (equivalent to Dune's CTE logic)
 */
export function calculateHourlyBalances(balanceEvents, currentHour) {
    const hourlyData = [];
    
    for (const event of balanceEvents) {
        hourlyData.push({
            hour: currentHour,
            pool_address: event.pool_address,
            pool_type: event.pool_type,
            hourly_change_btc: event.balance_change_btc,
            ending_balance_btc: event.end_balance_btc,
            transaction_count: 1, // Simplified for now
            btc_price_usd: null, // Can be enhanced with price feeds
            ending_balance_usd: null
        });
    }
    
    return hourlyData;
}

/**
 * Enhanced balance tracking with transaction analysis
 * This would analyze actual transactions to track individual transfers
 */
export async function getDetailedBalanceEvents(provider, fromBlock, toBlock) {
    const detailedEvents = [];
    
    try {
        // Get all blocks in range
        for (let blockNum = fromBlock; blockNum <= Math.min(fromBlock + 10, toBlock); blockNum++) {
            const block = await provider.getBlock(blockNum, true);
            
            if (!block || !block.transactions) continue;
            
            for (const tx of block.transactions) {
                if (!tx.to) continue;
                
                // Check if transaction involves any of our pools
                const poolConfig = Object.values(POOL_CONFIG).find(
                    config => config.address.toLowerCase() === tx.to.toLowerCase()
                );
                
                if (poolConfig && tx.value && tx.value !== '0') {
                    const receipt = await provider.getTransactionReceipt(tx.hash);
                    
                    if (receipt.status === 1) { // Successful transaction
                        detailedEvents.push({
                            block_number: blockNum,
                            transaction_hash: tx.hash,
                            log_index: 0, // Simplified
                            timestamp: new Date(block.timestamp * 1000).toISOString(),
                            pool_address: tx.to,
                            pool_type: poolConfig.type,
                            from_address: tx.from,
                            to_address: tx.to,
                            value_btc: parseFloat(ethers.formatEther(tx.value)),
                            event_context: 'direct_transfer', // Can be enhanced with event parsing
                            vault_id: null // Can be extracted from logs
                        });
                    }
                }
            }
        }
        
        return detailedEvents;
        
    } catch (error) {
        console.error('Error getting detailed balance events:', error);
        return []; // Return empty array on error to avoid breaking the flow
    }
}

/**
 * Get protocol TVL summary (equivalent to Dune's final aggregation)
 */
export async function getProtocolTVLSummary(provider, blockNumber = 'latest') {
    try {
        const tvlSummary = {
            timestamp: new Date().toISOString(),
            block_number: blockNumber === 'latest' ? await provider.getBlockNumber() : blockNumber,
            pools: {},
            total_tvl_btc: 0
        };
        
        for (const [poolName, config] of Object.entries(POOL_CONFIG)) {
            const balance = await provider.getBalance(config.address, blockNumber);
            const balanceBTC = parseFloat(ethers.formatEther(balance));
            
            tvlSummary.pools[poolName] = {
                address: config.address,
                type: config.type,
                balance_btc: balanceBTC
            };
            
            tvlSummary.total_tvl_btc += balanceBTC;
        }
        
        return tvlSummary;
        
    } catch (error) {
        console.error('Error getting protocol TVL summary:', error);
        throw error;
    }
}

/**
 * Format balance data for Supabase insertion
 */
export function formatBalanceDataForDB(hourlyBalances) {
    return hourlyBalances.map(balance => ({
        hour: balance.hour,
        pool_address: balance.pool_address.toLowerCase(),
        pool_type: balance.pool_type,
        hourly_change_btc: balance.hourly_change_btc,
        ending_balance_btc: balance.ending_balance_btc,
        transaction_count: balance.transaction_count || 0,
        btc_price_usd: balance.btc_price_usd,
        ending_balance_usd: balance.ending_balance_usd
    }));
}

/**
 * Save balance events to database (equivalent to Dune's data persistence)
 */
export async function saveBalanceEvents(balanceEvents, supabaseUrl, supabaseKey) {
    try {
        if (balanceEvents.length === 0) return true;
        
        const response = await fetch(`${supabaseUrl}/rest/v1/pool_balance_events`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(balanceEvents)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save balance events: ${response.status}`);
        }
        
        console.log(`✅ Saved ${balanceEvents.length} balance events`);
        return true;
        
    } catch (error) {
        console.error('❌ Error saving balance events:', error);
        return false;
    }
}

/**
 * Save hourly balance data to database
 */
export async function saveHourlyBalances(hourlyBalances, supabaseUrl, supabaseKey) {
    try {
        if (hourlyBalances.length === 0) return true;
        
        const formattedData = formatBalanceDataForDB(hourlyBalances);
        
        const response = await fetch(`${supabaseUrl}/rest/v1/pool_balance_hourly`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(formattedData)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save hourly balances: ${response.status}`);
        }
        
        console.log(`✅ Saved ${hourlyBalances.length} hourly balance records`);
        return true;
        
    } catch (error) {
        console.error('❌ Error saving hourly balances:', error);
        return false;
    }
}