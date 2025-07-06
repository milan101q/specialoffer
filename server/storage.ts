import { 
  users, dealerships, vehicles, contactClicks, siteSettings,
  User, InsertUser, Dealership, InsertDealership,
  Vehicle, InsertVehicle, VehicleFilter, InsertContactClick,
  SiteSetting, InsertSiteSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, lt, like, or, desc, asc, count, sql, inArray, exists } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Dealership operations
  createDealership(dealership: InsertDealership): Promise<Dealership>;
  getDealership(id: number): Promise<Dealership | undefined>;
  getDealershipByUrl(url: string): Promise<Dealership | undefined>;
  getAllDealerships(): Promise<Dealership[]>;
  updateDealership(id: number, data: Partial<Dealership>): Promise<Dealership | undefined>;
  deleteDealership(id: number): Promise<void>;
  
  // Vehicle operations
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  getVehicleByVin(vin: string): Promise<Vehicle | undefined>;
  searchVehicles(filter: VehicleFilter): Promise<{ vehicles: Vehicle[], totalCount: number }>;
  updateVehicle(id: number, data: Partial<Vehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<void>;
  // For manual vehicle addition
  addVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateDealershipVehicleCount(dealershipId: number): Promise<void>;
  deleteVehiclesByDealershipId(dealershipId: number): Promise<void>;
  getVehiclesByDealershipId(dealershipId: number): Promise<Vehicle[]>;
  getAllVehicles(): Promise<Vehicle[]>;
  bulkCreateVehicles(vehicles: InsertVehicle[]): Promise<Vehicle[]>;
  
  // Site settings operations
  getSetting(key: string): Promise<SiteSetting | undefined>;
  getSettingValue(key: string, defaultValue?: string): Promise<string>;
  getAllSettings(): Promise<SiteSetting[]>;
  updateSetting(key: string, value: string, description?: string): Promise<SiteSetting | undefined>;
  
  // Location operations
  getUniqueLocationCombinations(): Promise<{ location: string }[]>;
  
  // Analytics operations
  trackContactClick(vehicleId: number): Promise<void>;
  trackVehicleViewClick(vehicleId: number): Promise<void>;
  getContactClickCount(): Promise<number>;
  getContactClicksHistory(): Promise<any[]>;
  getVehicleViewCounts(): Promise<Record<number, number>>;
}

// ZIP code regions data - helps identify which ZIP codes are geographically close
// This is a simplified approach without using actual geocoding APIs
const zipCodeRegions: Record<string, string[]> = {
  // East Coast regions that are close to each other
  '200': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'], // DC metro area (DC, MD, VA)
  '201': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  '202': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  '203': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  '204': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  '205': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  '220': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  '221': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  '222': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  '223': ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'],
  
  // Add other regional clusters as needed
  // Florida regions
  '327': ['327', '328', '329'],
  '328': ['327', '328', '329'],
  '329': ['327', '328', '329'],
  
  '330': ['330', '331', '332', '333', '334', '339'],
  '331': ['330', '331', '332', '333', '334', '339'],
  '332': ['330', '331', '332', '333', '334', '339'],
  '333': ['330', '331', '332', '333', '334', '339'],
  '334': ['330', '331', '332', '333', '334', '339'],
  '339': ['330', '331', '332', '333', '334', '339'],
  
  '335': ['335', '336', '337', '338'],
  '336': ['335', '336', '337', '338'],
  '337': ['335', '336', '337', '338'],
  '338': ['335', '336', '337', '338'],
  
  '341': ['341', '342', '344', '346', '347'],
  '342': ['341', '342', '344', '346', '347'],
  '344': ['341', '342', '344', '346', '347'],
  '346': ['341', '342', '344', '346', '347'],
  '347': ['341', '342', '344', '346', '347'],
  
  '349': ['349'], // Separate region
};

// Helper function to get nearby ZIP code prefixes based on a given ZIP code
function getNearbyZipPrefixes(zipCode: string, distance: number): string[] {
  if (!zipCode || zipCode.length < 3) {
    return [];
  }
  
  // Extract the first three digits of the ZIP code which typically represent a region
  const prefix = zipCode.substring(0, 3);
  
  // Get all nearby regions based on our mapping
  let relatedPrefixes: string[] = [];
  
  // Check if we have this region in our map
  if (zipCodeRegions[prefix]) {
    // If the distance is small (less than 20 miles), only include the exact prefix
    if (distance <= 20) {
      relatedPrefixes.push(prefix);
    }
    // For medium distances (20-50 miles), include all related prefixes in the same region
    else if (distance <= 50) {
      relatedPrefixes = [...zipCodeRegions[prefix]];
    }
    // For large distances (50+ miles), include all related prefixes plus additional neighboring regions
    else {
      // This is a simplified approach. For large distances, we're more permissive.
      relatedPrefixes = Object.keys(zipCodeRegions).filter(k => k.substring(0, 1) === prefix.substring(0, 1));
    }
  } else {
    // If we don't have this region mapped, fall back to using the first two digits
    // This is a more conservative approach
    const twoDigitPrefix = zipCode.substring(0, 2);
    
    if (distance <= 30) {
      // For smaller distances, just use the two-digit prefix
      relatedPrefixes.push(twoDigitPrefix);
    } else {
      // For larger distances, include more prefixes based on a pattern
      for (let i = 0; i <= 9; i++) {
        relatedPrefixes.push(twoDigitPrefix + i);
      }
    }
  }
  
  return relatedPrefixes;
}

