import { InsertVehicle } from '@shared/schema';
import * as cheerio from 'cheerio';
import { logger } from '@shared/logger';

// Export cheerio for use in test endpoints
export { cheerio };

// Define CheerioRoot type to fix TypeScript errors
type CheerioRoot = ReturnType<typeof cheerio.load>;

// Import the specialized Inspected Auto extraction function
export { extractInspectedAutoVehicle } from './inspected-auto-scraper';

// Export placeholder for the Super Bee extractor to avoid errors
export function extractSuperBeeAutoVehicle($: CheerioRoot, url: string, dealershipId: number, dealershipName: string, dealerLocation: string, dealerZipCode: string | null): InsertVehicle {
  // Forward to generic extractor
  return extractGenericVehicle($, url, dealershipId, dealershipName, dealerLocation, dealerZipCode);
}

// Export placeholder for the JSON-LD data extractor to avoid errors
export function extractJsonLdData($: CheerioRoot): any | null {
  return null;
}

/**
 * Interface for dealer-specific selectors
 */
interface DealerSelectors {
  vehicleItem: string;
  vehicleLink: string;
  pagination?: string;
  price?: string;
  mileage?: string;
  vin?: string;
  images?: string;
}

/**
 * Interface for dealer configuration
 */
interface DealerConfig {
  name: string;
  inventoryPath: string;
  selectors: DealerSelectors;
}

/**
 * Interface for dealer pattern matching
 */
interface DealerPatterns {
  inventoryPaths: string[];
  specialDealers: {
    [key: string]: DealerConfig;
  };
}

/**
 * Patterns for identifying different dealer websites
 */
const DEALERSHIP_PATTERNS: DealerPatterns = {
  inventoryPaths: [
    'inventory',
    'cars',
    'used-cars',
    'certified-inventory',
    'pre-owned',
    'all-inventory',
    'used-inventory',
    'vehicles',
    'stock',
    'listings'
  ],
  specialDealers: {
    inspectedauto: {
      name: 'Inspected Auto',
      inventoryPath: 'inventory',
      selectors: {
        vehicleItem: '.vehicle-card',
        vehicleLink: 'a',
        pagination: '.pagination',
        price: '.price-value',
        mileage: '.mileage-value',
        vin: '.vin',
        images: '.vehicle-image'
      }
    },
    novaautoland: {
      name: 'Nova Autoland',
      inventoryPath: 'inventory',
      selectors: {
        vehicleItem: '.vehicle-item',
        vehicleLink: '.vehicle-title a',
        pagination: '.pagination',
        price: '.price',
        mileage: '.mileage',
        vin: '.vin',
        images: '.vehicle-image'
      }
    },
    superbeeauto: {
      name: 'Super Bee Auto',
      inventoryPath: 'inventory',
      selectors: {
        vehicleItem: '.inventory-item',
        vehicleLink: '.inventory-title a',
        pagination: '.pagination',
        price: '.price',
        mileage: '.mileage',
        vin: '.vin-value',
        images: '.inventory-image'
      }
    },
    number1auto: {
      name: 'Number 1 Auto Group',
      inventoryPath: 'inventory',
      selectors: {
        vehicleItem: '.vehicle-card',
        vehicleLink: '.vehicle-title a',
        pagination: '.pagination',
        price: '.price',
        mileage: '.mileage',
        vin: '.vin',
        images: '.vehicle-img'
      }
    },
    autogalleriava: {
      name: 'Auto Galleria VA',
      inventoryPath: 'inventory',
      selectors: {
        vehicleItem: '.car-item',
        vehicleLink: '.car-title a',
        pagination: '.page-numbers',
        price: '.car-price',
        mileage: '.car-mileage',
        vin: '.car-vin',
        images: '.car-image'
      }
    },
    ahqualitycars: {
      name: 'A & H Quality Cars',
      inventoryPath: 'inventory',
      selectors: {
        vehicleItem: '.vehicle-listing',
        vehicleLink: '.vehicle-title a',
        pagination: '.pagination',
        price: '.asking-price',
        mileage: '.odometer',
        vin: '.vin',
        images: '.vehicle-image'
      }
    },
    ninestarsauto: {
      name: 'Nine Stars Auto',
      inventoryPath: 'inventory',
      selectors: {
        vehicleItem: '.inventory-item',
        vehicleLink: '.inventory-title a',
        pagination: '.pagination',
        price: '.price',
        mileage: '.mileage',
        vin: '.vin',
        images: '.inventory-image'
      }
    }
  }
};

