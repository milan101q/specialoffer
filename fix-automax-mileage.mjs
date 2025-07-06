// Fix script for Automax of Chantilly mileage issues
import fetch from 'node-fetch';

// The dealership ID for Automax of Chantilly
const DEALERSHIP_ID = 19;

/**
 * First fix the database records - set mileage to 0 for Automax vehicles where mileage = year
 */
async function fixDatabaseRecords() {
  try {
    console.log('Fixing database records for Automax of Chantilly vehicles...');
    
    // Call our API endpoint to update the database
    const response = await fetch(`http://localhost:3000/api/admin/fix-automax-mileage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dealershipId: DEALERSHIP_ID,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fix database records: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`Database fix completed. Updated ${result.updatedCount} records.`);
    return result.updatedCount;
  } catch (error) {
    console.error('Error fixing database records:', error);
    return 0;
  }
}

/**
 * Trigger a resync of the dealership to fetch fresh data with improved mileage extraction
 */
async function triggerDealershipSync() {
  try {
    console.log(`Triggering sync for Automax of Chantilly (dealership ID: ${DEALERSHIP_ID})...`);
    
    // Use our API endpoint to sync just this dealership
    const response = await fetch(`http://localhost:3000/api/admin/sync-dealership`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dealershipId: DEALERSHIP_ID,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger sync: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Sync triggered successfully:', result);
    console.log('Check the server logs for sync progress.');
    return true;
  } catch (error) {
    console.error('Error triggering sync:', error);
    return false;
  }
}

/**
 * Alternative approach: use the direct API endpoint to test one vehicle
 */
async function testFixedScraper() {
  try {
    console.log('Testing improved scraper on a sample Automax of Chantilly vehicle...');
    
    // Find an Automax URL to test
    const automaxUrl = 'https://www.automaxofchantilly.com/details/used-2016-dodge-charger/93162981';
    
    // Call our scrape-test endpoint
    const response = await fetch(`http://localhost:3000/api/admin/scrape-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: automaxUrl,
        dealershipId: DEALERSHIP_ID,
        dealershipName: 'Automax of Chantilly',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to test scraper: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Scraper test results:', result);
    console.log(`Extracted mileage: ${result.mileage}`);
    return result;
  } catch (error) {
    console.error('Error testing scraper:', error);
    return null;
  }
}

// Run the fix process
async function main() {
  // Step 1: Fix existing database records
  const recordsFixed = await fixDatabaseRecords();
  
  if (recordsFixed > 0) {
    console.log(`Fixed ${recordsFixed} Automax vehicle records in the database.`);
  } else {
    console.log('No database records needed fixing, or fix operation failed.');
  }
  
  // Step 2: Trigger a sync with the improved scraper
  const syncTriggered = await triggerDealershipSync();
  
  if (syncTriggered) {
    console.log('Dealership sync has been triggered. New vehicle data will be fetched with improved mileage extraction.');
  } else {
    console.log('Failed to trigger dealership sync.');
    
    // Step 3 (Fallback): Test the fixed scraper on one vehicle
    const testResult = await testFixedScraper();
    
    if (testResult) {
      console.log('The scraper test was successful:');
      console.log(`- Vehicle: ${testResult.year} ${testResult.make} ${testResult.model}`);
      console.log(`- Mileage: ${testResult.mileage}`);
      console.log(`- Price: $${testResult.price}`);
    } else {
      console.log('Unable to verify the fix. Please check server logs for errors.');
    }
  }
}

main()
  .then(() => console.log('Automax mileage fix process completed.'))
  .catch(error => console.error('Error during fix process:', error));