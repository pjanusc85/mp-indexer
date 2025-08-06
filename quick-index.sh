#!/bin/bash

# Quick Indexer Acceleration Script
# Usage: ./quick-index.sh [number_of_runs]

INDEXER_URL="https://mp-indexer-3bylmrhs2-pjanusc85s-projects.vercel.app/api/cron-indexer"
RUNS=${1:-20}  # Default to 20 runs if no argument provided

echo "🚀 Quick Indexing Acceleration"
echo "📍 URL: $INDEXER_URL"
echo "🔄 Runs: $RUNS"
echo "🎯 Goal: Find vault events in blocks 2,965,933 to 3,300,000"
echo ""

total_blocks=0
total_events=0
errors=0

for i in $(seq 1 $RUNS); do
    echo -n "[$i/$RUNS] "
    
    response=$(curl -s -X POST "$INDEXER_URL" -H "Content-Type: application/json")
    
    if [ $? -eq 0 ]; then
        # Parse JSON response (basic extraction)
        from_block=$(echo "$response" | grep -o '"fromBlock":[0-9]*' | cut -d':' -f2)
        to_block=$(echo "$response" | grep -o '"toBlock":[0-9]*' | cut -d':' -f2)
        blocks_processed=$(echo "$response" | grep -o '"blocksProcessed":[0-9]*' | cut -d':' -f2)
        events_processed=$(echo "$response" | grep -o '"eventsProcessed":[0-9]*' | cut -d':' -f2)
        time_elapsed=$(echo "$response" | grep -o '"timeElapsed":[0-9]*' | cut -d':' -f2)
        
        if [ ! -z "$blocks_processed" ] && [ ! -z "$events_processed" ]; then
            total_blocks=$((total_blocks + blocks_processed))
            total_events=$((total_events + events_processed))
            
            echo "Blocks $from_block → $to_block | Processed: $blocks_processed | Events: $events_processed | Time: ${time_elapsed}ms"
            
            if [ "$events_processed" -gt 0 ]; then
                echo "🎉 FOUND $events_processed VAULT EVENTS! 🎉"
            fi
        else
            echo "Response received but couldn't parse block data"
        fi
    else
        echo "❌ Request failed"
        errors=$((errors + 1))
    fi
    
    # Small delay between requests
    sleep 0.5
done

echo ""
echo "📊 Summary:"
echo "   Total blocks processed: $total_blocks"
echo "   Total events found: $total_events"
echo "   Errors: $errors"

if [ "$total_events" -gt 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Found $total_events vault events!"
    echo "💡 Check your Supabase vault_events table to see the data."
else
    echo ""
    echo "💡 No events found in this batch. Continue running to process more blocks."
fi