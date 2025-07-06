const storage = require('./server/storage').storage;
const scheduler = require('./server/scheduler').scheduler;

async function main() {
  try {
    // Get Inspected Auto dealership ID
    const dealerships = await storage.getAllDealerships();
    const inspectedAuto = dealerships.find(d => d.name === 'Inspected Auto');
    
    if (inspectedAuto) {
      console.log('Found Inspected Auto dealership with ID:', inspectedAuto.id);
      
      // Set lastSynced to null to force a sync
      await storage.updateDealership(inspectedAuto.id, { lastSynced: null });
      console.log('Reset lastSynced time for Inspected Auto');
      
      // Trigger sync
      await scheduler.syncDealership(inspectedAuto.id);
      console.log('Sync completed');
    } else {
      console.log('Inspected Auto dealership not found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
