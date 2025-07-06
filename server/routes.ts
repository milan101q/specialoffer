import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { scheduler } from "./scheduler";
import { scrapeDealership } from "./scraper";
import { ScreenshotService } from "./screenshot-service";
import { VehicleArchiver } from "./vehicle-archive";
import { VehicleCardImageService } from "./screenshot-utils";
import { logger } from "@shared/logger";
import path from "path";
import fs from "fs";
import { parse } from "csv-parse";
import {
  insertDealershipSchema,
  insertVehicleSchema,
  vehicleFilterSchema,
  InsertVehicle,
  Dealership
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

/**
 * Detects if the request is from a social media bot/crawler
 */
function isSocialMediaCrawler(userAgent: string): boolean {
  const socialBots = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'Pinterest',
    'LinkedInBot',
    'WhatsApp',
    'Slackbot',
    'TelegramBot',
    'Discordbot',
    'googlebot',
    'bingbot',
    'yandex',
    'baiduspider'
  ];
  
  const lowerUA = userAgent.toLowerCase();
  return socialBots.some(bot => lowerUA.includes(bot.toLowerCase()));
}

/**
 * Generate Open Graph meta tags for a vehicle
 */
async function generateVehicleOpenGraphHtml(vehicleId: string, host: string): Promise<string> {
  let vehicle;
  
  // If it looks like a VIN (contains letters)
  if (/[a-zA-Z]/.test(vehicleId) && vehicleId.length >= 10) {
    vehicle = await storage.getVehicleByVin(vehicleId);
  } else {
    // Try to parse as numeric ID
    const numericId = parseInt(vehicleId, 10);
    vehicle = await storage.getVehicle(numericId);
  }
  
  if (!vehicle) {
    return '<!DOCTYPE html><html><head><title>Vehicle Not Found | SpecialOffer.Autos</title></head><body>Vehicle not found</body></html>';
  }
  
  // Get dealership info for location data
  const dealership = await storage.getDealership(vehicle.dealershipId);
  
  // Format vehicle details for meta tags
  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model || ''}`.toString().trim();
  const price = vehicle.price ? new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(vehicle.price) : 'Price on request';
  
  const location = vehicle.location || (dealership ? dealership.location : '');
  const description = `${vehicleTitle} with ${vehicle.mileage.toLocaleString()} miles, priced at ${price}${location ? `, located in ${location}` : ''}. Available at SpecialOffer.Autos.`;
  
  // Find the best image from the vehicle images
  let mainImage = '';
  if (vehicle.images && vehicle.images.length > 0) {
    // Try to find an image that's not a logo or SVG placeholder
    const bestImage = vehicle.images.find(img => 
      !img.includes('logo') && 
      !img.includes('banner') && 
      !img.startsWith('data:image/svg+xml')
    ) || vehicle.images[0];
    
    // Ensure the image URL is absolute
    if (bestImage.startsWith('http')) {
      mainImage = bestImage;
    } else if (bestImage) {
      // For relative URLs, convert to absolute using the production domain
      // We add host here so it works in both production and dev
      const baseUrl = host.includes('replit.dev')
        ? `https://${host}`
        : 'https://specialoffer.autos';
        
      mainImage = `${baseUrl}${bestImage.startsWith('/') ? '' : '/'}${bestImage}`;
    }
  }
  
  // Return the HTML with Open Graph meta tags
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${vehicleTitle} | SpecialOffer.Autos</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="product">
  <meta property="og:url" content="https://specialoffer.autos/vehicles/${vehicle.vin || vehicle.id}">
  <meta property="og:title" content="${vehicleTitle} | SpecialOffer.Autos">
  <meta property="og:description" content="${description}">
  ${mainImage ? `<meta property="og:image" content="${mainImage}">` : ''}
  <meta property="og:site_name" content="SpecialOffer.Autos">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://specialoffer.autos/vehicles/${vehicle.vin || vehicle.id}">
  <meta property="twitter:title" content="${vehicleTitle} | SpecialOffer.Autos">
  <meta property="twitter:description" content="${description}">
  ${mainImage ? `<meta property="twitter:image" content="${mainImage}">` : ''}
  
  <!-- Redirect browser users to the SPA -->
  <meta http-equiv="refresh" content="0;url=/vehicles/${vehicle.vin || vehicle.id}">
</head>
<body>
  <p>Redirecting to <a href="/vehicles/${vehicle.vin || vehicle.id}">vehicle details</a>...</p>