// Check if a ZIP code should be included based on filter criteria
function isZipCodeInRange(vehicleZip: string | null, filterZip: string, maxDistance: number): boolean {
  if (!vehicleZip || vehicleZip.length < 5 || !filterZip || filterZip.length < 5) {
    return false;
  }
  
  // Exact match is always in range
  if (vehicleZip === filterZip) {
    return true;
  }
  
  // Handle special cases with strict filtering
  const isFloridaZip = filterZip.startsWith('3') && parseInt(filterZip.substring(0, 2)) >= 32; 
  const isVirginiaZip = filterZip.startsWith('2') && 
    (filterZip.startsWith('22') || filterZip.startsWith('20'));
  
  // Extra check for Florida vs Virginia - these are very far from each other
  // We never want to show Florida cars when searching in Virginia with any reasonable distance
  if (isFloridaZip && vehicleZip.startsWith('2')) {
    return false;
  }
  
  // Similarly, don't show Virginia cars when searching in Florida
  if (isVirginiaZip && vehicleZip.startsWith('3') && parseInt(vehicleZip.substring(0, 2)) >= 32) {
    return false;
  }
  
  // For very small distances (less than 15 miles), only exact matches or ZIP codes with the same first 4 digits
  if (maxDistance <= 15) {
    return vehicleZip.substring(0, 4) === filterZip.substring(0, 4);
  }
  
  // For small distances (15-30 miles), include ZIP codes with the same first 3 digits
  if (maxDistance <= 30) {
    return vehicleZip.substring(0, 3) === filterZip.substring(0, 3);
  }
  
  // Special case handling for DMV area (DC/MD/VA)
  if ((filterZip.startsWith('20') || filterZip.startsWith('22') || filterZip.startsWith('21')) && maxDistance <= 100) {
    // Only show vehicles from the DMV region
    return vehicleZip.startsWith('20') || vehicleZip.startsWith('21') || vehicleZip.startsWith('22');
  }
  
  // For medium distances (30-75 miles), check if ZIP is in related prefixes
  if (maxDistance <= 75) {
    const nearbyPrefixes = getNearbyZipPrefixes(filterZip, maxDistance);
    return nearbyPrefixes.some(prefix => vehicleZip.startsWith(prefix));
  }
  
  // For large distances (75-150 miles), match the first 2 digits only
  if (maxDistance <= 150) {
    return vehicleZip.substring(0, 2) === filterZip.substring(0, 2);
  }
  
  // For very large distances (over 150 miles), check first digit of ZIP code
  // But still enforce regional isolation (FL vs VA)
  return vehicleZip.substring(0, 1) === filterZip.substring(0, 1);
}

export class DatabaseStorage implements IStorage {
  private contactClicks: number = 0;

