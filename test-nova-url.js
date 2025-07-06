import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// This script tests the extraction of vehicle data from a Nova Autoland vehicle page
async function testNovaVehicle() {
  try {
    // Test URL for a Nova Autoland vehicle
    const url = 'https://novaautoland.com/vdp/22130024/Used-2014-MercedesBenz-CClass-C250-Coupe-for-sale-in-Chantilly-VA-20152';
    
    console.log(`Testing data extraction for: ${url}`);
    
    // Fetch the vehicle page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.statusText}`);
      return;
    }
    
    console.log('Page fetched successfully');
    
    // Parse the HTML
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('HTML parsed successfully');
    
    // Extract the title/header
    const title = $('h1').first().text().trim();
    console.log(`Title: ${title}`);
    
    // Extract VIN
    let vin = '';
    $('*:contains("VIN")').each((_, element) => {
      const text = $(element).text();
      const vinMatch = text.match(/VIN[^\w\d]*([A-HJ-NPR-Z0-9]{17})/i);
      if (vinMatch && vinMatch[1] && !vin) {
        vin = vinMatch[1];
      }
    });
    console.log(`VIN: ${vin || 'Not found'}`);
    
    // Extract price
    let price = '';
    $('.price, .vehicle-price, *:contains("$")').each((_, element) => {
      const text = $(element).text().trim();
      if (text.includes('$') && !price) {
        const priceMatch = text.match(/\$\s?(\d{1,3}(,\d{3})*(\.\d+)?)/);
        if (priceMatch && priceMatch[0]) {
          price = priceMatch[0];
        }
      }
    });
    console.log(`Price: ${price || 'Not found'}`);
    
    // Extract mileage
    let mileage = '';
    $('.mileage, *:contains("miles")').each((_, element) => {
      const text = $(element).text().trim();
      if ((text.includes('miles') || text.includes('mi')) && !mileage) {
        const mileageMatch = text.match(/(\d{1,3}(,\d{3})*)(\.\d+)?\s*(mi|miles|mil)/i);
        if (mileageMatch && mileageMatch[0]) {
          mileage = mileageMatch[0];
        }
      }
    });
    console.log(`Mileage: ${mileage || 'Not found'}`);
    
    // Extract Carfax URL
    let carfaxUrl = null;
    $('a[href*="carfax"], a:contains("CARFAX"), a:contains("Carfax"), a:contains("carfax")').each((_, element) => {
      if (carfaxUrl) return;
      
      const href = $(element).attr('href');
      if (href && 
          (href.includes('carfax.com') || 
           href.includes('carfax') ||
           href.toLowerCase().includes('vehicle-history'))) {
        carfaxUrl = href;
      }
    });
    console.log(`Carfax URL: ${carfaxUrl || 'Not found'}`);
    
    // Count images
    const images = [];
    $('img').each((_, element) => {
      const src = $(element).attr('src') || $(element).attr('data-src');
      if (src && !src.includes('logo') && !src.includes('carfax') && !src.includes('placeholder')) {
        images.push(src);
      }
    });
    console.log(`Images found: ${images.length}`);
    if (images.length > 0) {
      console.log(`First image: ${images[0]}`);
    }
    
    console.log('\nTest completed successfully');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testNovaVehicle().catch(console.error);