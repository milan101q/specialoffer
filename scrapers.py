import requests
from bs4 import BeautifulSoup
import time
import random
from fake_useragent import UserAgent
from urllib.parse import urljoin
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Configuration
BASE_URL = "https://novaautoland.com"
REQUEST_DELAY = random.uniform(1, 5)  # Random delay between 1-5 seconds
MAX_RETRIES = 3
TIMEOUT = 10

class NovaAutoScraper:
    def __init__(self):
        self.ua = UserAgent()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': self.ua.random,
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': BASE_URL
        })

    def get_with_retry(self, url):
        for attempt in range(MAX_RETRIES):
            try:
                time.sleep(REQUEST_DELAY)
                response = self.session.get(
                    url,
                    timeout=TIMEOUT,
                    headers={'User-Agent': self.ua.random}
                )
                response.raise_for_status()
                return response
            except requests.RequestException as e:
                logging.warning(f"Attempt {attempt + 1} failed: {str(e)}")
                if attempt == MAX_RETRIES - 1:
                    logging.error(f"Max retries reached for {url}")
                    raise
                time.sleep(2 ** attempt)  # Exponential backoff

    def scrape_vehicle_listings(self):
        try:
            logging.info(f"Starting scrape of {BASE_URL}")
            response = self.get_with_retry(BASE_URL)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find all vehicle listings - UPDATE THESE SELECTORS
            listings = soup.select('div.vehicle-listing')  # Adjust this
            
            vehicles = []
            for listing in listings:
                try:
                    vehicle = {
                        'title': self._get_text(listing, 'h2.vehicle-title'),
                        'price': self._get_text(listing, '.price'),
                        'mileage': self._get_text(listing, '.mileage'),
                        'link': self._get_link(listing, 'a.vehicle-link'),
                        'image': self._get_image(listing, 'img.vehicle-image')
                    }
                    vehicles.append(vehicle)
                except Exception as e:
                    logging.error(f"Error processing listing: {str(e)}")
                    continue
            
            logging.info(f"Successfully scraped {len(vehicles)} vehicles")
            return vehicles
            
        except Exception as e:
            logging.error(f"Scraping failed: {str(e)}")
            return []

    def _get_text(self, element, selector):
        found = element.select_one(selector)
        return found.get_text(strip=True) if found else None

    def _get_link(self, element, selector):
        found = element.select_one(selector)
        return urljoin(BASE_URL, found['href']) if found and found.has_attr('href') else None

    def _get_image(self, element, selector):
        found = element.select_one(selector)
        return found['src'] if found and found.has_attr('src') else None

# Example usage
if __name__ == "__main__":
    scraper = NovaAutoScraper()
    results = scraper.scrape_vehicle_listings()
    print(f"Scraped {len(results)} vehicles")
