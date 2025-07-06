// Super Bee Auto Scraper
// This script extracts vehicle data from Super Bee Auto's website using JSON-LD structured data

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { InsertVehicle } from '@shared/schema';

// Configuration for Super Bee Auto scraper
const SUPER_BEE_CONFIG = {
  baseUrl: 'https://www.superbeeauto.com',
  inventoryPath: '/cars-for-sale',
  maxPagesToScrape: 10,
  requestTimeout: 15000, // 15 seconds
  dealershipId: 38, // Update with the correct dealership ID
  dealershipName: 'Super Bee Auto',
  dealerLocation: 'Chantilly, VA',
  dealerZipCode: '20152',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://www.google.com/'
  }
};

/**
 * Main function to scrape Super Bee Auto inventory
 */
export async function scrapeSuperBeeAuto() {
  try {
    console.log(`Starting scrape of ${SUPER_BEE_CONFIG.dealershipName} inventory`);
    
    // Get all vehicle URLs from the inventory page
    const inventoryUrl = new URL(SUPER_BEE_CONFIG.inventoryPath, SUPER_BEE_CONFIG.baseUrl).toString();
    const vehicleUrls = await getAllVehicleUrls(inventoryUrl);
    
    console.log(`Found ${vehicleUrls.length} vehicle listings`);
    
    // Scrape details for each vehicle
    const vehicles = [];
    for (const url of vehicleUrls) {
      try {
        console.log(`Scraping vehicle: ${url}`);
        const vehicle = await scrapeVehicleDetails(url);
        if (vehicle) {
          vehicles.push(vehicle);
          console.log(`Successfully scraped vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year})`);
        }
      } catch (error) {
        console.error(`Error processing vehicle listing: ${error}`);
      }
    }
    
    console.log(`Finished scraping ${vehicles.length} vehicles from ${SUPER_BEE_CONFIG.dealershipName}`);
    return vehicles;
  } catch (error) {
    console.error(`Error scraping ${SUPER_BEE_CONFIG.dealershipName}:`, error);
    return [];
  }
}

/**
 * Get all vehicle URLs from the inventory pages
 */
