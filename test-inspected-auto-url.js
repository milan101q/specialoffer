/**
 * Script to test Inspected Auto URL construction and scraping
 */
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testInspectedAutoUrl() {
  console.log('Testing Inspected Auto URL construction and scraping');
  
  const baseUrl = 'https://www.inspectedauto.com';
  
  // Test different URL formats
  const urlsToTest = [
    baseUrl, 
    `${baseUrl}/cars-for-sale`, 
    `${baseUrl}/inventory`,
    `${baseUrl}/used-cars`,
    `${baseUrl}/vehicles`,
    `${baseUrl}/for-sale`
  ];
  
  for (const url of urlsToTest) {
    console.log(`\nTesting URL: ${url}`);
    try {
      // Fetch the page
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.log(`  Failed to fetch: ${response.status} ${response.statusText}`);
        continue;
      }
      
      console.log(`  Page loaded successfully: ${response.status}`);
      
      // Parse HTML
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Try different selectors to find vehicle links
      const carLinkSelectors = [
        'a[href*="/Inventory/Details/"]',
        'a[href*="/inventory/"]',
        'a[href*="/vehicle-details/"]',
        'a[href*="/cars/"]',
        'a[href*="/used-vehicles/"]',
        '.vehicle-card a',
        '.car-listing a',
        '.inventory-item a',
        'a.vehicle-link'
      ];
      
      // Check if we can find vehicle links
      let foundLinks = 0;
      for (const selector of carLinkSelectors) {
        const links = $(selector);
        if (links.length > 0) {
          console.log(`  Found ${links.length} links with selector: ${selector}`);
          foundLinks += links.length;
          
          // Output the first 2 links for debugging
          links.slice(0, 2).each(function() {
            const href = $(this).attr('href');
            console.log(`    - ${href}`);
          });
        }
      }
      
      if (foundLinks === 0) {
        console.log('  No vehicle links found with any selector');
        
        // Try a broader approach - look for any link with vehicle-related keywords
        const allLinks = $('a');
        console.log(`  Checking ${allLinks.length} total links for vehicle-related keywords...`);
        
        const vehicleKeywords = ['inventory', 'vehicle', 'car', 'auto', 'sale'];
        const foundKeywordLinks = [];
        
        allLinks.each(function() {
          const href = $(this).attr('href');
          if (href) {
            // Check if the link contains any vehicle-related keywords
            for (const keyword of vehicleKeywords) {
              if (href.toLowerCase().includes(keyword)) {
                foundKeywordLinks.push(href);
                break;
              }
            }
          }
        });
        
        // Remove duplicates and show first 5
        const uniqueLinks = [...new Set(foundKeywordLinks)];
        console.log(`  Found ${uniqueLinks.length} links containing vehicle-related keywords`);
        uniqueLinks.slice(0, 5).forEach(link => console.log(`    - ${link}`));
      }
      
      // Look for title elements to understand page structure
      const titleElements = $('h1, h2, .title, .heading, .page-title');
      console.log(`  Found ${titleElements.length} title elements`);
      titleElements.slice(0, 3).each(function() {
        console.log(`    - "${$(this).text().trim()}"`);
      });
      
    } catch (error) {
      console.error(`  Error testing URL ${url}:`, error.message);
    }
  }
}

// Run the test
testInspectedAutoUrl()
  .then(() => console.log('Testing complete'))
  .catch(err => console.error('Error running tests:', err));