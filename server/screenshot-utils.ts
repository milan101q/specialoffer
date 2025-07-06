import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../shared/logger';
import { storage } from './storage';

// Directory for storing temp files
const TEMP_DIR = path.join(process.cwd(), 'tmp');
const VEHICLE_CARDS_DIR = path.join(TEMP_DIR, 'vehicle_cards');

// Ensure directories exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

if (!fs.existsSync(VEHICLE_CARDS_DIR)) {
  fs.mkdirSync(VEHICLE_CARDS_DIR, { recursive: true });
}

// Debug directory structure
logger.info(`TEMP_DIR: ${TEMP_DIR}`);
logger.info(`VEHICLE_CARDS_DIR: ${VEHICLE_CARDS_DIR}`);

/**
 * Utility for downloading and presenting vehicle card images
 */
export class VehicleCardImageService {
  /**
   * Current download page path for reference
   */
  public static currentDownloadPage: string | null = null;

  /**
   * Downloads all the first images from each vehicle (card images)
   * and creates a download page
   */
  public static async createVehicleCardImagesPage(): Promise<string> {
    try {
      // Create a timestamped directory
      const timestamp = Date.now();
      const dirName = `vehicle_cards_${timestamp}`;
      const dirPath = path.join(VEHICLE_CARDS_DIR, dirName);
      
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Get all vehicles
      const vehicles = await storage.getAllVehicles();
      logger.info(`Creating download page for ${vehicles.length} vehicles' card images`);
      
      // Create an HTML file with all vehicle card images for download
      const htmlFileName = 'cards.html';
      const htmlFilePath = path.join(dirPath, htmlFileName);
      
      // Start building HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vehicle Card Images - SpecialOffer.Autos</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              background: #f5f7fa;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 20px;
              color: #1c2a48;
              text-align: center;
            }
            .instructions {
              margin: 20px 0 30px;
              padding: 20px;
              background: #e3f2fd;
              border: 1px solid #bbdefb;
              border-radius: 10px;
              font-size: 16px;
              line-height: 1.5;
            }
            .instructions ul {
              margin-left: 20px;
              margin-top: 15px;
            }
            .instructions li {
              margin-bottom: 10px;
            }
            .download-all-section {
              margin: 30px 0;
              text-align: center;
            }
            .download-all {
              padding: 12px 24px;
              font-size: 16px;
              background: #4caf50;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
              transition: all 0.2s;
              font-weight: 600;
              text-decoration: none;
              display: inline-block;
            }
            .download-all:hover {
              background: #388e3c;
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
              transform: translateY(-2px);
            }
            .cards-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
              gap: 25px;
              margin-top: 30px;
            }
            .card {
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 3px 10px rgba(0,0,0,0.08);
              background: white;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .card:hover {
              transform: translateY(-5px);
              box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .card-image-container {
              position: relative;
              height: 200px;
              overflow: hidden;
            }
            .card-image {
              width: 100%;
              height: 100%;
              object-fit: cover;
              transition: transform 0.3s;
            }
            .card:hover .card-image {
              transform: scale(1.05);
            }
            .card-details {
              padding: 15px;
            }
            .card-title {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 8px;
              color: #1c2a48;
            }
            .card-price {
              font-size: 18px;
              font-weight: 700;
              color: #e91e63;
              margin-bottom: 10px;
            }
            .card-download {
              display: block;
              padding: 10px;
              background: #2196f3;
              color: white;
              text-align: center;
              border-radius: 5px;
              text-decoration: none;
              font-weight: 500;
              margin-top: 10px;
              transition: background 0.2s;
            }
            .card-download:hover {
              background: #1976d2;
            }
            .download-count {
              display: inline-block;
              padding: 3px 10px;
              background: #f5f5f5;
              border-radius: 20px;
              font-size: 14px;
              color: #666;
              margin-left: 10px;
            }
            .expiry-note {
              text-align: center;
              margin-top: 40px;
              color: #777;
              font-size: 14px;
            }
            #download-progress {
              display: none;
              margin: 20px auto;
              padding: 15px;
              background: #fff9c4;
              border: 1px solid #ffd54f;
              border-radius: 10px;
              text-align: center;
              max-width: 600px;
            }
            #download-button {
              display: block;
              margin: 15px auto;
              padding: 10px 20px;
              background: #ff9800;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-weight: 600;
            }
            #download-button:hover {
              background: #f57c00;
            }
            @media (max-width: 768px) {
              .cards-grid {
                grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
              }
            }
          </style>
        </head>
        <body>
          <h1>Vehicle Card Images - SpecialOffer.Autos</h1>
          
          <div class="instructions">
            <p><strong>Instructions</strong></p>
            <ul>
              <li>Each image below represents a vehicle card as it appears on the website.</li>
              <li>Click the "Download Image" button under each card to save that individual image.</li>
              <li>Use your browser's "Save As" feature to download images in their original quality.</li>
              <li>For bulk download: right-click on each image and select "Save Image As".</li>
            </ul>
          </div>
          
          <div class="cards-grid">
      `;
      
      // Filter to only include vehicles with at least one image
      const vehiclesWithImages = vehicles.filter(v => v.images && v.images.length > 0);
      
      // Track all card images
      const allCardImages: string[] = [];
      
      // Download and include card image for each vehicle
      for (const vehicle of vehiclesWithImages) {
        try {
          if (!vehicle.images || !vehicle.images[0]) continue;
          
          // Get the main image URL for the vehicle card
          const imageUrl = vehicle.images[0];
          
          // Create unique filename
          const safeTitle = (vehicle.title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`)
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();
          const fileName = `${safeTitle}_${vehicle.id}.jpg`;
          const filePath = path.join(dirPath, fileName);
          
          // Download the image
          const response = await fetch(imageUrl);
          if (!response.ok) {
            logger.warn(`Failed to download image from ${imageUrl}: ${response.status} ${response.statusText}`);
            continue;
          }
          
          const buffer = Buffer.from(await response.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
          
          allCardImages.push(filePath);
          
          // Get vehicle info for HTML
          const title = vehicle.title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
          const price = vehicle.price ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          }).format(vehicle.price) : 'Price not available';
          
          // Add card to HTML
          htmlContent += `
            <div class="card">
              <div class="card-image-container">
                <img class="card-image" src="${fileName}" alt="${title}" loading="lazy">
              </div>
              <div class="card-details">
                <div class="card-title">${title}</div>
                <div class="card-price">${price}</div>
                <a href="${fileName}" download="${safeTitle}.jpg" class="card-download">Download Image</a>
              </div>
            </div>
          `;
          
          // Log progress periodically
          if (allCardImages.length % 20 === 0) {
            logger.info(`Downloaded ${allCardImages.length} vehicle card images so far...`);
          }
        } catch (error) {
          logger.error(`Error processing vehicle card image: ${error}`);
        }
      }
      
      // Close HTML
      htmlContent += `
          </div>
          
          <div class="expiry-note">
            <p>This page will be available for 30 minutes. Generated on ${new Date().toLocaleString()}</p>
          </div>
          
          <script>
            // Add functionality to download images when needed
            document.addEventListener('DOMContentLoaded', function() {
              // Additional browser-side features can be added here
            });
          </script>
        </body>
        </html>
      `;
      
      // Write HTML file
      fs.writeFileSync(htmlFilePath, htmlContent);
      
      // Store the current download page for reference
      this.currentDownloadPage = htmlFilePath;
      
      logger.info(`Created vehicle card images download page at ${htmlFilePath} with ${allCardImages.length} images`);
      
      // Schedule cleanup after 30 minutes
      setTimeout(() => {
        try {
          this.cleanupDirectory(dirPath);
          if (this.currentDownloadPage === htmlFilePath) {
            this.currentDownloadPage = null;
          }
        } catch (error) {
          logger.error(`Failed to clean up download directory: ${error}`);
        }
      }, 30 * 60 * 1000);
      
      return htmlFilePath;
    } catch (error) {
      logger.error(`Error creating vehicle card images download page: ${error}`);
      throw error;
    }
  }
  
  /**
   * Clean up a specific directory
   */
  private static cleanupDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        fs.unlinkSync(path.join(dirPath, file));
      }
      fs.rmdirSync(dirPath);
      logger.info(`Cleaned up directory: ${dirPath}`);
    }
  }
  
  /**
   * Clean up old download directories
   */
  public static async cleanupOldDownloads(maxAgeMinutes = 30): Promise<void> {
    try {
      if (!fs.existsSync(VEHICLE_CARDS_DIR)) return;
      
      const directories = fs.readdirSync(VEHICLE_CARDS_DIR);
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const dir of directories) {
        if (dir.startsWith('vehicle_cards_')) {
          const dirPath = path.join(VEHICLE_CARDS_DIR, dir);
          
          // Skip if not a directory
          if (!fs.statSync(dirPath).isDirectory()) continue;
          
          const stats = fs.statSync(dirPath);
          const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);
          
          if (ageMinutes > maxAgeMinutes) {
            try {
              this.cleanupDirectory(dirPath);
              cleanedCount++;
            } catch (error) {
              logger.error(`Error cleaning up directory ${dirPath}: ${error}`);
            }
          }
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old vehicle card download directories`);
      }
    } catch (error) {
      logger.error(`Error cleaning up old vehicle card downloads: ${error}`);
    }
  }
}