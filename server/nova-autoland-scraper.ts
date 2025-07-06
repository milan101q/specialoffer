import { InsertVehicle } from '@shared/schema';
import * as cheerio from 'cheerio';

type CheerioRoot = ReturnType<typeof cheerio.load>;

// Configuration for Nova Autoland scraper
const NOVA_AUTOLAND_CONFIG = {
  baseUrl: 'https://novaautoland.com',
  inventoryPath: '/inventory?clearall=1',
  maxPagesToScrape: 20,
  requestTimeout: 10000, // 10 seconds
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://www.google.com/'
  }
};

export async function scrapeNovaAutoland(dealershipUrl: string, dealershipId: number, dealershipName: string, dealerLocation: string | null = null, dealerZipCode: string | null = null): Promise<InsertVehicle[]> {
  try {
    console.log(`Starting scrape of Nova Autoland inventory from: ${dealershipUrl}`);
    console.log(`Using dealership information - ID: ${dealershipId}, Name: ${dealershipName}, Location: ${dealerLocation || 'Not provided'}, ZIP Code: ${dealerZipCode || 'Not provided'}`);
    
    const inventoryUrl = new URL(NOVA_AUTOLAND_CONFIG.inventoryPath, NOVA_AUTOLAND_CONFIG.baseUrl).toString();
    console.log(`Using inventory URL: ${inventoryUrl}`);
    
    const vehicleUrls = await getAllVehicleUrls(inventoryUrl);
    
    console.log(`Found ${vehicleUrls.length} vehicle listings`);
    
    const vehicles: InsertVehicle[] = [];
    for (const url of vehicleUrls) {
      try {
        console.log(`Scraping vehicle listing: ${url}`);
        const vehicle = await scrapeVehicleDetails(url, dealershipId, dealershipName, dealerLocation, dealerZipCode);
        if (vehicle) {
          vehicles.push(vehicle);
          console.log(`Successfully scraped vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year})`);
        }
      } catch (error) {
        console.error(`Error processing vehicle listing: ${error}`);
      }
    }
    
    console.log(`Finished scraping ${vehicles.length} vehicles from Nova Autoland`);
    return vehicles;
  } catch (error) {
    console.error(`Error scraping Nova Autoland:`, error);
    return [];
  }
}

