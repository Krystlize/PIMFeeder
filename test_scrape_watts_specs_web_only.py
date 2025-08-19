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
from selenium.webdriver.support.ui import Select
import unittest
from unittest.mock import patch, MagicMock

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
                logging.FileHandler(f'watts_scraper_test_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
                logging.StreamHandler()
            ]
        )
        
        # Initialize Selenium
        self._init_selenium()
        
        # Initialize session for PDF downloads
        self._init_session()
        
        # Define drainage categories
        self.drainage_categories = [
            ("Floor & Area Drains", "drainage-solutions/floor-drains-channels-trench/floor-area-drains"),
            ("Roof Drains", "drainage-solutions/roof-drains"),
            ("Dead Level Trench Drains", "drainage-solutions/floor-drains-channels-trench/dead-level-trench-drains"),
            ("Cleanouts", "drainage-solutions/cleanouts"),
            ("Interceptors", "drainage-solutions/interceptors"),
            ("Green Roof Drains", "drainage-solutions/roof-drains/green-roof-drains"),
            ("Parking Deck Drains", "drainage-solutions/roof-drains/parking-deck-drains")
        ]
        
        self.output_dir = "watts_specs_test"
        self.failed_downloads = []
        self.min_delay = 3
        self.max_delay = 15
        self.current_delay = self.min_delay
    
    def _init_selenium(self):
        """Initialize Selenium WebDriver"""
        chrome_options = Options()
        chrome_options.add_argument('--headless=new')  # Updated headless mode
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-notifications')
        chrome_options.add_argument('--disable-popup-blocking')
        chrome_options.add_argument('--ignore-certificate-errors')
        chrome_options.add_argument('--disable-extensions')
        
        # Add additional preferences
        chrome_options.add_experimental_option('prefs', {
            'download.prompt_for_download': False,
            'download.directory_upgrade': True,
            'safebrowsing.enabled': True
        })
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.set_page_load_timeout(30)  # Set page load timeout
        self.wait = WebDriverWait(self.driver, 20)  # Increased wait time
        self.logger.info("Selenium WebDriver initialized with headless mode")
    
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
            "Floor & Area Drains": "drainage-solutions/floor-drains-channels-trench/floor-area-drains"
        }
        return f"{self.base_url}/products/{category_mapping.get(category, category.lower().replace(' ', '-'))}"
    
    def handle_cookie_consent(self):
        """Handle cookie consent popup if present"""
        try:
            cookie_btn = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler"))
            )
            cookie_btn.click()
            time.sleep(2)
            print("Cookie consent handled")
            return True
        except:
            print("No cookie consent button found or already accepted")
            return False

    def get_product_links(self, category_url):
        """Get all product links from a category page."""
        try:
            print(f"\nNavigating to category URL: {category_url}")
            self.driver.get(category_url)
            time.sleep(5)  # Initial wait for page load
            
            # Handle cookie consent
            self.handle_cookie_consent()
            
            # Wait for product grid to load
            print("Waiting for product grid to load...")
            try:
                grid_container = WebDriverWait(self.driver, 20).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "product-grid"))
                )
                print("Product grid found")
            except TimeoutException:
                print("Timeout waiting for product grid")
                return []
            
            # Try to set display to show 60 items per page
            try:
                print("Attempting to set 60 items per page...")
                dropdown = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.CLASS_NAME, "product-grid__dropdown"))
                )
                Select(dropdown).select_by_value("60")
                time.sleep(5)  # Wait for grid to update
                print("Successfully set to 60 items per page")
            except Exception as e:
                print(f"Could not set items per page: {str(e)}")
            
            product_links = []
            
            # Get all product cards
            print("Finding product cards...")
            product_cards = self.driver.find_elements(By.CSS_SELECTOR, ".grid-item")
            print(f"Found {len(product_cards)} product cards")
            
            for card in product_cards:
                try:
                    # Get link element
                    link_elem = card.find_element(By.CSS_SELECTOR, "a.grid-item__link")
                    product_url = link_elem.get_attribute("href")
                    
                    # Get product details
                    product_code = card.find_element(By.CSS_SELECTOR, ".grid-item__heading").text.strip()
                    product_desc = card.find_element(By.CSS_SELECTOR, ".grid-item__paragraph").text.strip()
                    
                    if product_url:
                        print(f"Found product: {product_code} - {product_desc}")
                        product_links.append((product_url, product_code, product_desc))
                except Exception as e:
                    print(f"Error processing product card: {str(e)}")
                    continue
            
            print(f"Total products found: {len(product_links)}")
            return product_links
            
        except Exception as e:
            print(f"Error in get_product_links: {str(e)}")
            return []
    
    def get_spec_sheet_url(self, product_url):
        """Get the specification sheet URL from a product page."""
        try:
            print(f"\nNavigating to product URL: {product_url}")
            self.driver.get(product_url)
            time.sleep(5)  # Initial wait for page load
            
            # Handle cookie consent
            self.handle_cookie_consent()
            
            # Wait for product details to load
            try:
                print("Waiting for product details to load...")
                WebDriverWait(self.driver, 20).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "product-details"))
                )
                time.sleep(5)  # Extra wait for dynamic content
                print("Product details loaded")
            except TimeoutException:
                print("Timeout waiting for product details")
                return None
            
            # First try: Check the downloads section
            try:
                print("Checking downloads section...")
                downloads_section = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, "downloads"))
                )
                
                # Look for specification sheet links
                spec_links = downloads_section.find_elements(By.XPATH, 
                    ".//a[contains(translate(., 'SPECIFICATION', 'specification'), 'specification') or contains(translate(., 'SPEC', 'spec'), 'spec')][@href[substring(., string-length(.) - 3) = '.pdf']]")
                
                if spec_links:
                    print(f"Found {len(spec_links)} specification links in downloads section")
                    return spec_links[0].get_attribute('href')
                    
            except Exception as e:
                print(f"Error checking downloads section: {str(e)}")
            
            # Second try: Check the resources section
            try:
                print("Checking resources section...")
                resources_section = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, "resources"))
                )
                
                # Look for specification sheet links
                spec_links = resources_section.find_elements(By.XPATH, 
                    ".//a[contains(translate(., 'SPECIFICATION', 'specification'), 'specification') or contains(translate(., 'SPEC', 'spec'), 'spec')][@href[substring(., string-length(.) - 3) = '.pdf']]")
                
                if spec_links:
                    print(f"Found {len(spec_links)} specification links in resources section")
                    return spec_links[0].get_attribute('href')
                    
            except Exception as e:
                print(f"Error checking resources section: {str(e)}")
            
            # Final try: Check the entire page
            try:
                print("Checking entire page...")
                spec_links = self.driver.find_elements(By.XPATH, 
                    "//a[contains(translate(., 'SPECIFICATION', 'specification'), 'specification') or contains(translate(., 'SPEC', 'spec'), 'spec')][@href[substring(., string-length(.) - 3) = '.pdf']]")
                
                if spec_links:
                    print(f"Found {len(spec_links)} specification links on the page")
                    return spec_links[0].get_attribute('href')
                else:
                    print("No specification links found on the page")
                    
            except Exception as e:
                print(f"Error checking entire page: {str(e)}")
            
            return None
            
        except Exception as e:
            print(f"Error in get_spec_sheet_url: {str(e)}")
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
        self.logger.info(f"Category URL: {category_url}")
        
        product_links = self.get_product_links(category_url)
        self.logger.info(f"\nFound {len(product_links)} products to process")
        
        successful_downloads = 0
        total_products = len(product_links)
        
        for i, (product_url, product_code, product_desc) in enumerate(product_links, 1):
            self.logger.info(f"\nProcessing product {i}/{total_products}: {product_code} - {product_desc}")
            
            spec_url = self.get_spec_sheet_url(product_url)
            
            if spec_url:
                output_path = os.path.join(category_dir, f"{self.clean_filename(product_url.split('/')[-1])}.pdf")
                self.logger.info(f"Attempting to download spec sheet to: {output_path}")
                
                if not os.path.exists(output_path):
                    if self.download_pdf(spec_url, output_path):
                        successful_downloads += 1
                        self.logger.info(f"Successfully downloaded spec sheet for {product_code}")
                    else:
                        self.logger.error(f"Failed to download spec sheet for {product_code}")
                else:
                    self.logger.info(f"Spec sheet already exists for {product_code}")
                    successful_downloads += 1
            else:
                self.logger.warning(f"No spec sheet URL found for {product_code}")
            
            time.sleep(self.current_delay)
            
        self.logger.info(f"\nCategory {category_name} complete. "
                      f"Successfully downloaded {successful_downloads}/{total_products} specs.")
    
    def get_category_urls(self):
        """Get URLs for all drainage categories"""
        category_urls = {}
        for category_name, category_path in self.drainage_categories:
            category_urls[category_name] = f"{self.base_url}/products/{category_path}"
        return category_urls
    
    def run(self):
        """
        Run the scraper for all categories.
        Returns the total number of specifications found and downloaded.
        """
        total_specs_found = 0
        total_specs_downloaded = 0
        
        try:
            # Setup output directory
            self.setup_directories()
            
            # Process each category
            print(f"\nProcessing {len(self.drainage_categories)} categories...")
            
            for category_name, category_path in self.drainage_categories:
                print(f"\nProcessing category: {category_name}")
                category_url = f"{self.base_url}/products/{category_path}"
                print(f"URL: {category_url}")
                
                try:
                    # Create category directory
                    category_dir = os.path.join(self.output_dir, self.clean_filename(category_name))
                    os.makedirs(category_dir, exist_ok=True)
                    
                    # Get product links for this category
                    product_links = self.get_product_links(category_url)
                    print(f"Found {len(product_links)} products in {category_name}")
                    
                    # Process each product
                    for product_url, product_code, product_desc in product_links:
                        print(f"\nProcessing product: {product_code} - {product_desc}")
                        print(f"URL: {product_url}")
                        
                        try:
                            # Get specification sheet URL
                            spec_url = self.get_spec_sheet_url(product_url)
                            
                            if spec_url:
                                total_specs_found += 1
                                print(f"Found specification sheet: {spec_url}")
                                
                                # Create output path for PDF
                                output_path = os.path.join(category_dir, f"{self.clean_filename(product_code)}.pdf")
                                
                                # Download the specification sheet
                                if self.download_pdf(spec_url, output_path):
                                    total_specs_downloaded += 1
                                    print(f"Successfully downloaded specification for {product_code}")
                                else:
                                    print(f"Failed to download specification for {product_code}")
                            else:
                                print(f"No specification sheet found for {product_code}")
                                
                            # Add delay between products
                            time.sleep(self.current_delay)
                                
                        except Exception as e:
                            print(f"Error processing product {product_code}: {str(e)}")
                            continue
                        
                except Exception as e:
                    print(f"Error processing category {category_name}: {str(e)}")
                    continue
                
            # Print summary
            print("\nScraping Summary:")
            print(f"Total specifications found: {total_specs_found}")
            print(f"Total specifications downloaded: {total_specs_downloaded}")
            
        except Exception as e:
            print(f"Error during scraping: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
        
        return total_specs_found, total_specs_downloaded
    
    def __del__(self):
        """Clean up resources"""
        if hasattr(self, 'driver'):
            self.driver.quit()

class TestWattsSpecScraper(unittest.TestCase):
    def setUp(self):
        """Set up test environment"""
        self.scraper = WattsSpecScraper()
        self.test_category = "Floor & Area Drains"
        self.test_url = "https://www.watts.com/products/drainage-solutions/floor-drains-channels-trench/floor-area-drains"
        
        # Create test output directory
        self.test_output_dir = "test_watts_specs"
        if not os.path.exists(self.test_output_dir):
            os.makedirs(self.test_output_dir)
    
    def tearDown(self):
        """Clean up after tests"""
        if hasattr(self, 'scraper') and hasattr(self.scraper, 'driver'):
            self.scraper.driver.quit()
    
    def test_cookie_consent(self):
        """Test cookie consent handling"""
        # Mock the driver and cookie button
        self.scraper.driver = MagicMock()
        mock_button = MagicMock()
        self.scraper.driver.find_element.return_value = mock_button
        
        # Test successful cookie consent
        result = self.scraper.handle_cookie_consent()
        self.assertTrue(result)
        
        # Test when cookie button is not found
        self.scraper.driver.find_element.side_effect = Exception("Button not found")
        result = self.scraper.handle_cookie_consent()
        self.assertFalse(result)
    
    def test_get_category_url(self):
        """Test category URL generation"""
        url = self.scraper.get_category_url(self.test_category)
        self.assertEqual(url, self.test_url)
    
    @patch('selenium.webdriver.Chrome')
    def test_product_grid_loading(self, mock_chrome):
        """Test product grid loading"""
        # Mock the driver and elements
        mock_driver = MagicMock()
        mock_grid = MagicMock()
        mock_driver.find_element.return_value = mock_grid
        self.scraper.driver = mock_driver
        
        # Test successful grid loading
        result = self.scraper.get_product_links(self.test_url)
        self.assertIsInstance(result, list)
    
    def test_clean_filename(self):
        """Test filename cleaning"""
        test_cases = [
            ("Test/File.pdf", "Test_File.pdf"),
            ("Test:File.pdf", "Test_File.pdf"),
            ("Test*File.pdf", "Test_File.pdf"),
            ("Test?File.pdf", "Test_File.pdf"),
            ("Test<File.pdf", "Test_File.pdf"),
            ("Test>File.pdf", "Test_File.pdf"),
            ("Test|File.pdf", "Test_File.pdf"),
            ("Test\\File.pdf", "Test_File.pdf")
        ]
        
        for input_name, expected_output in test_cases:
            cleaned = self.scraper.clean_filename(input_name)
            self.assertEqual(cleaned, expected_output)

if __name__ == '__main__':
    unittest.main() 