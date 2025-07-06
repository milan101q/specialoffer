// No need to import fetch in Node.js 18+

async function main() {
  try {
    console.log('Triggering Inspected Auto sync...');
    
    const response = await fetch('http://localhost:5000/api/test/trigger-inspected-auto-sync');
    const data = await response.json();
    
    console.log('Response:', data);
    
    if (response.ok) {
      console.log('Inspected Auto sync triggered successfully!');
    } else {
      console.error('Failed to trigger sync:', data.message || data.error);
    }
  } catch (error) {
    console.error('Error triggering sync:', error);
  }
}

main();