#!/bin/bash

echo "=== TESTING REAL WORKING DOWNLOADS ==="
echo ""

# Test 1: CoastWatch griddap (should work with full dataset download)
echo "[1] Testing CoastWatch AVHRR SST (griddap)"
url="https://coastwatch.pfeg.noaa.gov/erddap/griddap/nceiPH53sstd1day.nc?sea_surface_temperature[(2023-12-31T12:00:00Z)][(89.979)][(179.979)]"
echo "URL: $url"
data=$(curl -s -r 0-500 "$url" 2>&1)
if echo "$data" | grep -q "CDF" || echo "$data" | grep -q "NetCDF"; then
    echo "✅ SUCCESS: NetCDF file downloaded"
    echo "Data starts with: $(echo "$data" | head -c 30 | xxd -p | head -c 60)"
else
    echo "❌ FAILED"
fi
echo ""

# Test 2: Marine IE griddap (AORA bathymetry)
echo "[2] Testing Marine IE AORA Bathymetry (griddap)"  
url="https://erddap.marine.ie/erddap/griddap/AORA_asc.nc?elevation[(54.48108270014554)][(45.932321493156394)][(-10.430871044850768)]"
echo "URL: $url"
data=$(curl -s -r 0-500 "$url" 2>&1)
if echo "$data" | grep -q "CDF" || echo "$data" | grep -q "NetCDF"; then
    echo "✅ SUCCESS: NetCDF file downloaded"
else
    echo "❌ Status: $(curl -s -o /dev/null -w "%{http_code}" "$url")"
fi
echo ""

# Test 3: Info endpoint (always works)
echo "[3] Testing Info/Metadata endpoint"
url="https://coastwatch.pfeg.noaa.gov/erddap/info/nceiPH53sstd1day/index.json"
echo "URL: $url"
data=$(curl -s "$url")
if echo "$data" | jq -e '.table.columnNames' > /dev/null 2>&1; then
    echo "✅ SUCCESS: Metadata JSON retrieved"
    vars=$(echo "$data" | jq -r '.table.rows[] | select(.[0] == "variable") | .[1]' | head -3 | tr '\n' ',' | sed 's/,$//')
    echo "Variables: $vars"
else
    echo "❌ FAILED"
fi
echo ""

# Test 4: CSV download with constraints
echo "[4] Testing CSV download with time constraint"
url="https://coastwatch.pfeg.noaa.gov/erddap/tabledap/nceiPH53sstd1day.csv?time,latitude,longitude&time>=2023-12-31T12:00:00Z&time<=2023-12-31T12:00:00Z"
echo "URL: $url"
data=$(curl -s "$url" 2>&1)
if echo "$data" | head -1 | grep -q "time"; then
    echo "✅ SUCCESS: CSV data downloaded"
    echo "Headers: $(echo "$data" | head -1)"
    echo "First row: $(echo "$data" | head -2 | tail -1)"
else
    echo "⚠️  Response: $(echo "$data" | head -1)"
fi

echo ""
echo "=== DOWNLOAD TEST COMPLETE ==="
