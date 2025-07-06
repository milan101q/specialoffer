import { scheduler } from './server/scheduler.js';

async function main() {
  console.log('Manually triggering sync for Nova Autoland (ID: 33)...');
  
  try {
    await scheduler.syncDealership(33);
    console.log('Sync completed.');
  } catch (error) {
    console.error('Error during sync:', error);
  } finally {
    process.exit(0);
  }
}

main();