async function getAllVehicleUrls(inventoryUrl: string): Promise<string[]> {
  const vehicleUrls: string[] = [];
  const visitedPages = new Set<string>();
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
    } catch (error) {
      console.error(`Error processing inventory page ${currentPageUrl}:`, error);
      break;
    }
  } while (currentPageUrl);
  
  return vehicleUrls;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOVA_AUTOLAND_CONFIG.requestTimeout);
    
    const response = await fetch(url, {
      headers: {
        ...NOVA_AUTOLAND_CONFIG.headers,
        'User-Agent': NOVA_AUTOLAND_CONFIG.userAgent
      },
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

function extractVehicleUrlsFromPage($: CheerioRoot, baseUrl: string, vehicleUrls: string[]): void {
  // Nova Autoland now uses a different structure where vehicles are in divs with class "vehicle"
  const vehicleItems = $('.vehicle');
  console.log(`Found ${vehicleItems.length} vehicle items with class '.vehicle'`);
  
  vehicleItems.each((index: number, element: any) => {
    // Find links that contain "/vdp/" which is the current URL pattern for vehicle details
    const vehicleLink = $(element).find('a[href*="/vdp/"]').first();
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
  
  // If we didn't find any vehicles with the primary selector, try alternative selectors
  if (vehicleItems.length === 0) {
    // Try alternative selectors
    const alternativeSelectors = [
      '.i19r-main-img-lnk', // Direct selector for the main image links that lead to detail pages
      '.vehicle-title a', // Vehicle title links
      '.vehicle-wrap a', // Links inside vehicle-wrap divs
      'a[href*="/vdp/"]', // All links with /vdp/ in the URL
      '.inventory-results a', // Links in inventory results
      '[data-type="vehicle"] a' // Links in vehicle-typed elements
    ];
    
    for (const selector of alternativeSelectors) {
      const items = $(selector);
      if (items.length > 0) {
        console.log(`Found ${items.length} vehicle links with selector: ${selector}`);
        
        items.each((index: number, element: any) => {
          const href = $(element).attr('href');
          
          if (href && href.includes('/vdp/')) {
            try {
              const absoluteUrl = new URL(href, baseUrl).toString();
              if (!vehicleUrls.includes(absoluteUrl)) {
                vehicleUrls.push(absoluteUrl);
                console.log(`Found vehicle with alternative selector: ${absoluteUrl}`);
              }
            } catch (e) {
              console.log(`Invalid vehicle URL: ${href}`);
            }
          }
        });
        
        if (vehicleUrls.length > 0) {
          break; // If we found vehicles with one selector, no need to try others
        }
      }
    }
  }
}

function findNextPageUrl($: CheerioRoot, currentPageUrl: string): string | null {
  // Nova Autoland now uses button with onClick="changePage(this)" for pagination
  let nextPageUrl: string | null = null;
  
  // Look for the "Next" button
  $('button[onClick^="changePage"][aria-label="Next"]').each((index: number, element: any) => {
    const pageValue = $(element).attr('value');
    if (pageValue) {
      try {
        // Construct the next page URL manually since it's using JavaScript onclick
        const currentUrl = new URL(currentPageUrl);
        // Extract current page parameters
        const currentParams = new URLSearchParams(currentUrl.search);
        
        // Update or add the page parameter
        currentParams.set('page', pageValue);
        
        // Replace or set the search parameters in the URL
        currentUrl.search = currentParams.toString();
        
        nextPageUrl = currentUrl.toString();
        console.log(`Found next page URL: ${nextPageUrl}`);
        return false; // Break the loop
      } catch (e) {
        console.log(`Error constructing next page URL: ${e}`);
      }
    }
  });
  
  // If we didn't find a next button, also check the page indicator
  if (!nextPageUrl) {
    const pagerSummary = $('.pager-summary').text().trim();
    const pageMatch = pagerSummary.match(/Page:\s*(\d+)\s*of\s*(\d+)/i);
    
    if (pageMatch && pageMatch[1] && pageMatch[2]) {
      const currentPage = parseInt(pageMatch[1], 10);
      const totalPages = parseInt(pageMatch[2], 10);
      
      if (currentPage < totalPages) {
        try {
          // Construct the next page URL
          const nextPage = currentPage + 1;
          const currentUrl = new URL(currentPageUrl);
          const currentParams = new URLSearchParams(currentUrl.search);
          
          // Update or add the page parameter
          currentParams.set('page', nextPage.toString());
          
          // Replace or set the search parameters in the URL
          currentUrl.search = currentParams.toString();
          
          nextPageUrl = currentUrl.toString();
          console.log(`Constructed next page URL from page indicators: ${nextPageUrl}`);
        } catch (e) {
          console.log(`Error constructing next page URL from indicators: ${e}`);
        }
      }
    }
  }
  
  return nextPageUrl;
}

async function scrapeVehicleDetails(url: string, dealershipId: number, dealershipName: string, dealerLocation: string | null = null, dealerZipCode: string | null = null): Promise<InsertVehicle | null> {
  try {
    console.log(`Scraping vehicle with dealership location: ${dealerLocation || 'Not provided'}, ZIP code: ${dealerZipCode || 'Not provided'}`);
    
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
    // Try to extract Carfax URL
    const carfaxUrl = extractCarfaxUrl($, url, vin);
    console.log(`Extracted Carfax URL for ${vin}: ${carfaxUrl || 'Not found'}`);
    
    // Construct the vehicle object
    const vehicle: InsertVehicle = {
      title: `${year} ${make} ${model}`.trim(),
      dealershipId,
      vin,
      make,
      model,
      year,
      price,
      mileage,
      location: dealerLocation || 'Chantilly, VA',
      zipCode: dealerZipCode || '20152',
      images: imageUrls,
      carfaxUrl: carfaxUrl || undefined,
      contactUrl: url, // Using the listing URL as contact URL
      originalListingUrl: url,
      sortOrder: 0
    };
    
    console.log(`Vehicle object for ${vin} has carfaxUrl set to: ${vehicle.carfaxUrl || 'undefined'}`);
    console.log(`Vehicle object location set to: ${vehicle.location}, zipCode: ${vehicle.zipCode}`);
    
    
    return vehicle;
  } catch (error) {
    console.error(`Error scraping vehicle details from ${url}:`, error);
    return null;
  }
}

function extractVin($: CheerioRoot, url: string): string | null {
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

function findVinInText($: CheerioRoot): string | null {
  let foundVin: string | null = null;
  
  $('*:contains("VIN")').each((index: number, element: any) => {
    if (foundVin) return;
    
    const text = $(element).text();
    const vinMatch = text.match(/VIN[^\w\d]*([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch && vinMatch[1]) {
      foundVin = vinMatch[1];
    }
  });
  
  return foundVin;
}

function findVinInAttributes($: CheerioRoot): string | null {
  let foundVin: string | null = null;
  
  $('[data-vin], [vin], [id*="vin"], [class*="vin"], [itemprop="vehicleIdentificationNumber"]').each((index: number, element: any) => {
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

function findVinInMetaTags($: CheerioRoot): string | null {
  let foundVin: string | null = null;
  
  $('meta').each((index: number, element: any) => {
    if (foundVin) return;
    
    const content = $(element).attr('content') || '';
    const vinMatch = content.match(/([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch && vinMatch[1]) {
      foundVin = vinMatch[1];
    }
  });
  
  return foundVin;
}

function extractMakeModelYear($: CheerioRoot): { make: string; model: string; year: number } {
  let title = '';
  let make = '';
  let model = '';
  let year = new Date().getFullYear(); // Default to current year if can't extract
  
  // Start with the URL since Nova Autoland embeds vehicle info directly in the URL
  // Capture the current page URL from any source we can find
  const pageUrl = $('link[rel="canonical"]').attr('href') || 
                 $('meta[property="og:url"]').attr('content') || 
                 '';
  
  console.log(`Checking page URL for vehicle info: ${pageUrl}`);
  
  // Check the URL for Nova Autoland's specific pattern: /vdp/ID/Used-YEAR-MAKE-MODEL
  const urlPattern = /\/vdp\/\d+\/Used-(\d{4})-([^-]+)-([^-\/]+)/i;
  const urlMatch = pageUrl.match(urlPattern);
  
  if (urlMatch && urlMatch[1] && urlMatch[2] && urlMatch[3]) {
    year = parseInt(urlMatch[1], 10);
    make = formatBrandName(urlMatch[2].replace(/-/g, ' '));
    model = formatModelName(urlMatch[3].replace(/-/g, ' '));
    title = `${year} ${make} ${model}`;
    console.log(`Extracted vehicle info from page URL: ${title}`);
    return { make, model, year }; // If URL pattern matched, this is most reliable
  }
  
  // Check HTML content for the URL pattern
  const htmlContent = $.html();
  const htmlUrlMatches = htmlContent.match(urlPattern);
  if (htmlUrlMatches && htmlUrlMatches[1] && htmlUrlMatches[2] && htmlUrlMatches[3]) {
    year = parseInt(htmlUrlMatches[1], 10);
    make = formatBrandName(htmlUrlMatches[2].replace(/-/g, ' '));
    model = formatModelName(htmlUrlMatches[3].replace(/-/g, ' '));
    title = `${year} ${make} ${model}`;
    console.log(`Extracted vehicle info from HTML content URL: ${title}`);
    return { make, model, year }; // If URL pattern matched in HTML, this is reliable
  }
  
  // Look at all a tags with href containing /vdp/ to find the current vehicle's link
  const vdpLinks: string[] = [];
  $('a[href*="/vdp/"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    if (href.includes('/vdp/')) {
      vdpLinks.push(href);
    }
  });
  
  // Try to find the most likely VDP link
  for (const href of vdpLinks) {
    const linkUrlMatch = href.match(/\/Used-(\d{4})-([^-]+)-([^-\/]+)/i);
    if (linkUrlMatch && linkUrlMatch[1] && linkUrlMatch[2] && linkUrlMatch[3]) {
      year = parseInt(linkUrlMatch[1], 10);
      make = formatBrandName(linkUrlMatch[2].replace(/-/g, ' '));
      model = formatModelName(linkUrlMatch[3].replace(/-/g, ' '));
      title = `${year} ${make} ${model}`;
      console.log(`Extracted vehicle info from VDP link: ${title}`);
      return { make, model, year }; // If URL pattern matched, this is reliable
    }
  }
  
  // Extract title from Nova Autoland's current structure with h1 vehicle-title
  const titleElement = $('h1.vehicle-title').first();
  if (titleElement.length) {
    title = titleElement.text().trim();
    console.log(`Found vehicle title from h1.vehicle-title: ${title}`);
  }
  
  // If not found, try alternative title selectors
  if (!title) {
    const altTitleElement = $('.vehicle-name, [itemprop="name"], .vehicle-detail-header h1').first();
    if (altTitleElement.length) {
      title = altTitleElement.text().trim();
      console.log(`Found vehicle title from alternative selector: ${title}`);
    }
  }
  
  // If we have a title with year make model, try to parse it
  if (title) {
    // Extract year (4 digit number between 1900 and current year + 1)
    const currentYear = new Date().getFullYear();
    const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch && yearMatch[1]) {
      const parsedYear = parseInt(yearMatch[1], 10);
      if (parsedYear >= 1900 && parsedYear <= currentYear + 1) {
        year = parsedYear;
        console.log(`Extracted year from title: ${year}`);
      }
    }
    
    // Extract make and model
    if (!make || !model) {
      const commonMakes = [
        'acura', 'audi', 'bmw', 'buick', 'cadillac', 'chevrolet', 'chevy', 'chrysler', 
        'dodge', 'ford', 'gmc', 'honda', 'hyundai', 'infiniti', 'jaguar', 'jeep', 
        'kia', 'land rover', 'lexus', 'lincoln', 'maserati', 'mazda', 'mercedes-benz',
        'nissan', 'porsche', 'ram', 'subaru', 'tesla', 'toyota', 'volkswagen', 'volvo'
      ];
      
      for (const brand of commonMakes) {
        if (title.toLowerCase().includes(brand)) {
          if (!make) {
            make = formatBrandName(brand);
            console.log(`Extracted make from title: ${make}`);
          }
          
          // Try to extract model after the make
          if (!model) {
            const afterMake = title.toLowerCase().split(brand)[1];
            if (afterMake) {
              const modelMatch = afterMake.match(/^\s*([a-z0-9-]+)/i);
              if (modelMatch && modelMatch[1]) {
                model = formatModelName(modelMatch[1]);
                console.log(`Extracted model from title: ${model}`);
              }
            }
          }
          
          break;
        }
      }
    }
  }
  
  // Look for structured data as fallback
  if (!make) {
    $('[itemprop="brand"], [itemprop="manufacturer"]').each((index: number, element: any) => {
      if (make) return;
      
      const itemPropMake = $(element).text().trim() || $(element).attr('content');
      if (itemPropMake) {
        make = itemPropMake;
        console.log(`Found make from structured data: ${make}`);
      }
    });
  }
  
  if (!model) {
    $('[itemprop="model"]').each((index: number, element: any) => {
      if (model) return;
      
      const itemPropModel = $(element).text().trim() || $(element).attr('content');
      if (itemPropModel) {
        model = itemPropModel;
        console.log(`Found model from structured data: ${model}`);
      }
    });
  }
  
  if (!year) {
    $('[itemprop="modelDate"], [itemprop="productionDate"], [itemprop="releaseDate"]').each((index: number, element: any) => {
      if (year) return;
      
      const itemPropYear = $(element).text().trim() || $(element).attr('content');
      if (itemPropYear) {
        const parsedYear = parseInt(itemPropYear, 10);
        if (!isNaN(parsedYear)) {
          year = parsedYear;
          console.log(`Found year from structured data: ${year}`);
        }
      }
    });
  }
  
  // Handle cases where extraction might have failed
  if (!make) make = 'Unknown';
  if (!model) model = 'Unknown';
  if (!year) year = new Date().getFullYear();
  
  return { make, model, year };
}

function formatBrandName(brand: string): string {
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

function formatModelName(model: string): string {
  return model.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

function extractPrice($: CheerioRoot): number {
  let price = 0;
  
  // Try Nova Autoland's updated price selectors first
  $('h2.vehicle-price').each((index: number, element: any) => {
    if (price) return;
    
    const priceText = $(element).text().trim();
    if (priceText && priceText.includes('$')) {
      const priceMatch = priceText.match(/\$\s?(\d{1,3}(,\d{3})*(\.\d+)?)/);
      if (priceMatch && priceMatch[1]) {
        const parsedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (!isNaN(parsedPrice)) {
          price = parsedPrice;
          console.log(`Found price: $${price} using h2.vehicle-price selector`);
        }
      }
    }
  });
  
  // Try other known Nova Autoland selectors if first one didn't work
  if (!price) {
    $('.price, .final-price, [itemprop="price"], .vehicle-detail-price').each((index: number, element: any) => {
      if (price) return;
      
      const priceText = $(element).text().trim();
      if (priceText && priceText.includes('$')) {
        const priceMatch = priceText.match(/\$\s?(\d{1,3}(,\d{3})*(\.\d+)?)/);
        if (priceMatch && priceMatch[1]) {
          const parsedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(parsedPrice)) {
            price = parsedPrice;
            console.log(`Found price: $${price} using alternative price selector`);
          }
        }
      }
    });
  }
  
  // Fallback to more generic price extraction
  if (!price) {
    $('*:contains("$")').each((index: number, element: any) => {
      if (price) return;
      
      const text = $(element).text().trim();
      if (text.length > 30 || text.includes('msrp') || text.includes('starting at')) return;
      
      if (text && text.includes('$')) {
        const priceMatch = text.match(/\$\s?(\d{1,3}(,\d{3})*(\.\d+)?)/);
        if (priceMatch && priceMatch[1]) {
          const parsedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(parsedPrice) && parsedPrice > 0 && parsedPrice < 500000) {
            price = parsedPrice;
            console.log(`Found price: $${price} using generic price extraction`);
          }
        }
      }
    });
  }
  
  return price;
}

function extractMileage($: CheerioRoot): number {
  let mileage = 0;
  
  // Try Nova Autoland's updated mileage selector with vehicle-sub-line span
  $('.vehicle-sub-line .vehicle-mileage').each((index: number, element: any) => {
    if (mileage) return;
    
    const text = $(element).text().trim();
    const mileageMatch = text.match(/(\d{1,3}(,\d{3})*)(\.\d+)?\s*(mi|miles|mil)/i);
    
    if (mileageMatch && mileageMatch[1]) {
      const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(parsedMileage)) {
        mileage = parsedMileage;
        console.log(`Found mileage: ${mileage} miles using vehicle-sub-line selector`);
      }
    }
  });
  
  // Try the h5 element with vehicle-mileage span
  if (!mileage) {
    $('h5 .vehicle-mileage').each((index: number, element: any) => {
      if (mileage) return;
      
      const text = $(element).text().trim();
      const mileageMatch = text.match(/(\d{1,3}(,\d{3})*)(\.\d+)?\s*(mi|miles|mil)/i);
      
      if (mileageMatch && mileageMatch[1]) {
        const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsedMileage)) {
          mileage = parsedMileage;
          console.log(`Found mileage: ${mileage} miles using h5 with vehicle-mileage class`);
        }
      }
    });
  }
  
  // Try any element that contains "miles"
  if (!mileage) {
    $('*:contains("miles")').each((index: number, element: any) => {
      if (mileage) return;
      
      const text = $(element).text().trim();
      // Skip if text is too long (likely not a mileage indicator)
      if (text.length > 50) return;
      
      const mileageMatch = 
        text.match(/(\d{1,3}(,\d{3})*)(\.\d+)?\s*(mi|miles|mil)/i) || 
        text.match(/mileage:?\s*(\d{1,3}(,\d{3})*)/i);
      
      if (mileageMatch && mileageMatch[1]) {
        const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsedMileage)) {
          mileage = parsedMileage;
          console.log(`Found mileage: ${mileage} miles using generic miles text`);
        }
      }
    });
  }
  
  return mileage;
}

function extractColors($: CheerioRoot): { exteriorColor: string; interiorColor: string } {
  let exteriorColor = '';
  let interiorColor = '';
  
  // Extract exterior color
  $('*:contains("exterior color"), *:contains("ext. color"), *:contains("color:")').each((index: number, element: any) => {
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
  $('*:contains("interior color"), *:contains("int. color")').each((index: number, element: any) => {
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

function extractTechnicalDetails($: CheerioRoot): { bodyType: string; fuelType: string; transmission: string; drivetrain: string } {
  let bodyType = '';
  let fuelType = '';
  let transmission = '';
  let drivetrain = '';
  
  // Extract body type
  $('*:contains("body style"), *:contains("body type")').each((index: number, element: any) => {
    if (bodyType) return;
    
    const text = $(element).text();
    const match = text.match(/body\s*(?:style|type):?\s*([a-z\s-]+)/i);
    if (match && match[1]) {
      bodyType = match[1].trim();
    }
  });
  
  // Extract fuel type
  $('*:contains("fuel"), *:contains("engine")').each((index: number, element: any) => {
    if (fuelType) return;
    
    const text = $(element).text();
    if (text.includes('gasoline') || text.includes('gas')) {
      fuelType = 'Gasoline';
    } else if (text.includes('diesel')) {
      fuelType = 'Diesel';
    } else if (text.includes('hybrid')) {
      fuelType = 'Hybrid';
    } else if (text.includes('electric')) {
      fuelType = 'Electric';
    }
  });
  
  // Extract transmission
  $('*:contains("transmission")').each((index: number, element: any) => {
    if (transmission) return;
    
    const text = $(element).text();
    if (text.includes('automatic')) {
      transmission = 'Automatic';
    } else if (text.includes('manual')) {
      transmission = 'Manual';
    } else if (text.includes('cvt')) {
      transmission = 'CVT';
    }
  });
  
  // Extract drivetrain
  $('*:contains("drivetrain"), *:contains("drive type"), *:contains("4wd"), *:contains("awd")').each((index: number, element: any) => {
    if (drivetrain) return;
    
    const text = $(element).text().toLowerCase();
    if (text.includes('4wd') || text.includes('4x4') || text.includes('four wheel')) {
      drivetrain = '4WD';
    } else if (text.includes('awd') || text.includes('all wheel')) {
      drivetrain = 'AWD';
    } else if (text.includes('fwd') || text.includes('front wheel')) {
      drivetrain = 'FWD';
    } else if (text.includes('rwd') || text.includes('rear wheel')) {
      drivetrain = 'RWD';
    }
  });
  
  return { bodyType, fuelType, transmission, drivetrain };
}

function extractCarfaxUrl($: CheerioRoot, pageUrl: string, vin: string | null): string | null {
  // Strategy 1: Look for direct Carfax links in the page
  let carfaxUrl: string | null = null;
  
  // Look for Carfax links directly on the page
  $('a[href*="carfax.com"], a[href*="carfaxonline.com"]').each((index: number, element: any) => {
    if (carfaxUrl) return;
    
    const href = $(element).attr('href');
    if (href && (href.includes('carfax.com') || href.includes('carfaxonline.com'))) {
      try {
        carfaxUrl = new URL(href, pageUrl).toString();
        console.log(`Found direct Carfax link: ${carfaxUrl}`);
      } catch (e) {
        console.log(`Invalid Carfax URL: ${href}`);
      }
    }
  });
  
  // Strategy 2: Look for Carfax images which might be inside links
  if (!carfaxUrl) {
    $('a:has(img[src*="carfax"]), a:has(img[alt*="carfax"])').each((index: number, element: any) => {
      if (carfaxUrl) return;
      
      const href = $(element).attr('href');
      if (href) {
        try {
          carfaxUrl = new URL(href, pageUrl).toString();
          console.log(`Found Carfax link from image: ${carfaxUrl}`);
        } catch (e) {
          console.log(`Invalid Carfax URL from image link: ${href}`);
        }
      }
    });
  }
  
  // Strategy 3: Look for "data-carfax" attributes or classes containing carfax
  if (!carfaxUrl) {
    $('[data-carfax], [class*="carfax"]').each((index: number, element: any) => {
      if (carfaxUrl) return;
      
      const href = $(element).attr('href') || $(element).find('a').attr('href');
      if (href) {
        try {
          carfaxUrl = new URL(href, pageUrl).toString();
          console.log(`Found Carfax link from attribute: ${carfaxUrl}`);
        } catch (e) {
          console.log(`Invalid Carfax URL from attribute: ${href}`);
        }
      }
    });
  }
  
  // Strategy 4: If we have a VIN and no carfax URL, construct a generic one
  if (!carfaxUrl && vin) {
    // Carfax doesn't allow direct deep links to reports, so just use their main URL
    // This won't provide a direct report but at least links to Carfax where the user can input the VIN
    carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=VAU_0&vin=${vin}`;
    console.log(`Constructed generic Carfax URL using VIN: ${carfaxUrl}`);
  }
  
  return carfaxUrl;
}

function extractDescription($: CheerioRoot): string {
  // Try to find a vehicle description
  const descriptionElements = $('.vehicle-description, .description, [itemprop="description"]');
  if (descriptionElements.length > 0) {
    return descriptionElements.first().text().trim();
  }
  
  return '';
}

function extractImages($: CheerioRoot, baseUrl: string): string[] {
  const imageUrls: string[] = [];
  const htmlSource = $.html();
  
  // Extract image URLs from source code using regex patterns for dealercarsearch.com
  // This can find images that might be loaded dynamically via JavaScript
  const dealerSearchPattern = /https?:\/\/imagescdn\.dealercarsearch\.com\/Media\/[^"')\s]+\.jpe?g/gi;
  let match;
  while ((match = dealerSearchPattern.exec(htmlSource)) !== null) {
    const imageUrl = match[0];
    if (!imageUrls.includes(imageUrl) && 
        !imageUrl.includes('newarrivalphoto.jpg') && 
        !imageUrl.includes('no_photo.jpg') &&
        !imageUrl.includes('placeholder')) {
      imageUrls.push(imageUrl);
      console.log(`Found dealercarsearch image from source: ${imageUrl}`);
    }
  }
  
  // Try to find carousel images specifically
  const carouselPattern = /itemProp:"contentUrl",content:"([^"]+)"/gi;
  while ((match = carouselPattern.exec(htmlSource)) !== null) {
    if (match[1]) {
      const imageUrl = match[1];
      if (!imageUrls.includes(imageUrl) && 
          !imageUrl.includes('newarrivalphoto.jpg') && 
          !imageUrl.includes('no_photo.jpg') &&
          !imageUrl.includes('placeholder')) {
        imageUrls.push(imageUrl);
        console.log(`Found contentUrl image: ${imageUrl}`);
      }
    }
  }
  
  // Check for data-slide-img attributes which Nova Autoland uses
  const slideImgPattern = /data-slide-img="([^"]+)"/gi;
  while ((match = slideImgPattern.exec(htmlSource)) !== null) {
    if (match[1]) {
      const imageUrl = match[1];
      if (!imageUrls.includes(imageUrl) && 
          !imageUrl.includes('newarrivalphoto.jpg') && 
          !imageUrl.includes('no_photo.jpg') &&
          !imageUrl.includes('placeholder')) {
        imageUrls.push(imageUrl);
        console.log(`Found data-slide-img: ${imageUrl}`);
      }
    }
  }
  
  // Continue with DOM-based approaches if we still don't have enough images
  if (imageUrls.length < 3) {
    // Directly prioritize images hosted on dealercarsearch.com
    // as Nova Autoland primarily uses this image hosting service
    $('img[src*="dealercarsearch.com"], img[data-src*="dealercarsearch.com"]').each((index: number, element: any) => {
      const src = $(element).attr('src') || 
                  $(element).attr('data-src') || 
                  $(element).attr('data-lazy-src') ||
                  $(element).attr('data-original');
    
      if (src && !src.includes('newarrivalphoto.jpg')) { // Skip the default placeholder
        try {
          // Create absolute URL if needed
          const imageUrl = new URL(src, baseUrl).toString();
          // Only add image if it's not already in the array
          if (!imageUrls.includes(imageUrl)) {
            imageUrls.push(imageUrl);
            console.log(`Found dealercarsearch image: ${imageUrl}`);
          }
        } catch (e) {
          console.log(`Invalid image URL: ${src}`);
        }
      }
    });
  
    // Check for images from other common vehicle image providers
    if (imageUrls.length === 0) {
      $('img[src*="pictures.dealer.com"], img[src*="images.autotrader.com"], img[src*="photos.vehicle.pics"]').each((index: number, element: any) => {
        const src = $(element).attr('src') || $(element).attr('data-src') || $(element).attr('data-lazy-src');
        if (src && !isPlaceholderImage(src)) {
          try {
            const imageUrl = new URL(src, baseUrl).toString();
            if (!imageUrls.includes(imageUrl)) {
              imageUrls.push(imageUrl);
              console.log(`Found other provider image: ${imageUrl}`);
            }
          } catch (e) {
            console.log(`Invalid image URL: ${src}`);
          }
        }
      });
    }
  
    // If still no images, look for any vehicle-related images
    if (imageUrls.length === 0) {
      // Look for large images that are likely vehicle photos
      $('img').each((index: number, element: any) => {
        const src = $(element).attr('src') || $(element).attr('data-src');
        const width = parseInt($(element).attr('width') || '0', 10);
        const height = parseInt($(element).attr('height') || '0', 10);
        
        // Only consider reasonably sized images and skip common placeholders/logos
        if (src && 
            (width > 200 || height > 200 || src.includes('vehicle') || src.includes('car')) && 
            !isPlaceholderImage(src) && 
            !isNonVehicleImage(src)) {
          try {
            const imageUrl = new URL(src, baseUrl).toString();
            if (!imageUrls.includes(imageUrl) && isLikelyVehicleImage(imageUrl)) {
              imageUrls.push(imageUrl);
              console.log(`Found likely vehicle image: ${imageUrl}`);
            }
          } catch (e) {
            console.log(`Invalid image URL: ${src}`);
          }
        }
      });
    }
  }
  
  return imageUrls;
}

function isPlaceholderImage(src: string): boolean {
  const placeholderPatterns = [
    /placeholder/i,
    /no[-_]photo/i,
    /no[-_]image/i,
    /coming[-_]soon/i,
    /default/i,
    /blank/i,
    /logo/i,
    /icon/i,
    /newarrivalphoto/i
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(src));
}

function isNonVehicleImage(src: string): boolean {
  const nonVehiclePatterns = [
    /logo/i,
    /icon/i,
    /banner/i,
    /button/i,
    /promo/i,
    /carfax/i,
    /autocheck/i,
    /social/i
  ];
  
  return nonVehiclePatterns.some(pattern => pattern.test(src));
}

function isLikelyVehicleImage(url: string): boolean {
  // If the URL contains common vehicle image hosting domains, it's likely a vehicle image
  const vehicleImageDomains = [
    'dealercarsearch.com',
    'dealer.com',
    'autotrader.com',
    'carscdn.com',
    'carsguide.com',
    'carsdirect.com',
    'motortrend.com',
    'carfax.com',
    'vehiclephotos.com',
    'vehicle.pics'
  ];
  
  if (vehicleImageDomains.some(domain => url.includes(domain))) {
    return true;
  }
  
  // Check if the URL path contains common vehicle image indicators
  const vehicleImageIndicators = [
    '/vehicle/',
    '/vehicles/',
    '/car/',
    '/cars/',
    '/auto/',
    '/inventory/',
    '/stock/',
    '/used/',
    '/vdp/',
    '/photo/'
  ];
  
  if (vehicleImageIndicators.some(indicator => url.includes(indicator))) {
    return true;
  }
  
  return false;
}