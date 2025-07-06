import { storage } from "./storage";
import { scrapeDealership } from "./scraper";
import { scrapeInspectedAuto } from "./inspected-auto-scraper";
import { vehicles, InsertVehicle } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { eq, lt, and } from "drizzle-orm/expressions";
import { logger } from "@shared/logger";

// Class to manage the scheduled inventory sync
export class InventoryScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private shuffleIntervalId: NodeJS.Timeout | null = null;
  private syncIntervalHours: number = 4; // Default to 4 hours
  private shuffleIntervalMinutes: number = 10; // Shuffle every 10 minutes
  private isRunning: boolean = false;

  constructor(syncIntervalHours?: number, shuffleIntervalMinutes?: number) {
    if (syncIntervalHours) {
      this.syncIntervalHours = syncIntervalHours;
    }
    if (shuffleIntervalMinutes) {
      this.shuffleIntervalMinutes = shuffleIntervalMinutes;
    }
  }

  // Start the scheduler
  start() {
    if (this.intervalId) {
      return; // Already running
    }

    logger.info(`Starting inventory scheduler. Sync every ${this.syncIntervalHours} hours.`);
    
    // Run immediately on start
    this.syncAllDealerships();
    
    // Schedule regular sync runs
    const intervalMs = this.syncIntervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.syncAllDealerships();
    }, intervalMs);
    
    // Start inventory shuffling
    logger.info(`Starting inventory shuffling. Shuffle every ${this.shuffleIntervalMinutes} minutes.`);
    this.shuffleInventory(); // Run immediately
    
    // Schedule regular shuffling
    const shuffleIntervalMs = this.shuffleIntervalMinutes * 60 * 1000;
    this.shuffleIntervalId = setInterval(() => {
      this.shuffleInventory();
    }, shuffleIntervalMs);
  }

  // Stop the scheduler
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Inventory scheduler stopped.');
    }
    
    if (this.shuffleIntervalId) {
      clearInterval(this.shuffleIntervalId);
      this.shuffleIntervalId = null;
      logger.info('Inventory shuffling stopped.');
    }
  }
  
  // Shuffle the inventory to ensure vehicles rotate through pages
  async shuffleInventory() {
    try {
      logger.info('Shuffling vehicle inventory...');
      
      // Update all vehicles with a random sort order
      // This will be used in the query ordering to randomize the results
      const result = await db.execute(sql`
        UPDATE vehicles
        SET updated_at = CURRENT_TIMESTAMP,
            sort_order = floor(random() * 1000)
      `);
      
      logger.info(`Shuffled inventory: ${result.rowCount} vehicles updated`);
    } catch (error) {
      logger.error('Error shuffling inventory:', error);
    }
  }

  // Manually trigger a sync for all dealerships
  async syncAllDealerships() {
    if (this.isRunning) {
      logger.info('Sync already in progress, skipping this run');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Starting sync for all dealerships...');
      
      const dealerships = await storage.getAllDealerships();
      logger.info(`Found ${dealerships.length} dealerships to sync`);
      
      // Get current time
      const now = new Date();
      
      for (const dealership of dealerships) {
        try {
          // Check if this dealership has been synced in the last 4 hours
          if (dealership.lastSynced) {
            const lastSyncTime = new Date(dealership.lastSynced);
            const hoursSinceLastSync = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceLastSync < this.syncIntervalHours) {
              logger.info(`Skipping dealership ${dealership.name} - last synced ${hoursSinceLastSync.toFixed(1)} hours ago (less than ${this.syncIntervalHours} hours)`);
              continue;
            }
          }
          
          await this.syncDealership(dealership.id);
        } catch (error) {
          logger.error(`Error syncing dealership ${dealership.id} (${dealership.name}):`, error);
          
          // Update dealership status to error
          await storage.updateDealership(dealership.id, {
            status: 'error',
            lastSynced: new Date()
          });
        }
      }
      
      logger.info('Completed sync for all dealerships');
    } catch (error) {
      logger.error('Error during dealership sync:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Sync a specific dealership
  async syncDealership(dealershipId: number) {
    const dealership = await storage.getDealership(dealershipId);
    if (!dealership) {
      throw new Error(`Dealership with ID ${dealershipId} not found`);
    }
    
    // Skip sync if dealership is expired
    if (dealership.isExpired || dealership.status === 'expired') {
      logger.info(`Skipping sync for expired dealership: ${dealership.name} (${dealership.url})`);
      return;
    }
    
    // Check if expiration date has passed but status not updated yet
    if (dealership.expirationDate && new Date() > new Date(dealership.expirationDate)) {
      logger.info(`Dealership ${dealership.name} has expired. Updating status...`);
      await storage.updateDealership(dealershipId, { 
        isExpired: true,
        status: 'expired'
      });
      return;
    }
    
    logger.info(`Syncing dealership: ${dealership.name} (${dealership.url})`);
    
    // Update dealership status to syncing
    await storage.updateDealership(dealershipId, { status: 'syncing' });
    
    try {
      // First, get existing vehicles for this dealership
      const existingVehicles = await storage.getVehiclesByDealershipId(dealershipId);
      const existingVinMap = new Map(existingVehicles.map(v => [v.vin, v]));
      
      // Check if we should use enhanced scraper based on dealership name or URL
      const useEnhancedScraper = shouldUseEnhancedScraper(dealership.name, dealership.url);
      let scrapedVehicles: InsertVehicle[] = [];
      
      // Scrape primary URL first
      if (dealership.name.toLowerCase().includes('inspected auto') || dealership.url.toLowerCase().includes('inspectedauto')) {
        logger.info(`Using dedicated Inspected Auto scraper for ${dealership.name}`);
        scrapedVehicles = await scrapeInspectedAuto(dealership.url, dealershipId, dealership.name);
      } else if (useEnhancedScraper) {
        logger.info(`Using fallback generic scraper for ${dealership.name}`);
        scrapedVehicles = await scrapeDealership(dealership.url, dealershipId, dealership.name, dealership.location, dealership.zipCode);
      } else {
        scrapedVehicles = await scrapeDealership(dealership.url, dealershipId, dealership.name, dealership.location, dealership.zipCode);
      }
      logger.info(`Scraped ${scrapedVehicles.length} vehicles from primary URL of ${dealership.name}`);
      
      // Then scrape additional URLs if present
      if (dealership.additionalUrls && dealership.additionalUrls.length > 0) {
        logger.info(`Found ${dealership.additionalUrls.length} additional URLs to scrape for ${dealership.name}`);
        
        for (const additionalUrl of dealership.additionalUrls) {
          if (!additionalUrl || additionalUrl.trim() === '') continue;
          
          try {
            logger.info(`Scraping additional URL for ${dealership.name}: ${additionalUrl}`);
            let additionalVehicles: InsertVehicle[] = [];
            
            // Use the same scraper type as the primary URL
            if (dealership.name.toLowerCase().includes('inspected auto') || dealership.url.toLowerCase().includes('inspectedauto')) {
              logger.info(`Using dedicated Inspected Auto scraper for additional URL`);
              additionalVehicles = await scrapeInspectedAuto(
                additionalUrl, 
                dealershipId, 
                dealership.name
              );
            } else {
              additionalVehicles = await scrapeDealership(
                additionalUrl, 
                dealershipId, 
                dealership.name,
                dealership.location,
                dealership.zipCode
              );
            }
            
            if (additionalVehicles && additionalVehicles.length > 0) {
              logger.info(`Found ${additionalVehicles.length} vehicles from additional URL for ${dealership.name}`);
              scrapedVehicles = [...scrapedVehicles, ...additionalVehicles];
            } else {
              logger.info(`No vehicles found from additional URL for ${dealership.name}: ${additionalUrl}`);
            }
          } catch (error) {
            logger.error(`Error scraping additional URL ${additionalUrl} for ${dealership.name}:`, error);
            // Continue with next URL even if one fails
          }
        }
      }
      
      logger.info(`Total of ${scrapedVehicles.length} vehicles scraped from all URLs for ${dealership.name}`);
      
      // Remove duplicates from scraped vehicles using a Map with VIN as key
      const uniqueVehiclesMap = new Map();
      for (const vehicle of scrapedVehicles) {
        // If a vehicle with this VIN already exists in the map, only keep the most complete one
        if (!uniqueVehiclesMap.has(vehicle.vin) || 
            (uniqueVehiclesMap.get(vehicle.vin).images.length < vehicle.images.length)) {
          uniqueVehiclesMap.set(vehicle.vin, vehicle);
        }
      }
      
      // Convert the Map back to array with unique vehicles
      scrapedVehicles = Array.from(uniqueVehiclesMap.values());
      logger.info(`After removing duplicates: ${scrapedVehicles.length} unique vehicles`);
      
      // Track which VINs were found in the scrape
      const scrapedVinSet = new Set(scrapedVehicles.map(v => v.vin));
      
      // Process each scraped vehicle
      let updatedCount = 0;
      let createdCount = 0;
      
      for (const vehicle of scrapedVehicles) {
        try {
          // Skip vehicles with invalid VIN
          if (!vehicle.vin || vehicle.vin === 'UNKNOWN' || vehicle.vin.length !== 17) {
            logger.info(`Skipping vehicle with invalid VIN: ${vehicle.vin}`);
            continue;
          }
          
          // Check if vehicle already exists in database
          if (existingVinMap.has(vehicle.vin)) {
            // Update existing vehicle
            const existingVehicle = existingVinMap.get(vehicle.vin);
            
            // Only update if something changed (to avoid unnecessary updates)
            if (existingVehicle && (
                vehicle.price !== existingVehicle.price || 
                vehicle.title !== existingVehicle.title ||
                vehicle.mileage !== existingVehicle.mileage ||
                (vehicle.carfaxUrl && (!existingVehicle.carfaxUrl || existingVehicle.carfaxUrl !== vehicle.carfaxUrl)) ||
                (vehicle.images && vehicle.images.length > 0 && (
                  !existingVehicle.images || 
                  existingVehicle.images.length === 0 ||
                  vehicle.images.length > existingVehicle.images.length
                )))) {
              
              // Make sure images is properly handled as a string array
              const images = vehicle.images && vehicle.images.length > 0 
                ? (Array.isArray(vehicle.images) ? vehicle.images : []) 
                : (Array.isArray(existingVehicle.images) ? existingVehicle.images : []);
              
              await storage.updateVehicle(existingVehicle.id, {
                price: vehicle.price,
                title: vehicle.title,
                mileage: vehicle.mileage,
                images: images as string[],
                carfaxUrl: vehicle.carfaxUrl || existingVehicle.carfaxUrl,
                updatedAt: new Date()
              });
              updatedCount++;
            }
          } else {
            // Create new vehicle
            await storage.createVehicle(vehicle);
            createdCount++;
          }
        } catch (error) {
          // Log error but continue with other vehicles
          logger.error(`Error processing vehicle ${vehicle.vin}:`, error);
        }
      }
      
      logger.info(`Created ${createdCount} new vehicles, updated ${updatedCount} existing vehicles`);
      
      // Remove vehicles that are no longer listed (sold or removed)
      let deletedCount = 0;
      
      // Convert Map entries to an array for safe iteration
      const vinsToCheck = Array.from(existingVinMap.keys());
      
      // Process each VIN
      for (const vin of vinsToCheck) {
        try {
          if (!scrapedVinSet.has(vin)) {
            const vehicle = existingVinMap.get(vin);
            if (vehicle) {
              await storage.deleteVehicle(vehicle.id);
              deletedCount++;
            }
          }
        } catch (err) {
          logger.error(`Error deleting vehicle ${vin}:`, err);
        }
      }
      
      logger.info(`Removed ${deletedCount} vehicles that are no longer listed`);
      
      // Update dealership status
      await storage.updateDealership(dealershipId, {
        status: 'active',
        lastSynced: new Date(),
        vehicleCount: scrapedVehicles.length
      });
      
      logger.info(`Successfully synced ${dealership.name} - ${scrapedVehicles.length} vehicles`);
    } catch (error) {
      logger.error(`Error during sync for ${dealership.name}:`, error);
      
      // Update dealership status to error
      await storage.updateDealership(dealershipId, {
        status: 'error',
        lastSynced: new Date()
      });
      
      throw error;
    }
  }

  // Check if the scheduler is currently running
  isSchedulerRunning(): boolean {
    return this.intervalId !== null;
  }
}

// Helper function to determine if we should use the enhanced scraper
function shouldUseEnhancedScraper(dealershipName: string, dealershipUrl: string): boolean {
  // List of dealership names that should use enhanced scraper
  const enhancedScraperDealershipNames = [
    'nova autoland',
    'super bee auto',
    'number1 auto',
    'number 1 auto',
    'number 1 auto group',
    'auto galleria',
    'chantilly auto',
    'epic motor',
    'auto deal makers',
    'a & h quality cars',
    'nine stars auto',
    'inspected auto'
  ];
  
  // List of URL patterns that should use enhanced scraper
  const enhancedScraperUrlPatterns = [
    'novaautoland',
    'superbeeauto',
    'number1auto',
    'autogalleriava',
    'chantillyautosales',
    'epicmotorcompany',
    'autodealmakers',
    'ahqualitycars',
    'ninestarsauto',
    'inspectedauto'
  ];
  
  // Check if dealership name contains any of the enhanced scraper names
  const nameLower = dealershipName.toLowerCase();
  if (enhancedScraperDealershipNames.some(name => nameLower.includes(name))) {
    return true;
  }
  
  // Check if dealership URL contains any of the enhanced scraper URL patterns
  const urlLower = dealershipUrl.toLowerCase();
  if (enhancedScraperUrlPatterns.some(pattern => urlLower.includes(pattern))) {
    return true;
  }
  
  return false;
}

// Create a singleton scheduler instance
export const scheduler = new InventoryScheduler();
