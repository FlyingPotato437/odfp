#!/bin/bash

echo "=== DATA DIVERSITY & COVERAGE ANALYSIS ==="
echo ""

# 1. Database stats
echo "📊 TOTAL DATASETS:"
curl -s "http://localhost:3000/api/v1/admin/status" | jq -r '.datasetCount'
echo ""

# 2. Source system variety
echo "🏢 SOURCE SYSTEMS:"
curl -s "http://localhost:3000/api/v1/search?size=500" | jq -r '.results[] | .sourceSystem' | sort | uniq -c | sort -rn
echo ""

# 3. Publisher variety  
echo "📚 TOP PUBLISHERS:"
curl -s "http://localhost:3000/api/v1/search?size=500" | jq -r '.results[] | .publisher' | sort | uniq -c | sort -rn | head -15
echo ""

# 4. Geographic coverage
echo "🌍 GEOGRAPHIC COVERAGE:"
curl -s "http://localhost:3000/api/v1/search?size=500" | jq -r '.results[] | select(.spatial.bbox != null) | .spatial.bbox | @csv' | head -20
echo ""

# 5. Variable diversity
echo "🔬 VARIABLES (unique count):"
curl -s "http://localhost:3000/api/v1/search?size=500" | jq -r '.results[].variables[]?' | sort -u | wc -l
echo ""

# 6. Temporal coverage
echo "📅 TEMPORAL COVERAGE:"
curl -s "http://localhost:3000/api/v1/search?size=100" | jq -r '.results[] | select(.time.start != null) | "\(.time.start) to \(.time.end)"' | head -10
echo ""

echo "=== ANALYSIS COMPLETE ==="
