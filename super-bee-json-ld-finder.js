// Use the node-fetch package we already have in the project
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function fetchWithRetry(url, retries = 3) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    };
    
    const response = await fetch(url, { headers });
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

async function findJsonLdData(url) {
  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Find all JSON-LD scripts
    const jsonLdScripts = $('script[type="application/ld+json"]');
    console.log(`Found ${jsonLdScripts.length} JSON-LD scripts on the page`);
    
    jsonLdScripts.each((index, element) => {
      try {
        const scriptContent = $(element).html();
        const jsonData = JSON.parse(scriptContent);
        console.log(`\n--- JSON-LD Script #${index + 1} ---`);
        console.log(JSON.stringify(jsonData, null, 2));
        
        // Check if this JSON-LD has price or mileage data
        if (jsonData['@type'] === 'Vehicle' || 
            (jsonData.offers && jsonData.offers.price) || 
            jsonData.mileageFromOdometer) {
          console.log('\nFound vehicle data:');
          
          if (jsonData.offers && jsonData.offers.price) {
            console.log(`Price: ${jsonData.offers.price} ${jsonData.offers.priceCurrency || ''}`);
          }
          
          if (jsonData.mileageFromOdometer) {
            console.log(`Mileage: ${jsonData.mileageFromOdometer.value} ${jsonData.mileageFromOdometer.unitCode || 'miles'}`);
          } else if (jsonData.vehicleConfiguration && jsonData.vehicleConfiguration.includes('miles')) {
            console.log(`Possible mileage from configuration: ${jsonData.vehicleConfiguration}`);
          }
        }
      } catch (error) {
        console.error(`Error parsing JSON-LD script #${index + 1}:`, error);
      }
    });
    
  } catch (error) {
    console.error('Error fetching page:', error);
  }
}

// URLs to check
const urls = [
  'https://www.superbeeauto.com/details/used-2006-bmw-6-series/108342045',
  'https://www.superbeeauto.com/cars-for-sale'
];

async function main() {
  for (const url of urls) {
    console.log(`\n=== Checking ${url} ===\n`);
    await findJsonLdData(url);
  }
}

main().catch(console.error);