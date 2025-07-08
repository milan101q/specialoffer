// new-scraper.ts
// Assuming InsertVehicle type is defined elsewhere and accessible, e.g., from '@shared/schema'
// import { InsertVehicle } from '@shared/schema';

// Placeholder for InsertVehicle type if not using a shared schema
interface InsertVehicle {
  title: string;
  price: number;
  year: number;
  make: string;
  model: string;
  mileage: number;
  vin: string;
  location: string;
  zipCode: string;
  dealershipId: number;
  images: string[];
  carfaxUrl: string | null;
  contactUrl: string | null;
  originalListingUrl: string;
  sortOrder: number;
}

import * as cheerio from 'cheerio';

// Configuration for Nova Autoland scraper
const NOVA_AUTOLAND_CONFIG = {
  baseUrl: 'https://novaautoland.com',
  inventoryPath: '/inventory?clearall=1',
  maxPagesToScrape: 20, // Maximum number of inventory pages to scrape
  requestTimeout: 15000, // 15 seconds timeout for each request
  minDelay: 1000, // Minimum delay between requests in milliseconds
  maxDelay: 3000, // Maximum delay between requests in milliseconds
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://www.google.com/' // Referer for initial request
  }
};

/**
 * Introduces a random delay to mimic human browsing behavior and avoid rate limiting.
 * @param {number} min - Minimum delay in milliseconds.
 * @param {number} max - Maximum delay in milliseconds.
 */