</body>
</html>`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up static file serving for temporary files in the /tmp directory
  const tmpDir = path.join(process.cwd(), 'tmp');
  logger.info(`Setting up static file serving for /files from ${tmpDir}`);
  app.use('/files', express.static(tmpDir));
  
  // Set up static file serving for vehicle uploads
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  logger.info(`Setting up static file serving for /uploads from ${uploadsDir}`);
  app.use('/uploads', express.static(uploadsDir));
  
  // Configure session storage with more robust error handling
  const SessionStore = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'auto-hub-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, 
      maxAge: 24 * 60 * 60 * 1000,  // 24 hours
      httpOnly: true,
      sameSite: 'lax'
    },
    store: new SessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    // Add robust error handling for session deserialization failures
    unset: 'destroy'
  }));
  
  // Add error handling middleware specifically for session issues
  app.use((req, res, next) => {
    if (req.session.regenerate) {
      const originalRegenerate = req.session.regenerate;
      req.session.regenerate = function(callback) {
        if (typeof callback !== 'function') {
          return originalRegenerate.call(this);
        }
        return originalRegenerate.call(this, function(err) {
          if (err) {
            logger.error('Session regeneration error:', err);
          }
          return callback(err);
        });
      };
    }
    next();
  });

  // Configure passport
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: 'Incorrect username' });
      }
      if (user.password !== password) { // In a real app, you'd use bcrypt to compare
        return done(null, false, { message: 'Incorrect password' });
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Setup multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  });
  
  // Multer with CSV file filter
  const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (_req, file, cb) => {
      // Accept only CSV files
      if (file.mimetype === 'text/csv' || 
          file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    }
  });

  // Authentication middleware
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
  };
  
  // Add cache control middleware for API responses to improve performance
  app.use('/api', (req, res, next) => {
    // For GET requests that retrieve data (except for auth routes), enable caching
    if (req.method === 'GET' && !req.path.includes('/auth/')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes with revalidation
      res.setHeader('Vary', 'Accept-Encoding, Authorization'); // Vary header for proper caching
    } else {
      // For POST/PUT/DELETE and auth routes, disable caching for security
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Cache the vehicles API endpoint more aggressively for better performance
  app.use('/api/vehicles', (req, res, next) => {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800'); // 10 minutes with 30 min stale allowance
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Start the inventory sync scheduler
  scheduler.start();

  // API Routes
  // Authentication
  app.post('/api/auth/login', passport.authenticate('local'), (req, res) => {
    console.log('User authenticated:', req.user);
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ isAuthenticated: true, user: req.user });
    } else {
      res.json({ isAuthenticated: false });
    }
  });

  // Dealership routes
  app.get('/api/dealerships', isAuthenticated, async (_req, res) => {
    try {
      const dealerships = await storage.getAllDealerships();
      res.json(dealerships);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/dealerships', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertDealershipSchema.parse(req.body);
      
      // Check if dealership already exists
      const existing = await storage.getDealershipByUrl(validatedData.url);
      if (existing) {
        return res.status(409).json({ message: 'Dealership with this URL already exists' });
      }
      
      // Extract name from URL if not provided
      if (!validatedData.name) {
        const urlObj = new URL(validatedData.url);
        const hostname = urlObj.hostname; 
        // Remove www. and .com/.net/etc
        const name = hostname
          .replace(/^www\./, '')
          .replace(/\.(com|net|org|co|io|auto|cars|biz)$/, '')
          .split('.')
          .join(' ')
          .split('-')
          .join(' ')
          .split('_')
          .join(' ');
        
        // Capitalize each word
        validatedData.name = name
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      
      // Process ZIP code and set formatted location if available
      if (validatedData.zipCode) {
        // Convert from ZIP code to city, state format. This could be expanded
        // to use an actual geocoding API, but for now we'll use a simple mapping
        // for common localities in the demo.
        const zipLocationMap: Record<string, string> = {
          '20151': 'Chantilly, VA',
          '20152': 'Chantilly, VA',
          '22314': 'Alexandria, VA',
          '22102': 'McLean, VA',
          '22043': 'Falls Church, VA',
          '22046': 'Falls Church, VA',
          '22101': 'McLean, VA',
          '22180': 'Vienna, VA',
          '22182': 'Vienna, VA',
          '20170': 'Herndon, VA',
          '20171': 'Herndon, VA',
          '20190': 'Reston, VA',
          '20191': 'Reston, VA',
        };
        
        // Set the formatted location if we have a match
        if (zipLocationMap[validatedData.zipCode]) {
          validatedData.location = zipLocationMap[validatedData.zipCode];
        }
      }
      
      const dealership = await storage.createDealership(validatedData);
      
      // Start scraping in background
      setTimeout(() => {
        scheduler.syncDealership(dealership.id).catch(error => {
          console.error(`Background sync failed for dealership ${dealership.id}:`, error);
        });
      }, 0);
      
      res.status(201).json(dealership);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: (error as Error).message });
      }
    }
  });

  app.get('/api/dealerships/:id', isAuthenticated, async (req, res) => {
    try {
      const dealership = await storage.getDealership(parseInt(req.params.id, 10));
      if (!dealership) {
        return res.status(404).json({ message: 'Dealership not found' });
      }
      res.json(dealership);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete('/api/dealerships/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const dealership = await storage.getDealership(id);
      if (!dealership) {
        return res.status(404).json({ message: 'Dealership not found' });
      }
      
      await storage.deleteDealership(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/dealerships/:id/sync', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const dealership = await storage.getDealership(id);
      if (!dealership) {
        return res.status(404).json({ message: 'Dealership not found' });
      }

      // Check if dealership is expired
      const now = new Date();
      if (dealership.expirationDate && new Date(dealership.expirationDate) < now) {
        return res.status(403).json({ 
          success: false,
          message: 'Cannot sync expired dealership',
          status: 'expired',
          dealership
        });
      }
      
      // Set dealership as syncing in response
      res.status(202).json({ 
        success: true, 
        message: 'Sync process started',
        status: 'syncing',
        dealership: {
          ...dealership,
          syncStatus: 'syncing'
        }
      });

      // Then start the sync process
      scheduler.syncDealership(id).catch(error => {
        console.error(`Manual sync failed for dealership ${id}:`, error);
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: (error as Error).message,
        status: 'error'
      });
    }
  });
  
  // Update a dealership's URL and other settings
  app.patch('/api/dealerships/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { url, zipCode, additional_urls } = req.body;
      const updateData: Partial<Dealership> = {};
      
      // Handle URL updates
      if (url !== undefined) {
        if (!url || typeof url !== 'string') {
          return res.status(400).json({ message: 'Valid URL is required' });
        }
        
        // Validate URL format
        try {
          new URL(url);
          updateData.url = url;
        } catch (e) {
          return res.status(400).json({ message: 'Invalid URL format' });
        }
      }
      
      // Handle additional URLs updates
      if (additional_urls !== undefined) {
        if (!Array.isArray(additional_urls)) {
          return res.status(400).json({ message: 'Additional URLs must be an array' });
        }
        
        // Validate each URL in the array
        for (const additionalUrl of additional_urls) {
          if (additionalUrl && typeof additionalUrl === 'string') {
            try {
              new URL(additionalUrl);
            } catch (e) {
              return res.status(400).json({ 
                message: `Invalid URL format in additional URLs: ${additionalUrl}` 
              });
            }
          }
        }
        
        // Remove any empty strings from the array
        const filteredUrls = additional_urls.filter(url => url && url.trim() !== '');
        updateData.additionalUrls = filteredUrls;
      }
      
      // Handle ZIP code updates
      if (zipCode !== undefined) {
        if (zipCode && typeof zipCode === 'string') {
          // Validate ZIP code format
          if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
            return res.status(400).json({ message: 'Invalid ZIP code format (must be 12345 or 12345-6789)' });
          }
          
          updateData.zipCode = zipCode;
          
          // Update location based on ZIP code
          const zipLocationMap: Record<string, string> = {
            '20151': 'Chantilly, VA',
            '20152': 'Chantilly, VA',
            '22314': 'Alexandria, VA',
            '22102': 'McLean, VA',
            '22043': 'Falls Church, VA',
            '22046': 'Falls Church, VA',
            '22101': 'McLean, VA',
            '22180': 'Vienna, VA',
            '22182': 'Vienna, VA',
            '20170': 'Herndon, VA',
            '20171': 'Herndon, VA',
            '20190': 'Reston, VA',
            '20191': 'Reston, VA',
            '75075': 'Plano, TX',
            '20919': 'Silver Spring, MD',
          };
          
          // Update location if we have a match for the ZIP code
          if (zipLocationMap[zipCode]) {
            updateData.location = zipLocationMap[zipCode];
          }
        } else if (zipCode === '') {
          // Allow clearing the ZIP code
          updateData.zipCode = null;
        }
      }
      
      // Return early if no updates were provided
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No valid updates provided' });
      }
      
      const dealership = await storage.getDealership(id);
      if (!dealership) {
        return res.status(404).json({ message: 'Dealership not found' });
      }
      
      const updatedDealership = await storage.updateDealership(id, updateData);
      
      if (!updatedDealership) {
        return res.status(500).json({ message: 'Failed to update dealership' });
      }
      
      // If location, zipCode or additionalUrls were updated, trigger a sync
      if (updateData.location || updateData.zipCode !== undefined || updateData.additionalUrls !== undefined) {
        // Start the sync process in the background, don't await it
        if (updateData.additionalUrls !== undefined) {
          console.log(`Additional URLs updated for ${updatedDealership.name}, triggering sync...`);
          console.log(`New additional URLs: ${JSON.stringify(updateData.additionalUrls)}`);
        } else {
          console.log(`Location or ZIP code updated for ${updatedDealership.name}, triggering sync...`);
        }
        
        scheduler.syncDealership(id).catch(error => {
          console.error(`Sync after dealership update failed for dealership ${id}:`, error);
        });
      }
      
      res.json(updatedDealership);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Renew a dealership's subscription
  app.post('/api/dealerships/:id/renew', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const days = req.body.days || 30; // Default to 30 days if not specified
      
      const dealership = await storage.getDealership(id);
      if (!dealership) {
        return res.status(404).json({ message: 'Dealership not found' });
      }
      
      const renewedDealership = await storage.renewDealership(id, days);
      
      res.json({ 
        success: true, 
        message: 'Dealership subscription renewed successfully',
        dealership: renewedDealership
      });
    } catch (error) {
      console.error('Error renewing dealership:', error);
      res.status(500).json({ message: 'Error renewing dealership subscription', error: (error as Error).message });
    }
  });

  // CSV Upload for inventory
  app.post('/api/dealerships/:id/upload', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const dealershipId = parseInt(req.params.id, 10);
      const dealership = await storage.getDealership(dealershipId);
      if (!dealership) {
        return res.status(404).json({ message: 'Dealership not found' });
      }

      // Parse CSV data
      const vehicles: InsertVehicle[] = [];
      const fileContent = req.file.buffer.toString('utf8');
      
      // Create parser
      const parser = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      // Process CSV records
      for await (const record of parser) {
        try {
          // Convert CSV fields to vehicle object
          const vehicle: InsertVehicle = {
            title: record.title || `${record.year} ${record.make} ${record.model}`,
            year: parseInt(record.year, 10),
            make: record.make,
            model: record.model,
            price: parseInt(record.price, 10),
            mileage: parseInt(record.mileage, 10),
            vin: record.vin,
            location: record.location || '',
            zipCode: record.zipCode || record.zip || '',
            dealershipId,
            images: record.images ? record.images.split(',').map((url: string) => url.trim()) : 
                   [`https://via.placeholder.com/640x480.png?text=${encodeURIComponent(record.make + ' ' + record.model)}`],
            carfaxUrl: record.carfaxUrl || record.carfax_url || undefined,
            originalListingUrl: record.originalListingUrl || record.url || 
                              `${dealership.url}/inventory/${record.vin}`
          };
          
          // Validate vehicle data
          const validatedVehicle = insertVehicleSchema.parse(vehicle);
          vehicles.push(validatedVehicle);
        } catch (error) {
          console.error('Error processing CSV record:', error, record);
          // Continue with next record
        }
      }

      if (vehicles.length === 0) {
        return res.status(400).json({ message: 'No valid vehicle records found in CSV' });
      }

      // Store vehicles
      const addedVehicles = await storage.bulkCreateVehicles(vehicles);
      
      // Update dealership
      await storage.updateDealership(dealershipId, {
        lastSynced: new Date(),
        status: 'active'
      });

      res.json({ 
        success: true, 
        message: `Uploaded ${addedVehicles.length} vehicles`, 
        count: addedVehicles.length 
      });
    } catch (error) {
      console.error('Error processing CSV upload:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Vehicle routes
  // API endpoint to get all unique city/state combinations from the inventory
  app.get('/api/locations', async (_req, res) => {
    try {
      // Get unique locations from vehicles and arrange them alphabetically
      const locations = await storage.getUniqueLocationCombinations();
      res.json(locations);
    } catch (error) {
      console.error('Error fetching location combinations:', error);
      res.status(500).json({ message: 'Error fetching locations', error: (error as Error).message });
    }
  });
  
  app.get('/api/vehicles', async (req, res) => {
    try {
      const queryParams = req.query;
      
      // Debug incoming request query parameters
      console.log('Incoming query params:', JSON.stringify(queryParams));
      
      // Convert query params to filter object
      const filter: Record<string, any> = {
        page: queryParams.page ? parseInt(queryParams.page as string, 10) : 1,
        limit: queryParams.limit ? parseInt(queryParams.limit as string, 10) : 12
      };
      
      // Handle search keyword
      if (queryParams.keyword) {
        filter.keyword = queryParams.keyword as string;
      }
      
      // Handle make filter (could be array)
      if (queryParams.make) {
        const makeParam = queryParams.make;
        filter.make = Array.isArray(makeParam) 
          ? makeParam 
          : [makeParam as string];
        
        // Debug make filter
        console.log('Make filter applied:', JSON.stringify(filter.make));
      }
      
      // Handle numeric range filters
      if (queryParams.yearMin) filter.yearMin = parseInt(queryParams.yearMin as string, 10);
      if (queryParams.yearMax) filter.yearMax = parseInt(queryParams.yearMax as string, 10);
      if (queryParams.priceMin) filter.priceMin = parseInt(queryParams.priceMin as string, 10);
      if (queryParams.priceMax) filter.priceMax = parseInt(queryParams.priceMax as string, 10);
      if (queryParams.mileageMin) filter.mileageMin = parseInt(queryParams.mileageMin as string, 10);
      if (queryParams.mileageMax) filter.mileageMax = parseInt(queryParams.mileageMax as string, 10);
      
      // Handle location filters
      if (queryParams.zipCode) filter.zipCode = queryParams.zipCode as string;
      if (queryParams.distance) filter.distance = parseInt(queryParams.distance as string, 10);
      if (queryParams.location) filter.location = queryParams.location as string;
      if (queryParams.dealershipId) filter.dealershipId = parseInt(queryParams.dealershipId as string, 10);
      
      // Handle sorting
      if (queryParams.sortBy) {
        filter.sortBy = queryParams.sortBy as string;
      }
      
      // For dealership filtering, add debug logging
      if (queryParams.dealershipId) {
        console.log(`Filtering by dealership ID: ${queryParams.dealershipId}`);
      }
      
      // Validate the filter
      const validatedFilter = vehicleFilterSchema.parse(filter);
      console.log('Validated filter:', JSON.stringify(validatedFilter));
      
      // Get search results
      const { vehicles: allVehicles, totalCount } = await storage.searchVehicles(validatedFilter);
      
      // Save the original total count before filtering
      const originalTotalCount = totalCount;
      
      // Filter out problematic vehicle IDs (2, 14, and 4646 - Honda Pilot)
      const filteredVehicles = allVehicles.filter(vehicle => 
        vehicle.id !== 2 && 
        vehicle.id !== 14 && 
        vehicle.id !== 4646 && 
        vehicle.vin !== "2HKYF18545H532952"
      );
      
      // Enhance vehicles with dealership information
      const enhancedVehicles = await Promise.all(filteredVehicles.map(async (vehicle) => {
        const dealership = await storage.getDealership(vehicle.dealershipId);
        return {
          ...vehicle,
          dealership: dealership ? {
            id: dealership.id,
            name: dealership.name,
            location: vehicle.location // Using vehicle.location as it should already contain city, state
          } : { name: 'Unknown Dealership' }
        };
      }));
      
      // Keep track of how many vehicles we've filtered out
      const filteredOut = allVehicles.length - filteredVehicles.length;
      
      // Use the original total count, but subtract the number of filtered vehicles
      const adjustedTotalCount = originalTotalCount - filteredOut;
      
      // Ensure we're sending the correct page information
      const page = validatedFilter.page || 1;
      const limit = validatedFilter.limit || 12;
      const totalPages = Math.ceil(adjustedTotalCount / limit);
      
      console.log(`Responding with page ${page} of ${totalPages} (${enhancedVehicles.length} vehicles, total: ${adjustedTotalCount})`);
      
      res.json({
        vehicles: enhancedVehicles,
        totalCount: adjustedTotalCount,
        currentPage: page,
        totalPages: totalPages
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: (error as Error).message });
      }
    }
  });

  // Get vehicle by ID (legacy approach)
  app.get('/api/vehicles/:id', async (req, res) => {
    try {
      // Check if the param is a VIN (alphanumeric) or an ID (numeric)
      const param = req.params.id;
      let vehicle;
      
      // If it looks like a VIN (contains letters)
      if (/[a-zA-Z]/.test(param) && param.length >= 10) {
        vehicle = await storage.getVehicleByVin(param);
      } else {
        // Try to parse as numeric ID
        const id = parseInt(param, 10);
        
        // Skip problematic IDs 2, 14, and 4646 (Honda Pilot) and redirect to ID 1
        if (id === 2 || id === 14 || id === 4646) {
          return res.redirect('/api/vehicles/1');
        }
        
        vehicle = await storage.getVehicle(id);
      }
      
      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }
      
      // Get dealership info
      const dealership = await storage.getDealership(vehicle.dealershipId);
      
      res.json({
        ...vehicle,
        dealership: dealership 
          ? { 
              id: dealership.id, 
              name: dealership.name,
              location: vehicle.location // Use vehicle location since it should contain city, state
            } 
          : { name: 'Unknown Dealership' }
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Track contact click for a vehicle
  app.post('/api/vehicles/:id/track-contact', async (req, res) => {
    try {
      const param = req.params.id;
      let vehicle;
      
      // If it looks like a VIN (contains letters)
      if (/[a-zA-Z]/.test(param) && param.length >= 10) {
        vehicle = await storage.getVehicleByVin(param);
      } else {
        // Try to parse as numeric ID
        const vehicleId = parseInt(param, 10);
        vehicle = await storage.getVehicle(vehicleId);
      }
      
      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }
      
      // Track the contact click
      await storage.trackContactClick(vehicle.id);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Dashboard Stats
  app.get('/api/stats', isAuthenticated, async (_req, res) => {
    try {
      const dealerships = await storage.getAllDealerships();
      
      // Calculate total vehicles
      const totalVehicles = dealerships.reduce((sum, dealer) => sum + dealer.vehicleCount, 0);
      
      // Get most recent sync time
      const lastSynced = dealerships.length > 0 
        ? dealerships.reduce((latest, dealer) => {
            return dealer.lastSynced && (!latest || dealer.lastSynced > latest) 
              ? dealer.lastSynced 
              : latest;
          }, null as Date | null)
        : null;
      
      // Get actual contact clicks count
      const contactClicks = await storage.getContactClickCount();
      
      // Get vehicle view counts
      const vehicleViewCounts = await storage.getVehicleViewCounts();
      const totalViewClicks = Object.values(vehicleViewCounts).reduce((sum, count) => sum + count, 0);
      
      res.json({
        totalDealerships: dealerships.length,
        totalVehicles,
        contactClicks,
        viewClicks: totalViewClicks,
        lastSynced,
        vehicleViewCounts
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Get contact clicks history for admin analytics
  app.get('/api/contact-clicks', isAuthenticated, async (_req, res) => {
    try {
      const contactClicksHistory = await storage.getContactClicksHistory();
      res.json(contactClicksHistory);
    } catch (error) {
      console.error("Error fetching contact clicks history:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Track vehicle view clicks
  app.post('/api/vehicles/:id/track-view', async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id, 10);
      if (isNaN(vehicleId)) {
        return res.status(400).json({ message: 'Invalid vehicle ID' });
      }
      
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }
      
      // Track the view click
      await storage.trackVehicleViewClick(vehicleId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking vehicle view click:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Get vehicle view counts for admin analytics
  app.get('/api/vehicle-view-counts', isAuthenticated, async (_req, res) => {
    try {
      const viewCounts = await storage.getVehicleViewCounts();
      res.json(viewCounts);
    } catch (error) {
      console.error("Error fetching vehicle view counts:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Trigger full sync for all dealerships
  app.post('/api/sync', isAuthenticated, (_req, res) => {
    try {
      scheduler.syncAllDealerships().catch(error => {
        console.error('Error during full sync:', error);
      });
      
      res.json({ success: true, message: 'Full sync initiated' });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Admin endpoint to sync a specific dealership
  app.post('/api/admin/sync-dealership', isAuthenticated, async (req, res) => {
    try {
      const { dealershipId } = req.body;
      
      if (!dealershipId || isNaN(parseInt(String(dealershipId), 10))) {
        return res.status(400).json({ error: 'Valid dealership ID is required' });
      }
      
      const id = parseInt(String(dealershipId), 10);
      const dealership = await storage.getDealership(id);
      
      if (!dealership) {
        return res.status(404).json({ error: 'Dealership not found' });
      }
      
      console.log(`Manual sync triggered for dealership ${id} (${dealership.name})`);
      
      // Optionally force a sync regardless of when the last sync was
      await storage.updateDealership(id, { lastSynced: null });
      
      // Start the sync process asynchronously
      scheduler.syncDealership(id).catch(error => {
        console.error(`Manual sync failed for dealership ${id}:`, error);
      });
      
      res.json({ 
        success: true, 
        message: `Sync process started for ${dealership.name}`,
        dealership
      });
    } catch (error) {
      console.error('Error in manual dealership sync:', error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Public test endpoints for Inspected Auto sync (TEMPORARY - FOR TESTING ONLY)
  app.get('/api/test/trigger-inspected-auto-sync', async (_req, res) => {
    try {
      // Find Inspected Auto dealership
      const dealerships = await storage.getAllDealerships();
      const inspectedAuto = dealerships.find(d => 
        d.name.toLowerCase().includes('inspected auto') || 
        (d.url && d.url.toLowerCase().includes('inspectedauto'))
      );
      
      if (!inspectedAuto) {
        return res.status(404).json({ 
          success: false,
          message: 'Inspected Auto dealership not found in the database'
        });
      }
      
      console.log(`Triggering sync for Inspected Auto (ID: ${inspectedAuto.id})`);
      
      // Reset lastSynced to force a sync regardless of when it was last synced
      await storage.updateDealership(inspectedAuto.id, { lastSynced: null });
      
      // Start the sync process
      scheduler.syncDealership(inspectedAuto.id).catch(error => {
        logger.error('Error triggering Inspected Auto sync:', error);
      });
      
      res.json({ 
        success: true, 
        message: `Sync process started for Inspected Auto (ID: ${inspectedAuto.id})`,
        dealershipId: inspectedAuto.id
      });
    } catch (error) {
      logger.error('Error triggering Inspected Auto sync:', error);
      return res.status(500).json({ message: 'Error triggering sync', error: String(error) });
    }
  });
  
  // Site Settings API Endpoints
  
  // Get all site settings
  app.get('/api/settings', async (_req, res) => {
    try {
      // Public endpoint to get public settings
      const showListDealershipButton = await storage.getSettingValue('showListDealershipButton', 'true');
      
      res.json({
        showListDealershipButton: showListDealershipButton === 'true'
      });
    } catch (error) {
      console.error("Error fetching site settings:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Get all site settings (admin)
  app.get('/api/admin/settings', isAuthenticated, async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching all site settings:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Update a site setting (admin)
  app.post('/api/admin/settings', isAuthenticated, async (req, res) => {
    try {
      const { key, value, description } = req.body;
      
      if (!key || value === undefined) {
        return res.status(400).json({ error: 'Key and value are required' });
      }
      
      const updatedSetting = await storage.updateSetting(key, value.toString(), description);
      
      if (!updatedSetting) {
        return res.status(404).json({ error: 'Setting not found or could not be updated' });
      }
      
      res.json(updatedSetting);
    } catch (error) {
      console.error("Error updating site setting:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Admin API Endpoints
  

  
  // Special endpoint to fix Automax of Chantilly mileage issues
  app.post('/api/admin/fix-automax-mileage', isAuthenticated, async (req, res) => {
    const { dealershipId } = req.body;
    
    if (!dealershipId || dealershipId !== 19) {
      return res.status(400).json({ error: 'Valid Automax of Chantilly dealership ID (19) is required' });
    }
    
    try {
      console.log('Running fix for Automax of Chantilly mileage issues...');
      
      // Get all vehicles from Automax of Chantilly
      const vehicles = await storage.getVehiclesByDealershipId(dealershipId);
      
      if (!vehicles || vehicles.length === 0) {
        return res.status(404).json({ error: 'No Automax vehicles found' });
      }
      
      console.log(`Found ${vehicles.length} Automax vehicles to check for mileage issues`);
      
      let updatedCount = 0;
      
      // Loop through vehicles and fix those where mileage = year
      for (const vehicle of vehicles) {
        if (vehicle.mileage === vehicle.year) {
          console.log(`Fixing vehicle ${vehicle.id}: ${vehicle.year} ${vehicle.make} ${vehicle.model} - Mileage matches year`);
          
          // Update vehicle to set mileage to 0 (indicating unknown)
          await storage.updateVehicle(vehicle.id, {
            ...vehicle,
            mileage: 0 // Set to 0 instead of vehicle.year
          });
          
          updatedCount++;
        }
      }
      
      res.json({ 
        message: 'Fix completed for Automax of Chantilly mileage issues', 
        totalVehicles: vehicles.length,
        updatedCount
      });
    } catch (error) {
      console.error('Error fixing Automax mileage issues:', error);
      res.status(500).json({ error: 'Failed to fix Automax mileage issues' });
    }
  });
  
  // Endpoint to sync a specific dealership
  app.post('/api/admin/sync-dealership', isAuthenticated, async (req, res) => {
    const { dealershipId } = req.body;
    
    if (!dealershipId) {
      return res.status(400).json({ error: 'Dealership ID is required' });
    }
    
    try {
      const dealership = await storage.getDealership(dealershipId);
      
      if (!dealership) {
        return res.status(404).json({ error: 'Dealership not found' });
      }
      
      // Start the sync process in the background
      scheduler.syncDealership(dealershipId)
        .then(() => console.log(`Sync completed for dealership ${dealershipId}`))
        .catch(error => console.error(`Sync failed for dealership ${dealershipId}:`, error));
      
      res.json({ message: 'Sync process started', dealership });
    } catch (error) {
      console.error('Error syncing dealership:', error);
      res.status(500).json({ error: 'Failed to sync dealership' });
    }
  });
  
  // Endpoint to test the scraper on a specific vehicle URL
  app.post('/api/admin/scrape-test', isAuthenticated, async (req, res) => {
    const { url, dealershipId, dealershipName } = req.body;
    
    if (!url || !dealershipId || !dealershipName) {
      return res.status(400).json({ error: 'URL, dealership ID, and dealership name are required' });
    }
    
    try {
      console.log(`Testing scraper on URL: ${url}`);
      
      // Import the enhanced-scraper module dynamically
      const enhancedScraper = await import('./enhanced-scraper');
      
      // Use the scraper to extract vehicle data
      // First get the HTML 
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}` });
      }
      
      const html = await response.text();
      const $ = enhancedScraper.cheerio.load(html);
      
      // Use generic extraction
      const vehicle = enhancedScraper.extractGenericVehicle($, url, dealershipId, dealershipName, 'Chantilly, VA', '20151');
      
      if (!vehicle) {
        return res.status(404).json({ error: 'Failed to extract vehicle data from URL' });
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error('Error testing scraper:', error);
      res.status(500).json({ error: 'Failed to test scraper' });
    }
  });
  
  // Endpoint to test Super Bee Auto scraping with JSON-LD support
  app.post('/api/admin/superbee-test', async (req, res) => {
    const { url, dealershipId, dealershipName } = req.body;
    
    if (!url || !dealershipId || !dealershipName) {
      return res.status(400).json({ error: 'URL, dealership ID, and dealership name are required' });
    }
    
    try {
      console.log(`Testing Super Bee Auto scraper with JSON-LD on URL: ${url}`);
      
      // Import the enhanced-scraper module dynamically
      const enhancedScraper = await import('./enhanced-scraper');
      
      // Make sure we have the location data
      const dealerLocation = 'Alexandria, VA'; 
      const dealerZipCode = '22306';
      
      // Fetch the HTML content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1'
        }
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}` });
      }
      
      const html = await response.text();
      const $ = enhancedScraper.cheerio.load(html);
      
      // Use the Super Bee Auto extraction function from enhanced-scraper
      const vehicle = enhancedScraper.extractSuperBeeAutoVehicle($, url, dealershipId, dealershipName, dealerLocation, dealerZipCode);
      
      if (!vehicle) {
        return res.status(404).json({ error: 'Failed to extract vehicle data from URL' });
      }
      
      // Get any JSON-LD data that was found for diagnostic purposes
      const jsonLdData = enhancedScraper.extractJsonLdData($);
      
      // Return both the vehicle data and the raw JSON-LD data
      res.json({
        vehicle,
        jsonLdData,
        success: true
      });
    } catch (error) {
      console.error('Error testing Super Bee Auto scraper:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to test Super Bee Auto scraper', message: errorMessage });
    }
  });

  /**
   * Handle manual vehicle addition for Inspected Auto
   */
  app.post('/api/admin/vehicles/add-manual', isAuthenticated, upload.array('photos', 24), async (req, res) => {
    try {
      const { 
        title, 
        year, 
        make, 
        model, 
        price, 
        mileage, 
        vin, 
        carfaxUrl, 
        contactUrl,
        originalListingUrl,
        dealershipId, 
        location,
        zipCode
      } = req.body;
      
      // Validate required fields
      if (!title || !year || !make || !model || !price || !mileage || !vin || !dealershipId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields' 
        });
      }
      
      // Get the uploaded files
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'At least one photo is required' 
        });
      }
      
      // Check if the dealership exists
      const dealership = await storage.getDealership(parseInt(dealershipId));
      if (!dealership) {
        return res.status(404).json({ 
          success: false, 
          message: 'Dealership not found' 
        });
      }
      
      // Check if the VIN already exists
      const existingVehicle = await storage.getVehicleByVin(vin);
      if (existingVehicle) {
        return res.status(409).json({ 
          success: false, 
          message: 'Vehicle with this VIN already exists' 
        });
      }
      
      // Create upload directory if it doesn't exist
      const uploadDir = path.join(__dirname, '../uploads/vehicles', vin);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Process and move the uploaded images
      const imageUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = path.extname(file.originalname);
        const filename = `${i + 1}${fileExt}`;
        const filePath = path.join(uploadDir, filename);
        
        // Move the file to the uploads directory
        fs.writeFileSync(filePath, file.buffer);
        
        // Add the image URL to the array
        const imageUrl = `/uploads/vehicles/${vin}/${filename}`;
        imageUrls.push(imageUrl);
      }
      
      // Create the vehicle object
      const vehicle: InsertVehicle = {
        title: title,
        year: parseInt(year),
        make,
        model,
        price: parseInt(price),
        mileage: parseInt(mileage),
        vin,
        dealershipId: parseInt(dealershipId),
        images: imageUrls,
        originalListingUrl: originalListingUrl || `https://inspectedauto.com`,
        location: location || 'Chantilly, VA',
        zipCode: zipCode || '20151'
      };
      
      // Add optional fields if provided
      if (carfaxUrl) vehicle.carfaxUrl = carfaxUrl;
      if (contactUrl) vehicle.contactUrl = contactUrl;
      
      // Add the vehicle to the database
      const newVehicle = await storage.addVehicle(vehicle);
      
      // Update the dealership's vehicle count
      await storage.updateDealershipVehicleCount(parseInt(dealershipId));
      
      return res.status(201).json({ 
        success: true, 
        message: 'Vehicle added successfully', 
        vehicle: newVehicle 
      });
    } catch (error) {
      console.error('Error adding vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error adding vehicle',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate HTML vehicle cards and use the global static file server
   */
  app.get('/api/admin/vehicle-cards', isAuthenticated, async (_req, res) => {
    try {
      // Check if vehicle cards are already generated
      if (ScreenshotService.currentVehicleCardsDir && 
          fs.existsSync(path.join(ScreenshotService.currentVehicleCardsDir, 'index.html'))) {
        
        // Use existing vehicle cards
        const virtualPath = path.basename(ScreenshotService.currentVehicleCardsDir);
        const indexUrl = `/files/${virtualPath}/index.html`;
        
        logger.info(`Using existing vehicle cards at ${ScreenshotService.currentVehicleCardsDir}`);
        
        const vehicles = await storage.getAllVehicles();
        
        return res.json({
          success: true,
          url: indexUrl,
          message: 'Using existing vehicle cards. This link will expire in 30 minutes.',
          fileCount: vehicles.length
        });
      }
      
      // Generate HTML files for all vehicles
      const directoryPath = await ScreenshotService.generateVehicleCardsHtml();
      
      // Get the virtual path based on the directory name - this will be used with the /files prefix
      const virtualPath = path.basename(directoryPath);
      
      // No need to set up special routes - global static file server will handle it
      logger.info(`Vehicle cards generated at ${directoryPath} - accessible at /files/${virtualPath}/`);
      
      // Run cleanup of old temp files immediately (from previous runs)
      ScreenshotService.cleanupTempFiles(30)
        .catch(err => logger.error('Error cleaning up old temp files:', err));
      
      // Also schedule cleanup of current files after 30 minutes
      setTimeout(() => {
        logger.info(`Scheduling cleanup of vehicle cards in directory: ${directoryPath}`);
        ScreenshotService.cleanupTempFiles(30)
          .catch(err => logger.error('Error cleaning up temp files:', err));
      }, 30 * 60 * 1000);
      
      // Return the URL path to access the index.html through the global file server
      const indexUrl = `/files/${virtualPath}/index.html`;
      
      // Get the vehicle count for the response
      const vehicles = await storage.getAllVehicles();
      const fileCount = vehicles.length;
      
      res.json({ 
        success: true, 
        url: indexUrl,
        message: 'Vehicle cards generated successfully. This link will expire in 30 minutes.',
        fileCount: fileCount
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate vehicle cards';
      logger.error('Error generating vehicle cards:', error);
      res.status(500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });
  
  /**
   * Direct endpoint to generate and serve the cards HTML file immediately
   * This is a more reliable approach that doesn't depend on file paths
   */
  app.get('/api/admin/direct-cards-download', isAuthenticated, async (_req, res) => {
    try {
      logger.info('Starting to generate vehicle card images directly...');
      
      // Get all vehicles
      const vehicles = await storage.getAllVehicles();
      logger.info(`Generating direct HTML for ${vehicles.length} vehicle card images`);
      
      // Filter to only include vehicles with at least one image
      const vehiclesWithImages = vehicles.filter(v => v.images && v.images.length > 0);
      
      // Start building HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vehicle Card Images - SpecialOffer.Autos</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              background: #f5f7fa;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 20px;
              color: #1c2a48;
              text-align: center;
            }
            .instructions {
              margin: 20px 0 30px;
              padding: 20px;
              background: #e3f2fd;
              border: 1px solid #bbdefb;
              border-radius: 10px;
              font-size: 16px;
              line-height: 1.5;
            }
            .instructions ul {
              margin-left: 20px;
              margin-top: 15px;
            }
            .instructions li {
              margin-bottom: 10px;
            }
            .cards-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
              gap: 25px;
              margin-top: 30px;
            }
            .card {
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 3px 10px rgba(0,0,0,0.08);
              background: white;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .card:hover {
              transform: translateY(-5px);
              box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .card-image-container {
              position: relative;
              height: 200px;
              overflow: hidden;
            }
            .card-image {
              width: 100%;
              height: 100%;
              object-fit: cover;
              transition: transform 0.3s;
            }
            .card:hover .card-image {
              transform: scale(1.05);
            }
            .card-details {
              padding: 15px;
            }
            .card-title {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 8px;
              color: #1c2a48;
            }
            .card-price {
              font-size: 18px;
              font-weight: 700;
              color: #e91e63;
              margin-bottom: 10px;
            }
            .card-download {
              display: block;
              padding: 10px;
              background: #2196f3;
              color: white;
              text-align: center;
              border-radius: 5px;
              text-decoration: none;
              font-weight: 500;
              margin-top: 10px;
              transition: background 0.2s;
            }
            .card-download:hover {
              background: #1976d2;
            }
            .expiry-note {
              text-align: center;
              margin-top: 40px;
              color: #777;
              font-size: 14px;
            }
            @media (max-width: 768px) {
              .cards-grid {
                grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
              }
            }
          </style>
        </head>
        <body>
          <h1>Vehicle Card Images - SpecialOffer.Autos</h1>
          
          <div class="instructions">
            <p><strong>Instructions</strong></p>
            <ul>
              <li>Each image below represents a vehicle card as it appears on the website.</li>
              <li>Right-click on any image and select "Save Image As" to download.</li>
              <li>You can open images in a new tab to see them in full size.</li>
              <li>Click the links below the images to download them directly.</li>
            </ul>
          </div>
          
          <div class="cards-grid">
      `;
      
      // Add each vehicle card to the HTML
      for (const vehicle of vehiclesWithImages) {
        try {
          if (!vehicle.images || !vehicle.images[0]) continue;
          
          // Get the main image URL for the vehicle card
          const imageUrl = vehicle.images[0];
          
          // Create safe filename for download attribute
          const safeTitle = (vehicle.title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`)
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();
          
          // Get vehicle info for HTML
          const title = vehicle.title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
          const price = vehicle.price ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          }).format(vehicle.price) : 'Price not available';
          
          // Add card to HTML directly using the original image URL
          htmlContent += `
            <div class="card">
              <div class="card-image-container">
                <img class="card-image" src="${imageUrl}" alt="${title}" loading="lazy">
              </div>
              <div class="card-details">
                <div class="card-title">${title}</div>
                <div class="card-price">${price}</div>
                <a href="${imageUrl}" download="${safeTitle}.jpg" class="card-download">Download Image</a>
              </div>
            </div>
          `;
        } catch (error) {
          logger.error(`Error processing vehicle card image: ${error}`);
        }
      }
      
      // Close HTML
      htmlContent += `
          </div>
          
          <div class="expiry-note">
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
        </html>
      `;
      
      // Set content type and send the HTML directly
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
      
      logger.info(`Successfully served direct vehicle card images HTML with ${vehiclesWithImages.length} images`);
    } catch (error) {
      logger.error('Error generating direct vehicle card images:', error);
      res.status(500).send('Error generating vehicle card images');
    }
  });
  
  /**
   * Generate and download all vehicle card images (first image of each vehicle)
   */
  app.get('/api/admin/vehicle-card-images', isAuthenticated, async (_req, res) => {
    try {
      // Check if card images page is already generated and still exists
      if (VehicleCardImageService.currentDownloadPage && 
          fs.existsSync(VehicleCardImageService.currentDownloadPage)) {
        
        // Parse the html file path to get the directory name without full path
        const fullPath = VehicleCardImageService.currentDownloadPage;
        const dirPath = path.dirname(fullPath);
        
        // Extract the last segment of the path - should be the timestamp directory
        const pathSegments = dirPath.split(path.sep);
        const dirName = pathSegments[pathSegments.length - 1]; 
        
        // Construct URL with just the timestamp directory name and html file
        const pageUrl = `/files/${dirName}/cards.html`;
        
        // Log detailed information for debugging
        logger.info(`File path: ${fullPath}`);
        logger.info(`Directory path: ${dirPath}`);
        logger.info(`Directory name: ${dirName}`);
        logger.info(`Using existing vehicle card images download URL: ${pageUrl}`);
        
        return res.json({
          success: true,
          url: pageUrl,
          message: 'Using existing vehicle card images page. This link will expire in 30 minutes.',
        });
      }
      
      logger.info('Starting to generate vehicle card images download page...');
      
      // First clean up any old downloads
      await VehicleCardImageService.cleanupOldDownloads(30);
      
      // Generate directory with vehicle card images and HTML download page
      const htmlFilePath = await VehicleCardImageService.createVehicleCardImagesPage();
      
      // Parse the HTML file path to get the directory name
      const dirPath = path.dirname(htmlFilePath);
      
      // Extract the last segment of the path - should be the timestamp directory
      const pathSegments = dirPath.split(path.sep);
      const dirName = pathSegments[pathSegments.length - 1]; 
      
      // Construct the URL with just the timestamp directory name and html file
      const downloadUrl = `/files/${dirName}/cards.html`;
      
      // Log detailed information for debugging
      logger.info(`File path: ${htmlFilePath}`);
      logger.info(`Directory path: ${dirPath}`);
      logger.info(`Directory name: ${dirName}`);
      logger.info(`Generated download URL: ${downloadUrl}`);
      
      res.json({
        success: true,
        url: downloadUrl,
        message: 'Vehicle card images are ready for download. This link will expire in 30 minutes.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate vehicle card images';
      logger.error('Error generating vehicle card images:', error);
      res.status(500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  /**
   * Generate and download all vehicle photos in a gallery format
   */
  app.get('/api/admin/vehicle-photos-zip', isAuthenticated, async (_req, res) => {
    try {
      // Check if photo gallery is already generated and still exists
      if (VehicleArchiver.currentPhotosDownloadFile && 
          fs.existsSync(VehicleArchiver.currentPhotosDownloadFile)) {
        
        // Get the directory containing the gallery
        const fullPath = VehicleArchiver.currentPhotosDownloadFile;
        const galleryDir = path.dirname(fullPath);
        
        // Extract the last segment of the path - should be the timestamp directory
        const pathSegments = galleryDir.split(path.sep);
        const dirName = pathSegments[pathSegments.length - 1];
        
        // Construct the URL with just the timestamp directory name and html file
        const indexUrl = `/files/${dirName}/download.html`;
        
        // Log detailed information for debugging
        logger.info(`File path: ${fullPath}`);
        logger.info(`Directory path: ${galleryDir}`);
        logger.info(`Directory name: ${dirName}`);
        logger.info(`Generated gallery URL: ${indexUrl}`);
        
        logger.info(`Using existing vehicle photos gallery at ${galleryDir}`);
        
        return res.json({
          success: true,
          url: indexUrl,
          message: 'Using existing vehicle photos gallery. This link will expire in 30 minutes.',
        });
      }
      
      logger.info('Starting to create photo gallery of all vehicle photos...');
      
      // First clean up any old archives
      await VehicleArchiver.cleanupOldFiles(30);
      
      // Generate directory with all vehicle photos and an index.html file
      const htmlFilePath = await VehicleArchiver.createVehiclePhotosDownload();
      
      // Parse the HTML file path to get the directory name
      const dirPath = path.dirname(htmlFilePath);
      
      // Extract the last segment of the path - should be the timestamp directory
      const pathSegments = dirPath.split(path.sep);
      const dirName = pathSegments[pathSegments.length - 1]; 
      
      // Construct the URL with just the timestamp directory name and html file
      const indexUrl = `/files/${dirName}/download.html`;
      
      // Log detailed information for debugging
      logger.info(`File path: ${htmlFilePath}`);
      logger.info(`Directory path: ${dirPath}`);
      logger.info(`Directory name: ${dirName}`);
      logger.info(`Generated gallery URL: ${indexUrl}`);
      
      res.json({ 
        success: true, 
        url: indexUrl,
        message: 'Vehicle photos gallery created successfully. This link will expire in 30 minutes.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate vehicle photos gallery';
      logger.error('Error generating vehicle photos gallery:', error);
      res.status(500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  });

  /**
   * Special route to handle social media crawlers for vehicle detail pages
   * This renders server-side HTML with proper Open Graph meta tags
   */
  app.get('/vehicles/:id', async (req, res, next) => {
    // Check if request is from a social media crawler
    const userAgent = req.get('User-Agent') || '';
    
    // Only serve special HTML for social media crawlers
    if (isSocialMediaCrawler(userAgent)) {
      try {
        const id = req.params.id;
        logger.info(`Serving special crawler HTML for vehicle ID: ${id}, User-Agent: ${userAgent}`);
        
        const html = await generateVehicleOpenGraphHtml(id, req.get('host') || 'specialoffer.autos');
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      } catch (error) {
        logger.error('Error generating crawler HTML:', error);
        // For errors, let the SPA handle it
        next();
      }
    } else {
      // For regular users, let the SPA handle routing
      next();
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
