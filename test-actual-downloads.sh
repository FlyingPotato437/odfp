#!/bin/bash

echo "=== TESTING ACTUAL DATA DOWNLOADS ==="
echo ""

# Get 5 diverse datasets
datasets=$(curl -s "http://localhost:3000/api/v1/search?size=10" | jq -r '.results[] | @base64')

count=0
successful=0
failed=0

for dataset in $datasets; do
    count=$((count + 1))
    if [ $count -gt 5 ]; then
        break
    fi
    
    row=$(echo "$dataset" | base64 --decode)
    title=$(echo "$row" | jq -r '.title' | head -c 60)
    url=$(echo "$row" | jq -r '.distributions[0].url // empty')
    format=$(echo "$row" | jq -r '.distributions[0].format')
    
    if [ -z "$url" ] || [ "$url" = "null" ]; then
        echo "[$count] SKIP: No URL for '$title'"
        continue
    fi
    
    echo "[$count] Testing: $title"
    echo "    URL: $url"
    echo "    Format: $format"
    
    # Try to download first 1KB to verify it's real data
    output=$(curl -s -r 0-1024 --connect-timeout 10 --max-time 15 "$url" 2>&1 | head -c 200)
    status=$?
    
    if [ $status -eq 0 ] && [ -n "$output" ]; then
        # Check if output contains data (not error message)
        if echo "$output" | grep -q -i "error\|not found\|404"; then
            echo "    ❌ FAILED: Error response"
            failed=$((failed + 1))
        else
            echo "    ✅ SUCCESS: Downloaded data"
            successful=$((successful + 1))
            # Show first 50 chars of data
            echo "    Data preview: $(echo "$output" | head -c 50 | tr '\n' ' ')..."
        fi
    else
        echo "    ❌ FAILED: Could not download"
        failed=$((failed + 1))
    fi
    echo ""
done

echo "=== RESULTS ==="
echo "Successful downloads: $successful"
echo "Failed downloads: $failed"
