#!/usr/bin/env node

// Enhanced ERDDAP metadata extraction test
// Tests the improved ERDDAP connector against real CoastWatch servers

const { fetchErddapAllDatasets, fetchErddapInfo } = require('../src/lib/connectors/erddap.ts');

const COASTWATCH_SERVERS = [
  'https://coastwatch.pfeg.noaa.gov',
  'https://upwell.pfeg.noaa.gov'
];

async function testErddapExtraction() {
  console.log('🔍 Testing Enhanced ERDDAP Metadata Extraction\n');
  
  for (const server of COASTWATCH_SERVERS) {
    console.log(`\n📡 Testing server: ${server}`);
    
    try {
      // Test dataset listing
      console.log('  📋 Fetching dataset list...');
      const datasets = await fetchErddapAllDatasets(server);
      console.log(`  ✅ Found ${datasets.length} datasets`);
      
      // Filter for satellite sea surface datasets (likely to have the metadata issues)
      const satelliteDatasets = datasets.filter(d => 
        d.title && (
          d.title.toLowerCase().includes('smos') ||
          d.title.toLowerCase().includes('smap') ||
          d.title.toLowerCase().includes('satellite') ||
          d.title.toLowerCase().includes('sss') ||
          d.title.toLowerCase().includes('sea surface')
        )
      );
      
      console.log(`  🛰️  Found ${satelliteDatasets.length} potential satellite datasets`);
      
      // Test metadata extraction on a few datasets
      const testDatasets = satelliteDatasets.slice(0, 3);
      
      for (const dataset of testDatasets) {
        console.log(`\n    🔬 Testing dataset: ${dataset.datasetID}`);
        console.log(`      Title: ${dataset.title || 'Unknown'}`);
        console.log(`      Structure: ${dataset.dataStructure || 'Unknown'}`);
        
        try {
          const info = await fetchErddapInfo(server, dataset.datasetID);
          
          console.log(`      Variables: ${info.variables.length}`);
          console.log(`      Spatial bounds: ${info.bbox ? `[${info.bbox.join(', ')}]` : '❌ Unknown'}`);
          console.log(`      Temporal range: ${info.timeStart && info.timeEnd ? 
            `${info.timeStart} to ${info.timeEnd}` : '❌ Unknown'}`);
          
          // Show first few variables for context
          if (info.variables.length > 0) {
            console.log('      Sample variables:');
            info.variables.slice(0, 3).forEach(v => {
              console.log(`        - ${v.name} ${v.units ? `[${v.units}]` : ''} ${v.standard_name ? `(${v.standard_name})` : ''}`);
            });
          }
          
          // Flag potential issues
          if (!info.bbox) {
            console.log('      🚨 ISSUE: Missing spatial bounds');
          }
          if (!info.timeStart || !info.timeEnd) {
            console.log('      🚨 ISSUE: Missing temporal coverage');
          }
          if (info.variables.length === 0) {
            console.log('      🚨 ISSUE: No variables found');
          }
          
        } catch (error) {
          console.log(`      ❌ Failed to extract metadata: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Failed to access server: ${error.message}`);
    }
  }
  
  console.log('\n✅ ERDDAP metadata extraction test completed');
}

// Run the test
if (require.main === module) {
  testErddapExtraction().catch(console.error);
}

module.exports = { testErddapExtraction };