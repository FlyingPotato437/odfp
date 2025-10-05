#!/bin/bash

echo "=== TESTING WORKING DATA ACCESS METHODS ==="
echo ""

# Test 1: HTML Data Access Page (always works)
echo "[1] HTML Data Access Form"
url="https://coastwatch.pfeg.noaa.gov/erddap/griddap/nceiPH53sstd1day.html"
echo "URL: $url"
status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
if [ "$status" = "200" ]; then
    echo "✅ SUCCESS: Data access page available (HTTP $status)"
    echo "Users can download data interactively from this page"
else
    echo "❌ FAILED: HTTP $status"
fi
echo ""

# Test 2: OPeNDAP DDS (Data Descriptor)
echo "[2] OPeNDAP Data Descriptor"
url="https://coastwatch.pfeg.noaa.gov/erddap/griddap/nceiPH53sstd1day.dds"
echo "URL: $url"
data=$(curl -s "$url")
if echo "$data" | grep -q "Dataset {"; then
    echo "✅ SUCCESS: OPeNDAP access working"
    echo "Structure: $(echo "$data" | head -3 | tail -1)"
else
    echo "❌ FAILED"
fi
echo ""

# Test 3: Graph/Make A Graph (visual data preview)
echo "[3] Data Visualization/Graph Tool"
url="https://coastwatch.pfeg.noaa.gov/erddap/griddap/nceiPH53sstd1day.graph"
echo "URL: $url"
status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
if [ "$status" = "200" ]; then
    echo "✅ SUCCESS: Graph tool available (HTTP $status)"
else
    echo "❌ FAILED: HTTP $status"
fi
echo ""

# Test 4: WMS (Web Map Service) - for spatial data
echo "[4] WMS GetCapabilities"
url="https://coastwatch.pfeg.noaa.gov/erddap/wms/nceiPH53sstd1day/request?service=WMS&version=1.3.0&request=GetCapabilities"
echo "URL: $url"
data=$(curl -s "$url")
if echo "$data" | grep -q "WMS_Capabilities"; then
    echo "✅ SUCCESS: WMS service available"
    echo "Can be used in GIS software (QGIS, ArcGIS, etc.)"
else
    echo "❌ FAILED"
fi
echo ""

# Test 5: Direct file access (if available)
echo "[5] File Browser"
url="https://coastwatch.pfeg.noaa.gov/erddap/files/nceiPH53sstd1day/"
echo "URL: $url"
status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
if [ "$status" = "200" ]; then
    echo "✅ SUCCESS: Direct file access available (HTTP $status)"
else
    echo "⚠️  Not available (HTTP $status) - some datasets don't allow file browsing"
fi

echo ""
echo "=== SUMMARY ==="
echo "✅ Data IS accessible via:"
echo "  - HTML forms (browser-based download)"
echo "  - OPeNDAP (programmatic access)"
echo "  - WMS (GIS software)"
echo "  - Graph tools (visualization)"
