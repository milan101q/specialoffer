// Sync Automax of Chantilly script
import fetch from 'node-fetch';

async function main() {
  try {
    console.log('Triggering sync for Automax of Chantilly (dealership ID: 19)...');
    
    // Using the API endpoint to trigger a sync for a specific dealership
    const response = await fetch('http://localhost:5000/api/admin/sync-dealership', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dealershipId: 19, // Automax of Chantilly ID
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to trigger sync: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Sync triggered successfully:', result);
    console.log('Check the server logs for sync progress.');
  } catch (error) {
    console.error('Error triggering sync:', error);
  }
}

main();