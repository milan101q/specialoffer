// nova-sync.js
// This script manually triggers the Nova Autoland synchronization process
// by calling the scheduler's syncDealership method.

// Assuming 'scheduler' is correctly imported and available in your server environment.
// The path './server/scheduler.js' should point to your scheduler module.
import { scheduler } from './server/scheduler.js';

async function main() {
  // IMPORTANT: Ensure this ID (e.g., 33) matches the actual dealership ID for Nova Autoland
  // in your database that the scheduler uses.
  const novaAutolandDealershipId = 33;
  console.log(`Manually triggering sync for Nova Autoland (ID: ${novaAutolandDealershipId})...`);

  try {
    // Call the syncDealership method from your scheduler.
    // This will internally use the scrapeNovaAutoland function.
    await scheduler.syncDealership(novaAutolandDealershipId);
    console.log('Nova Autoland sync completed successfully.');
  } catch (error) {
    console.error('Error during Nova Autoland sync:', error);
  } finally {
    // Exit the process after sync attempt, regardless of success or failure.
    // This is typical for a one-off manual trigger script.
    process.exit(0);
  }
}

main();
