import fetch from 'node-fetch';

async function testSync() {
  try {
    console.log('Testing Inspected Auto sync functionality...');
    
    // First, try getting the list of vehicles for the inspected auto dealership
    console.log('Checking current Inspected Auto vehicle in database...');
    const vehicleResponse = await fetch('http://localhost:5000/api/vehicles?dealership=47');
    const vehicleData = await vehicleResponse.json();
    
    if (vehicleResponse.ok) {
      console.log(`Found ${vehicleData.vehicles?.length || 0} vehicles for Inspected Auto`);
      if (vehicleData.vehicles && vehicleData.vehicles.length > 0) {
        const vehicle = vehicleData.vehicles[0];
        console.log('Sample vehicle data:');
        console.log(`  - Title: ${vehicle.title}`);
        console.log(`  - Year: ${vehicle.year}`);
        console.log(`  - Make: ${vehicle.make}`);
        console.log(`  - Model: ${vehicle.model}`);
        console.log(`  - Price: $${vehicle.price}`);
        console.log(`  - Mileage: ${vehicle.mileage} miles`);
        console.log(`  - VIN: ${vehicle.vin || 'Not available'}`);
        console.log(`  - Images: ${vehicle.images?.length || 0} images`);
      }
    } else {
      console.error('Error fetching Inspected Auto vehicles:', vehicleData);
    }
    
    // Now test the inspection-auto-scraper directly
    console.log('\nManually calling inspected-auto-scraper...');
    const scriptContent = `
      import { scrapeInspectedAuto } from './server/inspected-auto-scraper.js';
      
      async function testScraper() {
        try {
          const dealershipUrl = 'https://www.inspectedauto.com/Inventory/Details/663eadbc-78cf-4254-b688-71031593a49d';
          const dealershipId = 47;
          const dealershipName = 'Inspected Auto';
          
          console.log('Starting test of scrapeInspectedAuto function...');
          const vehicles = await scrapeInspectedAuto(dealershipUrl, dealershipId, dealershipName);
          
          console.log(\`Scraped \${vehicles.length} vehicles\`);
          if (vehicles.length > 0) {
            console.log('First vehicle details:');
            console.log(JSON.stringify(vehicles[0], null, 2));
          }
        } catch (error) {
          console.error('Error testing scraper:', error);
        }
      }
      
      testScraper();
    `;
    
    console.log('Test script output will show in the workflow logs');
    await fetch('http://localhost:5000/api/vehicles/SADHD2S17L1F85500');
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

testSync();