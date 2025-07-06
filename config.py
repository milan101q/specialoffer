# Scraper Configuration
SCRAPER_CONFIG = {
    'base_url': 'https://novaautoland.com',
    'timeout': 15,
    'max_retries': 3,
    'delay_range': (1, 5),  # min and max delay in seconds
    'user_agents': [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
    ],
    'output_file': 'scraped_data.json'
}
