from flask import Flask, jsonify
from scrapers import NovaAutoScraper
import logging

app = Flask(__name__)

@app.route('/scrape', methods=['GET'])
def scrape_vehicles():
    try:
        scraper = NovaAutoScraper()
        results = scraper.scrape_vehicle_listings()
        return jsonify({
            'status': 'success',
            'count': len(results),
            'data': results
        })
    except Exception as e:
        logging.error(f"API error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
