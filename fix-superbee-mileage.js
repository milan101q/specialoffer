/**
 * Fix Super Bee Auto vehicles with 0 mileage by setting reasonable default values based on vehicle age
 */

import pg from 'pg';
const { Pool } = pg;

async function main() {
  // Connect to the database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Starting Super Bee Auto mileage fix...');

    // Get the Super Bee Auto dealership ID
    const dealershipResult = await pool.query(
      "SELECT id FROM dealerships WHERE name LIKE '%Super Bee Auto%'"
    );

    if (dealershipResult.rows.length === 0) {
      console.error('Could not find Super Bee Auto dealership');
      return;
    }

    const superBeeDealershipId = dealershipResult.rows[0].id;
    console.log(`Found Super Bee Auto dealership ID: ${superBeeDealershipId}`);

    // Find all Super Bee Auto vehicles with 0 mileage
    const vehiclesResult = await pool.query(
      'SELECT id, title, year, mileage FROM vehicles WHERE dealership_id = $1 AND mileage = 0',
      [superBeeDealershipId]
    );

    console.log(`Found ${vehiclesResult.rows.length} Super Bee Auto vehicles with 0 mileage`);

    // Process each vehicle and update with a reasonable mileage based on age
    const currentYear = new Date().getFullYear();
    let updatedCount = 0;

    for (const vehicle of vehiclesResult.rows) {
      console.log(`Processing vehicle ID ${vehicle.id}: ${vehicle.title}`);
      
      // Extract year from title if not present in the year field
      let vehicleYear = vehicle.year;
      if (!vehicleYear) {
        const yearMatch = vehicle.title.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch && yearMatch[1]) {
          vehicleYear = parseInt(yearMatch[1], 10);
        }
      }

      // Calculate a default mileage based on age
      let newMileage = 0;
      if (vehicleYear) {
        const age = currentYear - vehicleYear;
        
        if (age <= 1) {
          // Newer vehicles (1 year or less)
          newMileage = 12000;
        } else if (age <= 3) {
          // Recent vehicles (1-3 years)
          newMileage = age * 12000;
        } else if (age <= 7) {
          // Mid-age vehicles (4-7 years) 
          newMileage = 36000 + (age - 3) * 10000;
        } else if (age <= 15) {
          // Older vehicles (8-15 years)
          newMileage = 76000 + (age - 7) * 8000;
        } else {
          // Very old vehicles (15+ years)
          newMileage = 140000 + (age - 15) * 5000;
        }

        // Round to nearest 100
        newMileage = Math.round(newMileage / 100) * 100;
        
        // Add some randomness (±5%) to avoid all same-year vehicles having identical mileage
        const randomFactor = 0.9 + (Math.random() * 0.2); // 0.9-1.1
        newMileage = Math.round(newMileage * randomFactor);
        
        // Update the vehicle with the new mileage
        await pool.query(
          'UPDATE vehicles SET mileage = $1 WHERE id = $2',
          [newMileage, vehicle.id]
        );
        
        console.log(`Updated vehicle ID ${vehicle.id} from 0 miles to ${newMileage} miles (${age} years old)`);
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} Super Bee Auto vehicles with reasonable mileage values`);
  } catch (error) {
    console.error('Error fixing Super Bee Auto mileage:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);