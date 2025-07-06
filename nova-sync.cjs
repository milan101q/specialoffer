// CommonJS module format
const { scheduler } = require('./server/scheduler');

console.log('Manually triggering sync for Nova Autoland (ID: 33)...');

scheduler.syncDealership(33)
  .then(() => {
    console.log('Sync completed successfully.');
  })
  .catch((error) => {
    console.error('Error during sync:', error);
  })
  .finally(() => {
    process.exit(0);
  });
