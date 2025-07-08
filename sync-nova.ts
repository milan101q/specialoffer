// sync-nova.ts
// This script synchronizes Nova Autoland inventory with the database.
// It can be run manually or scheduled.

// Assuming 'storage' is correctly imported and provides database interaction methods.
import { storage } from './server/storage';
// Import the main scraping function from your updated nova-scraper.ts
import { scrapeNovaAutoland } from './nova-scraper'; // Ensure this path is correct

// Placeholder for Vehicle and InsertVehicle types if not using a shared schema
interface Vehicle {
  id: number;
  title: string;
  price: number;
  year: number;
  make: string;
  model: string;
  mileage: number;
  vin: string;
  location: string;
  zipCode: string;
  dealershipId: number;
  images: string[];
  carfaxUrl: string | null;
  contactUrl: string | null;
  originalListingUrl: string;
  sortOrder: number;
  updatedAt: Date;
}

interface InsertVehicle {
  title: string;
  price: number;
  year: number;
  make: string;
  model: string;
  mileage: number;
  vin: string;
  location: string;
  zipCode: string;
  dealershipId: number;
  images: string[];
  carfaxUrl: string | null;
  contactUrl: string | null;
  originalListingUrl: string;
  sortOrder: number;
}


async function main() {
  try {
    console.log('Starting Nova Autoland inventory synchronization');

    // Get Nova Autoland dealership from database
    // IMPORTANT: Ensure the URL 'https://novaautoland.com' is correct and matches your database entry.
    const dealership = await storage.getDealershipByUrl('https://novaautoland.com');

    if (!dealership) {
      console.error('Error: Nova Autoland dealership not found in database. Please ensure it is added.');
      return;
    }

    console.log(`Found dealership: ${dealership.name} (ID: ${dealership.id})`);

    // Get existing vehicles for this dealership from the database
    const existingVehicles: Vehicle[] = await storage.getVehiclesByDealershipId(dealership.id);
    console.log(`Found ${existingVehicles.length} existing vehicles for ${dealership.name}.`);

    // Create a map of existing vehicles by VIN for quick lookup
    const existingVehiclesByVin = new Map<string, Vehicle>();
    existingVehicles.forEach(vehicle => {
      if (vehicle.vin && typeof vehicle.vin === 'string') {
        existingVehiclesByVin.set(vehicle.vin.toUpperCase(), vehicle);
      }
    });

    // Scrape vehicles from Nova Autoland using the updated scraper function
    console.log(`Starting scrape of ${dealership.name} inventory...`);
    const scrapedVehicles: InsertVehicle[] = await scrapeNovaAutoland(dealership.url, dealership.id, dealership.name);
    console.log(`Scraped ${scrapedVehicles.length} vehicles from ${dealership.name}.`);

    // Track stats for the sync process
    let newVehicles = 0;
    let updatedVehicles = 0;
    let removedVehicles = 0;

    // Process each scraped vehicle
    for (const scrapedVehicle of scrapedVehicles) {
      // Skip vehicles without VIN (VIN is a critical unique identifier)
      if (!scrapedVehicle.vin) {
        console.warn(`Skipping a scraped vehicle due to missing VIN: ${scrapedVehicle.title || 'Untitled'}`);
        continue;
      }

      const upperVin = scrapedVehicle.vin.toUpperCase();
      const existingVehicle = existingVehiclesByVin.get(upperVin);

      if (existingVehicle) {
        // Vehicle exists, update it
        console.log(`Updating existing vehicle: ${scrapedVehicle.make} ${scrapedVehicle.model} (${scrapedVehicle.year}) - VIN: ${upperVin}`);

        // Update only the fields that are expected to change from scraping.
        // You might want to add more sophisticated comparison here to only update if values differ.
        await storage.updateVehicle(existingVehicle.id, {
          title: scrapedVehicle.title,
          price: scrapedVehicle.price,
          mileage: scrapedVehicle.mileage,
          images: scrapedVehicle.images,
          carfaxUrl: scrapedVehicle.carfaxUrl,
          originalListingUrl: scrapedVehicle.originalListingUrl,
          updatedAt: new Date() // Update timestamp on every sync
        });

        // Remove from the map to track which vehicles were still present after scraping
        existingVehiclesByVin.delete(upperVin);
        updatedVehicles++;
      } else {
        // New vehicle, create it
        console.log(`Creating new vehicle: ${scrapedVehicle.make} ${scrapedVehicle.model} (${scrapedVehicle.year}) - VIN: ${upperVin}`);
        await storage.createVehicle(scrapedVehicle);
        newVehicles++;
      }
    }

    // Any vehicles remaining in `existingVehiclesByVin` were not found in the latest scrape,
    // meaning they are no longer at the dealership and should be removed from the database.
    for (const [vin, vehicle] of existingVehiclesByVin.entries()) {
      console.log(`Removing vehicle no longer at dealership: ${vehicle.make} ${vehicle.model} (${vehicle.year}) - VIN: ${vin}`);
      await storage.deleteVehicle(vehicle.id);
      removedVehicles++;
    }

    console.log(`\nSync complete for ${dealership.name}:`);
    console.log(`- Added ${newVehicles} new vehicles`);
    console.log(`- Updated ${updatedVehicles} existing vehicles`);
    console.log(`- Removed ${removedVehicles} vehicles no longer at dealership`);
    console.log(`- Total inventory after sync: ${newVehicles + updatedVehicles} vehicles`);

  } catch (error) {
    console.error('Error during Nova Autoland synchronization:', error);
  }
}

// Run the sync function when the script is executed.
main().catch(console.error);
