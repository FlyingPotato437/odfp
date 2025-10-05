#!/bin/bash

echo "=== COMPREHENSIVE ODFP FUNCTIONALITY TEST ==="
echo ""

# Test 1: Database Stats
echo "1. DATABASE STATS"
curl -s "http://localhost:3000/api/v1/admin/status" | jq '.'
echo ""

# Test 2: Text Search
echo "2. TEXT SEARCH (ocean temperature)"
curl -s "http://localhost:3000/api/v1/search?q=ocean+temperature&size=3" | jq -r '.total, .results[] | .title' | head -5
echo ""

# Test 3: Geospatial Search
echo "3. GEOSPATIAL SEARCH (California bbox)"
curl -s "http://localhost:3000/api/v1/search?bbox=-125,32,-117,42&size=3" | jq -r '.total, .results[] | .title' | head -5
echo ""

# Test 4: Variable Filter
echo "4. VARIABLE FILTER (salinity)"
curl -s "http://localhost:3000/api/v1/search?variables=salinity&size=3" | jq -r '.total, .results[] | .title' | head -5
echo ""

# Test 5: Source System Filter
echo "5. SOURCE SYSTEM FILTER (ERDDAP)"
curl -s "http://localhost:3000/api/v1/search?sourceSystem=ERDDAP&size=3" | jq -r '.total, .results[0] | .title, .distributions[0].url'
echo ""

# Test 6: Dataset Detail API
echo "6. DATASET DETAIL API"
dataset_id=$(curl -s "http://localhost:3000/api/v1/search?sourceSystem=ERDDAP&size=1" | jq -r '.results[0].id')
echo "Testing dataset: $dataset_id"
curl -s "http://localhost:3000/api/v1/datasets/$dataset_id" | jq -r '.title, .distributions[0].url' | head -3
echo ""

# Test 7: Download URL Validity
echo "7. DOWNLOAD URL VALIDITY TEST"
echo "Testing 3 random download URLs..."
urls=$(curl -s "http://localhost:3000/api/v1/search?sourceSystem=ERDDAP&size=3" | jq -r '.results[].distributions[0].url')
count=0
for url in $urls; do
  count=$((count + 1))
  status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url" 2>/dev/null)
  if [ "$status" -eq 200 ] || [ "$status" -eq 206 ]; then
    echo "  ✅ URL $count: HTTP $status (VALID)"
  else
    echo "  ⚠️  URL $count: HTTP $status"
  fi
  if [ $count -ge 3 ]; then
    break
  fi
done
echo ""

echo "=== TEST COMPLETE ==="