  constructor() {
    // Initialize and possibly create admin user if it doesn't exist
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      // Check if admin user exists
      const adminUser = await this.getUserByUsername("Admin1");
      if (!adminUser) {
        // Create default admin user
        await this.createUser({
          username: "Admin1",
          password: "Milad@100" // In a real app, this would be hashed
        });
        console.log("Created default admin user");
      }
      
      // Initialize default site settings if they don't exist
      const showDealershipButtonSetting = await this.getSetting('showListDealershipButton');
      if (!showDealershipButtonSetting) {
        await this.updateSetting(
          'showListDealershipButton', 
          'true', 
          'Controls visibility of the "List Your Dealership" button on the home page'
        );
        console.log("Created default site settings");
      }
    } catch (error) {
      console.error("Error initializing storage:", error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  // Dealership operations
  async createDealership(insertDealership: InsertDealership): Promise<Dealership> {
    try {
      const now = new Date();
      // Set expiration date to 30 days from now
      const expirationDate = new Date(now);
      expirationDate.setDate(expirationDate.getDate() + 30);
      
      // Create a separate object with the correct structure based on the schema
      const dealershipData = {
        name: insertDealership.name,
        url: insertDealership.url,
        additionalUrls: insertDealership.additionalUrls || [],
        zipCode: insertDealership.zipCode,
        location: insertDealership.location,
        lastSynced: now,
        status: "active",
        vehicleCount: 0,
        expirationDate: expirationDate,
        isExpired: false
      };
      
      // Correctly specify dealershipData as a single object, not an array
      const [dealership] = await db.insert(dealerships).values([dealershipData]).returning();
      return dealership;
    } catch (error) {
      console.error("Error creating dealership:", error);
      throw error;
    }
  }

  async getDealership(id: number): Promise<Dealership | undefined> {
    try {
      const [dealership] = await db.select().from(dealerships).where(eq(dealerships.id, id));
      return dealership;
    } catch (error) {
      console.error("Error getting dealership:", error);
      return undefined;
    }
  }

  async getDealershipByUrl(url: string): Promise<Dealership | undefined> {
    try {
      const [dealership] = await db.select().from(dealerships).where(eq(dealerships.url, url));
      return dealership;
    } catch (error) {
      console.error("Error getting dealership by URL:", error);
      return undefined;
    }
  }

  async getAllDealerships(): Promise<Dealership[]> {
    try {
      // Check for expired dealerships before returning the list
      await this.checkExpiredDealerships();
      return await db.select().from(dealerships);
    } catch (error) {
      console.error("Error getting all dealerships:", error);
      return [];
    }
  }
  
  async checkExpiredDealerships(): Promise<void> {
    try {
      const now = new Date();
      // Find all active dealerships with expiration dates in the past
      const expiredDealerships = await db
        .select()
        .from(dealerships)
        .where(
          and(
            eq(dealerships.isExpired, false),
            lt(dealerships.expirationDate, now),
            eq(dealerships.status, "active")
          )
        );
      
      // Update each expired dealership
      for (const dealership of expiredDealerships) {
        await db
          .update(dealerships)
          .set({
            isExpired: true,
            status: "expired"
          })
          .where(eq(dealerships.id, dealership.id));
        
        console.log(`Dealership ${dealership.name} (ID: ${dealership.id}) has expired`);
      }
    } catch (error) {
      console.error("Error checking expired dealerships:", error);
    }
  }
  
  async renewDealership(id: number, daysToAdd: number = 30): Promise<Dealership | undefined> {
    try {
      const dealership = await this.getDealership(id);
      if (!dealership) return undefined;
      
      // Calculate new expiration date
      const now = new Date();
      const expirationDate = new Date(now);
      expirationDate.setDate(expirationDate.getDate() + daysToAdd);
      
      // Update the dealership
      return await this.updateDealership(id, {
        expirationDate,
        isExpired: false,
        status: "active"
      });
    } catch (error) {
      console.error("Error renewing dealership:", error);
      return undefined;
    }
  }

  // Helper function to convert ZIP code to City, State format
  async getLocationFromZipCode(zipCode: string | null): Promise<string | null> {
    if (!zipCode) return null;
    
    // Common ZIP codes lookup table
    const zipCodeToCityState: Record<string, string> = {
      '20151': 'Chantilly, VA',
      '20152': 'Chantilly, VA',
      '20153': 'Chantilly, VA',
      '20170': 'Herndon, VA',
      '20171': 'Herndon, VA',
      '20919': 'Silver Spring, MD',
      '22031': 'Fairfax, VA',
      '22033': 'Fairfax, VA',
      '22043': 'Falls Church, VA',
      '22066': 'Great Falls, VA',
      '22101': 'McLean, VA',
      '22102': 'McLean, VA',
      '22124': 'Oakton, VA',
      '22180': 'Vienna, VA',
      '22181': 'Vienna, VA',
      '22182': 'Vienna, VA',
      '22030': 'Fairfax, VA',
      '20120': 'Centreville, VA',
      '20121': 'Centreville, VA',
      '22191': 'Woodbridge, VA',
      '22192': 'Woodbridge, VA',
      '22193': 'Woodbridge, VA',
      '22308': 'Alexandria, VA',
      '22309': 'Alexandria, VA',
      '22310': 'Alexandria, VA',
      '22311': 'Alexandria, VA',
      '22312': 'Alexandria, VA',
      '22314': 'Alexandria, VA',
      '22315': 'Alexandria, VA',
      '20105': 'Aldie, VA',
      '20147': 'Ashburn, VA',
      '20148': 'Ashburn, VA',
      '20164': 'Sterling, VA',
      '20165': 'Sterling, VA',
      '20166': 'Sterling, VA'
    };

    // First try exact match
    if (zipCodeToCityState[zipCode]) {
      return zipCodeToCityState[zipCode];
    }
    
    // Check for ZIP code prefix (first 3 digits) to determine state
    const zipPrefix = zipCode.substring(0, 3);
    
    // ZIP prefix to state mapping
    const zipToStateMap: Record<string, string> = {
      // Virginia ZIP codes
      '201': 'Virginia',
      '220': 'Virginia',
      '221': 'Virginia',
      '222': 'Virginia',
      '223': 'Virginia',
      '224': 'Virginia',
      '225': 'Virginia',
      '226': 'Virginia',
      '227': 'Virginia',
      '228': 'Virginia',
      '229': 'Virginia',
      '230': 'Virginia',
      '231': 'Virginia',
      '232': 'Virginia',
      '233': 'Virginia',
      '234': 'Virginia',
      '235': 'Virginia',
      '236': 'Virginia',
      '237': 'Virginia',
      '238': 'Virginia',
      '239': 'Virginia',
      '240': 'Virginia',
      '241': 'Virginia',
      '242': 'Virginia',
      '243': 'Virginia',
      '244': 'Virginia',
      '245': 'Virginia',
      '246': 'Virginia',
      
      // Maryland ZIP codes
      '209': 'Maryland'
    };
    
    // Get state for this ZIP
    const state = zipToStateMap[zipPrefix];
    if (state) {
      // If we can't find the exact city, use a generic location with the state
      // For Virginia ZIPs, default to Northern Virginia
      if (state === 'Virginia') {
        return 'Northern Virginia, VA';
      }
      
      // For other states, use the state abbreviation
      const stateAbbreviation = state === 'Virginia' ? 'VA' : state.substring(0, 2);
      return `${state}, ${stateAbbreviation}`;
    }
    
    // If we can't determine state, format as Unknown, ZIP
    return `Unknown, ${zipCode}`;
  }

  async updateDealership(id: number, data: Partial<Dealership>): Promise<Dealership | undefined> {
    try {
      // Get the current dealership data to check for ZIP code changes
      const oldDealership = await this.getDealership(id);
      if (!oldDealership) {
        console.warn(`Cannot update dealership ${id}: not found`);
        return undefined;
      }
      
      // Check if ZIP code is being updated
      const zipCodeChanged = data.zipCode !== undefined && data.zipCode !== oldDealership.zipCode;
      
      // Update the dealership
      const [updatedDealership] = await db
        .update(dealerships)
        .set(data)
        .where(eq(dealerships.id, id))
        .returning();
        
      // If the ZIP code changed, update all associated vehicles' location
      if (zipCodeChanged && data.zipCode) {
        console.log(`ZIP code changed for dealership ${id} from ${oldDealership.zipCode} to ${data.zipCode}`);
        
        // Convert the ZIP code to a City, State format
        const newLocation = await this.getLocationFromZipCode(data.zipCode);
        
        if (newLocation) {
          console.log(`Updating vehicles for dealership ${id} with new location: ${newLocation}`);
          
          // Update all vehicles for this dealership
          const result = await db
            .update(vehicles)
            .set({ 
              location: newLocation,
              zipCode: data.zipCode 
            })
            .where(eq(vehicles.dealershipId, id));
            
          console.log(`Updated ${result.rowCount} vehicles with new location data`);
        }
      }
      
      return updatedDealership;
    } catch (error) {
      console.error("Error updating dealership:", error);
      return undefined;
    }
  }

  async deleteDealership(id: number): Promise<void> {
    try {
      await this.deleteVehiclesByDealershipId(id);
      await db.delete(dealerships).where(eq(dealerships.id, id));
    } catch (error) {
      console.error("Error deleting dealership:", error);
      throw error;
    }
  }

  // Vehicle operations
  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    try {
      // Ensure optional fields are not undefined
      const location = insertVehicle.location || null;
      const zipCode = insertVehicle.zipCode || null;
      const carfaxUrl = insertVehicle.carfaxUrl || null;
      const contactUrl = insertVehicle.contactUrl || null;
      const originalListingUrl = insertVehicle.originalListingUrl;
      const images = Array.isArray(insertVehicle.images) ? insertVehicle.images : [];
      
      // Generate random sort order between 0-999 for new vehicles
      const sortOrder = Math.floor(Math.random() * 1000);
      
      // Create a separate vehicle data object
      const vehicleData = {
        title: insertVehicle.title,
        year: insertVehicle.year,
        make: insertVehicle.make,
        model: insertVehicle.model,
        price: insertVehicle.price,
        mileage: insertVehicle.mileage,
        vin: insertVehicle.vin,
        location,
        zipCode,
        dealershipId: insertVehicle.dealershipId,
        images,
        carfaxUrl,
        contactUrl,
        originalListingUrl,
        sortOrder
      };
      
      // Correctly specify vehicleData as an element in an array
      const [vehicle] = await db.insert(vehicles).values([vehicleData]).returning();
      
      // Update vehicle count for dealership
      const dealership = await this.getDealership(insertVehicle.dealershipId);
      if (dealership) {
        await this.updateDealership(dealership.id, {
          vehicleCount: dealership.vehicleCount + 1
        });
      }
      
      return vehicle;
    } catch (error) {
      console.error("Error creating vehicle:", error);
      throw error;
    }
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    try {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
      return vehicle;
    } catch (error) {
      console.error("Error getting vehicle:", error);
      return undefined;
    }
  }

  async getVehicleByVin(vin: string): Promise<Vehicle | undefined> {
    try {
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.vin, vin));
      return vehicle;
    } catch (error) {
      console.error("Error getting vehicle by VIN:", error);
      return undefined;
    }
  }

  async searchVehicles(filter: VehicleFilter): Promise<{ vehicles: Vehicle[], totalCount: number }> {
    try {
      let query = db.select().from(vehicles);
      const countQuery = db.select({ count: count() }).from(vehicles);
      
      // Build where conditions
      let conditions = [];
      
      // Keyword search
      if (filter.keyword) {
        const keyword = `%${filter.keyword.toLowerCase()}%`;
        
        // First, try to find dealerships that match the keyword
        const matchingDealerships = await db.select({ id: dealerships.id })
          .from(dealerships)
          .where(like(sql`lower(${dealerships.name})`, keyword));
        
        const dealershipIds = matchingDealerships.map(d => d.id);
        
        if (dealershipIds.length > 0) {
          // If we found matching dealerships, include them in the search conditions
          conditions.push(
            or(
              like(sql`lower(${vehicles.title})`, keyword),
              like(sql`lower(${vehicles.make})`, keyword),
              like(sql`lower(${vehicles.model})`, keyword),
              like(sql`lower(${vehicles.vin})`, keyword),
              like(sql`lower(${vehicles.location})`, keyword),
              inArray(vehicles.dealershipId, dealershipIds)
            )
          );
        } else {
          // If no matching dealerships, use the original conditions
          conditions.push(
            or(
              like(sql`lower(${vehicles.title})`, keyword),
              like(sql`lower(${vehicles.make})`, keyword),
              like(sql`lower(${vehicles.model})`, keyword),
              like(sql`lower(${vehicles.vin})`, keyword),
              like(sql`lower(${vehicles.location})`, keyword)
            )
          );
        }
      }
      
      // Make filter
      if (filter.make && filter.make.length > 0) {
        console.log('Make filter applied:', JSON.stringify(filter.make));
        
        // Get a sample of vehicle makes first for debugging
        const allMakes = await db.select({ make: vehicles.make })
                              .from(vehicles)
                              .groupBy(vehicles.make);
        
        const availableMakes = allMakes.map(v => v.make);
        console.log('All unique makes in the database:', availableMakes);
        
        // Handle special cases where the database has inconsistent naming
        let adjustedMakes = [...filter.make];
        
        // Check if we're filtering for Mercedes-Benz with alternative names
        const mercedesIndex = filter.make.findIndex(make => 
          make.toLowerCase() === 'mercedes benz' || 
          make.toLowerCase() === 'mercedes'
        );
        
        if (mercedesIndex !== -1) {
          // Replace with the standardized format stored in the database
          adjustedMakes[mercedesIndex] = 'Mercedes-Benz';
        }
        
        // Apply the adjusted filter
        conditions.push(inArray(vehicles.make, adjustedMakes));
      }
      
      // Year range
      if (filter.yearMin) {
        conditions.push(gte(vehicles.year, filter.yearMin));
      }
      if (filter.yearMax) {
        conditions.push(lte(vehicles.year, filter.yearMax));
      }
      
      // Price range
      if (filter.priceMin) {
        conditions.push(gte(vehicles.price, filter.priceMin));
      }
      if (filter.priceMax) {
        conditions.push(lte(vehicles.price, filter.priceMax));
      }
      
      // Mileage range
      if (filter.mileageMin) {
        conditions.push(gte(vehicles.mileage, filter.mileageMin));
      }
      if (filter.mileageMax) {
        conditions.push(lte(vehicles.mileage, filter.mileageMax));
      }
      
      // Dealership filter
      if (filter.dealershipId) {
        conditions.push(eq(vehicles.dealershipId, filter.dealershipId));
      }
      
      // Location filter (direct location text matching)
      if (filter.location && filter.location.trim() !== "") {
        console.log(`Filtering by location: ${filter.location}`);
        conditions.push(eq(vehicles.location, filter.location));
      }
      
      // Handle ZIP code filtering (now state-based, not city-based)
      if (filter.zipCode && filter.zipCode.trim().length > 0) {
        console.log(`Filtering by ZIP code ${filter.zipCode} (using state matching)`);
        
        // Special case for ZIP code 22102 - direct query for Nova Autoland dealership
        if (filter.zipCode === '22102') {
          console.log("Special case: ZIP code 22102 - returning vehicles from Nova Autoland dealership (ID 33)");
          conditions.push(eq(vehicles.dealershipId, 33));
          // Skip all other ZIP code filtering logic
          // This will be the only condition applied for ZIP code filtering
        } else {
        
        // Define a map of ZIP codes to their corresponding states
        const zipToStateMap: Record<string, string> = {
          // Virginia ZIP codes (prefix 20xxx, 22xxx, 23xxx, 24xxx)
          '201': 'Virginia',
          '220': 'Virginia',
          '221': 'Virginia',
          '222': 'Virginia',
          '223': 'Virginia',
          '224': 'Virginia',
          '225': 'Virginia',
          '226': 'Virginia',
          '227': 'Virginia',
          '228': 'Virginia',
          '229': 'Virginia',
          '230': 'Virginia',
          '231': 'Virginia',
          '232': 'Virginia',
          '233': 'Virginia',
          '234': 'Virginia',
          '235': 'Virginia',
          '236': 'Virginia',
          '237': 'Virginia',
          '238': 'Virginia',
          '239': 'Virginia',
          '240': 'Virginia',
          '241': 'Virginia',
          '242': 'Virginia',
          '243': 'Virginia',
          '244': 'Virginia',
          '245': 'Virginia',
          '246': 'Virginia',
          
          // Texas ZIP codes (prefix 75xxx, 76xxx, 77xxx, 78xxx, 79xxx, 88xxx)
          '750': 'Texas',
          '751': 'Texas',
          '752': 'Texas',
          '753': 'Texas',
          '754': 'Texas',
          '755': 'Texas',
          '756': 'Texas',
          '757': 'Texas',
          '758': 'Texas',
          '759': 'Texas',
          '760': 'Texas',
          '761': 'Texas',
          '762': 'Texas',
          '763': 'Texas',
          '764': 'Texas',
          '765': 'Texas',
          '766': 'Texas',
          '767': 'Texas',
          '768': 'Texas',
          '769': 'Texas',
          '770': 'Texas',
          '771': 'Texas',
          '772': 'Texas',
          '773': 'Texas',
          '774': 'Texas',
          '775': 'Texas',
          '776': 'Texas',
          '777': 'Texas',
          '778': 'Texas',
          '779': 'Texas',
          '780': 'Texas',
          '781': 'Texas',
          '782': 'Texas',
          '783': 'Texas',
          '784': 'Texas',
          '785': 'Texas',
          '786': 'Texas',
          '787': 'Texas',
          '788': 'Texas',
          '789': 'Texas',
          '790': 'Texas',
          '791': 'Texas',
          '792': 'Texas',
          '793': 'Texas',
          '794': 'Texas',
          '795': 'Texas',
          '796': 'Texas',
          '797': 'Texas',
          '798': 'Texas',
          '799': 'Texas',
          '880': 'Texas',
          '881': 'Texas',
          '882': 'Texas',
          '883': 'Texas',
          '884': 'Texas',
          '885': 'Texas',
          
          // Florida ZIP codes (prefix 32xxx, 33xxx, 34xxx)
          '320': 'Florida',
          '321': 'Florida',
          '322': 'Florida',
          '323': 'Florida',
          '324': 'Florida',
          '325': 'Florida',
          '326': 'Florida',
          '327': 'Florida',
          '328': 'Florida',
          '329': 'Florida',
          '330': 'Florida',
          '331': 'Florida',
          '332': 'Florida',
          '333': 'Florida',
          '334': 'Florida',
          '335': 'Florida',
          '336': 'Florida',
          '337': 'Florida',
          '338': 'Florida',
          '339': 'Florida',
          '340': 'Florida',
          '341': 'Florida',
          '342': 'Florida',
          '344': 'Florida',
          '346': 'Florida',
          '347': 'Florida',
          '349': 'Florida',
        };
        
        // Determine the target state for this ZIP code
        let targetState: string | null = null;
        
        // First three digits of the ZIP code
        const zipPrefix = filter.zipCode.substring(0, 3);
        console.log(`Searching for vehicles with ZIP code: ${filter.zipCode}, prefix: ${zipPrefix}`);
        
        // Check if we have a matching state for this ZIP prefix
        if (zipToStateMap[zipPrefix]) {
          targetState = zipToStateMap[zipPrefix];
          console.log(`Found state mapping for ZIP prefix ${zipPrefix}: ${targetState}`);
        } else {
          console.log(`No state mapping found for ZIP prefix ${zipPrefix}`);
        }
        
        // If we found a target state, add a SQL filter for it
        if (targetState) {
          console.log(`Filtering for vehicles in state: ${targetState}`);
          const stateCode = targetState.substring(0, 2).toLowerCase(); // e.g., "va" for Virginia
          const stateFull = targetState.toLowerCase(); // e.g., "virginia"
          
          // Create a much more flexible search with multiple patterns:
          conditions.push(
            or(
              // Match state abbreviation (VA) at the end of the location
              like(sql`lower(${vehicles.location})`, `%, ${stateCode}`),
              // Match state abbreviation (VA) anywhere in the location
              like(sql`lower(${vehicles.location})`, `%${stateCode}%`),
              // Match full state name (Virginia) anywhere in the location
              like(sql`lower(${vehicles.location})`, `%${stateFull}%`),
              // State-specific ZIP code patterns
              ...(targetState === 'Virginia' ? [
                // Match any vehicle with VA zip codes (starts with 20, 22, 23, 24)
                sql`${vehicles.zipCode} LIKE '20%' OR ${vehicles.zipCode} LIKE '22%' OR ${vehicles.zipCode} LIKE '23%' OR ${vehicles.zipCode} LIKE '24%'`
              ] : []),
              ...(targetState === 'Texas' ? [
                // Match any vehicle with TX zip codes (starts with 75-79, 88)
                sql`${vehicles.zipCode} LIKE '75%' OR ${vehicles.zipCode} LIKE '76%' OR ${vehicles.zipCode} LIKE '77%' OR 
                   ${vehicles.zipCode} LIKE '78%' OR ${vehicles.zipCode} LIKE '79%' OR ${vehicles.zipCode} LIKE '88%'`
              ] : []),
              ...(targetState === 'Florida' ? [
                // Match any vehicle with FL zip codes (starts with 32-34)
                sql`${vehicles.zipCode} LIKE '32%' OR ${vehicles.zipCode} LIKE '33%' OR ${vehicles.zipCode} LIKE '34%'`
              ] : []),
              // If this is a ZIP code from a known state, also match vehicles that have that state in any form in any field
              ...(zipPrefix ? [
                // Try to match the zip code directly too
                eq(vehicles.zipCode, filter.zipCode),
                // For a special case - Virginia filtering by 22102, always include vehicles from dealership 33 (Nova Autoland)
                ...(filter.zipCode === '22102' ? [
                  eq(vehicles.dealershipId, 33)
                ] : [])
              ] : []),
              // Add a fallback for any state - match vehicles with no location or empty fields
              or(
                and(
                  sql`${vehicles.location} IS NULL`,
                  sql`${vehicles.zipCode} IS NULL`
                )
              )
            )
          );
        } else {
          // If we don't have a mapping for this ZIP code, just use loose prefix matching
          conditions.push(
            // Look for vehicles with matching ZIP code prefix
            like(vehicles.zipCode, zipPrefix + '%')
          );
        }
        
        // Give priority to exact ZIP code matches in the sorting
        if (!filter.sortBy) {
          // Add custom sorting to prioritize ZIP matches (if we have vehicle ZIP codes)
          const zipMatchPriority = sql`
            CASE 
              WHEN ${vehicles.zipCode} = ${filter.zipCode} THEN 4
              WHEN ${vehicles.zipCode} LIKE ${filter.zipCode.substring(0, 3) + '%'} THEN 3
              WHEN ${vehicles.zipCode} LIKE ${filter.zipCode.substring(0, 2) + '%'} THEN 2
              ELSE 1
            END
          `;
          
          // Will be used in the ordering section below
          filter.zipMatchPriority = zipMatchPriority;
        }
      } // Close the else branch for ZIP code handling
      } // Close the ZIP code filter
      
      // Apply conditions to both queries
      if (conditions.length > 0) {
        const whereCondition = and(...conditions);
        query = query.where(whereCondition);
        countQuery.where(whereCondition);
      }
      
      // Special behavior for BMW filtering - always put Nine Stars BMW at the top
      const isBmwSearch = filter.make && filter.make.length === 1 && filter.make[0] === 'BMW';
      
      // Apply sorting
      if (isBmwSearch) {
        // For BMW searches, prioritize Nine Stars dealership (ID 26) vehicles
        query = query.orderBy(
          sql`CASE WHEN dealership_id = 26 THEN 1 ELSE 0 END DESC`,
          desc(vehicles.year),
          desc(vehicles.sortOrder)
        );
      } else if (filter.sortBy) {
        switch (filter.sortBy) {
          case 'price_low':
            query = query.orderBy(asc(vehicles.price));
            break;
          case 'price_high':
            query = query.orderBy(desc(vehicles.price));
            break;
          case 'year_new':
            query = query.orderBy(desc(vehicles.year));
            break;
          case 'mileage_low':
            query = query.orderBy(asc(vehicles.mileage));
            break;
          default:
            // relevance - use random sort order as primary factor 
            query = query.orderBy(desc(vehicles.sortOrder));
            break;
        }
      } else if (filter.zipMatchPriority) {
        // Priority sorting for ZIP code filtered results
        query = query.orderBy(
          filter.zipMatchPriority, // Give priority to exact ZIP matches
          desc(vehicles.sortOrder),
          desc(vehicles.createdAt)
        );
      } else {
        // Default sorting: use random sort order first, then creation date
        query = query.orderBy(desc(vehicles.sortOrder), desc(vehicles.createdAt));
      }
      
      // Get total count
      const [totalResult] = await countQuery;
      let totalCount = Number(totalResult?.count || 0);
      
      // Apply pagination
      const page = filter.page || 1;
      const limit = filter.limit || 12;
      const offset = (page - 1) * limit;
      
      query = query.limit(limit).offset(offset);
      
      // Execute query
      let vehicleResults = await query;
      
      // If we have a make filter, log the makes of the returned vehicles to see if they match
      if (filter.make && filter.make.length > 0) {
        console.log('Filter requested makes:', JSON.stringify(filter.make));
        console.log('Returned vehicles makes:', JSON.stringify(vehicleResults.map(v => v.make)));
      }
      
      // No additional post-query filtering needed anymore since we use state-based filtering
      
      return {
        vehicles: vehicleResults,
        totalCount: totalCount
      };
    } catch (error) {
      console.error("Error searching vehicles:", error);
      return { vehicles: [], totalCount: 0 };
    }
  }

  async updateVehicle(id: number, data: Partial<Vehicle>): Promise<Vehicle | undefined> {
    try {
      const [updatedVehicle] = await db
        .update(vehicles)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(vehicles.id, id))
        .returning();
      return updatedVehicle;
    } catch (error) {
      console.error("Error updating vehicle:", error);
      return undefined;
    }
  }

  async deleteVehicle(id: number): Promise<void> {
    try {
      const vehicle = await this.getVehicle(id);
      if (vehicle) {
        await db.delete(vehicles).where(eq(vehicles.id, id));
        
        // Update vehicle count for dealership
        const dealership = await this.getDealership(vehicle.dealershipId);
        if (dealership && dealership.vehicleCount > 0) {
          await this.updateDealership(dealership.id, {
            vehicleCount: dealership.vehicleCount - 1
          });
        }
      }
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      throw error;
    }
  }

  async deleteVehiclesByDealershipId(dealershipId: number): Promise<void> {
    try {
      await db.delete(vehicles).where(eq(vehicles.dealershipId, dealershipId));
      
      // Reset vehicle count for dealership
      await this.updateDealership(dealershipId, { vehicleCount: 0 });
    } catch (error) {
      console.error("Error deleting vehicles by dealership ID:", error);
      throw error;
    }
  }

  async getVehiclesByDealershipId(dealershipId: number): Promise<Vehicle[]> {
    try {
      return await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.dealershipId, dealershipId));
    } catch (error) {
      console.error("Error getting vehicles by dealership ID:", error);
      return [];
    }
  }
  
  async getAllVehicles(): Promise<Vehicle[]> {
    try {
      // Fetch all vehicles, limit to 200 to prevent performance issues
      return await db
        .select()
        .from(vehicles)
        .limit(200);
    } catch (error) {
      console.error("Error getting all vehicles:", error);
      return [];
    }
  }

  async bulkCreateVehicles(insertVehicles: InsertVehicle[]): Promise<Vehicle[]> {
    try {
      if (insertVehicles.length === 0) return [];
      
      const createdVehicles: Vehicle[] = [];
      
      // We'll process in batches to avoid potential issues with large sets
      const batchSize = 50;
      for (let i = 0; i < insertVehicles.length; i += batchSize) {
        const batch = insertVehicles.slice(i, i + batchSize);
        
        // Process each vehicle in the batch
        for (const insertVehicle of batch) {
          const vehicle = await this.createVehicle(insertVehicle);
          createdVehicles.push(vehicle);
        }
      }
      
      return createdVehicles;
    } catch (error) {
      console.error("Error bulk creating vehicles:", error);
      throw error;
    }
  }
  
  // Analytics operations
  async trackContactClick(vehicleId: number): Promise<void> {
    try {
      // Check if the vehicle exists
      const vehicle = await this.getVehicle(vehicleId);
      if (vehicle) {
        // Store click in the database
        await db.insert(contactClicks).values({
          vehicleId: vehicleId,
          clickType: 'contact'
        });
        
        // Update in-memory counter for backward compatibility
        this.contactClicks++;
      }
    } catch (error) {
      console.error("Error tracking contact click:", error);
    }
  }
  
  async trackVehicleViewClick(vehicleId: number): Promise<void> {
    try {
      // Check if the vehicle exists
      const vehicle = await this.getVehicle(vehicleId);
      if (vehicle) {
        // Store click in the database
        await db.insert(contactClicks).values({
          vehicleId: vehicleId,
          clickType: 'view'
        });
      }
    } catch (error) {
      console.error("Error tracking vehicle view click:", error);
    }
  }
  
  async getVehicleViewCounts(): Promise<Record<number, number>> {
    try {
      // Group by vehicleId and count where clickType = 'view'
      const results = await db
        .select({
          vehicleId: contactClicks.vehicleId,
          count: count(contactClicks.id)
        })
        .from(contactClicks)
        .where(eq(contactClicks.clickType, 'view'))
        .groupBy(contactClicks.vehicleId);
      
      // Convert to map of vehicleId -> count
      const viewCounts: Record<number, number> = {};
      for (const result of results) {
        viewCounts[result.vehicleId] = Number(result.count);
      }
      
      return viewCounts;
    } catch (error) {
      console.error("Error getting vehicle view counts:", error);
      return {};
    }
  }
  
  async getContactClickCount(): Promise<number> {
    try {
      // Get the count from the database
      const result = await db.select({ count: count() }).from(contactClicks);
      const dbCount = result[0]?.count || 0;
      
      // Update the in-memory counter to match the database
      this.contactClicks = Number(dbCount);
      
      return this.contactClicks;
    } catch (error) {
      console.error("Error getting contact click count:", error);
      // Fallback to in-memory counter if database query fails
      return this.contactClicks;
    }
  }
  
  // Method for manual vehicle addition
  async addVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    try {
      // Reuse existing createVehicle method
      return this.createVehicle(insertVehicle);
    } catch (error) {
      console.error("Error adding vehicle:", error);
      throw error;
    }
  }
  
  // Update the vehicle count for a dealership
  async updateDealershipVehicleCount(dealershipId: number): Promise<void> {
    try {
      // Count vehicles for this dealership
      const [result] = await db
        .select({ count: count() })
        .from(vehicles)
        .where(eq(vehicles.dealershipId, dealershipId));
      
      const vehicleCount = result?.count || 0;
      
      // Update the dealership record
      await db
        .update(dealerships)
        .set({ vehicleCount, lastSynced: new Date() })
        .where(eq(dealerships.id, dealershipId));
      
    } catch (error) {
      console.error(`Error updating vehicle count for dealership ${dealershipId}:`, error);
      throw error;
    }
  }
  
  async getContactClicksHistory(): Promise<any[]> {
    try {
      // First get all the contact clicks
      const clickResults = await db
        .select()
        .from(contactClicks)
        .orderBy(desc(contactClicks.timestamp))
        .limit(50);
      
      // Create a list of all results with full vehicle info
      const resultPromises = clickResults.map(async (click) => {
        // Try to get the vehicle from database
        const vehicle = await this.getVehicle(click.vehicleId);
        
        if (vehicle) {
          // Vehicle exists, use its information
          return {
            id: click.id,
            vehicleId: click.vehicleId,
            timestamp: click.timestamp,
            title: vehicle.title,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            dealershipId: vehicle.dealershipId
          };
        } else {
          // Vehicle doesn't exist (was likely deleted)
          // Try to construct a useful display from vehicle ID format patterns
          // e.g., Some dealerships use ID formats like: MAKE-MODEL-YEAR-ID
          const vehicleIdStr = click.vehicleId.toString();
          let estimatedMake = "Unknown";
          let estimatedModel = "Unknown";
          let estimatedYear = null;
          
          // Extract info from the original vehicleId if possible using common patterns
          if (vehicleIdStr.length > 4) {
            // Extract year if it looks like there's a 4-digit year in the ID (2000-2025)
            const yearMatch = vehicleIdStr.match(/20\d\d/);
            if (yearMatch) {
              estimatedYear = parseInt(yearMatch[0]);
            } 
          }
          
          return {
            id: click.id,
            vehicleId: click.vehicleId,
            timestamp: click.timestamp,
            title: `Vehicle #${click.vehicleId}`, 
            make: estimatedMake,
            model: estimatedModel,
            year: estimatedYear,
            dealershipId: null
          };
        }
      });
      
      // Resolve all promises
      return Promise.all(resultPromises);
    } catch (error) {
      console.error("Error getting contact clicks history:", error);
      return [];
    }
  }
  
  // Location operations
  async getUniqueLocationCombinations(): Promise<{ location: string }[]> {
    try {
      // Get all unique non-null locations from the vehicles table
      // and return in a format that can be used for a dropdown
      const locationsResult = await db
        .select({ location: vehicles.location })
        .from(vehicles)
        .where(
          and(
            sql`${vehicles.location} IS NOT NULL`,
            sql`TRIM(${vehicles.location}) != ''`
          )
        )
        .groupBy(vehicles.location)
        .orderBy(vehicles.location);
      
      // Filter out empty locations and trim any extra whitespace
      const validLocations = locationsResult
        .filter(item => item.location !== null && item.location !== undefined)
        .filter(item => item.location && item.location.trim() !== '')
        .map(item => ({ location: item.location!.trim() }));
      
      // Sort by state, then city (format is typically "City, State")
      return validLocations.sort((a, b) => {
        const aParts = a.location.split(',');
        const bParts = b.location.split(',');
        
        // Get state part (after comma) or empty string if no comma
        const aState = aParts.length > 1 ? aParts[1].trim() : '';
        const bState = bParts.length > 1 ? bParts[1].trim() : '';
        
        // Sort by state first
        if (aState !== bState) {
          return aState.localeCompare(bState);
        }
        
        // If states are the same, sort by city
        const aCity = aParts[0].trim();
        const bCity = bParts[0].trim();
        return aCity.localeCompare(bCity);
      });
    } catch (error) {
      console.error("Error getting unique location combinations:", error);
      return [];
    }
  }
  
  // Site settings operations
  async getSetting(key: string): Promise<SiteSetting | undefined> {
    try {
      const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
      return setting;
    } catch (error) {
      console.error(`Error getting setting for key ${key}:`, error);
      return undefined;
    }
  }
  
  async getSettingValue(key: string, defaultValue: string = ''): Promise<string> {
    try {
      const setting = await this.getSetting(key);
      return setting ? setting.value : defaultValue;
    } catch (error) {
      console.error(`Error getting setting value for key ${key}:`, error);
      return defaultValue;
    }
  }
  
  async getAllSettings(): Promise<SiteSetting[]> {
    try {
      return await db.select().from(siteSettings);
    } catch (error) {
      console.error("Error getting all settings:", error);
      return [];
    }
  }
  
  async updateSetting(key: string, value: string, description?: string): Promise<SiteSetting | undefined> {
    try {
      // Check if setting exists
      const existingSetting = await this.getSetting(key);
      const now = new Date();
      
      if (existingSetting) {
        // Update existing setting
        const updateData: Partial<SiteSetting> = { 
          value,
          updatedAt: now
        };
        
        if (description) {
          updateData.description = description;
        }
        
        const [updatedSetting] = await db
          .update(siteSettings)
          .set(updateData)
          .where(eq(siteSettings.key, key))
          .returning();
        
        return updatedSetting;
      } else {
        // Create new setting
        const settingData = {
          key,
          value,
          description: description || `Setting for ${key}`,
          updatedAt: now
        };
        
        const [newSetting] = await db
          .insert(siteSettings)
          .values(settingData)
          .returning();
        
        return newSetting;
      }
    } catch (error) {
      console.error(`Error updating setting for key ${key}:`, error);
      return undefined;
    }
  }
}

export const storage = new DatabaseStorage();
