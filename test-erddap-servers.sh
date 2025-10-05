#!/bin/bash

# Test which ERDDAP servers are actually accessible
echo "Testing ERDDAP servers for accessibility..."
echo ""

servers=(
  "https://coastwatch.pfeg.noaa.gov"
  "https://upwell.pfeg.noaa.gov"
  "https://data.nodc.noaa.gov"
  "https://osmc.noaa.gov"
  "https://erddap.emodnet-physics.eu"
  "https://erddap.emodnet-chemistry.eu"
  "https://data.axiomdatascience.com"
  "https://erddap.secoora.org"
  "https://data.gcoos.org"
  "https://erddap.marine.ie"
)

working_servers=()

for server in "${servers[@]}"; do
  echo -n "Testing $server/erddap ... "

  # Try to access the ERDDAP tabledap/allDatasets.csv endpoint
  status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 \
    "$server/erddap/tabledap/allDatasets.csv?datasetID&page=1&itemsPerPage=1" 2>/dev/null)

  if [ "$status" -eq 200 ]; then
    echo "✅ WORKS (HTTP $status)"
    working_servers+=("$server")
  else
    echo "❌ FAILED (HTTP $status)"
  fi
done

echo ""
echo "=== WORKING SERVERS (${#working_servers[@]}) ==="
for server in "${working_servers[@]}"; do
  echo "  - $server"
done

# Output as JSON for programmatic use
echo ""
echo "=== JSON OUTPUT ==="
printf '%s\n' "${working_servers[@]}" | jq -R . | jq -s .