/**
 * Main function to scrape a dealership's inventory
 */
export async function enhancedScrapeDealership(
  dealershipUrl: string,
  dealershipId: number,
  dealershipName: string,
  dealerLocation: string | null = null,
  dealerZipCode: string | null = null
): Promise<InsertVehicle[]> {
  try {
    const vehicles: InsertVehicle[] = [];
    
    // Determine if we're dealing with a specific dealership pattern
    const dealerPattern = identifyDealerPattern(dealershipUrl, dealershipName);
    console.log(`Identified dealer pattern: ${dealerPattern || 'generic'}`);
    
    // Handle Inspected Auto with specialized scraper
    if (dealerPattern === 'inspectedauto' || dealershipName.toLowerCase().includes('inspected auto')) {
      console.log(`Using specialized scraper for Inspected Auto: ${dealershipUrl}`);
      
      // Import dynamically to avoid circular dependency
      const { scrapeInspectedAuto } = await import('./inspected-auto-scraper');
      return await scrapeInspectedAuto(dealershipUrl, dealershipId, dealershipName);
    }
    
    // Set headers appropriate for the dealer type
    const headers = getHeadersForDealer(dealerPattern);
    
    // Fetch the dealership homepage or inventory page
    console.log(`Fetching dealership page: ${dealershipUrl}`);
    const response = await fetchWithRetry(dealershipUrl, { headers });
    
    if (!response.ok) {
      console.error(`Failed to fetch dealership page: ${response.statusText}`);
      return vehicles;
    }
    
    // Load the HTML content with cheerio
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Find the inventory page URL if we're not already on it
    const inventoryPageUrl = findInventoryPageUrl($, dealershipUrl, dealerPattern);
    
    if (!inventoryPageUrl) {
      console.error(`Could not find inventory page URL for ${dealershipName}`);
      return vehicles;
    }
    
    // Now fetch the inventory page if it's different from the initial URL
    let inventoryPageHtml = html;
    let inventory$: CheerioRoot = $;
    
    if (inventoryPageUrl !== dealershipUrl) {
      console.log(`Fetching inventory page: ${inventoryPageUrl}`);
      const inventoryResponse = await fetchWithRetry(inventoryPageUrl, { headers });
      
      if (!inventoryResponse.ok) {
        console.error(`Failed to fetch inventory page: ${inventoryResponse.statusText}`);
        return vehicles;
      }
      
      inventoryPageHtml = await inventoryResponse.text();
      inventory$ = cheerio.load(inventoryPageHtml);
    }
    
    // Get individual vehicle listing URLs from the inventory page
    const vehicleUrls = await getVehicleListingUrls(
      inventory$,
      inventoryPageUrl,
      dealerPattern,
      dealershipName,
      dealershipUrl
    );
    
    console.log(`Found ${vehicleUrls.length} vehicle URLs to process for ${dealershipName}`);
    
    // Process each vehicle listing
    for (const url of vehicleUrls) {
      try {
        const vehicle = await scrapeVehicleListing(
          url,
          dealershipId,
          dealershipName,
          dealerPattern,
          dealerLocation,
          dealerZipCode
        );
        
        if (vehicle) {
          vehicles.push(vehicle);
        }
      } catch (error) {
        console.error(`Error processing vehicle at ${url}: ${error}`);
      }
    }
    
    console.log(`Successfully scraped ${vehicles.length} vehicles for ${dealershipName}`);
    return vehicles;
  } catch (error) {
    console.error(`Error in enhancedScrapeDealership: ${error}`);
    return [];
  }
}

/**
 * Identify the dealer pattern based on URL and name
 */
function identifyDealerPattern(url: string, name: string): string | null {
  try {
    const lowerUrl = url.toLowerCase();
    const lowerName = name.toLowerCase();
    
    // Check common patterns
    if (lowerUrl.includes('inspectedauto') || lowerName.includes('inspected auto')) {
      return 'inspectedauto';
    } else if (lowerUrl.includes('novaautoland') || lowerName.includes('nova auto')) {
      return 'novaautoland';
    } else if (lowerUrl.includes('superbeeauto') || lowerName.includes('super bee')) {
      return 'superbeeauto';
    } else if (lowerUrl.includes('number1auto') || lowerName.includes('number 1 auto')) {
      return 'number1auto';
    } else if (lowerUrl.includes('autogalleria') || lowerName.includes('auto galleria')) {
      return 'autogalleriava';
    } else if (lowerUrl.includes('ahqualitycars') || lowerName.includes('a & h')) {
      return 'ahqualitycars';
    } else if (lowerUrl.includes('ninestarsauto') || lowerName.includes('nine stars')) {
      return 'ninestarsauto';
    }
    
    // No specific pattern identified
    return null;
  } catch (error) {
    console.error(`Error identifying dealer pattern: ${error}`);
    return null;
  }
}

