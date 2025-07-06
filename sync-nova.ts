import { storage } from './server/storage';
import { scrapeNovaAutoland } from './nova-scraper';

// This script synchronizes Nova Autoland inventory with the database
// It can be run manually or scheduled

async function main() {
  try {
    console.log('Starting Nova Autoland inventory synchronization');
    
    // Get Nova Autoland dealership from database
    const dealership = await storage.getDealershipByUrl('https://novaautoland.com');
    
    if (!dealership) {
      console.error('Error: Nova Autoland dealership not found in database');
      return;
    }
    
    console.log(`Found dealership: ${dealership.name} (ID: ${dealership.id})`);
    
    // Get existing vehicles for this dealership
    const existingVehicles = await storage.getVehiclesByDealershipId(dealership.id);
    console.log(`Found ${existingVehicles.length} existing vehicles for ${dealership.name}`);
    
    // Create a map of existing vehicles by VIN for quick lookup
    const existingVehiclesByVin = new Map();
    existingVehicles.forEach(vehicle => {
      if (vehicle.vin && typeof vehicle.vin === 'string') {
        existingVehiclesByVin.set(vehicle.vin.toUpperCase(), vehicle);
      }
    });
    
    // Scrape vehicles from Nova Autoland
    console.log(`Starting scrape of ${dealership.name} inventory...`);
    const scrapedVehicles = await scrapeNovaAutoland(dealership.url, dealership.id, dealership.name);
    console.log(`Scraped ${scrapedVehicles.length} vehicles from ${dealership.name}`);
    
    // Track stats
    let newVehicles = 0;
    let updatedVehicles = 0;
    let removedVehicles = 0;
    
    // Process scraped vehicles
    for (const scrapedVehicle of scrapedVehicles) {
      // Skip vehicles without VIN (required field)
      if (!scrapedVehicle.vin) {
        console.log('Skipping vehicle without VIN');
        continue;
      }
      
      const upperVin = scrapedVehicle.vin.toUpperCase();
      const existingVehicle = existingVehiclesByVin.get(upperVin);
      
      if (existingVehicle) {
        // Update existing vehicle
        console.log(`Updating existing vehicle: ${scrapedVehicle.make} ${scrapedVehicle.model} (${scrapedVehicle.year})`);
        
        // Note: We could do a deepEqual comparison to avoid unnecessary updates,
        // but for simplicity, we'll just update all fields
        await storage.updateVehicle(existingVehicle.id, {
          title: scrapedVehicle.title,
          price: scrapedVehicle.price,
          mileage: scrapedVehicle.mileage,
          images: scrapedVehicle.images,
          carfaxUrl: scrapedVehicle.carfaxUrl,
          originalListingUrl: scrapedVehicle.originalListingUrl,
          updatedAt: new Date()
        });
        
        // Remove from the map to track which vehicles were removed from the dealership
        existingVehiclesByVin.delete(upperVin);
        updatedVehicles++;
      } else {
        // Create new vehicle
        console.log(`Creating new vehicle: ${scrapedVehicle.make} ${scrapedVehicle.model} (${scrapedVehicle.year})`);
        await storage.createVehicle(scrapedVehicle);
        newVehicles++;
      }
    }
    
    // Remove vehicles that no longer exist at the dealership
    for (const [vin, vehicle] of existingVehiclesByVin.entries()) {
      console.log(`Removing vehicle no longer at dealership: ${vehicle.make} ${vehicle.model} (${vehicle.year})`);
      await storage.deleteVehicle(vehicle.id);
      removedVehicles++;
    }
    
    console.log(`\nSync complete for ${dealership.name}:`);
    console.log(`- Added ${newVehicles} new vehicles`);
    console.log(`- Updated ${updatedVehicles} existing vehicles`);
    console.log(`- Removed ${removedVehicles} vehicles no longer at dealership`);
    console.log(`- Total inventory: ${newVehicles + updatedVehicles} vehicles`);
    
  } catch (error) {
    console.error('Error during Nova Autoland synchronization:', error);
  }
}

// Run the sync
main().catch(console.error);