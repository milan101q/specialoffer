/**
 * Direct test for Inspected Auto scraper - Manual addition of a vehicle
 */

import { db } from './server/db.ts';
import { vehicles, dealerships } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    console.log('Starting direct Inspected Auto test script');
    
    // Check if Inspected Auto dealership exists
    const dealership = await db.query.dealerships.findFirst({
      where: eq(dealerships.id, 47)
    });
    
    if (!dealership) {
      console.error('Inspected Auto dealership not found!');
      return;
    }
    
    console.log('Found dealership:', dealership);
    
    // Create test vehicle for Inspected Auto
    const testVehicle = {
      dealershipId: 47,
      title: '2020 Jaguar I-PACE',
      make: 'Jaguar',
      model: 'I-PACE',
      year: 2020,
      price: 22995,
      mileage: 82408,
      vin: 'SADHD2S17L1F85500',
      stock: null,
      exteriorColor: 'Black',
      interiorColor: 'Black',
      transmission: 'Automatic',
      engine: 'Electric',
      fuelType: 'Electric',
      drivetrain: 'AWD',
      bodyType: 'SUV',
      description: 'Premium electric SUV with great features',
      features: [],
      images: [
        'https://cdn05.carsforsale.com/3ee92870c3be594bf6c16a0984748172/2020-jaguar-i-pace-ev400-252520hse.jpg?width=640&height=480&format=&sig=6a421c561097d121',
        'https://cdn05.carsforsale.com/00c9feecc9b66803c946d4d9293ca9794b/2020-jaguar-i-pace-ev400-252520hse.jpg?width=640&height=480&format=&sig=eb45ff22c9b4d7ea',
        'https://cdn05.carsforsale.com/00b7aa02ed96867dc7b6de7fd9af3064b8/2020-jaguar-i-pace-ev400-252520hse.jpg?width=640&height=480&format=&sig=048d9073226a4b41',
        'https://cdn05.carsforsale.com/4dbd8eea40c79af0285da1c03dccbc16/2020-jaguar-i-pace-ev400-252520hse.jpg?width=640&height=480&format=&sig=a877d6a6ad667ff0'
      ],
      url: 'https://www.inspectedauto.com/Inventory/Details/663eadbc-78cf-4254-b688-71031593a49d',
      originalListingUrl: 'https://www.inspectedauto.com/Inventory/Details/663eadbc-78cf-4254-b688-71031593a49d',
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: 'Chantilly, VA',
      zipCode: '20151',
      carfaxUrl: 'https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=VAU_0&vin=SADHD2S17L1F85500',
      sortOrder: Math.floor(Math.random() * 1000)
    };
    
    // First, check if the vehicle already exists
    const existingVehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.vin, 'SADHD2S17L1F85500')
    });
    
    if (existingVehicle) {
      console.log('Vehicle already exists, deleting it first...');
      await db.delete(vehicles).where(eq(vehicles.id, existingVehicle.id));
      console.log('Vehicle deleted.');
    }
    
    // Now insert the test vehicle
    console.log('Inserting test vehicle...');
    const result = await db.insert(vehicles).values(testVehicle);
    
    console.log('Vehicle inserted successfully!', result);
    
    // Update dealership record with last_synced timestamp
    await db.update(dealerships)
      .set({ 
        lastSynced: new Date(),
        vehicleCount: 1
      })
      .where(eq(dealerships.id, 47));
    
    console.log('Dealership updated with last_synced timestamp and vehicle count.');
    
    console.log('Test completed successfully. Check the vehicles table for the new entry.');
    
  } catch (error) {
    console.error('Error in direct test script:', error);
  }
}

main()
  .then(() => console.log('Script execution completed'))
  .catch(error => console.error('Unhandled error:', error))
  .finally(() => process.exit(0));