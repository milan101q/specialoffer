// test-scraper.js
// This script is for local debugging to help identify if scraping issues are due to website changes or deployment environment.

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Introduces a random delay to mimic human browsing behavior and avoid rate limiting.
 * @param {number} min - Minimum delay in milliseconds.
 * @param {number} max - Maximum delay in milliseconds.
 */
async function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`Pausing for ${delay / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Fetches a URL with retries and a timeout.
 * @param {string} url - The URL to fetch.
 * @param {object} headers - Custom headers for the request.
 * @param {number} retries - Number of retries.
 * @returns {Promise<Response>} - The fetch response.
 */
async function fetchWithRetry(url, headers, retries = 3) {
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

            console.log(`Fetching: ${url} (Attempt ${i + 1}/${retries + 1})`);
            const response = await fetch(url, {
                headers: {
                    ...headers,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: controller.signal,
                redirect: 'follow'
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.warn(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
                if (response.status === 403 || response.status === 429) {
                    console.error("Possible bot detection or rate limiting. Consider increasing delays or changing User-Agent.");
                    // For local testing, we might want to stop early on strong blocks
                    return response;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error(`Error fetching ${url}: ${error.message}`);
            if (i < retries) {
                await randomDelay(2000, 5000); // Delay before retrying
            } else {
                throw error;
            }
        }
    }
}

/**
 * Extracts vehicle URLs from a single inventory page.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance loaded with the page HTML.
 * @param {string} baseUrl - The base URL of the dealership.
 * @param {string[]} vehicleUrls - Array to push extracted URLs into.
 */
function extractVehicleUrlsFromPage($, baseUrl, vehicleUrls) {
    // *** IMPORTANT: Update these selectors if novaautoland.com's HTML changes ***
    const vehicleItems = $('.inventory-container, .inventory-item, .vehicle-item, .listing-item, .car-card');

    if (vehicleItems.length === 0) {
        console.warn("No vehicle items found with current selectors. Website structure may have changed.");
    }

    vehicleItems.each((_, element) => {
        // Look for links that contain "inventory" or "vehicle" in their href
        const vehicleLink = $(element).find('a[href*="/inventory/"], a[href*="/vehicle/"], a.vehicle-link, a.listing-link').first();
        const href = vehicleLink.attr('href');

        if (href) {
            try {
                const absoluteUrl = new URL(href, baseUrl).toString();
                if (!vehicleUrls.includes(absoluteUrl)) {
                    vehicleUrls.push(absoluteUrl);
                    console.log(`Found vehicle URL: ${absoluteUrl}`);
                }
            } catch (e) {
                console.warn(`Invalid vehicle URL encountered: ${href} - ${e.message}`);
            }
        } else {
            // console.log("No valid vehicle link found for an item.");
        }
    });
}

/**
 * Finds the URL for the next pagination page.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance loaded with the page HTML.
 * @param {string} currentPageUrl - The URL of the current page.
 * @param {string} baseUrl - The base URL of the dealership.
 * @returns {string|null} - The URL of the next page, or null if not found.
 */
function findNextPageUrl($, currentPageUrl, baseUrl) {
    let nextPageUrl = null;
    // *** IMPORTANT: Update these selectors if novaautoland.com's pagination HTML changes ***
    const paginationLinks = $('.pagination a, .page-item a, a[href*="page="], .next-page-link, .next');

    paginationLinks.each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase().trim();

        // Prioritize links with "next" text or "page=" in href
        if (href && (text.includes('next') || href.includes('page='))) {
            try {
                const url = new URL(href, baseUrl).toString();
                // Ensure it's actually a different page and not the current one or a dummy link
                if (url !== currentPageUrl && !url.includes('#')) {
                    nextPageUrl = url;
                    return false; // Break the loop, found the next page
                }
            } catch (e) {
                console.warn(`Invalid pagination URL: ${href} - ${e.message}`);
            }
        }
    });

    return nextPageUrl;
}

/**
 * Scrapes all vehicle URLs from the inventory.
 * @param {string} inventoryUrl - The starting inventory URL.
 * @param {string} baseUrl - The base URL of the dealership.
 * @returns {Promise<string[]>} - An array of vehicle URLs.
 */
async function getAllVehicleUrls(inventoryUrl, baseUrl) {
    const vehicleUrls = [];
    const visitedPages = new Set();
    let currentPageUrl = inventoryUrl;
    const maxPagesToScrape = 5; // Limit for local testing to avoid excessive requests

    let pageCount = 0;
    do {
        if (pageCount >= maxPagesToScrape) {
            console.log(`Reached maximum pages to scrape (${maxPagesToScrape}) for local test.`);
            break;
        }

        if (visitedPages.has(currentPageUrl)) {
            console.log(`Already visited page: ${currentPageUrl}. Stopping pagination.`);
            break;
        }

        try {
            console.log(`Fetching inventory page: ${currentPageUrl}`);
            const response = await fetchWithRetry(currentPageUrl, {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.google.com/'
            });

            if (!response.ok) {
                console.error(`Failed to fetch inventory page ${currentPageUrl}: ${response.statusText}`);
                break; // Stop if a page fails to load
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            extractVehicleUrlsFromPage($, baseUrl, vehicleUrls);
            visitedPages.add(currentPageUrl);
            pageCount++;

            const next = findNextPageUrl($, currentPageUrl, baseUrl);
            if (next && next !== currentPageUrl) {
                currentPageUrl = next;
                await randomDelay(1000, 3000); // Delay between pages
            } else {
                currentPageUrl = ''; // No more pages
            }

        } catch (error) {
            console.error(`Error processing inventory page ${currentPageUrl}:`, error.message);
            currentPageUrl = ''; // Stop on error
        }
    } while (currentPageUrl);

    return vehicleUrls;
}

/**
 * Scrapes details from a single vehicle page. This is a simplified version for local testing.
 * @param {string} url - The URL of the vehicle page.
 * @returns {Promise<object|null>} - A simplified vehicle object or null if scraping fails.
 */
async function scrapeVehicleDetails(url) {
    try {
        console.log(`Scraping details for: ${url}`);
        const response = await fetchWithRetry(url, {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': 'https://novaautoland.com/inventory'
        });

        if (!response.ok) {
            console.error(`Failed to fetch vehicle page ${url}: ${response.statusText}`);
            return null;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // --- Basic extraction for testing ---
        // *** IMPORTANT: These selectors might need updates based on website changes ***
        const title = $('h1.vehicle-title, .vehicle-name, [itemprop="name"]').first().text().trim();
        const priceText = $('.price, .vehicle-price, .final-price, [itemprop="price"]').first().text().trim();
        const mileageText = $('.mileage, .vehicle-mileage, *:contains("miles")').first().text().trim();
        const vinText = $('*:contains("VIN")').first().text().trim();

        const priceMatch = priceText.match(/\$\s*([\d,]+)/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;

        const mileageMatch = mileageText.match(/([\d,]+)\s*miles/i);
        const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, ''), 10) : 0;

        const vinMatch = vinText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
        const vin = vinMatch ? vinMatch[1] : 'N/A';

        const images = [];
        $('.vehicle-images img, .gallery img, .carousel img').each((_, img) => {
            const src = $(img).attr('src') || $(img).attr('data-src');
            if (src && !src.includes('placeholder') && !src.includes('loading')) {
                try {
                    images.push(new URL(src, url).toString());
                } catch (e) {
                    // console.warn(`Invalid image URL: ${src}`);
                }
            }
        });

        console.log(`  Title: ${title}`);
        console.log(`  Price: $${price}`);
        console.log(`  Mileage: ${mileage} miles`);
        console.log(`  VIN: ${vin}`);
        console.log(`  Images found: ${images.length}`);

        return { title, price, mileage, vin, images: images.slice(0, 3) }; // Return first 3 images for brevity
    } catch (error) {
        console.error(`Error scraping vehicle details from ${url}: ${error.message}`);
        return null;
    }
}

async function main() {
    const dealershipUrl = 'https://novaautoland.com';
    const inventoryStartUrl = `${dealershipUrl}/inventory?clearall=1`;

    console.log('--- Starting Local Nova Autoland Scraper Test ---');
    console.log(`Target URL: ${dealershipUrl}`);

    try {
        const vehicleUrls = await getAllVehicleUrls(inventoryStartUrl, dealershipUrl);
        console.log(`\nFound ${vehicleUrls.length} unique vehicle listing URLs.`);

        if (vehicleUrls.length > 0) {
            console.log('\n--- Scraping Details for Sample Vehicles ---');
            const sampleUrls = vehicleUrls.slice(0, 3); // Scrape details for first 3 vehicles only for local test

            for (const url of sampleUrls) {
                await randomDelay(1000, 2000); // Delay before scraping each detail page
                const vehicleData = await scrapeVehicleDetails(url);
                if (vehicleData) {
                    console.log('\nSuccessfully scraped vehicle:');
                    console.log(vehicleData);
                }
            }
        } else {
            console.log('No vehicle URLs found. Check selectors in extractVehicleUrlsFromPage.');
        }

        console.log('\n--- Local Scraper Test Complete ---');

    } catch (error) {
        console.error('\nAn unhandled error occurred during the scraping process:', error);
    }
}

main().catch(console.error);
