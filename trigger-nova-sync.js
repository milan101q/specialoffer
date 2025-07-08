// trigger-nova-sync.js
// This script is used to manually trigger the Nova Autoland sync via an API endpoint.

async function main() {
  console.log('Attempting to trigger Nova Autoland sync via API...');
  try {
    // Ensure this URL matches your deployed Render service's API endpoint
    // and the dealership ID (e.g., 30 or 33) is correct for Nova Autoland in your database.
    const response = await fetch('http://localhost:5000/api/sync-dealership/30', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // If your API requires authentication (e.g., an API key or session cookie),
        // you would need to add it here. For local testing, it might not be needed.
        // 'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({}), // Empty body if no specific data is required for triggering
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Sync trigger response:', data);
      console.log('Nova Autoland sync initiated successfully (or status received). Check server logs for details.');
    } else {
      console.error(`Failed to trigger sync: ${response.status} ${response.statusText}`);
      const errorData = await response.text(); // Get response body for more details
      console.error('Error details:', errorData);
    }
  } catch (error) {
    console.error('Error sending sync trigger request:', error);
  }
}

main().catch(console.error);
