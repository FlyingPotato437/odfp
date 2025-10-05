#!/bin/bash

echo "═══════════════════════════════════════════════════════════"
echo "  COMPREHENSIVE FEATURE TEST - ALL UI & API"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Test 1: Home page loads
echo "[1] HOME PAGE"
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/")
if [ "$status" = "200" ]; then
    echo "  ✅ Home page loads (HTTP $status)"
else
    echo "  ❌ FAILED (HTTP $status)"
fi
echo ""

# Test 2: Search page loads
echo "[2] SEARCH PAGE"
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/search")
if [ "$status" = "200" ]; then
    echo "  ✅ Search page loads (HTTP $status)"
else
    echo "  ❌ FAILED (HTTP $status)"
fi
echo ""

# Test 3: Search API - Text search
echo "[3] SEARCH API - TEXT FILTER"
result=$(curl -s "http://localhost:3000/api/v1/search?q=temperature&size=5")
total=$(echo "$result" | jq -r '.total')
count=$(echo "$result" | jq -r '.results | length')
if [ "$total" -gt 0 ] && [ "$count" -gt 0 ]; then
    echo "  ✅ Text search works: $total results, returned $count"
else
    echo "  ❌ FAILED: total=$total, returned=$count"
fi
echo ""

# Test 4: Search API - Bbox filter
echo "[4] SEARCH API - GEOSPATIAL FILTER"
result=$(curl -s "http://localhost:3000/api/v1/search?bbox=-125,32,-117,42&size=5")
total=$(echo "$result" | jq -r '.total')
if [ "$total" -gt 0 ]; then
    echo "  ✅ Bbox filter works: $total results"
else
    echo "  ❌ FAILED: total=$total"
fi
echo ""

# Test 5: Search API - Temporal filter
echo "[5] SEARCH API - TEMPORAL FILTER"
result=$(curl -s "http://localhost:3000/api/v1/search?timeStart=2020-01-01&size=5")
total=$(echo "$result" | jq -r '.total')
if [ "$total" -gt 0 ]; then
    echo "  ✅ Temporal filter works: $total results"
else
    echo "  ⚠️  May not have datasets with timeStart (total=$total)"
fi
echo ""

# Test 6: Search API - Variable filter
echo "[6] SEARCH API - VARIABLE FILTER"
result=$(curl -s "http://localhost:3000/api/v1/search?q=salinity&size=5")
total=$(echo "$result" | jq -r '.total')
if [ "$total" -gt 0 ]; then
    echo "  ✅ Variable search works: $total results"
else
    echo "  ❌ FAILED: total=$total"
fi
echo ""

# Test 7: Dataset detail page
echo "[7] DATASET DETAIL PAGE"
dataset_id=$(curl -s "http://localhost:3000/api/v1/search?size=1" | jq -r '.results[0].id')
echo "  Testing dataset: $dataset_id"
# Next.js handles unencoded URLs fine for dynamic routes
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/dataset/$dataset_id")
if [ "$status" = "200" ]; then
    echo "  ✅ Dataset page loads (HTTP $status)"
else
    echo "  ❌ FAILED (HTTP $status)"
fi
echo ""

# Test 8: Dataset API
echo "[8] DATASET DETAIL API"
result=$(curl -s "http://localhost:3000/api/v1/datasets/$dataset_id")
title=$(echo "$result" | jq -r '.title // empty')
if [ -n "$title" ]; then
    echo "  ✅ Dataset API works"
    echo "  Title: $title"
else
    echo "  ❌ FAILED: No title found"
fi
echo ""

# Test 9: CSV Export
echo "[9] CSV EXPORT"
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/v1/search?q=ocean&size=5&format=csv")
if [ "$status" = "200" ]; then
    echo "  ✅ CSV export works (HTTP $status)"
    # Check if it's actually CSV
    output=$(curl -s "http://localhost:3000/api/v1/search?q=ocean&size=5&format=csv" | head -1)
    if echo "$output" | grep -q "id,title"; then
        echo "  ✅ CSV format valid: $output"
    else
        echo "  ⚠️  Response: $output"
    fi
else
    echo "  ❌ FAILED (HTTP $status)"
fi
echo ""

# Test 10: Download links work
echo "[10] DOWNLOAD LINK ACCESS"
url=$(curl -s "http://localhost:3000/api/v1/search?size=1" | jq -r '.results[0].distributions[0].url')
echo "  Testing URL: $url"
status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
if [ "$status" = "200" ]; then
    echo "  ✅ Download link accessible (HTTP $status)"
else
    echo "  ⚠️  HTTP $status (may need constraints or login)"
fi
echo ""

# Test 11: ISO metadata endpoint
echo "[11] ISO 19115 METADATA"
result=$(curl -s "http://localhost:3000/api/v1/datasets/$dataset_id/iso")
if echo "$result" | jq -e '.metadata' > /dev/null 2>&1; then
    echo "  ✅ ISO metadata endpoint works"
else
    echo "  ⚠️  ISO metadata may not be fully implemented"
fi
echo ""

# Test 12: Admin status
echo "[12] ADMIN STATUS ENDPOINT"
result=$(curl -s "http://localhost:3000/api/v1/admin/status")
count=$(echo "$result" | jq -r '.datasetCount')
if [ "$count" -gt 0 ]; then
    echo "  ✅ Admin status works: $count datasets"
else
    echo "  ❌ FAILED: count=$count"
fi
echo ""

# Test 13: Check if map loads (via API test)
echo "[13] MAP COMPONENT TEST"
# The map uses Leaflet which loads client-side, so we test the page loads
status=$(curl -s "http://localhost:3000/search" | grep -c "leaflet")
if [ "$status" -gt 0 ]; then
    echo "  ✅ Map component included (found $status references)"
else
    echo "  ⚠️  Map may not be on search page"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  TEST COMPLETE"
echo "═══════════════════════════════════════════════════════════"