async function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`Pausing for ${delay / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Fetches a URL with retries and a timeout.
 * @param {string} url - The URL to fetch.
 * @param {number} retries - Number of retries.
 * @returns {Promise<Response>} - The fetch response.
 */
async function fetchWithRetry(url: string, retries: number = 3): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NOVA_AUTOLAND_CONFIG.requestTimeout);

      console.log(`Fetching: ${url} (Attempt ${i + 1}/${retries + 1})`);
      const response = await fetch(url, {
        headers: {
          ...NOVA_AUTOLAND_CONFIG.headers,
          'User-Agent': NOVA_AUTOLAND_CONFIG.userAgent
        },
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
        if (response.status === 403 || response.status === 429) {
            console.error("Possible bot detection or rate limiting. Consider increasing delays or changing User-Agent.");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error: any) {
      console.error(`Error fetching ${url}: ${error.message}`);
      if (i < retries) {
        await randomDelay(NOVA_AUTOLAND_CONFIG.minDelay, NOVA_AUTOLAND_CONFIG.maxDelay); // Delay before retrying
      } else {
        throw error;
      }
    }
  }
  throw new Error('Failed to fetch after multiple retries.'); // Should not be reached
}

/**
 * Extracts all vehicle URLs from the inventory pages.
 * @param {string} inventoryUrl - The starting inventory URL.
 * @returns {Promise<string[]>} - An array of unique vehicle URLs.
 */
async function getAllVehicleUrls(inventoryUrl: string): Promise<string[]> {
  const vehicleUrls: string[] = [];
  const visitedPages = new Set<string>();
  let currentPageUrl: string | null = inventoryUrl;
  let pageCount = 0;

  do {
    if (pageCount >= NOVA_AUTOLAND_CONFIG.maxPagesToScrape) {
      console.log(`Reached maximum pages to scrape (${NOVA_AUTOLAND_CONFIG.maxPagesToScrape}). Stopping pagination.`);
      break;
    }

    if (visitedPages.has(currentPageUrl)) {
        console.log(`Already visited page: ${currentPageUrl}. Stopping pagination to avoid loops.`);
        break;
    }

    try {
      console.log(`Processing inventory page: ${currentPageUrl}`);
      const response = await fetchWithRetry(currentPageUrl);
      const html = await response.text();
      const $ = cheerio.load(html);

      // --- Selector for vehicle items ---
      // IMPORTANT: If the scraper stops finding vehicles, this selector likely needs updating.
      // Inspect novaautoland.com's inventory page for current class names/structure.
      const vehicleItems = $('.inventory-container, .inventory-item, .vehicle-item, .listing-item, .car-card');

      if (vehicleItems.length === 0) {
          console.warn(`No vehicle items found on ${currentPageUrl} with current selectors. Website structure may have changed.`);
      }

      vehicleItems.each((_, element) => {
        // Look for links that contain "inventory" or "vehicle" in their href
        // IMPORTANT: Update these link selectors if the URL patterns change.
        const vehicleLink = $(element).find('a[href*="/inventory/"], a[href*="/vehicle/"], a.vehicle-link, a.listing-link').first();
        const href = vehicleLink.attr('href');

        if (href) {
          try {
            const absoluteUrl = new URL(href, NOVA_AUTOLAND_CONFIG.baseUrl).toString();
            if (!vehicleUrls.includes(absoluteUrl)) {
              vehicleUrls.push(absoluteUrl);
              console.log(`Found vehicle listing URL: ${absoluteUrl}`);
            }
          } catch (e: any) {
            console.warn(`Invalid vehicle URL encountered: ${href} on page ${currentPageUrl} - ${e.message}`);
          }
        }
      });

      visitedPages.add(currentPageUrl);
      pageCount++;

      // --- Selector for next pagination link ---
      // IMPORTANT: If pagination stops working, this selector likely needs updating.
      // Inspect novaautoland.com's pagination section for current class names/structure.
      const paginationLinks = $('.pagination a, .page-item a, a[rel="next"], a:contains("Next"), a[href*="page="]');
      let foundNextPage = false;
      paginationLinks.each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase().trim();

        if (href && (text.includes('next') || /page \d+/i.test(text) || $(element).attr('rel') === 'next')) {
          try {
            const url = new URL(href, NOVA_AUTOLAND_CONFIG.baseUrl).toString();
            if (url !== currentPageUrl && !visitedPages.has(url) && !url.includes('#')) {
              currentPageUrl = url;
              foundNextPage = true;
              return false; // Break the loop
            }
          } catch (e: any) {
            console.warn(`Invalid pagination URL: ${href} - ${e.message}`);
          }
        }
      });

      if (!foundNextPage) {
        currentPageUrl = null; // No more pages or next page already visited/invalid
        console.log("No next page found or all reachable pages visited. Stopping pagination.");
      } else {
          await randomDelay(NOVA_AUTOLAND_CONFIG.minDelay, NOVA_AUTOLAND_CONFIG.maxDelay); // Delay before fetching next page
      }

    } catch (error: any) {
      console.error(`Error processing inventory page ${currentPageUrl}:`, error.message);
      currentPageUrl = null; // Stop on error
    }
  } while (currentPageUrl);

  return vehicleUrls;
}

/**
 * Scrapes detailed information for a single vehicle.
 * @param {string} url - The URL of the vehicle detail page.
 * @param {number} dealershipId - The ID of the dealership.
 * @param {string} dealershipName - The name of the dealership.
 * @returns {Promise<InsertVehicle | null>} - The scraped vehicle object or null if failed.
 */
async function scrapeNovaAutolandVehicle(url: string, dealershipId: number, dealershipName: string): Promise<InsertVehicle | null> {
  console.log(`Processing Nova Autoland vehicle: ${url}`);

  // Default values for vehicle
  let make = '';
  let model = '';
  let year = 0;
  let price = 0;
  let mileage = 0;
  let title = '';
  let vin = '';
  let images: string[] = [];
  let carfaxUrl: string | null = null;

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch vehicle detail page: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // --- VIN Extraction ---
    // IMPORTANT: Update these selectors if VIN element changes on detail page.
    vin = $('[id*="vin"], [class*="vin"], [data-vin], [itemprop="vehicleIdentificationNumber"]').first().text().trim();
    if (!vin) {
        // Fallback: search for VIN in all text content
        $('body *:not(script):not(style)').each((_, element) => {
            const text = $(element).text().trim();
            const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
            if (vinMatch && vinMatch[1] && vinMatch[1].length === 17) {
                vin = vinMatch[1];
                return false; // Found VIN, break loop
            }
        });
    }
    if (!vin) {
        // Fallback: check meta tags
        $('meta[content*="VIN"]').each((_, element) => {
            const content = $(element).attr('content');
            if (content) {
                const vinMatch = content.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
                if (vinMatch && vinMatch[1] && vinMatch[1].length === 17) {
                    vin = vinMatch[1];
                    return false;
                }
            }
        });
    }
    if (!vin) {
        // Fallback: try to extract from URL if present
        const urlVinMatch = url.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
        if (urlVinMatch && urlVinMatch[1]) {
            vin = urlVinMatch[1];
        }
    }

    if (!vin) {
        console.warn(`Could not find VIN for vehicle at ${url}. This vehicle will be skipped.`);
        return null; // Skip vehicle if VIN cannot be found
    }


    // --- Title, Make, Model, Year Extraction ---
    // IMPORTANT: Update these selectors if vehicle title/details element changes.
    const vehicleTitleElement = $('h1.vehicle-title, .vehicle-name, [itemprop="name"], .detail-title').first();
    title = vehicleTitleElement.text().trim();

    // Try to parse year, make, model from title or other common elements
    const titleMatch = title.match(/(\d{4})\s+([A-Za-z\s]+)\s+([A-Za-z0-9\s-]+)/);
    if (titleMatch) {
        year = parseInt(titleMatch[1], 10);
        make = titleMatch[2].trim();
        model = titleMatch[3].trim();
    } else {
        // Fallback: look for structured data or specific detail elements
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            try {
                const parsedJson = JSON.parse(jsonLd);
                if (parsedJson['@type'] === 'Vehicle' || parsedJson['@type'] === 'Car') {
                    if (parsedJson.name) title = parsedJson.name;
                    if (parsedJson.brand) make = typeof parsedJson.brand === 'string' ? parsedJson.brand : parsedJson.brand.name;
                    if (parsedJson.model) model = parsedJson.model;
                    if (parsedJson.vehicleModelDate) year = parseInt(parsedJson.vehicleModelDate, 10);
                }
            } catch (e: any) {
                console.warn(`Error parsing JSON-LD for ${url}: ${e.message}`);
            }
        }

        // Fallback: specific detail table/list items
        $('.detail-value, .spec-value, .vehicle-details li, .vehicle-info li, .specs-table td').each((_, elem) => {
            const text = $(elem).text().trim();
            if (text.toLowerCase().includes('make:') && !make) make = text.split(':')[1]?.trim() || '';
            if (text.toLowerCase().includes('model:') && !model) model = text.split(':')[1]?.trim() || '';
            if (text.toLowerCase().includes('year:') && !year) year = parseInt(text.split(':')[1]?.trim() || '0', 10);
        });
    }

    // Ensure make/model/year have some value if not found
    if (!make) make = 'Unknown Make';
    if (!model) model = 'Unknown Model';
    if (year === 0) year = new Date().getFullYear(); // Default to current year if not found


    // --- Price Extraction ---
    // IMPORTANT: Update these selectors if price element changes.
    const priceSelectors = ['.price', '.vehicle-price', '.final-price', '[itemprop="price"], .listing-price, .sale-price'];
    for (const selector of priceSelectors) {
        const priceText = $(selector).first().text().trim();
        const priceMatch = priceText.match(/\$\s*([\d,]+)/);
        if (priceMatch && priceMatch[1]) {
            const parsedPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
            if (!isNaN(parsedPrice) && parsedPrice > 100) { // Simple validation for realistic price
                price = parsedPrice;
                break;
            }
        }
    }
    if (price === 0) {
        console.warn(`Could not find a valid price for ${url}. Defaulting to 0.`);
    }


    // --- Mileage Extraction ---
    // IMPORTANT: Update these selectors if mileage element changes.
    const mileageSelectors = ['.mileage', '.vehicle-mileage', '[itemprop="mileageFromOdometer"], *:contains("miles"), *:contains("mileage")'];
    for (const selector of mileageSelectors) {
        const mileageText = $(selector).first().text().trim();
        const mileageMatch = mileageText.match(/([\d,]+)\s*(?:miles|mi)/i);
        if (mileageMatch && mileageMatch[1]) {
            const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
            if (!isNaN(parsedMileage) && parsedMileage >= 0) {
                mileage = parsedMileage;
                break;
            }
        }
    }
    if (mileage === 0) {
        console.warn(`Could not find mileage for ${url}. Defaulting to 0.`);
    }


    // --- Image Extraction ---
    // IMPORTANT: Update these selectors if image gallery/elements change.
    const imageSelectors = [
        '.vehicle-images img', '.gallery img', '.carousel img', '.slider img',
        '[data-src]', '[data-lazy]', '[data-original]', '[data-srcset]',
        'img[src*="vehicle"], img[src*="inventory"], img[src*="car"]',
        '.dcs-media-viewer img', '.dcs-gallery img', '.lightbox-image img',
        'a[href*=".jpg"] img', 'a[href*=".jpeg"] img', 'a[href*=".png"] img',
        'img[src*="dealercarsearch"]', 'img[src*="imagescdn"]'
    ];

    const processedImageUrls = new Set<string>();
    for (const selector of imageSelectors) {
        $(selector).each((_, imgElement) => {
            let src = $(imgElement).attr('src') ||
                      $(imgElement).attr('data-src') ||
                      $(imgElement).attr('data-lazy') ||
                      $(imgElement).attr('data-original') ||
                      $(imgElement).attr('data-srcset')?.split(' ')[0]; // Take first URL from srcset

            // If it's an anchor with an image href
            const parentAnchor = $(imgElement).closest('a');
            if (parentAnchor.length && parentAnchor.attr('href') && isValidImageUrl(parentAnchor.attr('href') || '')) {
                src = parentAnchor.attr('href');
            }

            if (src && isValidImageUrl(src) && !isPlaceholderImage(src) && !isNonVehicleImage(src)) {
                try {
                    const absoluteUrl = new URL(src, url).toString();
                    if (!processedImageUrls.has(absoluteUrl)) {
                        images.push(absoluteUrl);
                        processedImageUrls.add(absoluteUrl);
                    }
                } catch (e: any) {
                    console.warn(`Invalid image URL: ${src} - ${e.message}`);
                }
            }
        });
        if (images.length > 0) break; // Stop after finding some images
    }

    // Fallback for images if very few found: try common patterns with VIN/ID
    if (images.length < 3 && vin && vin !== 'N/A') {
        const potentialPatterns = [
            `https://novaautoland.com/photos/${vin}/1.jpg`, // Example pattern
            `https://images.dealercarsearch.com/Media/23726/${vin}/1.jpg` // Another common pattern
            // Add more patterns if you identify them from the website
        ];
        for (const pattern of potentialPatterns) {
            if (!processedImageUrls.has(pattern)) {
                images.push(pattern);
                processedImageUrls.add(pattern);
            }
        }
    }

    // Limit images to a reasonable number to prevent oversized data
    if (images.length > 20) {
        images = images.slice(0, 20);
        console.log(`Limited images to 20 for ${url}`);
    }


    // --- Carfax URL Extraction ---
    // IMPORTANT: Update these selectors if Carfax link changes.
    carfaxUrl = enhancedExtractCarfaxUrl($, url, vin);


    // Create the vehicle object
    const vehicle: InsertVehicle = {
      title: title || `${year} ${make} ${model}`,
      price,
      year,
      make,
      model,
      mileage,
      vin,
      location: 'Nova Autoland, VA', // Hardcoded as per your original file
      zipCode: '20151', // Hardcoded as per your original file
      dealershipId,
      images,
      carfaxUrl: carfaxUrl || null,
      contactUrl: null, // As per original file
      originalListingUrl: url,
      sortOrder: 0
    };

    console.log(`Successfully scraped Nova Autoland vehicle: ${year} ${make} ${model} with price $${price} and mileage ${mileage}`);
    console.log(`Found ${images.length} images for vehicle`);
    return vehicle;

  } catch (error: any) {
    console.error(`Error processing Nova Autoland vehicle: ${error.message}`);
    return null;
  }
}

