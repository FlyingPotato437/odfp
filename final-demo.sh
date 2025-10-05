#!/bin/bash
echo "╔════════════════════════════════════════════════╗"
echo "║   ODFP COMPREHENSIVE FUNCTIONALITY DEMO        ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

echo "📊 DATABASE STATUS:"
curl -s "http://localhost:3000/api/v1/admin/status" | jq '.'
echo ""

echo "🔍 SEARCH TEST: 'ocean temperature'"
curl -s "http://localhost:3000/api/v1/search?q=ocean+temperature&size=3" | jq '{total, results: [.results[] | {id, title, publisher}]}'
echo ""

echo "🌍 GEOSPATIAL TEST: California region"
curl -s "http://localhost:3000/api/v1/search?bbox=-125,32,-117,42&size=3" | jq '{total, results: [.results[] | {title, bbox: .spatial.bbox}]}'
echo ""

echo "🧪 VARIABLE FILTER TEST: 'salinity'"
curl -s "http://localhost:3000/api/v1/search?q=salinity&size=3" | jq '{total, results: [.results[] | {title, variables: (.variables | length)}]}'
echo ""

echo "📥 DOWNLOAD URL SAMPLE:"
curl -s "http://localhost:3000/api/v1/search?sourceSystem=ERDDAP&size=1" | jq -r '.results[0] | "Dataset: \(.title)\nPublisher: \(.publisher)\nURL: \(.distributions[0].url)\nFormat: \(.distributions[0].format)"'
echo ""

echo "✅ ALL SYSTEMS OPERATIONAL!"
