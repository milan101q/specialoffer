// trigger-nova-sync.js

async function main() {
  try {
    const response = await fetch('https://specialoffer-jk6o.onrender.com/api/sync-dealership/30', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // include empty body or data if needed
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Sync response:', data);
  } catch (error) {
    console.error('❌ Failed to sync Nova Autoland:', error.message);
  }
}

main();
