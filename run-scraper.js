// run-scraper.js
// This script manually runs the Nova Autoland scraper for testing purposes
// It now imports the main scraping function from the updated nova-scraper.js

import { scrapeNovaAutoland } from './nova-scraper.js';

async function main() {
  try {
    console.log('Starting Nova Autoland scraper test...');

    // Nova Autoland dealership info
    const dealershipUrl = 'https://novaautoland.com';
    const dealershipId = 1; // Test ID - adjust as needed for your system
    const dealershipName = 'Nova Autoland';

    // Run the scraper
    const vehicles = await scrapeNovaAutoland(dealershipUrl, dealershipId, dealershipName);

    console.log(`Scraping complete! Found ${vehicles.length} vehicles.`);

    // Print a sample of the vehicles (first 3)
    console.log('\nSample of scraped vehicles:');
    if (vehicles.length > 0) {
      vehicles.slice(0, 3).forEach((vehicle, index) => {
        console.log(`\nVehicle ${index + 1}:`);
        console.log(`Title: ${vehicle.title}`);
        console.log(`VIN: ${vehicle.vin}`);
        console.log(`Make/Model: ${vehicle.make} ${vehicle.model}`);
        console.log(`Year: ${vehicle.year}`);
        console.log(`Price: $${vehicle.price}`);
        console.log(`Mileage: ${vehicle.mileage} miles`);
        console.log(`Location: ${vehicle.location} (${vehicle.zipCode})`);
        console.log(`Carfax URL: ${vehicle.carfaxUrl || 'Not available'}`);
        console.log(`Images: ${vehicle.images.length} found`);
        console.log(`First image: ${vehicle.images[0] || 'No images'}`);
      });
    } else {
      console.log('No vehicles were scraped successfully.');
    }

  } catch (error) {
    console.error('Error running Nova Autoland scraper test:', error);
  }
}

// Run the script
main().catch(console.error);
