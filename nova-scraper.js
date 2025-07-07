import fetch from 'node-fetch';
import { InsertVehicle } from '@shared/schema';
import * as cheerio from 'cheerio';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Configuration for Nova Autoland scraper
const NOVA_AUTOLAND_CONFIG = {
  baseUrl: 'https://novaautoland.com',
  inventoryPath: '/inventory?clearall=1',
  maxPagesToScrape: 20,
  requestTimeout: 15000, // 15 seconds
  rateLimit: 2000, // ms between requests
  maxConcurrentRequests: 2,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://www.google.com/',
    'Accept-Encoding': 'gzip, deflate, br'
  },
  debug: process.env.NODE_ENV !== 'production',
  debugLimit: 3,
  proxy: {
    enabled: process.env.USE_PROXY === 'true',
    url: process.env.PROXY_URL || 'http://your-proxy:port',
    auth: {
      username: process.env.PROXY_USERNAME || '',
      password: process.env.PROXY_PASSWORD || ''
    }
  }
};

export async function scrapeNovaAutoland(dealershipUrl, dealershipId, dealershipName) {
  try {
    if (NOVA_AUTOLAND_CONFIG.debug) {
      console.log('DEBUG MODE ENABLED - LIMITED SCRAPING');
    }
    
    console.log(`Starting scrape of Nova Autoland inventory`);
    
    const inventoryUrl = new URL(NOVA_AUTOLAND_CONFIG.inventoryPath, NOVA_AUTOLAND_CONFIG.baseUrl).toString();
    let vehicleUrls = await getAllVehicleUrls(inventoryUrl);
    
    if (NOVA_AUTOLAND_CONFIG.debug && NOVA_AUTOLAND_CONFIG.debugLimit) {
      vehicleUrls = vehicleUrls.slice(0, NOVA_AUTOLAND_CONFIG.debugLimit);
      console.log(`DEBUG: Limited to ${vehicleUrls.length} vehicles`);
    }
    
    console.log(`Found ${vehicleUrls.length} vehicle listings`);
    
    const vehicles = [];
    const scrapingPromises = [];
    
    // Process vehicles with concurrency control
    for (let i = 0; i < vehicleUrls.length; i += NOVA_AUTOLAND_CONFIG.maxConcurrentRequests) {
      const batch = vehicleUrls.slice(i, i + NOVA_AUTOLAND_CONFIG.maxConcurrentRequests);
      const batchPromises = batch.map(url => 
        scrapeVehicleWithDelay(url, dealershipId, dealershipName, i * NOVA_AUTOLAND_CONFIG.rateLimit)
      );
      const batchResults = await Promise.all(batchPromises);
      vehicles.push(...batchResults.filter(v => v));
      
      if (NOVA_AUTOLAND_CONFIG.debug && vehicles.length >= NOVA_AUTOLAND_CONFIG.debugLimit) {
        break; // Early exit in debug mode
      }
    }
    
    console.log(`Finished scraping ${vehicles.length} vehicles from Nova Autoland`);
    return vehicles;
  } catch (error) {
    console.error(`Error scraping Nova Autoland:`, error);
    return [];
  }
}

async function scrapeVehicleWithDelay(url, dealershipId, dealershipName, delay) {
  await new Promise(resolve => setTimeout(resolve, delay));
  try {
    console.log(`Scraping vehicle listing: ${url}`);
    const vehicle = await scrapeVehicleDetails(url, dealershipId, dealershipName);
    if (vehicle) {
      console.log(`Successfully scraped vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year})`);
      return vehicle;
    }
  } catch (error) {
    console.error(`Error processing vehicle listing: ${error}`);
    return null;
  }
}