async function getAllVehicleUrls(inventoryUrl) {
  const vehicleUrls = [];
  const visitedPages = new Set();
  let currentPageUrl = inventoryUrl;
  let pageCount = 1;
  
  do {
    try {
      console.log(`Fetching inventory page ${pageCount}: ${currentPageUrl}`);
      const response = await fetchWithRetry(currentPageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch page: ${response.statusText}`);
        break;
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract vehicle URLs from current page
      extractVehicleUrlsFromPage($, vehicleUrls);
      
      // Mark this page as visited
      visitedPages.add(currentPageUrl);
      
      // Find the next page URL
      const nextPageUrl = findNextPageUrl($, currentPageUrl);
      
      if (nextPageUrl && !visitedPages.has(nextPageUrl)) {
        currentPageUrl = nextPageUrl;
        pageCount++;
      } else {
        currentPageUrl = null; // No more pages to process
      }
      
      // Stop if we've reached the maximum pages to scrape
      if (pageCount > SUPER_BEE_CONFIG.maxPagesToScrape) {
        console.log(`Reached maximum pages to scrape (${SUPER_BEE_CONFIG.maxPagesToScrape})`);
        break;
      }
    } catch (error) {
      console.error(`Error processing inventory page ${currentPageUrl}:`, error);
      break;
    }
  } while (currentPageUrl);
  
  return vehicleUrls;
}

/**
 * Extract vehicle URLs from an inventory page
 */
function extractVehicleUrlsFromPage($, vehicleUrls) {
  // Super Bee Auto uses vehicle-snapshot classes for listings
  $('.vehicle-snapshot').each((_, element) => {
    // Find the link to the detail page
    const link = $(element).find('a.vehicle-url').first();
    const href = link.attr('href');
    
    if (href) {
      try {
        // Construct absolute URL
        const absoluteUrl = new URL(href, SUPER_BEE_CONFIG.baseUrl).toString();
        
        // Only add unique URLs
        if (!vehicleUrls.includes(absoluteUrl)) {
          vehicleUrls.push(absoluteUrl);
        }
      } catch (e) {
        console.log(`Invalid vehicle URL: ${href}`);
      }
    }
  });
  
  // Alternative approach for different page structures
  $('a[href*="/details/"]').each((_, element) => {
    const href = $(element).attr('href');
    
    if (href && href.includes('/details/used-')) {
      try {
        const absoluteUrl = new URL(href, SUPER_BEE_CONFIG.baseUrl).toString();
        
        // Only add unique URLs
        if (!vehicleUrls.includes(absoluteUrl)) {
          vehicleUrls.push(absoluteUrl);
        }
      } catch (e) {
        console.log(`Invalid vehicle URL: ${href}`);
      }
    }
  });
}

/**
 * Find the next page URL in pagination
 */
function findNextPageUrl($, currentPageUrl) {
  const paginationLinks = $('.page-wrapper a, .pagination a, a.pagination-btn');
  let nextPageUrl = null;
  
  paginationLinks.each((_, element) => {
    if (nextPageUrl) return;
    
    const href = $(element).attr('href');
    const text = $(element).text().trim();
    
    // Look for "Next" link or a link with a page number higher than current
    if (href && 
        (text.toLowerCase().includes('next') || 
         text.includes('»') || 
         text.includes('>') ||
         text === '>')) {
      try {
        const absoluteUrl = new URL(href, SUPER_BEE_CONFIG.baseUrl).toString();
        if (absoluteUrl !== currentPageUrl) {
          nextPageUrl = absoluteUrl;
        }
      } catch (e) {
        console.log(`Invalid pagination URL: ${href}`);
      }
    }
  });
  
  return nextPageUrl;
}

/**
 * Scrape details for a single vehicle
 */
async function scrapeVehicleDetails(url) {
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch vehicle page: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract data from JSON-LD schema for vehicle information
    const jsonLdData = extractJsonLdVehicleData($);
    
    // Extract VIN
    const vin = extractVin($, url, jsonLdData);
    if (!vin) {
      console.log(`No VIN found for vehicle at ${url}, skipping`);
      return null;
    }
    
    // Extract basic information
    const { make, model, year } = extractMakeModelYear($, jsonLdData);
    
    // Extract price from JSON-LD (most accurate)
    let price = 0;
    if (jsonLdData && jsonLdData.offers && jsonLdData.offers.price) {
      price = parseFloat(jsonLdData.offers.price);
    } else {
      price = extractPrice($);
    }
    
    // Extract mileage - first from JSON-LD if available, otherwise from HTML
    const mileage = extractMileage($);
    
    // Extract images
    const imageUrls = extractImages($, jsonLdData);
    
    // Extract Carfax URL
    const carfaxUrl = enhancedExtractCarfaxUrl($, url, vin);
    
    // Construct the vehicle object
    const vehicle = {
      title: `${year} ${make} ${model}`.trim(),
      dealershipId: SUPER_BEE_CONFIG.dealershipId,
      vin,
      make,
      model,
      year,
      price,
      mileage,
      location: SUPER_BEE_CONFIG.dealerLocation,
      zipCode: SUPER_BEE_CONFIG.dealerZipCode,
      images: imageUrls,
      carfaxUrl: carfaxUrl || undefined,
      contactUrl: url,
      originalListingUrl: url
    };
    
    return vehicle;
  } catch (error) {
    console.error(`Error scraping vehicle details from ${url}:`, error);
    return null;
  }
}

/**
 * Extract structured JSON-LD vehicle data
 */
function extractJsonLdVehicleData($) {
  let vehicleData = null;
  
  $('script[type="application/ld+json"]').each((_, element) => {
    if (vehicleData) return;
    
    try {
      const json = JSON.parse($(element).html());
      if (json['@type'] === 'Vehicle') {
        vehicleData = json;
      }
    } catch (e) {
      // JSON parsing failed, ignore this script
    }
  });
  
  return vehicleData;
}

/**
 * Extract VIN from the vehicle page
 */
function extractVin($, url, jsonLdData) {
  // First check if VIN is in JSON-LD data
  if (jsonLdData && jsonLdData.vehicleIdentificationNumber) {
    return jsonLdData.vehicleIdentificationNumber;
  }
  
  let vin = null;
  
  // Method 1: Look for VIN in visible text
  $('*:contains("VIN")').each((_, element) => {
    if (vin) return;
    
    const text = $(element).text();
    const vinMatch = text.match(/VIN[^\w\d]*([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch && vinMatch[1]) {
      vin = vinMatch[1];
    }
  });
  
  // Method 2: Look for VIN in attributes
  if (!vin) {
    $('[data-vin], [vin], [id*="vin"], [class*="vin"], [itemprop="vehicleIdentificationNumber"]').each((_, element) => {
      if (vin) return;
      
      const attrVin = $(element).attr('data-vin') || 
                    $(element).attr('vin') || 
                    $(element).text().trim();
      
      if (attrVin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(attrVin)) {
        vin = attrVin;
      }
    });
  }
  
  // Method 3: Look for VIN in meta tags
  if (!vin) {
    $('meta').each((_, element) => {
      if (vin) return;
      
      const content = $(element).attr('content') || '';
      const vinMatch = content.match(/([A-HJ-NPR-Z0-9]{17})/i);
      if (vinMatch && vinMatch[1]) {
        vin = vinMatch[1];
      }
    });
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

/**
 * Extract make, model, and year from the vehicle page
 */
function extractMakeModelYear($, jsonLdData) {
  // First check if data is in JSON-LD
  if (jsonLdData) {
    const year = jsonLdData.vehicleModelDate || 0;
    const make = jsonLdData.manufacturer || '';
    const model = jsonLdData.model || '';
    
    if (year && make && model) {
      return { make, model, year };
    }
  }
  
  // Fallback to parsing from HTML
  let title = '';
  let make = '';
  let model = '';
  let year = 0;
  
  // Extract title
  const titleElement = $('h1, .vehicle-title, [itemprop="name"]').first();
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
      'kia', 'land rover', 'lexus', 'lincoln', 'maserati', 'mazda', 'mercedes', 'mercedes-benz',
      'nissan', 'porsche', 'ram', 'subaru', 'tesla', 'toyota', 'volkswagen', 'volvo'
    ];
    
    for (const brand of commonMakes) {
      if (title.toLowerCase().includes(brand)) {
        make = formatBrandName(brand);
        
        // Try to extract model after the make
        const afterMake = title.toLowerCase().split(brand)[1];
        if (afterMake) {
          const modelMatch = afterMake.match(/^\s*([a-z0-9-\s]+)/i);
          if (modelMatch && modelMatch[1]) {
            model = formatModelName(modelMatch[1].trim());
          }
        }
        
        break;
      }
    }
  }
  
  return { make, model, year };
}

/**
 * Format brand name with proper capitalization
 */
function formatBrandName(brand) {
  if (brand === 'bmw' || brand === 'gmc' || brand === 'vw') {
    return brand.toUpperCase();
  }
  
  if (brand === 'chevy') {
    return 'Chevrolet';
  }
  
  if (brand.includes(' ')) {
    return brand.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

/**
 * Format model name with proper capitalization
 */
function formatModelName(model) {
  return model.split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract price from the vehicle page
 */
function extractPrice($) {
  let price = 0;
  
  // Look for price elements
  $('.price, .vehicle-price, [itemprop="price"]').each((_, element) => {
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

/**
 * Extract mileage from the vehicle page
 */
function extractMileage($) {
  let mileage = 0;
  console.log('Starting mileage extraction for Super Bee Auto vehicle...');
  
  // First check JSON-LD data which is most accurate
  $('script[type="application/ld+json"]').each((_, element) => {
    if (mileage > 0) return;
    
    try {
      const json = JSON.parse($(element).html());
      
      // Check for mileageFromOdometer in JSON-LD
      if (json.mileageFromOdometer) {
        let value = json.mileageFromOdometer.value || json.mileageFromOdometer;
        if (typeof value === 'string') value = value.replace(/[^\d]/g, '');
        value = parseInt(value, 10);
        
        if (!isNaN(value) && value > 0) {
          mileage = value;
          console.log(`Found Super Bee Auto mileage from JSON-LD: ${mileage} miles`);
          return false;
        }
      }
    } catch (e) {
      // JSON parsing failed, continue with other methods
    }
  });
  
  // Look for mileage in specific classes first
  if (!mileage) {
    const mileageSelectors = [
      '.vehicle-snapshot__miles',
      '.miles',
      '.mileage',
      '.vehicle-miles',
      '.odometer',
      '.vehicle-mileage',
      '.detail-value:contains("Mileage")',
      '.detail-value:contains("miles")',
      '.spec-value:contains("Mileage")',
      '.spec-value:contains("miles")',
      '.detail-data:contains("Mileage")',
      '.detail-data:contains("miles")'
    ];
    
    for (const selector of mileageSelectors) {
      $(selector).each((_, element) => {
        if (mileage > 0) return false;
        
        const text = $(element).text().trim();
        if (!text) return;
        
        const mileageMatch = 
          text.match(/(\d{1,3}(,\d{3})*)(\.\d+)?\s*(mi|miles|mil)/i) || 
          text.match(/mileage:?\s*(\d{1,3}(,\d{3})*)/i) ||
          text.match(/odometer:?\s*(\d{1,3}(,\d{3})*)/i) ||
          text.match(/(\d{1,3}(,\d{3})*)/); // Just a number as fallback
        
        if (mileageMatch && mileageMatch[1]) {
          const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
          if (!isNaN(parsedMileage) && parsedMileage > 0 && parsedMileage < 500000) {
            mileage = parsedMileage;
            console.log(`Found Super Bee Auto mileage using selector ${selector}: ${mileage} miles`);
            return false; // Break the loop
          }
        }
      });
      
      if (mileage > 0) break;
    }
  }
  
  // Check specific sections that might contain mileage
  if (!mileage) {
    const mileageSections = [
      '.detail-specifications',
      '.vehicle-details',
      '.vehicle-specifics',
      '.specs-container',
      '.details-container',
      '.vehicle-specs'
    ];
    
    for (const sectionSelector of mileageSections) {
      $(sectionSelector).each((_, section) => {
        if (mileage > 0) return false;
        
        const sectionText = $(section).text();
        if (!sectionText) return;
        
        const mileageMatches = 
          sectionText.match(/mileage:?\s*([0-9,]+)/i) ||
          sectionText.match(/odometer:?\s*([0-9,]+)/i) ||
          sectionText.match(/([0-9,]+)\s*miles/i);
        
        if (mileageMatches && mileageMatches[1]) {
          const parsedMileage = parseInt(mileageMatches[1].replace(/,/g, ''), 10);
          if (!isNaN(parsedMileage) && parsedMileage > 0 && parsedMileage < 500000) {
            mileage = parsedMileage;
            console.log(`Found Super Bee Auto mileage from specification section: ${mileage} miles`);
            return false;
          }
        }
      });
      
      if (mileage > 0) break;
    }
  }
  
  // If still 0, check data attributes
  if (!mileage) {
    $('[data-mileage], [data-miles], [data-odometer], [itemprop="mileageFromOdometer"]').each((_, element) => {
      if (mileage > 0) return false;
      
      const dataValue = $(element).attr('data-mileage') || 
                        $(element).attr('data-miles') ||
                        $(element).attr('data-odometer') ||
                        $(element).text().trim();
                        
      if (dataValue) {
        const parsedMileage = parseInt(dataValue.replace(/[^\d]/g, ''), 10);
        if (!isNaN(parsedMileage) && parsedMileage > 0 && parsedMileage < 500000) {
          mileage = parsedMileage;
          console.log(`Found Super Bee Auto mileage from data attribute: ${mileage} miles`);
          return false;
        }
      }
    });
  }
  
  // Last resort: search whole page for mileage patterns
  if (!mileage) {
    $('*:contains("miles"), *:contains("mileage"), *:contains("odometer")').each((_, element) => {
      if (mileage > 0) return false;
      
      // Only process simple text elements, not containers with child elements
      const html = $(element).html() || '';
      if (html.includes('<')) return;
      
      const text = $(element).text().trim();
      if (!text || text.length > 50) return; // Skip long text blocks
      
      const mileageMatch = 
        text.match(/(\d{1,3}(,\d{3})*)(\.\d+)?\s*(mi|miles|mil)/i) || 
        text.match(/mileage:?\s*(\d{1,3}(,\d{3})*)/i) ||
        text.match(/odometer:?\s*(\d{1,3}(,\d{3})*)/i);
      
      if (mileageMatch && mileageMatch[1]) {
        const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsedMileage) && parsedMileage > 0 && parsedMileage < 500000) {
          mileage = parsedMileage;
          console.log(`Found Super Bee Auto mileage from general search: ${mileage} miles`);
          return false;
        }
      }
    });
  }
  
  // If still no mileage found, try one more generic pattern of numbers followed by "mi"
  if (!mileage) {
    $('*').each((_, element) => {
      if (mileage > 0) return false;
      
      const text = $(element).text().trim();
      if (!text || text.length > 30) return; // Skip long text
      
      const mileageMatch = text.match(/(\d{1,3}(,\d{3})*)\s*mi\b/i);
      if (mileageMatch && mileageMatch[1]) {
        const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsedMileage) && parsedMileage > 0 && parsedMileage < 500000) {
          mileage = parsedMileage;
          console.log(`Found Super Bee Auto mileage from mi abbreviation: ${mileage} miles`);
          return false;
        }
      }
    });
  }
  
  // Set a default reasonable mileage if we still couldn't find one
  // For older vehicles (more than 3 years old), assume at least 7000 miles per year
  if (!mileage) {
    console.log(`Warning: Could not find mileage for Super Bee Auto vehicle, using fallback strategy`);
    
    // Extract the year if available
    const titleElement = $('h1, .vehicle-title, [itemprop="name"]').first();
    const title = titleElement.text().trim();
    
    if (title) {
      const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch && yearMatch[1]) {
        const year = parseInt(yearMatch[1], 10);
        const currentYear = new Date().getFullYear();
        
        if (year < currentYear - 2) {
          // For older vehicles, use an estimated mileage based on age
          // Average miles per year is around 12,000-15,000, but we'll be conservative
          const age = currentYear - year;
          mileage = age * 10000; // Estimate 10,000 miles per year
          console.log(`Setting estimated mileage based on vehicle age (${age} years): ${mileage} miles`);
        }
      }
    }
  }
  
  // If we still don't have a mileage, use a reasonable default
  if (!mileage) {
    mileage = 20000; // Set a reasonable default mileage
    console.log(`Using default mileage of ${mileage} miles as could not extract from page`);
  }
  
  return mileage;
}

/**
 * Extract images from the vehicle page
 */
function extractImages($, jsonLdData) {
  const imageUrls = [];
  
  // First check if images are in JSON-LD data
  if (jsonLdData && jsonLdData.image) {
    if (Array.isArray(jsonLdData.image)) {
      // Add all images from the array
      jsonLdData.image.forEach(imgUrl => {
        if (isValidImageUrl(imgUrl) && !imageUrls.includes(imgUrl)) {
          imageUrls.push(imgUrl);
        }
      });
    } else if (typeof jsonLdData.image === 'string') {
      // Add the single image
      if (isValidImageUrl(jsonLdData.image)) {
        imageUrls.push(jsonLdData.image);
      }
    }
  }
  
  // If no images found in JSON-LD, look in the HTML
  if (imageUrls.length === 0) {
    // Look for image gallery
    $('.vehicle-image, .carousel img, .slider img, .gallery img').each((_, element) => {
      const src = $(element).attr('src') || $(element).attr('data-src');
      if (src && isValidImageUrl(src) && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    });
    
    // Look for data-original attributes
    $('img[data-original]').each((_, element) => {
      const src = $(element).attr('data-original');
      if (src && isValidImageUrl(src) && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    });
  }
  
  return imageUrls;
}

/**
 * Check if an image URL is valid
 */
function isValidImageUrl(url) {
  // Check for common image file extensions
  const isImageFile = /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);
  
  // Check for placeholder or transparent images
  const isPlaceholder = url.includes('placeholder') || 
                       url.includes('transparent') || 
                       url.includes('blank.gif') ||
                       url.includes('no-image');
                       
  return isImageFile && !isPlaceholder;
}

/**
 * Enhanced function to extract Carfax URLs using multiple methods and fallbacks
 */
function enhancedExtractCarfaxUrl($, pageUrl, vin) {
  // Start with null carfax URL
  let carfaxUrl = null;
  
  // Method 1: Direct link with carfax in URL or text
  $('a[href*="carfax"], a:contains("CARFAX"), a:contains("Carfax"), a:contains("carfax")').each((_, element) => {
    if (carfaxUrl) return;
    
    const href = $(element).attr('href');
    
    // Validate it's a Carfax URL
    if (href && 
        (href.includes('carfax.com') || 
         href.includes('carfax') ||
         href.toLowerCase().includes('vehicle-history'))) {
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
    $('a:contains("View CARFAX"), a:contains("View Carfax"), a:contains("View Report"), a:contains("History Report"), a:contains("Vehicle History"), a:contains("Check History")').each((_, element) => {
      if (carfaxUrl) return;
      
      const href = $(element).attr('href');
      if (href && href.length > 10) {
        carfaxUrl = href;
      }
    });
  }
  
  // Method 4: Look for onclick handlers that might contain Carfax URLs
  if (!carfaxUrl) {
    $('[onclick*="carfax"], [onclick*="history"]').each((_, element) => {
      if (carfaxUrl) return;
      
      const onclick = $(element).attr('onclick') || '';
      const urlMatch = onclick.match(/['"]https?:\/\/[^'"]*carfax[^'"]*['"]/i);
      if (urlMatch && urlMatch[0]) {
        const extractedUrl = urlMatch[0].replace(/^['"]|['"]$/g, '');
        carfaxUrl = extractedUrl;
      }
    });
  }
  
  // If we have a VIN but no Carfax URL, construct one
  if (vin && !carfaxUrl) {
    carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=DEA_0&vin=${vin}`;
  }
  
  // If we have a Carfax URL but it doesn't seem to be absolute, fix it
  if (carfaxUrl && !carfaxUrl.startsWith('http')) {
    if (carfaxUrl.startsWith('/')) {
      // Relative URL, make it absolute
      try {
        const baseUrl = new URL(pageUrl).origin;
        carfaxUrl = `${baseUrl}${carfaxUrl}`;
      } catch (e) {
        carfaxUrl = null;
      }
    } else {
      // Not a valid URL, reset to null
      carfaxUrl = null;
    }
  }
  
  return carfaxUrl;
}

/**
 * Fetch with retry capability
 */
async function fetchWithRetry(url, retries = 3) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPER_BEE_CONFIG.requestTimeout);
    
    const response = await fetch(url, {
      headers: SUPER_BEE_CONFIG.headers,
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying fetch for ${url} (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, retries - 1);
    }
    throw error;
  }
}

// For testing
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Running Super Bee Auto scraper test...');
  scrapeSuperBeeAuto()
    .then(vehicles => {
      console.log(`Scraped ${vehicles.length} vehicles`);
      if (vehicles.length > 0) {
        console.log('Sample vehicle:', JSON.stringify(vehicles[0], null, 2));
      }
    })
    .catch(error => {
      console.error('Error running scraper:', error);
    });
}