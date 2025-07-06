import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

// This script tests the enhanced Carfax URL extraction functionality
// across different dealership websites

async function fetchWithRetry(url, retries = 3) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 10000
    });
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

// Enhanced Carfax URL extraction function
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
      console.log(`Found direct Carfax link: ${href}`);
      carfaxUrl = href;
    }
  });
  
  // Method 2: Look for image links (carfax logo)
  if (!carfaxUrl) {
    $('a:has(img[src*="carfax"]), a:has(img[alt*="carfax"])').each((_, element) => {
      if (carfaxUrl) return;
      
      const href = $(element).attr('href');
      if (href && (href.includes('carfax.com') || href.includes('carfax'))) {
        console.log(`Found Carfax image link: ${href}`);
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
        console.log(`Found View Carfax link: ${href}`);
        carfaxUrl = href;
      }
    });
  }
  
  // Method 4: Look for JSON-LD data that might contain a Carfax URL
  if (!carfaxUrl) {
    $('script[type="application/ld+json"]').each((_, element) => {
      if (carfaxUrl) return;
      
      try {
        const json = JSON.parse($(element).html());
        if (json.url && typeof json.url === 'string' && 
            (json.url.includes('carfax') || json.url.includes('history'))) {
          console.log(`Found Carfax URL in JSON-LD: ${json.url}`);
          carfaxUrl = json.url;
        }
      } catch (e) {
        // JSON parsing failed, ignore
      }
    });
  }
  
  // Method 5: Look for onclick handlers that might contain Carfax URLs
  if (!carfaxUrl) {
    $('[onclick*="carfax"], [onclick*="history"]').each((_, element) => {
      if (carfaxUrl) return;
      
      const onclick = $(element).attr('onclick') || '';
      const urlMatch = onclick.match(/['"]https?:\/\/[^'"]*carfax[^'"]*['"]/i);
      if (urlMatch && urlMatch[0]) {
        const extractedUrl = urlMatch[0].replace(/^['"]|['"]$/g, '');
        console.log(`Found Carfax URL in onclick handler: ${extractedUrl}`);
        carfaxUrl = extractedUrl;
      }
    });
  }
  
  // Method 6: Look for data attributes
  if (!carfaxUrl) {
    $('[data-carfax-url], [data-history-url], [data-report-url]').each((_, element) => {
      if (carfaxUrl) return;
      
      const dataUrl = $(element).attr('data-carfax-url') || 
                    $(element).attr('data-history-url') || 
                    $(element).attr('data-report-url');
      if (dataUrl) {
        console.log(`Found Carfax URL in data attribute: ${dataUrl}`);
        carfaxUrl = dataUrl;
      }
    });
  }
  
  // If we have a VIN but no Carfax URL, construct one
  if (vin && !carfaxUrl) {
    carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=DEA_0&vin=${vin}`;
    console.log(`Constructed Carfax URL for VIN ${vin}: ${carfaxUrl}`);
  }
  
  // If we have a Carfax URL but it doesn't have the VIN, add it
  if (carfaxUrl && vin && !carfaxUrl.includes(vin)) {
    // Check if it's already a valid Carfax URL or just a relative path
    if (carfaxUrl.includes('carfax.com')) {
      // It's already a valid URL, just need to check if the VIN is needed
      if (!carfaxUrl.includes('vin=')) {
        carfaxUrl = `${carfaxUrl}${carfaxUrl.includes('?') ? '&' : '?'}vin=${vin}`;
      }
    } else if (carfaxUrl.startsWith('/')) {
      // It's a relative path, construct an absolute URL
      try {
        const baseUrl = new URL(pageUrl).origin;
        carfaxUrl = `${baseUrl}${carfaxUrl}`;
      } catch (e) {
        // Invalid URL, fallback to constructing a standard Carfax URL
        carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=DEA_0&vin=${vin}`;
      }
    } else {
      // It doesn't look like a valid URL, construct a standard Carfax URL
      carfaxUrl = `https://www.carfax.com/VehicleHistory/p/Report.cfx?partner=DEA_0&vin=${vin}`;
    }
  }
  
  if (carfaxUrl) {
    console.log(`Extracted Carfax URL for ${vin}: ${carfaxUrl}`);
  }
  
  return carfaxUrl;
}

// Extract VIN from the vehicle details page
function extractVin($, url) {
  let vin = null;
  
  // Method 1: Look for VIN in visible text
  $('*:contains("VIN")').each((_, element) => {
    if (vin) return;
    
    const text = $(element).text();
    const vinMatch = text.match(/VIN[^\w\d]*([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch && vinMatch[1]) {
      vin = vinMatch[1];
      console.log(`Found VIN in text: ${vin}`);
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
        console.log(`Found VIN in attribute: ${vin}`);
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
        console.log(`Found VIN in meta tag: ${vin}`);
      }
    });
  }
  
  // Method 4: Look for VIN in URL
  if (!vin) {
    const urlVinMatch = url.match(/([A-HJ-NPR-Z0-9]{17})/i);
    if (urlVinMatch && urlVinMatch[1]) {
      vin = urlVinMatch[1];
      console.log(`Found VIN in URL: ${vin}`);
    }
  }
  
  return vin;
}

// Test Carfax extraction on a specific vehicle listing page
async function testCarfaxExtraction(url) {
  try {
    console.log(`Testing Carfax extraction for: ${url}`);
    
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.statusText}`);
      return;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // First, extract the VIN
    const vin = extractVin($, url);
    if (!vin) {
      console.log(`No VIN found on page: ${url}`);
      return;
    }
    
    // Then extract the Carfax URL
    const carfaxUrl = enhancedExtractCarfaxUrl($, url, vin);
    
    if (carfaxUrl) {
      console.log(`SUCCESS: Found Carfax URL for ${vin}:\n${carfaxUrl}\n`);
    } else {
      console.log(`WARNING: No Carfax URL found for ${vin} on page: ${url}\n`);
    }
  } catch (error) {
    console.error(`Error testing Carfax extraction for ${url}:`, error);
  }
}

// Main function to test Carfax extraction on various sites
async function main() {
  // Sample vehicle detail pages from different dealerships
  const testUrls = [
    // Nova Autoland
    'https://novaautoland.com/vdp/22130024/Used-2014-MercedesBenz-CClass-C250-Coupe-for-sale-in-Chantilly-VA-20152',
    // Nine Stars Auto
    'https://ninestarsauto.com/detail/2016-bmw-x5-xdrive50i/13095/',
    // A&H Quality Cars
    'https://ahqualitycars.net/inventory/2022-nissan-frontier-4x4-rock-creek-edition-crew-cab-s66392/',
    // Auto Galleria
    'https://www.autogalleria.us/inventory/used-2019-ford-explorer-xlt-4wd-sport-utility-1fm5k8d8xkga97908',
    // Add more test URLs as needed
  ];
  
  for (const url of testUrls) {
    await testCarfaxExtraction(url);
  }
}

// Run the tests
main().catch(console.error);