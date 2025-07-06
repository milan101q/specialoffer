import { db } from './server/db.ts';
import { scheduler } from './server/scheduler.ts';
import { dealerships } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function forceSyncInspectedAuto() {
  try {
    console.log('Forcing sync for Inspected Auto...');
    
    // First, update the lastSynced field to null to force a sync
    const dealershipId = 47; // Inspected Auto ID
    
    // Update the lastSynced field in the database
    await db.update(dealerships)
      .set({ lastSynced: null })
      .where(eq(dealerships.id, dealershipId));
    
    console.log('Updated lastSynced to null for Inspected Auto in database');
    
    // Now call the scheduler method directly to sync this dealership
    console.log('Triggering sync for Inspected Auto...');
    await scheduler.syncDealership(dealershipId);
    
    console.log('Sync process completed!');
    
    // Query the database to see the updated vehicle data
    const result = await db.query.vehicles.findMany({
      where: eq(dealerships.id, dealershipId),
      with: {
        dealership: true
      }
    });
    
    console.log(`Found ${result.length} vehicles from Inspected Auto after sync`);
    
    if (result.length > 0) {
      // Show information about the first vehicle
      const vehicle = result[0];
      console.log('First vehicle information:');
      console.log(`- Title: ${vehicle.title}`);
      console.log(`- Year: ${vehicle.year}`);
      console.log(`- Make: ${vehicle.make}`);
      console.log(`- Model: ${vehicle.model}`);
      console.log(`- Price: $${vehicle.price}`);
      console.log(`- Mileage: ${vehicle.mileage} miles`);
      console.log(`- VIN: ${vehicle.vin || 'N/A'}`);
      console.log(`- Images: ${vehicle.images.length} images`);
      console.log(`- Location: ${vehicle.location}`);
    }
  } catch (error) {
    console.error('Error forcing sync:', error);
  }
}

forceSyncInspectedAuto();