/**
 * Set appropriate headers for different dealer types
 */
function getHeadersForDealer(dealerPattern: string | null): HeadersInit {
  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
  
  // Add dealer-specific headers if needed
  if (dealerPattern === 'superbeeauto') {
    headers['Sec-Ch-Ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    headers['Sec-Ch-Ua-Mobile'] = '?0';
    headers['Sec-Ch-Ua-Platform'] = '"Windows"';
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'none';
    headers['Sec-Fetch-User'] = '?1';
  }
  
  return headers;
}

/**
 * Fetch with retry capability
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    if (retries <= 1) throw error;
    console.log(`Fetch failed, retrying (${retries - 1} retries left): ${url}`);
    return fetchWithRetry(url, options, retries - 1);
  }
}

/**
 * Find the inventory page URL from the homepage
 */
function findInventoryPageUrl($: CheerioRoot, baseUrl: string, dealerPattern: string | null): string {
  try {
    // If we have a specific dealer pattern, try using the known inventory path
    if (dealerPattern && DEALERSHIP_PATTERNS.specialDealers[dealerPattern]) {
      const inventoryPath = DEALERSHIP_PATTERNS.specialDealers[dealerPattern].inventoryPath;
      const constructedUrl = new URL(inventoryPath, baseUrl).toString();
      console.log(`Using known inventory path for ${dealerPattern}: ${constructedUrl}`);
      return constructedUrl;
    }
    
    // Otherwise try to find inventory links in the page
    let bestInventoryUrl = '';
    let bestScore = 0;
    
    // Look for links that contain inventory-related terms
    $('a').each(function() {
      const href = $(this).attr('href');
      const text = $(this).text().trim().toLowerCase();
      
      if (!href) return;
      
      // Resolve relative URLs
      let fullUrl: string;
      try {
        fullUrl = new URL(href, baseUrl).toString();
      } catch (e) {
        return; // Skip invalid URLs
      }
      
      // Check if this is an inventory link
      if (isInventoryLink(href, text)) {
        // Score this link based on how likely it is to be the main inventory page
        const score = isMoreLikelyInventoryLink(href, text, baseUrl) ? 10 : 5;
        
        if (score > bestScore) {
          bestInventoryUrl = fullUrl;
          bestScore = score;
        }
      }
    });
    
    // If we found a good inventory link, use it
    if (bestInventoryUrl) {
      console.log(`Found inventory page URL: ${bestInventoryUrl} (score: ${bestScore})`);
      return bestInventoryUrl;
    }
    
    // Otherwise just append /inventory to the base URL as a fallback
    const fallbackUrl = new URL('inventory', baseUrl).toString();
    console.log(`Using fallback inventory URL: ${fallbackUrl}`);
    return fallbackUrl;
  } catch (error) {
    console.error(`Error finding inventory page URL: ${error}`);
    return baseUrl; // Return the original URL as a fallback
  }
}

/**
 * Check if a link is likely an inventory link
 */
function isInventoryLink(href: string, text: string): boolean {
  const lowerHref = href.toLowerCase();
  const lowerText = text.toLowerCase();
  
  // Check if the URL contains inventory-related paths
  for (const path of DEALERSHIP_PATTERNS.inventoryPaths) {
    if (lowerHref.includes(path)) {
      return true;
    }
  }
  
  // Check if the link text suggests it's an inventory link
  const inventoryTexts = ['inventory', 'vehicles', 'cars', 'listings', 'stock', 'browse'];
  for (const inventoryText of inventoryTexts) {
    if (lowerText.includes(inventoryText)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Determine if a link is more likely to be the main inventory page
 */
function isMoreLikelyInventoryLink(href: string, text: string, currentUrl: string): boolean {
  const lowerHref = href.toLowerCase();
  const lowerText = text.toLowerCase();
  
  // Prefer links that include "all" inventory or similar terms
  if (lowerHref.includes('all-inventory') || 
      lowerHref.includes('all-vehicles') || 
      lowerHref.includes('all-cars') ||
      lowerHref.includes('used-inventory') || 
      lowerHref.includes('used-cars')) {
    return true;
  }
  
  // Prefer links where the text is simple like "Inventory" or "Vehicles"
  if ((lowerText === 'inventory' || lowerText === 'vehicles' || lowerText === 'cars') && 
      lowerText.length < 12) {
    return true;
  }
  
  // Disprefer links that are too specific
  if (lowerHref.includes('new-inventory') || 
      lowerHref.includes('new-cars') ||
      lowerHref.includes('certified') ||
      lowerHref.includes('special') ||
      lowerHref.includes('featured')) {
    return false;
  }
  
  return false;
}

/**
 * Get individual vehicle listing URLs from an inventory page
 */
async function getVehicleListingUrls(
  $: CheerioRoot,
  inventoryPageUrl: string,
  dealerPattern: string | null,
  dealershipName: string,
  dealershipUrl: string
): Promise<string[]> {
  const vehicleUrls: string[] = [];
  
  try {
    // If we have a specific pattern, use the appropriate selector
    let vehicleItemSelector = '.vehicle';
    let vehicleLinkSelector = 'a';
    
    if (dealerPattern && DEALERSHIP_PATTERNS.specialDealers[dealerPattern]) {
      vehicleItemSelector = DEALERSHIP_PATTERNS.specialDealers[dealerPattern].selectors.vehicleItem;
      vehicleLinkSelector = DEALERSHIP_PATTERNS.specialDealers[dealerPattern].selectors.vehicleLink;
    }
    
    // Look for vehicle listings using the selector
    console.log(`Looking for vehicle listings with selector: ${vehicleItemSelector}`);
    $(vehicleItemSelector).each(function() {
      const $item = $(this);
      const $link = $item.find(vehicleLinkSelector).first();
      const href = $link.attr('href');
      
      if (href) {
        try {
          const fullUrl = new URL(href, inventoryPageUrl).toString();
          if (isVehicleDetailLink(fullUrl) && !vehicleUrls.includes(fullUrl)) {
            vehicleUrls.push(fullUrl);
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }
    });
    
    // If we didn't find any listings with the specific selector, try some generic ones
    if (vehicleUrls.length === 0) {
      console.log('No vehicles found with specific selector, trying generic selectors');
      
      const genericSelectors = [
        '.vehicle-item a', '.inventory-item a', '.vehicle-listing a', 
        '.car-item a', '.listing-item a', '.search-result a',
        'a[href*="detail"]', 'a[href*="vehicle"]', 'a[href*="inventory"]'
      ];
      
      for (const selector of genericSelectors) {
        console.log(`Trying generic selector: ${selector}`);
        $(selector).each(function() {
          const href = $(this).attr('href');
          
          if (href) {
            try {
              const fullUrl = new URL(href, inventoryPageUrl).toString();
              if (isVehicleDetailLink(fullUrl) && !vehicleUrls.includes(fullUrl)) {
                vehicleUrls.push(fullUrl);
              }
            } catch (e) {
              // Skip invalid URLs
            }
          }
        });
        
        if (vehicleUrls.length > 0) {
          console.log(`Found ${vehicleUrls.length} vehicles with generic selector: ${selector}`);
          break;
        }
      }
    }
    
    // Special case for Inspected Auto - their URL pattern is hard to match with selectors
    if (dealerPattern === 'inspectedauto' || dealershipName.toLowerCase().includes('inspected auto')) {
      console.log('Using specialized extraction for Inspected Auto URLs');
      
      // If we have any URL that looks like a GUID, it's likely a vehicle detail page
      $('a').each(function() {
        const href = $(this).attr('href');
        
        if (href && href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)) {
          try {
            const fullUrl = new URL(href, inventoryPageUrl).toString();
            if (!vehicleUrls.includes(fullUrl)) {
              console.log(`Found Inspected Auto vehicle URL with GUID pattern: ${fullUrl}`);
              vehicleUrls.push(fullUrl);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });
    }
    
    console.log(`Found ${vehicleUrls.length} vehicle URLs from ${dealershipName}`);
    return vehicleUrls;
  } catch (error) {
    console.error(`Error getting vehicle listing URLs: ${error}`);
    return vehicleUrls;
  }
}

/**
 * Check if a URL is likely a vehicle detail page
 */
function isVehicleDetailLink(href: string): boolean {
  const lowerHref = href.toLowerCase();
  
  // Check for common patterns in vehicle detail URLs
  return (
    lowerHref.includes('/vehicle/') ||
    lowerHref.includes('/detail') ||
    lowerHref.includes('/vdp/') ||
    lowerHref.includes('/inventory/') ||
    lowerHref.includes('/car/') ||
    lowerHref.includes('/listing/') ||
    lowerHref.includes('vin=') ||
    lowerHref.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) !== null
  );
}

/**
 * Scrape data from a vehicle listing page
 */
async function scrapeVehicleListing(
  url: string,
  dealershipId: number,
  dealershipName: string,
  dealerPattern: string | null,
  dealerLocation: string | null,
  dealerZipCode: string | null
): Promise<InsertVehicle | null> {
  try {
    console.log(`Scraping vehicle listing: ${url}`);
    
    // Set appropriate headers for the dealer
    const headers = getHeadersForDealer(dealerPattern);
    
    // Fetch the vehicle detail page
    const response = await fetchWithRetry(url, { headers });
    
    if (!response.ok) {
      console.error(`Failed to fetch vehicle details: ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Ensure dealer location and ZIP code have reasonable values
    const dealerLocationValue = dealerLocation || 'Unknown Location';
    const dealerZipCodeValue = dealerZipCode || null;
    console.log(`Using dealership location: ${dealerLocationValue}, ZIP code: ${dealerZipCodeValue}`);
    
    // Use appropriate extraction method based on dealer pattern
    if (dealerPattern === 'inspectedauto') {
      console.log(`Using specialized Inspected Auto extraction`);
      // Dynamically import to avoid circular dependency
      return import('./inspected-auto-scraper')
        .then(module => module.extractInspectedAutoVehicle($, url, dealershipId, dealershipName, dealerLocationValue, dealerZipCodeValue));
    } else if (dealerPattern === 'superbeeauto') {
      console.log(`Using specialized Super Bee Auto extraction`);
      return extractSuperBeeAutoVehicle($, url, dealershipId, dealershipName, dealerLocationValue, dealerZipCodeValue);
    } else {
      // Generic extraction for other dealers
      console.log(`Using generic vehicle extraction for ${dealershipName}`);
      return extractGenericVehicle($, url, dealershipId, dealershipName, dealerLocationValue, dealerZipCodeValue);
    }
  } catch (error) {
    console.error(`Error processing vehicle at ${url}: ${error}`);
    return null;
  }
}

/**
 * Generic extraction function for vehicles - works for most dealer sites
 */
export function extractGenericVehicle($: CheerioRoot, url: string, dealershipId: number, dealershipName: string, dealerLocation: string, dealerZipCode: string | null): InsertVehicle {
  try {
    console.log(`Using generic vehicle extraction for URL: ${url}`);
    
    // Extract title, year, make, model
    let title = '';
    let year = 0;
    let make = '';
    let model = '';
    
    // Try to find title elements
    const titleSelectors = [
      'h1.vehicle-title', 
      'h1.inventory-title', 
      'h1.vdp-title',
      'h1.detail-title',
      'h1.page-title',
      'h1',
      '.title',
      '.vehicle-title',
      '.inventory-title',
      '.detail-title',
      '.vdp-title',
      '#vehicle-title'
    ];
    
    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        title = element.text().trim();
        if (title) {
          console.log(`Found title using selector ${selector}: "${title}"`);
          break;
        }
      }
    }
    
    // If we still don't have a title, try to extract from document title
    if (!title) {
      title = $('title').text();
      // Try to clean up the title by removing the website name
      title = title.split('|')[0].trim();
      console.log(`Extracted title from document title: "${title}"`);
    }
    
    // Parse the vehicle title to get year, make, and model
    if (title) {
      const titleParts = parseVehicleTitle(title);
      year = titleParts.year;
      make = titleParts.make;
      model = titleParts.model;
    }
    
    // Extract VIN, price, and mileage using common selectors
    let vin = '';
    let price = 0;
    let mileage = 0;
    
    // VIN extraction
    const vinSelectors = ['.vin', '#vin', '.vehicle-vin', '.inventory-vin', '[data-vin]'];
    for (const selector of vinSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const vinText = element.text().trim();
        const vinMatch = vinText.match(/[A-HJ-NPR-Z0-9]{17}/i);
        if (vinMatch) {
          vin = vinMatch[0];
          console.log(`Found VIN using selector ${selector}: ${vin}`);
          break;
        }
      }
    }
    
    // Price extraction
    const priceSelectors = ['.price', '.msrp', '.asking-price', '.sale-price', '.vehicle-price', '.inventory-price', '#price'];
    for (const selector of priceSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const priceText = element.text().trim();
        price = parsePrice(priceText);
        if (price > 0) {
          console.log(`Found price using selector ${selector}: $${price}`);
          break;
        }
      }
    }
    
    // Mileage extraction
    const mileageSelectors = ['.mileage', '.odometer', '.vehicle-mileage', '.inventory-mileage', '#mileage'];
    for (const selector of mileageSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const mileageText = element.text().trim();
        mileage = parseMileage(mileageText);
        if (mileage > 0) {
          console.log(`Found mileage using selector ${selector}: ${mileage}`);
          break;
        }
      }
    }
    
    // Extract images
    const images: string[] = [];
    $('img.vehicle-image, img.inventory-image, .vehicle-photos img, .car-photos img, .gallery-image, .carousel img').each(function() {
      const src = $(this).attr('src');
      if (src && !images.includes(src) && isValidImageUrl(src)) {
        images.push(src);
      }
    });
    
    // Extract Carfax URL if available
    const carfaxUrl = enhancedExtractCarfaxUrl($, url, vin);
    
    // Build the vehicle object
    const vehicle: InsertVehicle = {
      dealershipId,
      title: title || `${year} ${make} ${model}`.trim(),
      vin: vin || null,
      stock: null,
      make: make || '',
      model: model || '',
      year: year || 0,
      price: price,
      mileage: mileage,
      exteriorColor: '',
      interiorColor: '',
      transmission: '',
      engine: '',
      fuelType: '',
      drivetrain: '',
      bodyType: '',
      description: '',
      features: [],
      images: images,
      url: url,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: dealerLocation || 'Unknown Location',
      zipCode: dealerZipCode || null,
      carfaxUrl: carfaxUrl || null,
      sortOrder: Math.floor(Math.random() * 1000)
    };
    
    return vehicle;
  } catch (error) {
    console.error(`Error in extractGenericVehicle: ${error}`);
    // Return a minimal vehicle object to avoid errors
    return {
      dealershipId,
      title: url,
      vin: null,
      stock: null,
      make: '',
      model: '',
      year: 0,
      price: 0,
      mileage: 0,
      exteriorColor: '',
      interiorColor: '',
      transmission: '',
      engine: '',
      fuelType: '',
      drivetrain: '',
      bodyType: '',
      description: '',
      features: [],
      images: [],
      url: url,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: dealerLocation || 'Unknown Location',
      zipCode: dealerZipCode || null,
      carfaxUrl: null,
      sortOrder: Math.floor(Math.random() * 1000)
    };
  }
}

/**
 * Enhanced function to extract Carfax URLs using multiple methods and fallbacks
 */
function enhancedExtractCarfaxUrl($: CheerioRoot, pageUrl: string, vin: string | null): string | null {
  try {
    // Check for direct Carfax links
    let carfaxUrl: string | null = null;
    
    // Try to find direct links to Carfax reports
    $('a[href*="carfax.com"]').each(function() {
      const href = $(this).attr('href');
      if (href && href.includes('carfax.com') && !carfaxUrl) {
        carfaxUrl = href;
        return false; // Break the loop
      }
    });
    
    // If found, return it
    if (carfaxUrl) {
      console.log(`Found Carfax URL: ${carfaxUrl}`);
      return carfaxUrl;
    }
    
    // If we have a VIN, try to construct a Carfax URL
    if (vin) {
      carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?vin=${vin}`;
      console.log(`Constructed Carfax URL from VIN: ${carfaxUrl}`);
      return carfaxUrl;
    }
    
    // No Carfax URL found
    return null;
  } catch (error) {
    console.error(`Error extracting Carfax URL: ${error}`);
    return null;
  }
}

/**
 * Parse a vehicle title to extract year, make, and model
 */
function parseVehicleTitle(title: string): { year: number, make: string, model: string } {
  const result = {
    year: 0,
    make: '',
    model: ''
  };
  
  try {
    // Strip common prefixes like "Used" or "New"
    let cleanTitle = title.replace(/^(used|new|pre-owned|certified)\s+/i, '').trim();
    
    // Extract year (4 digit number between 1900 and 2100)
    const yearMatch = cleanTitle.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[0]);
      
      // Remove the year from the title for further processing
      cleanTitle = cleanTitle.replace(yearMatch[0], '').trim();
    }
    
    // Extract make and model
    // List of common makes to help with identification
    const commonMakes = [
      'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick', 'Cadillac', 
      'Chevrolet', 'Chevy', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'Genesis', 
      'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 
      'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Maserati', 'Mazda', 'McLaren', 
      'Mercedes-Benz', 'Mercedes', 'Mercury', 'Mini', 'Mitsubishi', 'Nissan', 'Porsche', 
      'Ram', 'Rolls-Royce', 'Saab', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
    ];
    
    // Try to identify the make
    let makeEndIndex = -1;
    let makeFound = '';
    
    for (const make of commonMakes) {
      if (cleanTitle.includes(make)) {
        const makeIndex = cleanTitle.indexOf(make);
        if (makeIndex >= 0 && (makeEndIndex === -1 || makeIndex < makeEndIndex)) {
          makeEndIndex = makeIndex + make.length;
          makeFound = make;
        }
      }
    }
    
    if (makeFound) {
      result.make = makeFound;
      
      // Extract model from text after the make
      if (makeEndIndex < cleanTitle.length) {
        const modelText = cleanTitle.substring(makeEndIndex).trim();
        
        // Take the first word as the base model, or more if it looks like a multi-word model
        const modelParts = modelText.split(/\s+/);
        if (modelParts.length > 0) {
          // Check for common multi-word models
          if (modelParts.length >= 2 && 
              (modelParts[0] + ' ' + modelParts[1]).match(/grand (cherokee|caravan|prix)|range rover|land cruiser|model [a-z]/i)) {
            result.model = modelParts[0] + ' ' + modelParts[1];
          } else {
            result.model = modelParts[0];
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error parsing vehicle title: ${error}`);
    return result;
  }
}

/**
 * Parse a price string to extract the numeric price
 */
function parsePrice(priceText: string): number {
  try {
    if (!priceText) return 0;
    
    // Remove all non-numeric characters except decimal points
    const numericText = priceText.replace(/[^\d.]/g, '');
    
    // Parse as float and convert to integer (whole dollars)
    const price = parseFloat(numericText);
    
    // Check if the resulting price is reasonable (between $100 and $10M)
    if (!isNaN(price) && price >= 100 && price < 10000000) {
      return Math.round(price);
    }
    
    return 0;
  } catch (error) {
    console.error(`Error parsing price: ${error}`);
    return 0;
  }
}

/**
 * Parse a mileage string to extract the numeric mileage
 */
function parseMileage(mileageText: string): number {
  try {
    if (!mileageText) return 0;
    
    // Remove all non-numeric characters
    const numericText = mileageText.replace(/[^\d]/g, '');
    
    // Parse as integer
    const mileage = parseInt(numericText);
    
    // Check if the resulting mileage is reasonable (between 1 and 1M)
    if (!isNaN(mileage) && mileage > 0 && mileage < 1000000) {
      return mileage;
    }
    
    return 0;
  } catch (error) {
    console.error(`Error parsing mileage: ${error}`);
    return 0;
  }
}

/**
 * Check if a URL is a valid image URL
 */
function isValidImageUrl(url: string): boolean {
  try {
    // Check for common image formats
    const lowerUrl = url.toLowerCase();
    
    // Must be a fully qualified URL
    if (!lowerUrl.startsWith('http')) return false;
    
    // Check for common image extensions
    if (lowerUrl.endsWith('.jpg') || 
        lowerUrl.endsWith('.jpeg') || 
        lowerUrl.endsWith('.png') || 
        lowerUrl.endsWith('.webp') || 
        lowerUrl.endsWith('.gif')) {
      return true;
    }
    
    // Check for CDN image URLs that may not have extensions
    if ((lowerUrl.includes('.cdn.') || lowerUrl.includes('images.') || lowerUrl.includes('/images/')) &&
        !lowerUrl.includes('icon') && 
        !lowerUrl.includes('logo')) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking image URL: ${error}`);
    return false;
  }
}