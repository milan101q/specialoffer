import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { spawn } from 'child_process';
import { storage } from './storage';
import { Vehicle } from '@shared/schema';
import { logger } from '@shared/logger';

// Directory for storing temporary screenshots and html files
const TEMP_DIR = path.join(process.cwd(), 'tmp');

// Ensure the directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export class ScreenshotService {
  // Store the current vehicle cards directory path for reference
  public static currentVehicleCardsDir: string | null = null;
  /**
   * Generates an HTML representation of a vehicle card for screenshot
   */
  private static async generateVehicleCardHtml(vehicle: Vehicle): Promise<string> {
    // Format functions
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(price);
    };

    const formatMileage = (mileage: number) => {
      return new Intl.NumberFormat('en-US').format(mileage) + ' miles';
    };

    // Get main image
    const mainImage = vehicle.images && vehicle.images.length > 0 
      ? vehicle.images[0] 
      : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTIiIHg9IjMiIHk9IjYiIHJ4PSIyIiAvPjxwYXRoIGQ9Ik0xNiAxNnYyYTIgMiAwIDAgMS0yIDJINmEyIDIgMCAwIDEtMi0ydi0yIiAvPjxwYXRoIGQ9Ik04IDZWNGEyIDIgMCAwIDEgMi0yaDRhMiAyIDAgMCAxIDIgMnYyIiAvPjwvc3ZnPg==';

    // Get dealership name from ID (not part of Vehicle type)
    let dealerName = 'Unknown Dealership';
    try {
      const dealership = await storage.getDealership(vehicle.dealershipId);
      if (dealership) {
        dealerName = dealership.name;
      }
    } catch (error) {
      logger.warn(`Failed to get dealership name for ID ${vehicle.dealershipId}:`, error);
    }
    const location = vehicle.location || 'Unknown Location';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vehicle Card</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            width: 400px;
            height: 600px;
            margin: 0;
            padding: 0;
            background: white;
          }
          .card {
            width: 100%;
            height: 100%;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            display: flex;
            flex-direction: column;
          }
          .image-container {
            width: 100%;
            height: 60%;
            position: relative;
            background: #f1f5f9;
          }
          .image {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .location-badge {
            position: absolute;
            bottom: 12px;
            left: 12px;
            background-color: rgb(59, 130, 246);
            color: white;
            font-size: 12px;
            font-weight: 500;
            padding: 4px 8px;
            border-radius: 9999px;
          }
          .discount-badge {
            position: absolute;
            top: 12px;
            left: 12px;
            background: linear-gradient(to right, #f59e0b, #ef4444);
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 9999px;
            border: 1px solid white;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .star-icon {
            width: 12px;
            height: 12px;
            margin-right: 4px;
            fill: #fef08a;
          }
          .price-badge {
            position: absolute;
            top: 12px;
            right: 12px;
            background-color: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(4px);
            color: rgb(37, 99, 235);
            font-size: 14px;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 9999px;
          }
          .content {
            padding: 16px;
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
          }
          .title {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: 8px;
          }
          .price {
            font-size: 18px;
            font-weight: 700;
            color: rgb(59, 130, 246);
            white-space: nowrap;
          }
          .info {
            margin-top: 8px;
            font-size: 14px;
            color: #4b5563;
          }
          .info-item {
            display: flex;
            align-items: center;
            margin-bottom: 6px;
          }
          .info-icon {
            margin-right: 6px;
            width: 14px;
            height: 14px;
            opacity: 0.7;
          }
          .badge {
            display: flex;
            justify-content: center;
            margin-top: 12px;
            margin-bottom: 4px;
          }
          .stamp {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: rotate(1deg);
            background: linear-gradient(to bottom right, #f0f9ff, #e0f2fe);
            border-radius: 8px;
            border: 1px solid #bfdbfe;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            padding: 8px 20px;
          }
          .stamp-inner {
            position: absolute;
            height: calc(100% - 8px);
            width: calc(100% - 8px);
            border: 1px dashed #93c5fd;
            border-radius: 6px;
            opacity: 0.6;
          }
          .stamp-content {
            position: relative;
            display: flex;
            align-items: center;
          }
          .verify-icon {
            flex-shrink: 0;
            margin-right: 8px;
            position: relative;
            width: 20px;
            height: 20px;
          }
          .verify-bg {
            position: absolute;
            inset: 0;
            background-color: #dbeafe;
            border-radius: 9999px;
            transform: scale(0.9);
          }
          .verify-check {
            position: relative;
            width: 20px;
            height: 20px;
            color: #1d4ed8;
          }
          .badge-text {
            display: flex;
            flex-direction: column;
          }
          .badge-label {
            font-size: 11px;
            line-height: 1;
            color: #2563eb;
            font-weight: 500;
          }
          .badge-site {
            font-size: 14px;
            font-weight: 800;
            background: linear-gradient(to right, #1e40af, #4f46e5);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            line-height: 1.2;
            letter-spacing: -0.5px;
          }
          .buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 16px;
          }
          .button {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
          }
          .button-carfax {
            background-color: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
          }
          .button-contact {
            background-color: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
          }
          .button-icon {
            width: 12px;
            height: 12px;
            margin-right: 4px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="image-container">
            <img src="${mainImage}" alt="${vehicle.title}" class="image" />
            <div class="location-badge">${location}</div>
            <div class="discount-badge">
              <svg class="star-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd" />
              </svg>
              DISCOUNT: FB100
            </div>
            <div class="price-badge">${formatPrice(vehicle.price)}</div>
          </div>
          <div class="content">
            <div class="header">
              <h3 class="title">${vehicle.title}</h3>
              <span class="price">${formatPrice(vehicle.price)}</span>
            </div>
            <div class="info">
              <div class="info-item">
                <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="8"></circle>
                  <path d="M16.2 7.8l-2 6.3-6.4 2.1"></path>
                </svg>
                <span>${formatMileage(vehicle.mileage)}</span>
              </div>
              <div class="info-item">
                <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${location}</span>
              </div>
              <div class="info-item">
                <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect>
                  <path d="M9 22v-4h6v4"></path>
                  <path d="M8 6h.01"></path>
                  <path d="M16 6h.01"></path>
                  <path d="M12 6h.01"></path>
                  <path d="M12 10h.01"></path>
                  <path d="M8 10h.01"></path>
                  <path d="M16 10h.01"></path>
                  <path d="M12 14h.01"></path>
                  <path d="M8 14h.01"></path>
                  <path d="M16 14h.01"></path>
                </svg>
                <span>${dealerName}</span>
              </div>
              
              <div class="badge">
                <div class="stamp">
                  <div class="stamp-inner"></div>
                  <div class="stamp-content">
                    <div class="verify-icon">
                      <div class="verify-bg"></div>
                      <svg class="verify-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"></path>
                      </svg>
                    </div>
                    <div class="badge-text">
                      <span class="badge-label">Verified Deal</span>
                      <span class="badge-site">SpecialOffer.Autos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="buttons">
              <div class="button button-carfax">
                <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                Carfax Report
              </div>
              <div class="button button-contact">
                <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                </svg>
                Contact Dealer
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Creates HTML files for all vehicle cards in a directory
   * Returns the directory path containing all HTML files
   */
  public static async generateVehicleCardsHtml(): Promise<string> {
    try {
      const timestamp = Date.now();
      const dirName = `vehicle_cards_${timestamp}`;
      const dirPath = path.join(TEMP_DIR, dirName);
      
      // Store the current directory path for reference
      this.currentVehicleCardsDir = dirPath;
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Get all vehicles
      const vehicles = await storage.getAllVehicles();
      
      logger.info(`Generating HTML files for ${vehicles.length} vehicle cards`);
      
      // Generate HTML files for each vehicle
      const generatedFiles: string[] = [];
      
      for (let i = 0; i < vehicles.length; i++) {
        const vehicle = vehicles[i];
        const htmlContent = await this.generateVehicleCardHtml(vehicle);
        // Create a safe filename
        const safeVehicleId = vehicle.id.toString();
        const safeMake = (vehicle.make || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safeModel = (vehicle.model || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `vehicle_${safeVehicleId}_${safeMake}_${safeModel}.html`;
        const filePath = path.join(dirPath, filename);
        
        // Write HTML content to file
        await fsPromises.writeFile(filePath, htmlContent, 'utf-8');
        generatedFiles.push(filename);
      }
      
      logger.info(`Successfully generated ${generatedFiles.length} HTML files in ${dirPath}`);
      
      // Create an index.html file that links to all vehicle cards
      const indexHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vehicle Cards Gallery</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              padding: 20px;
              background: #f9fafb;
            }
            h1 {
              margin-bottom: 20px;
              color: #1e40af;
            }
            .container {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
              gap: 20px;
            }
            .card-link {
              text-decoration: none;
              color: #111827;
              display: block;
              padding: 15px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .card-link:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .card-title {
              font-size: 16px;
              font-weight: 500;
              margin-bottom: 5px;
            }
            .card-info {
              font-size: 14px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <h1>SpecialOffer.Autos - Vehicle Cards</h1>
          <div class="container">
            ${vehicles.map((vehicle, index) => {
              const safeVehicleId = vehicle.id.toString();
              const safeMake = (vehicle.make || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
              const safeModel = (vehicle.model || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
              const filename = `vehicle_${safeVehicleId}_${safeMake}_${safeModel}.html`;
              
              return `
                <a href="${filename}" class="card-link" target="_blank">
                  <div class="card-title">${vehicle.title}</div>
                  <div class="card-info">${vehicle.make} ${vehicle.model} · ${vehicle.year} · $${vehicle.price.toLocaleString()}</div>
                </a>
              `;
            }).join('')}
          </div>
        </body>
        </html>
      `;
      
      await fsPromises.writeFile(path.join(dirPath, 'index.html'), indexHtml, 'utf-8');
      
      return dirPath;
    } catch (error) {
      logger.error('Failed to generate vehicle cards HTML:', error);
      throw error;
    }
  }

  /**
   * Cleans up old temporary files and directories
   */
  public static async cleanupTempFiles(maxAgeMinutes = 10): Promise<void> {
    try {
      const files = await fsPromises.readdir(TEMP_DIR);
      const now = Date.now();
      
      for (const file of files) {
        try {
          const filePath = path.join(TEMP_DIR, file);
          const stats = await fsPromises.stat(filePath);
          const fileAgeMins = (now - stats.mtimeMs) / (1000 * 60);
          
          if (fileAgeMins > maxAgeMinutes) {
            // Check if it's a directory
            if (stats.isDirectory()) {
              // First delete all files in the directory recursively
              const deleteDir = async (dirPath: string) => {
                const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
                
                await Promise.all(entries.map(async (entry) => {
                  const fullPath = path.join(dirPath, entry.name);
                  if (entry.isDirectory()) {
                    await deleteDir(fullPath);
                  } else {
                    await fsPromises.unlink(fullPath);
                  }
                }));
                
                await fsPromises.rmdir(dirPath);
              };
              
              await deleteDir(filePath);
              logger.info(`Cleaned up temp directory: ${file}`);
            } else {
              await fsPromises.unlink(filePath);
              logger.info(`Cleaned up temp file: ${file}`);
            }
          }
        } catch (err) {
          logger.error(`Error cleaning up ${file}:`, err);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up temp files:', error);
    }
  }
}