async function getAllVehicleUrls(inventoryUrl) {
  const vehicleUrls = [];
  const visitedPages = new Set();
  let currentPageUrl = inventoryUrl;
  
  do {
    try {
      console.log(`Fetching inventory page: ${currentPageUrl}`);
      const response = await fetchWithRetry(currentPageUrl);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract vehicle URLs from current page
      extractVehicleUrlsFromPage($, NOVA_AUTOLAND_CONFIG.baseUrl, vehicleUrls);
      
      // Find next page URL
      const nextPageUrl = findNextPageUrl($, currentPageUrl);
      
      // Mark this page as visited
      visitedPages.add(currentPageUrl);
      
      if (nextPageUrl && !visitedPages.has(nextPageUrl)) {
        currentPageUrl = nextPageUrl;
      } else {
        currentPageUrl = ''; // No more pages
      }
      
      // Stop if we've reached the maximum pages to scrape
      if (visitedPages.size >= NOVA_AUTOLAND_CONFIG.maxPagesToScrape) {
        console.log(`Reached maximum pages to scrape (${NOVA_AUTOLAND_CONFIG.maxPagesToScrape})`);
        break;
      }
      
      // Rate limiting between page requests
      await new Promise(resolve => setTimeout(resolve, NOVA_AUTOLAND_CONFIG.rateLimit));
    } catch (error) {
      console.error(`Error processing inventory page ${currentPageUrl}:`, error);
      break;
    }
  } while (currentPageUrl);
  
  return vehicleUrls;
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NOVA_AUTOLAND_CONFIG.requestTimeout);
      
      const fetchOptions = {
        headers: {
          ...NOVA_AUTOLAND_CONFIG.headers,
          'User-Agent': NOVA_AUTOLAND_CONFIG.userAgent
        },
        signal: controller.signal
      };
      
      // Add proxy if enabled
      if (NOVA_AUTOLAND_CONFIG.proxy.enabled) {
        fetchOptions.agent = new HttpsProxyAgent({
          host: NOVA_AUTOLAND_CONFIG.proxy.url,
          auth: `${NOVA_AUTOLAND_CONFIG.proxy.auth.username}:${NOVA_AUTOLAND_CONFIG.proxy.auth.password}`
        });
      }
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeout);
      
      // Handle special status codes
      if (response.status === 403) {
        throw new Error('Blocked by security (403)');
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 5;
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = 1000 * (i + 1);
      console.log(`Retrying fetch for ${url} in ${delay}ms (${retries - i - 1} retries left)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function extractVehicleUrlsFromPage($, baseUrl, vehicleUrls) {
  // Nova Autoland uses specific selectors for vehicle items
  const vehicleItems = $('.inventory-container, .inventory-item, .vehicle-item');
  
  vehicleItems.each((_, element) => {
    const vehicleLink = $(element).find('a[href*="/inventory/"], a[href*="/vehicle/"]').first();
    const href = vehicleLink.attr('href');
    
    if (href) {
      try {
        const absoluteUrl = new URL(href, baseUrl).toString();
        if (!vehicleUrls.includes(absoluteUrl)) {
          vehicleUrls.push(absoluteUrl);
          console.log(`Found vehicle: ${absoluteUrl}`);
        }
      } catch (e) {
        console.log(`Invalid vehicle URL: ${href}`);
      }
    }
  });
}

function findNextPageUrl($, currentPageUrl) {
  // Nova Autoland uses a specific pagination pattern
  const paginationLinks = $('.pagination a, .page-item a, a[href*="page="]');
  let nextPageUrl = null;
  
  paginationLinks.each((_, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().toLowerCase().trim();
    
    if (href && (text.includes('next') || /page \d+/i.test(text))) {
      try {
        const url = new URL(href, NOVA_AUTOLAND_CONFIG.baseUrl).toString();
        if (url !== currentPageUrl) {
          nextPageUrl = url;
          return false; // Break the loop
        }
      } catch (e) {
        console.log(`Invalid pagination URL: ${href}`);
      }
    }
  });
  
  return nextPageUrl;
}

async function scrapeVehicleDetails(url, dealershipId, dealershipName) {
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch vehicle page: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract VIN
    const vin = extractVin($, url);
    if (!vin) {
      console.log(`No VIN found for vehicle at ${url}, skipping`);
      return null;
    }
    
    // Extract basic vehicle info
    const { make, model, year } = extractMakeModelYear($);
    const price = extractPrice($);
    const mileage = extractMileage($);
    const { exteriorColor, interiorColor } = extractColors($);
    const { bodyType, fuelType, transmission, drivetrain } = extractTechnicalDetails($);
    const description = extractDescription($);
    const imageUrls = extractImages($, url);
    const carfaxUrl = enhancedExtractCarfaxUrl($, url, vin);
    const features = extractFeatures($);
    
    // Construct the vehicle object
    const vehicle = {
      title: `${year} ${make} ${model}`.trim(),
      dealershipId: dealershipId,
      vin,
      make,
      model,
      year,
      price,
      mileage,
      exteriorColor,
      interiorColor,
      bodyType,
      fuelType,
      transmission,
      drivetrain,
      description,
      location: 'McLean, VA',
      zipCode: '22102',
      images: imageUrls,
      carfaxUrl: carfaxUrl || undefined,
      contactUrl: url,
      originalListingUrl: url,
      features,
      scrapedAt: new Date().toISOString()
    };
    
    return vehicle;
  } catch (error) {
    console.error(`Error scraping vehicle details from ${url}:`, error);
    return null;
  }
}

function extractVin($, url) {
  // Method 1: Look for VIN in visible text
  let vin = findVinInText($);
  
  // Method 2: Look for VIN in various common attributes
  if (!vin) {
    vin = findVinInAttributes($);
  }
  
  // Method 3: Search in meta tags
  if (!vin) {
    vin = findVinInMetaTags($);
  }
  
  // Method 4: Look for VIN in URL
  if (!vin) {
    const urlVinMatch = url.match(/([A-HJ-NPR-Z0-9]{17})/i);
    if (urlVinMatch && urlVinMatch[1]) {
      vin = urlVinMatch[1];
    }
  }
  
  return vin;
}

function findVinInText($) {
  let foundVin = null;
  
  $('*:contains("VIN")').each((_, element) => {
    if (foundVin) return;
    
    const text = $(element).text();
    const vinMatch = text.match(/VIN[^\w\d]*([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch && vinMatch[1]) {
      foundVin = vinMatch[1];
    }
  });
  
  return foundVin;
}

function findVinInAttributes($) {
  let foundVin = null;
  
  $('[data-vin], [vin], [id*="vin"], [class*="vin"], [itemprop="vehicleIdentificationNumber"]').each((_, element) => {
    if (foundVin) return;
    
    const attrVin = $(element).attr('data-vin') || 
                   $(element).attr('vin') || 
                   $(element).text().trim();
    
    if (attrVin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(attrVin)) {
      foundVin = attrVin;
    }
  });
  
  return foundVin;
}

function findVinInMetaTags($) {
  let foundVin = null;
  
  $('meta').each((_, element) => {
    if (foundVin) return;
    
    const content = $(element).attr('content') || '';
    const vinMatch = content.match(/([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch && vinMatch[1]) {
      foundVin = vinMatch[1];
    }
  });
  
  return foundVin;
}

function extractMakeModelYear($) {
  let title = '';
  let make = '';
  let model = '';
  let year = 0;
  
  // Extract title from Nova Autoland's specific structure
  const titleElement = $('h1.vehicle-title, .vehicle-name, [itemprop="name"]').first();
  title = titleElement.text().trim();
  
  // If no title found, check meta tags
  if (!title) {
    $('meta[property="og:title"], meta[name="title"]').each((_, element) => {
      if (title) return;
      
      const content = $(element).attr('content');
      if (content && content.length > 5) {
        title = content.trim();
      }
    });
  }
  
  // Parse year, make, model from title
  if (title) {
    // Extract year (4 digit number between 1900 and current year + 1)
    const currentYear = new Date().getFullYear();
    const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch && yearMatch[1]) {
      const parsedYear = parseInt(yearMatch[1], 10);
      if (parsedYear >= 1900 && parsedYear <= currentYear + 1) {
        year = parsedYear;
      }
    }
    
    // Extract make and model
    const commonMakes = [
      'acura', 'audi', 'bmw', 'buick', 'cadillac', 'chevrolet', 'chevy', 'chrysler', 
      'dodge', 'ford', 'gmc', 'honda', 'hyundai', 'infiniti', 'jaguar', 'jeep', 
      'kia', 'land rover', 'lexus', 'lincoln', 'maserati', 'mazda', 'mercedes-benz',
      'nissan', 'porsche', 'ram', 'subaru', 'tesla', 'toyota', 'volkswagen', 'volvo'
    ];
    
    for (const brand of commonMakes) {
      if (title.toLowerCase().includes(brand)) {
        make = formatBrandName(brand);
        
        // Try to extract model after the make
        const afterMake = title.toLowerCase().split(brand)[1];
        if (afterMake) {
          const modelMatch = afterMake.match(/^\s*([a-z0-9-]+)/i);
          if (modelMatch && modelMatch[1]) {
            model = formatModelName(modelMatch[1]);
          }
        }
        
        break;
      }
    }
  }
  
  // Look for structured data as fallback
  $('[itemprop="brand"], [itemprop="manufacturer"]').each((_, element) => {
    if (make) return;
    
    const itemPropMake = $(element).text().trim() || $(element).attr('content');
    if (itemPropMake) {
      make = itemPropMake;
    }
  });
  
  $('[itemprop="model"]').each((_, element) => {
    if (model) return;
    
    const itemPropModel = $(element).text().trim() || $(element).attr('content');
    if (itemPropModel) {
      model = itemPropModel;
    }
  });
  
  $('[itemprop="modelDate"], [itemprop="productionDate"], [itemprop="releaseDate"]').each((_, element) => {
    if (year) return;
    
    const itemPropYear = $(element).text().trim() || $(element).attr('content');
    if (itemPropYear) {
      const parsedYear = parseInt(itemPropYear, 10);
      if (!isNaN(parsedYear)) {
        year = parsedYear;
      }
    }
  });
  
  return { make, model, year };
}

function formatBrandName(brand) {
  if (brand === 'bmw' || brand === 'gmc' || brand === 'vw') {
    return brand.toUpperCase();
  }
  
  if (brand.includes(' ')) {
    return brand.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function formatModelName(model) {
  return model.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

function extractPrice($) {
  let price = 0;
  
  // Try Nova Autoland's specific price selectors first
  $('.price, .vehicle-price, .final-price, [itemprop="price"]').each((_, element) => {
    if (price) return;
    
    const priceText = $(element).text().trim();
    if (priceText && priceText.includes('$')) {
      const priceMatch = priceText.match(/\$\s?(\d{1,3}(,\d{3})*(\.\d+)?)/);
      if (priceMatch && priceMatch[1]) {
        const parsedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (!isNaN(parsedPrice)) {
          price = parsedPrice;
        }
      }
    }
  });
  
  // Fallback to more generic price extraction
  if (!price) {
    $('*:contains("$")').each((_, element) => {
      if (price) return;
      
      const text = $(element).text().trim();
      if (text.length > 30 || text.includes('msrp') || text.includes('starting at')) return;
      
      if (text && text.includes('$')) {
        const priceMatch = text.match(/\$\s?(\d{1,3}(,\d{3})*(\.\d+)?)/);
        if (priceMatch && priceMatch[1]) {
          const parsedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(parsedPrice) && parsedPrice > 0 && parsedPrice < 500000) {
            price = parsedPrice;
          }
        }
      }
    });
  }
  
  return price;
}

function extractMileage($) {
  let mileage = 0;
  
  // Try Nova Autoland's specific mileage selectors first
  $('.mileage, .vehicle-mileage, *:contains("miles"), *:contains("mileage")').each((_, element) => {
    if (mileage) return;
    
    const text = $(element).text().trim();
    const mileageMatch = 
      text.match(/(\d{1,3}(,\d{3})*)(\.\d+)?\s*(mi|miles|mil)/i) || 
      text.match(/mileage:?\s*(\d{1,3}(,\d{3})*)/i);
    
    if (mileageMatch && mileageMatch[1]) {
      const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(parsedMileage)) {
        mileage = parsedMileage;
      }
    }
  });
  
  return mileage;
}

function extractColors($) {
  let exteriorColor = '';
  let interiorColor = '';
  
  // Extract exterior color
  $('*:contains("exterior color"), *:contains("ext. color"), *:contains("color:")').each((_, element) => {
    if (exteriorColor) return;
    
    const text = $(element).text();
    const colorMatch = text.match(/exterior\s*color:?\s*([a-z\s]+)/i) || 
                      text.match(/ext\.\s*color:?\s*([a-z\s]+)/i) ||
                      text.match(/color:?\s*([a-z\s]+)/i);
    if (colorMatch && colorMatch[1]) {
      exteriorColor = colorMatch[1].trim();
    }
  });
  
  // Extract interior color
  $('*:contains("interior color"), *:contains("int. color")').each((_, element) => {
    if (interiorColor) return;
    
    const text = $(element).text();
    const colorMatch = text.match(/interior\s*color:?\s*([a-z\s]+)/i) || 
                      text.match(/int\.\s*color:?\s*([a-z\s]+)/i);
    if (colorMatch && colorMatch[1]) {
      interiorColor = colorMatch[1].trim();
    }
  });
  
  return { exteriorColor, interiorColor };
}

function extractTechnicalDetails($) {
  let bodyType = '';
  let fuelType = '';
  let transmission = '';
  let drivetrain = '';
  
  // Extract body type
  $('*:contains("body"), *:contains("type")').each((_, element) => {
    if (bodyType) return;
    
    const text = $(element).text();
    const bodyMatch = text.match(/body(?:\s*type|style)?:?\s*([a-z\s]+)/i) || 
                     text.match(/type:?\s*([a-z\s]+)/i);
    if (bodyMatch && bodyMatch[1]) {
      bodyType = bodyMatch[1].trim();
    }
  });
  
  // Extract fuel type
  $('*:contains("fuel")').each((_, element) => {
    if (fuelType) return;
    
    const text = $(element).text();
    const fuelMatch = text.match(/fuel(?:\s*type)?:?\s*([a-z\s]+)/i);
    if (fuelMatch && fuelMatch[1]) {
      fuelType = fuelMatch[1].trim();
    }
  });
  
  // Extract transmission
  $('*:contains("transmission")').each((_, element) => {
    if (transmission) return;
    
    const text = $(element).text();
    const transmissionMatch = text.match(/transmission:?\s*([a-z0-9\s\-]+)/i);
    if (transmissionMatch && transmissionMatch[1]) {
      transmission = transmissionMatch[1].trim();
    }
  });
  
  // Extract drivetrain
  $('*:contains("drive"), *:contains("drivetrain")').each((_, element) => {
    if (drivetrain) return;
    
    const text = $(element).text();
    const driveMatch = text.match(/(?:drive(?:train)?|drive\s*type):?\s*([a-z0-9\s\-]+)/i);
    if (driveMatch && driveMatch[1]) {
      drivetrain = driveMatch[1].trim();
    }
  });
  
  return { bodyType, fuelType, transmission, drivetrain };
}

function extractFeatures($) {
  const features = [];
  const featureGroups = {};
  
  // Extract from feature lists
  $('.features-list li, .vehicle-features li, .specs-list li').each((_, el) => {
    const feature = $(el).text().trim();
    if (feature) features.push(feature);
  });
  
  // Extract from specification tables
  $('table.specs tr').each((_, row) => {
    const cols = $(row).find('td');
    if (cols.length === 2) {
      const key = $(cols[0]).text().trim().replace(':', '');
      const value = $(cols[1]).text().trim();
      if (key && value) {
        featureGroups[key] = value;
      }
    }
  });
  
  return {
    individualFeatures: features,
    featureGroups
  };
}

function enhancedExtractCarfaxUrl($, pageUrl, vin) {
  let carfaxUrl = null;
  
  // Method 1: Direct link with carfax in URL or text
  $('a[href*="carfax"], a:contains("CARFAX"), a:contains("Carfax"), a:contains("carfax")').each((_, element) => {
    if (carfaxUrl) return;
    
    const href = $(element).attr('href');
    if (href && (href.includes('carfax.com') || href.includes('carfax'))) {
      carfaxUrl = href;
    }
  });
  
  // Method 2: Look for image links (carfax logo)
  if (!carfaxUrl) {
    $('a:has(img[src*="carfax"]), a:has(img[alt*="carfax"])').each((_, element) => {
      if (carfaxUrl) return;
      
      const href = $(element).attr('href');
      if (href && (href.includes('carfax.com') || href.includes('carfax'))) {
        carfaxUrl = href;
      }
    });
  }
  
  // Method 3: Look for "View Carfax" or similar links
  if (!carfaxUrl) {
    $('a:contains("View CARFAX"), a:contains("View Carfax"), a:contains("View Report")').each((_, element) => {
      if (carfaxUrl) return;
      
      const href = $(element).attr('href');
      if (href && href.length > 10) {
        carfaxUrl = href;
      }
    });
  }
  
  // If we have a VIN but no Carfax URL, construct one
  if (vin && !carfaxUrl) {
    carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=DEA_0&vin=${vin}`;
  }
  
  // Ensure URL is absolute
  if (carfaxUrl && !carfaxUrl.startsWith('http')) {
    try {
      carfaxUrl = new URL(carfaxUrl, NOVA_AUTOLAND_CONFIG.baseUrl).toString();
    } catch (e) {
      carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=DEA_0&vin=${vin}`;
    }
  }
  
  return carfaxUrl || undefined;
}

function extractDescription($) {
  let description = '';
  
  // Try Nova Autoland's specific description selectors
  $('.vehicle-description, [itemprop="description"], .description').each((_, element) => {
    if (description) return;
    
    const text = $(element).text().trim();
    if (text && text.length > 30) {
      description = text;
    }
  });
  
  // If no description found, look for meta description
  if (!description) {
    $('meta[name="description"], meta[property="og:description"]').each((_, element) => {
      if (description) return;
      
      const content = $(element).attr('content');
      if (content && content.length > 10) {
        description = content;
      }
    });
  }
  
  return description;
}

function extractImages($, baseUrl) {
  const images = [];
  const processedUrls = new Set();
  
  // Find all image elements
  $('.vehicle-images img, .carousel img, .slider img, .gallery img').each((_, element) => {
    let src = $(element).attr('data-src') || $(element).attr('src');
    
    if (src && isValidImageUrl(src) && !isPlaceholderImage(src)) {
      try {
        const absoluteUrl = new URL(src, baseUrl).toString();
        if (!processedUrls.has(absoluteUrl)) {
          processedUrls.add(absoluteUrl);
          images.push(absoluteUrl);
        }
      } catch (e) {
        console.log(`Invalid image URL: ${src}`);
      }
    }
  });
  
  return images.slice(0, 20); // Limit to 20 images
}

function isPlaceholderImage(src) {
  return src.includes('placeholder') || 
         src.includes('no-image') || 
         src.includes('default');
}

function isValidImageUrl(url) {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const lowerUrl = url.toLowerCase();
  return validExtensions.some(ext => lowerUrl.endsWith(ext));
}

export default scrapeNovaAutoland;
