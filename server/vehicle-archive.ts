import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../shared/logger';
import { storage } from './storage';
import { Vehicle } from '@shared/schema';

// Directory for storing temporary files
const TEMP_DIR = path.join(process.cwd(), 'tmp');

// Ensure the directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export class VehicleArchiver {
  /**
   * Current photos download HTML file
   */
  public static currentPhotosDownloadFile: string | null = null;

  /**
   * Creates a HTML page that allows users to download all vehicle photos
   * using a simple browser download feature
   */
  public static async createVehiclePhotosDownload(): Promise<string> {
    try {
      // Create a timestamped directory
      const timestamp = Date.now();
      const dirName = `vehicle_photos_${timestamp}`;
      const dirPath = path.join(TEMP_DIR, dirName);
      
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Get all vehicles
      const vehicles = await storage.getAllVehicles();
      logger.info(`Creating download page for ${vehicles.length} vehicles' photos`);
      
      // Create a HTML file that lists all vehicle photos with download links
      const htmlFilePath = path.join(dirPath, 'download.html');
      
      // Start building the HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vehicle Photos Download</title>
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
              background: #f9fafb;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 20px;
              color: #1e3a8a;
              text-align: center;
            }
            h2 {
              font-size: 22px;
              margin: 30px 0 15px;
              color: #1e40af;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 8px;
            }
            .instructions {
              margin: 20px 0 30px;
              padding: 15px;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 8px;
              color: #1e40af;
            }
            .instructions ul {
              margin-left: 20px;
              margin-top: 10px;
            }
            .instructions li {
              margin-bottom: 5px;
            }
            .photo-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
              gap: 15px;
              margin-top: 20px;
            }
            .photo-item {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              overflow: hidden;
              background: white;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              transition: transform 0.2s;
            }
            .photo-item:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .photo-container {
              position: relative;
              padding-top: 75%; /* 4:3 aspect ratio */
            }
            .photo-image {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .photo-info {
              padding: 10px;
              font-size: 13px;
            }
            .photo-title {
              font-weight: 600;
              margin-bottom: 4px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .download-btn {
              display: block;
              width: 100%;
              padding: 8px;
              background: #3b82f6;
              color: white;
              text-align: center;
              border: none;
              border-radius: 0 0 8px 8px;
              font-weight: 500;
              cursor: pointer;
              text-decoration: none;
              margin-top: 5px;
            }
            .download-btn:hover {
              background: #2563eb;
            }
            .section-title {
              position: relative;
              margin-bottom: 20px;
              font-size: 18px;
              font-weight: 600;
              color: #1f2937;
            }
            .section-title::after {
              content: "";
              position: absolute;
              left: 0;
              bottom: -6px;
              width: 50px;
              height: 3px;
              background: #3b82f6;
              border-radius: 3px;
            }
            .button-container {
              margin: 30px 0;
              text-align: center;
            }
            .download-all {
              display: inline-block;
              padding: 12px 24px;
              background: #f59e0b;
              color: white;
              font-weight: 600;
              border-radius: 8px;
              text-decoration: none;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              transition: all 0.2s;
            }
            .download-all:hover {
              background: #d97706;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              transform: translateY(-2px);
            }
            .info-box {
              background: #fef3c7;
              border: 1px solid #fbbf24;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              color: #92400e;
            }
            @media (max-width: 768px) {
              .photo-grid {
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
              }
            }
          </style>
        </head>
        <body>
          <h1>SpecialOffer.Autos - Vehicle Photos</h1>
          
          <div class="instructions">
            <p><strong>Instructions:</strong></p>
            <ul>
              <li>Click on any "Download" button to save that vehicle photo to your computer.</li>
              <li>You can right-click on any image and select "Save image as..." to download it.</li>
              <li>Images are organized by vehicle below.</li>
            </ul>
          </div>
          
          <div class="info-box">
            <p>This page will be available for 30 minutes. After that, you'll need to generate it again from the admin dashboard.</p>
          </div>
      `;
      
      // Create a map to store all photo URLs by vehicle
      const vehiclePhotoMap = new Map<Vehicle, string[]>();
      
      // Filter to only include vehicles with images
      for (const vehicle of vehicles) {
        if (vehicle.images && vehicle.images.length > 0) {
          vehiclePhotoMap.set(vehicle, vehicle.images);
        }
      }
      
      // Add download sections for each vehicle with photos
      for (const [vehicle, photoUrls] of vehiclePhotoMap.entries()) {
        // Get vehicle info for HTML section
        const title = vehicle.title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
        const price = vehicle.price ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(vehicle.price) : 'Price not available';
        
        // Add section for this vehicle
        htmlContent += `
          <h2>${title} - ${price}</h2>
          <div class="section-title">Available Photos (${photoUrls.length})</div>
          <div class="photo-grid">
        `;
        
        // Add each photo
        for (let i = 0; i < photoUrls.length; i++) {
          const photoUrl = photoUrls[i];
          if (!photoUrl) continue;
          
          // Add download link for this photo
          htmlContent += `
            <div class="photo-item">
              <div class="photo-container">
                <img class="photo-image" src="${photoUrl}" alt="${title} - Photo ${i + 1}" loading="lazy">
              </div>
              <div class="photo-info">
                <div class="photo-title">${title}</div>
                <div>Photo ${i + 1} of ${photoUrls.length}</div>
              </div>
              <a href="${photoUrl}" download class="download-btn">Download</a>
            </div>
          `;
        }
        
        // Close vehicle section
        htmlContent += `
          </div>
        `;
      }
      
      // Close the HTML
      htmlContent += `
        </body>
        </html>
      `;
      
      // Write the HTML file
      fs.writeFileSync(htmlFilePath, htmlContent);
      
      // Store the current file path for reference
      this.currentPhotosDownloadFile = htmlFilePath;
      
      logger.info(`Created vehicle photos download page at ${htmlFilePath}`);
      
      // Schedule cleanup after 30 minutes
      setTimeout(() => {
        logger.info(`Scheduling cleanup of photos download file: ${dirPath}`);
        try {
          if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
              fs.unlinkSync(path.join(dirPath, file));
            }
            fs.rmdirSync(dirPath);
            
            if (this.currentPhotosDownloadFile === htmlFilePath) {
              this.currentPhotosDownloadFile = null;
            }
            
            logger.info(`Cleaned up photos download directory: ${dirPath}`);
          }
        } catch (error) {
          logger.error(`Failed to clean up photos download directory: ${error}`);
        }
      }, 30 * 60 * 1000);
      
      return htmlFilePath;
    } catch (error) {
      logger.error(`Error creating vehicle photos download page: ${error}`);
      throw error;
    }
  }
  
  /**
   * Clean up old photo download directories
   */
  public static async cleanupOldFiles(maxAgeMinutes = 30): Promise<void> {
    try {
      const files = fs.readdirSync(TEMP_DIR);
      const now = Date.now();
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('vehicle_photos_')) {
          const dirPath = path.join(TEMP_DIR, file);
          
          // Skip if not a directory
          if (!fs.statSync(dirPath).isDirectory()) continue;
          
          const stats = fs.statSync(dirPath);
          const fileAgeMs = now - stats.mtimeMs;
          const fileAgeMinutes = fileAgeMs / (1000 * 60);
          
          if (fileAgeMinutes > maxAgeMinutes) {
            try {
              // Remove all files in the directory
              const dirFiles = fs.readdirSync(dirPath);
              for (const dirFile of dirFiles) {
                fs.unlinkSync(path.join(dirPath, dirFile));
              }
              
              // Remove the directory itself
              fs.rmdirSync(dirPath);
              deletedCount++;
            } catch (error) {
              logger.error(`Error cleaning up directory ${dirPath}: ${error}`);
            }
          }
        }
      }
      
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old photo download directories`);
      }
    } catch (error) {
      logger.error(`Error cleaning up old photo download files: ${error}`);
    }
  }
}