/**
 * Checks if an image URL is likely a placeholder.
 * @param {string} src - The image source URL.
 * @returns {boolean} - True if it's a placeholder, false otherwise.
 */
function isPlaceholderImage(src: string): boolean {
  return src.includes('placeholder') ||
         src.includes('no-image') ||
         src.includes('noimage') ||
         src.includes('default') ||
         src.includes('blank.gif') ||
         src.includes('spacer.gif') ||
         /\/[0-9]+x[0-9]+\.[a-z]+$/i.test(src); // e.g., /100x100.png
}

/**
 * Checks if an image URL is likely a non-vehicle image (logo, banner, etc.).
 * @param {string} src - The image source URL.
 * @returns {boolean} - True if it's a non-vehicle image, false otherwise.
 */
function isNonVehicleImage(src: string): boolean {
  return src.includes('logo') ||
         src.includes('badge') ||
         src.includes('icon') ||
         src.includes('button') ||
         src.includes('banner') ||
         src.includes('background') ||
         src.includes('carfax'); // Carfax logos are not vehicle images
}

/**
 * Validates if a URL is a likely image URL.
 * @param {string} url - The URL to validate.
 * @returns {boolean} - True if it's a valid image URL, false otherwise.
 */
function isValidImageUrl(url: string): boolean {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const parsedUrl = url.toLowerCase();

  if (validExtensions.some(ext => parsedUrl.endsWith(ext))) {
    return true;
  }

  // Check common image CDN patterns that might not have explicit extensions
  if (
    parsedUrl.includes('cloudfront.net') ||
    parsedUrl.includes('dealercdn') ||
    parsedUrl.includes('googleapis.com/') ||
    parsedUrl.includes('dealercarsearch.com') ||
    parsedUrl.includes('carimage') ||
    parsedUrl.includes('photos') ||
    parsedUrl.includes('images') ||
    parsedUrl.includes('/img/') ||
    parsedUrl.includes('/media/') ||
    parsedUrl.includes('/vehicle-images/')
  ) {
    return true;
  }

  return false;
}

