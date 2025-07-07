import fetch from 'node-fetch';
async function main() {
  const response = await fetch('http://localhost:5000/api/sync-dealership/30', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = await response.json();
  console.log('Response:', data);
}

main().catch(console.error);
