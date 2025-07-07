/**
 * Run this script in a separate terminal with:
 * curl -X POST http://localhost:5000/api/admin/sync-dealership -H "Content-Type: application/json" -d '{"dealershipId":X}'
 * 
 * Replace X with the ID of the Inspected Auto dealership
 */
import fetch from 'node-fetch';

console.log('To force a sync for Inspected Auto:');
console.log('1. First login to the admin interface at http://localhost:5000/login');
console.log('2. Then find the ID of the Inspected Auto dealership in the admin panel');
console.log('3. Run the following curl command with the correct dealership ID:');
console.log('curl -X POST http://localhost:5000/api/admin/sync-dealership -H "Content-Type: application/json" -d \'{"dealershipId":X}\'');
console.log('4. Or visit the following API endpoint in the browser after logging in:');
console.log('http://localhost:5000/api/admin/trigger-inspected-auto-sync');
