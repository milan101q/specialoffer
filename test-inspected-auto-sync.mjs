import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    // Import the necessary modules
    const { db } = await import('./server/db.js');
    const { storage } = await import('./server/storage.js');
    const { scheduler } = await import('./server/scheduler.js');
    const { logger } = await import('./shared/logger.js');
    
    // Find Inspected Auto dealership
    logger.info('Looking for Inspected Auto dealership...');
    const dealerships = await storage.getAllDealerships();
    const inspectedAuto = dealerships.find(d => d.name.toLowerCase().includes('inspected auto'));
    
    if (!inspectedAuto) {
      logger.error('Inspected Auto dealership not found!');
      return;
    }
    
    logger.info(`Found Inspected Auto dealership with ID: ${inspectedAuto.id}`);
    logger.info(`URL: ${inspectedAuto.url}`);
    logger.info(`Last Synced: ${inspectedAuto.lastSynced}`);
    
    // Reset lastSynced to force a sync
    await storage.updateDealership(inspectedAuto.id, { lastSynced: null });
    logger.info('Reset lastSynced time for Inspected Auto');
    
    // Trigger sync
    logger.info('Starting sync for Inspected Auto...');
    await scheduler.syncDealership(inspectedAuto.id);
    logger.info('Sync completed');
    
    // Get updated vehicle count
    const vehicles = await storage.getVehiclesByDealershipId(inspectedAuto.id);
    logger.info(`Synced ${vehicles.length} vehicles from Inspected Auto`);
    
    // Print out some vehicles to see what was obtained
    if (vehicles.length > 0) {
      logger.info('Sample vehicles:');
      vehicles.slice(0, 3).forEach(vehicle => {
        logger.info(`- ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price} - ${vehicle.mileage} miles`);
        logger.info(`  VIN: ${vehicle.vin}`);
        logger.info(`  Images: ${vehicle.images.length} images`);
        logger.info(`  Carfax: ${vehicle.carfaxUrl || 'None'}`);
      });
    }
    
    // All done
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();