async function scrapeNovaAutolandVehicle(url: string, dealershipId: number, dealershipName: string): Promise<InsertVehicle | null> {
  console.log(`Processing Nova Autoland vehicle: ${url}`);
  import fetch from 'node-fetch';

  // Default values for vehicle
  let make = '';
  let model = '';
  let year = 0;
  let price = 0;
  let mileage = 0;
  let title = '';
  let vin = '';
  let images: string[] = [];
  
  try {
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': url.includes('/') ? url.split('/').slice(0, 3).join('/') + '/inventory' : 'https://www.google.com/'
    };
    
    const response = await fetch(url, { headers, redirect: 'follow' });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch vehicle detail page: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract VIN from the page
    $('[id*="vin"], [class*="vin"], [data-vin]').each((_, element) => {
      const text = $(element).text().trim();
      const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
      if (vinMatch && vinMatch[1]) {
        vin = vinMatch[1];
      }
    });
    
    // Extract make, model, year from title
    const vehicleTitle = $('h1, h2').first().text().trim();
    const titleMatch = vehicleTitle.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+)/);
    if (titleMatch) {
      year = parseInt(titleMatch[1], 10);
      make = titleMatch[2].trim();
      model = titleMatch[3].trim();
      title = vehicleTitle;
    }
    
    // Extract price
    $('[class*="price"], [id*="price"]').each((_, element) => {
      const text = $(element).text().trim();
      const priceMatch = text.match(/\$\s*([\d,]+)/);
      if (priceMatch && priceMatch[1]) {
        const parsedPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsedPrice) && parsedPrice > 1000) {
          price = parsedPrice;
        }
      }
    });
    
    // Extract mileage
    $('*:contains("miles"), *:contains("mileage")').each((_, element) => {
      const text = $(element).text().trim();
      const mileageMatch = text.match(/([\d,]+)\s*miles/i);
      if (mileageMatch && mileageMatch[1]) {
        const parsedMileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(parsedMileage) && parsedMileage > 0) {
          mileage = parsedMileage;
        }
      }
    });
    
    // Extract images
    $('.vehicle-images img, .gallery img, .carousel img').each((_, img) => {
      const src = $(img).attr('src');
      if (src && !src.includes('placeholder') && !src.includes('loading') && !src.includes('svg')) {
        try {
          const absoluteUrl = new URL(src, url).toString();
          if (!images.includes(absoluteUrl)) {
            images.push(absoluteUrl);
          }
        } catch (error) {
          console.warn(`Invalid image URL: ${src}`);
        }
      }
    });
    
    // If no images found, try to construct image URLs based on vehicle ID
    if (images.length === 0) {
      // Extract any ID from the URL that might be used for images
      const urlParts = url.split('/');
      const vehicleId = urlParts[urlParts.length - 1].replace(/[^0-9]/g, '');
      
      if (vehicleId) {
        const potentialPatterns = [
          `https://novaautoland.com/photos/${vehicleId}/1.jpg`,
          `https://photos.dealercarsearch.com/Media/23726/${vehicleId}/638751490480372364.jpg`,
          `https://images.dealercarsearch.com/Media/23726/${vehicleId}/638751490480372364.jpg`,
          `https://imagescdn.dealercarsearch.com/Media/23726/${vehicleId}/638751490480372364.jpg`
        ];
        
        for (const pattern of potentialPatterns) {
          if (!images.includes(pattern)) {
            images.push(pattern);
            console.log(`Added potential Nova Autoland image from pattern: ${pattern}`);
          }
        }
      }
    }
    
    // Add SVG placeholder as first image for Nova Autoland vehicles
    if (images.length > 0) {
      images.unshift('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 4 3\'%3E%3C/svg%3E');
    }
    
    // Create the vehicle object
    const vehicle: InsertVehicle = {
      title: title || `${year} ${make} ${model}`,
      price,
      year,
      make,
      model,
      mileage,
      vin,
      location: 'Nova Autoland, VA',
      zipCode: '20151',
      dealershipId,
      images,
      carfaxUrl: null,
      contactUrl: null,
      originalListingUrl: url,
      sortOrder: 0
    };
    
    console.log(`Successfully scraped Nova Autoland vehicle: ${year} ${make} ${model} with price $${price} and mileage ${mileage}`);
    console.log(`Found ${images.length} images for vehicle`);
    return vehicle;
    
  } catch (error) {
    console.error(`Error processing Nova Autoland vehicle: ${error}`);
    return null;
  }
}