/**
 * Enhanced function to extract Carfax URLs using multiple methods and fallbacks.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance.
 * @param {string} pageUrl - The current page URL.
 * @param {string} vin - The vehicle VIN.
 * @returns {string|null} - The Carfax URL or null.
 */
function enhancedExtractCarfaxUrl(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  vin: string
): string | null {
  let carfaxUrl: string | null = null;

  // Method 1: Direct link with carfax in URL or text
  $('a[href*="carfax"], a:contains("CARFAX"), a:contains("Carfax"), a:contains("carfax")').each((_, element) => {
    if (carfaxUrl) return; // Already found
    const href = $(element).attr('href');
    if (href && (href.includes('carfax.com') || href.includes('carfax') || href.toLowerCase().includes('vehicle-history'))) {
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
      if (href && href.length > 10) { // Basic length check to filter out empty/dummy links
        carfaxUrl = href;
      }
    });
  }

  // Method 4: Look for JSON-LD data
  if (!carfaxUrl) {
    $('script[type="application/ld+json"]').each((_, element) => {
      if (carfaxUrl) return;
      try {
        const json = JSON.parse($(element).html() || '{}');
        if (json.url && typeof json.url === 'string' && (json.url.includes('carfax') || json.url.includes('history'))) {
          carfaxUrl = json.url;
        }
        // Check for carfax report in offers or other nested properties
        if (json.offers && json.offers.itemOffered && json.offers.itemOffered.additionalProperty) {
            const carfaxProperty = json.offers.itemOffered.additionalProperty.find((prop: any) => prop.name === 'Carfax Report URL' && prop.value);
            if (carfaxProperty) carfaxUrl = carfaxProperty.value;
        }
      } catch (e: any) {
        // Ignore JSON parsing errors
      }
    });
  }

  // If we have a VIN but no Carfax URL, construct a generic one
  if (vin && !carfaxUrl) {
    carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=DEA_0&vin=${vin}`;
  }

  // Ensure the URL is absolute if found as relative
  if (carfaxUrl && !carfaxUrl.startsWith('http')) {
      try {
          carfaxUrl = new URL(carfaxUrl, pageUrl).toString();
      } catch (e: any) {
          console.warn(`Could not resolve relative Carfax URL: ${carfaxUrl}`);
          carfaxUrl = null; // Invalidate if cannot resolve
      }
  }

  return carfaxUrl;
}

export async function scrapeNovaAutoland(dealershipUrl: string, dealershipId: number, dealershipName: string): Promise<InsertVehicle[]> {
  try {
    console.log(`Starting scrape of Nova Autoland inventory for ${dealershipName}`);

    const inventoryUrl = new URL(NOVA_AUTOLAND_CONFIG.inventoryPath, NOVA_AUTOLAND_CONFIG.baseUrl).toString();
    const vehicleUrls = await getAllVehicleUrls(inventoryUrl);

    console.log(`Found ${vehicleUrls.length} unique vehicle listings.`);

    const vehicles: InsertVehicle[] = [];
    for (const url of vehicleUrls) {
      try {
        const vehicle = await scrapeNovaAutolandVehicle(url, dealershipId, dealershipName);
        if (vehicle) {
          vehicles.push(vehicle);
        }
        await randomDelay(NOVA_AUTOLAND_CONFIG.minDelay, NOVA_AUTOLAND_CONFIG.maxDelay); // Delay between detail page scrapes
      } catch (error: any) {
        console.error(`Error processing vehicle listing ${url}: ${error.message}`);
      }
    }

    console.log(`Finished scraping ${vehicles.length} vehicles from Nova Autoland.`);
    return vehicles;
  } catch (error: any) {
    console.error(`Fatal error during Nova Autoland scraping process:`, error);
    return [];
  }
}

// Export the main scraping function
export { scrapeNovaAutoland, scrapeNovaAutolandVehicle };
