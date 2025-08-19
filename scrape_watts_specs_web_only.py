import os
import time
from urllib.parse import urljoin
import re
import logging
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from bs4 import BeautifulSoup
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

class WattsSpecScraper:
    def __init__(self):
        """Initialize the scraper with web scraping only"""
        self.base_url = "https://www.watts.com"
        self.logger = logging.getLogger(__name__)
        
        # Setup logging
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(f'watts_scraper_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
                logging.StreamHandler()
            ]
        )
        
        # Initialize Selenium
        self._init_selenium()
        
        # Initialize session for PDF downloads
        self._init_session()
        
        # Define categories
        self.drainage_categories = [
            ("Floor & Area Drains", "drainage-solutions/floor-drains-channels-trench/floor-area-drains"),
            ("Roof Drains", "drainage-solutions/roof-drains"),
            ("Dead Level Trench Drains", "drainage-solutions/floor-drains-channels-trench/dead-level-trench-drains"),
            ("Cleanouts", "drainage-solutions/floor-drains-channels-trench/cleanouts"),
            ("Interceptors", "drainage-solutions/interceptors"),
            ("Green Roof Drains", "drainage-solutions/roof-drains/green-roof-drains"),
            ("Parking Deck Drains", "drainage-solutions/roof-drains/parking-deck-drains")
        ]
        
        self.output_dir = "watts_specs"
        self.failed_downloads = []
        self.min_delay = 3
        self.max_delay = 15
        self.current_delay = self.min_delay
    
    def _init_selenium(self):
        """Initialize Selenium WebDriver"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 10)
        self.logger.info("Selenium WebDriver initialized")
    
    def _init_session(self):
        """Initialize session for PDF downloads"""
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        })
        self.logger.info("Session initialized for PDF downloads")
    
    def setup_directories(self):
        """Create necessary directories"""
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            self.logger.info(f"Created main directory: {self.output_dir}")
    
    def get_category_url(self, category):
        """Get the URL for a category"""
        category_mapping = {
            "Floor & Area Drains": "drainage-solutions/floor-drains-channels-trench/floor-area-drains",
            "Roof Drains": "drainage-solutions/roof-drains",
            "Parking Deck Drains": "drainage-solutions/roof-drains/parking-deck-drains",
            "Green Roof Drains": "drainage-solutions/roof-drains/green-roof-drains",
            "Interceptors": "drainage-solutions/interceptors",
            "Cleanouts": "drainage-solutions/floor-drains-channels-trench/cleanouts",
            "Dead Level Trench Drains": "drainage-solutions/floor-drains-channels-trench/dead-level-trench-drains"
        }
        return f"{self.base_url}/products/{category_mapping.get(category, category.lower().replace(' ', '-'))}"
    
    def get_product_links(self, url):
        """Get product links from a category page using Selenium"""
        try:
            self.logger.info(f"Loading page: {url}")
            self.driver.get(url)
            time.sleep(5)  # Wait for initial load
            
            # Scroll to load all content
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)
            
            # Get page source and parse with BeautifulSoup
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            product_links = []
            
            # Find product containers
            product_containers = soup.find_all(['div', 'article'], attrs={
                'class': lambda x: x and any(term in str(x).lower() for term in ['product', 'item', 'card', 'tile']),
                'data-product-id': True
            })
            
            for container in product_containers:
                # Look for model numbers
                model_match = None
                for attr in ['data-model-number', 'data-product-id', 'data-item-number', 'id']:
                    if container.has_attr(attr):
                        model_match = re.search(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', container[attr], re.IGNORECASE)
                        if model_match:
                            break
                
                if not model_match:
                    model_match = container.find(text=re.compile(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', re.IGNORECASE))
                
                if model_match:
                    model = re.search(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', str(model_match), re.IGNORECASE).group(0)
                    link = container.find('a', href=lambda x: x and '/products/' in x)
                    if link:
                        product_url = urljoin(self.base_url, link['href'])
                        if (product_url, model.upper()) not in product_links:
                            product_links.append((product_url, model.upper()))
                            self.logger.info(f"Found product: {model} at {product_url}")
            
            if not product_links:
                self.logger.warning(f"No product links found for category: {url}")
                # Save page source for debugging
                debug_file = f"debug_page_source_{int(time.time())}.html"
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(self.driver.page_source)
                self.logger.info(f"Saved page source to {debug_file}")
            
            return product_links
            
        except Exception as e:
            self.logger.error(f"Error getting product links from {url}: {str(e)}")
            return []
    
    def get_spec_sheet_url(self, product_url):
        """Get specification sheet URL using Selenium"""
        try:
            self.logger.info(f"Getting spec sheet URL for {product_url}")
            self.driver.get(product_url)
            time.sleep(5)
            
            # Try to find and click the Specifications section
            expand_button = None
            for selector in [
                "//button[contains(@class, 'js-accordion__trigger') and contains(text(), 'Specifications')]",
                "//button[contains(@class, 'accordion__trigger') and contains(text(), 'Specifications')]",
                "//h2[contains(text(), 'Specifications')]/..//button"
            ]:
                try:
                    expand_button = self.wait.until(
                        EC.element_to_be_clickable((By.XPATH, selector))
                    )
                    if expand_button:
                        break
                except:
                    continue
            
            if expand_button:
                self.driver.execute_script("arguments[0].click();", expand_button)
                time.sleep(2)
                
                # Look for PDF link
                for selector in [
                    "//a[contains(@class, 'product-download__link') and contains(text(), 'Specification Sheet')]",
                    "//a[contains(@class, 'product-download__link') and contains(@href, '.pdf')]",
                    "//div[contains(@class, 'product-downloads')]//a[contains(@href, '.pdf')]"
                ]:
                    try:
                        spec_link = self.wait.until(
                            EC.presence_of_element_located((By.XPATH, selector))
                        )
                        if spec_link:
                            spec_url = spec_link.get_attribute('href')
                            if spec_url:
                                if not spec_url.startswith('http'):
                                    spec_url = urljoin(self.base_url, spec_url)
                                self.logger.info(f"Found spec sheet URL: {spec_url}")
                                return spec_url
                    except:
                        continue
            
            self.logger.warning(f"Could not find spec sheet URL for {product_url}")
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting spec sheet URL for {product_url}: {str(e)}")
            return None
    
    def download_pdf(self, url, output_path):
        """Download a PDF file"""
        try:
            response = self.session.get(url, stream=True)
            response.raise_for_status()
            
            if 'pdf' not in response.headers.get('content-type', '').lower():
                self.logger.warning(f"URL {url} returned non-PDF content")
                return False
            
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            self.logger.info(f"Successfully downloaded {url} to {output_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to download {url}: {str(e)}")
            return False
    
    def clean_filename(self, filename):
        """Clean filename to be valid"""
        return re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    def scrape_category(self, category_name, category_slug):
        """Scrape a single category"""
        self.logger.info(f"\nStarting to scrape category: {category_name}")
        category_dir = os.path.join(self.output_dir, self.clean_filename(category_name))
        os.makedirs(category_dir, exist_ok=True)
        
        category_url = self.get_category_url(category_name)
        product_links = self.get_product_links(category_url)
        
        successful_downloads = 0
        total_products = len(product_links)
        
        for i, (product_url, product_code) in enumerate(product_links, 1):
            self.logger.info(f"Processing product {i}/{total_products}")
            spec_url = self.get_spec_sheet_url(product_url)
            
            if spec_url:
                output_path = os.path.join(category_dir, f"{self.clean_filename(product_code)}.pdf")
                if not os.path.exists(output_path):
                    if self.download_pdf(spec_url, output_path):
                        successful_downloads += 1
                else:
                    self.logger.info(f"File already exists: {output_path}")
                    successful_downloads += 1
            
            time.sleep(self.current_delay)
        
        self.logger.info(f"Category {category_name} complete. "
                      f"Successfully downloaded {successful_downloads}/{total_products} specs.")
    
    def run(self):
        """Run the scraper for all categories"""
        self.setup_directories()
        start_time = time.time()
        
        try:
            for category_name, category_slug in self.drainage_categories:
                self.scrape_category(category_name, category_slug)
                time.sleep(self.current_delay * 2)
        
        finally:
            duration = time.time() - start_time
            self.logger.info(f"\nScraping completed in {duration:.2f} seconds")
            self.logger.info(f"Failed downloads: {len(self.failed_downloads)}")
            
            if self.failed_downloads:
                self.logger.info("\nFailed Downloads:")
                for url, path in self.failed_downloads:
                    self.logger.info(f"- {url} -> {path}")
    
    def __del__(self):
        """Clean up resources"""
        if hasattr(self, 'driver'):
            self.driver.quit()

if __name__ == "__main__":
    scraper = WattsSpecScraper()
    
    try:
        print("\nStarting to scrape all categories...")
        scraper.run()
        print("\nScraping completed!")
    
    except Exception as e:
        print(f"\nError during scraping: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
    finally:
        print("\nCleaning up...")
        scraper.__del__()
        print("Done!") 