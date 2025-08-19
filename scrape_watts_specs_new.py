import os
import requests
from bs4 import BeautifulSoup
import time
from urllib.parse import urljoin, quote
import re
import logging
from datetime import datetime
import json
from typing import Optional, List, Tuple
import PyPDF2
from io import BytesIO
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

class WattsSpecScraper:
    def __init__(self):
        """Initialize the scraper"""
        self.session = requests.Session()
        self.base_url = "https://www.watts.com"
        self.logger = logging.getLogger(__name__)
        
        # Set up headers to mimic a browser
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.watts.com/',
            'Origin': 'https://www.watts.com'
        })
        
        # Initialize Selenium
        self._init_selenium()
        
        # Initialize session
        self._init_session()
        
        # Updated URLs to match the website structure
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
        
        # Setup logging with more detailed format
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(f'watts_scraper_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
                logging.StreamHandler()
            ]
        )
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,  # number of retries
            backoff_factor=1,  # wait 1, 2, 4 seconds between retries
            status_forcelist=[429, 500, 502, 503, 504]  # HTTP status codes to retry on
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        
        # Track failed downloads for retry
        self.failed_downloads = []
        
        # Adaptive rate limiting
        self.min_delay = 3  # minimum delay in seconds
        self.max_delay = 15  # maximum delay in seconds
        self.current_delay = self.min_delay
        
    def _init_selenium(self):
        """Initialize Selenium WebDriver"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')  # Run in headless mode
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 10)  # 10 second timeout
    
    def _init_session(self):
        """Initialize session with necessary cookies and tokens"""
        try:
            # First visit the main page to get initial cookies
            self.session.verify = False  # Disable SSL verification
            self.session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            })
            
            response = self.session.get(self.base_url)
            response.raise_for_status()
            
            # Parse the page for any necessary tokens
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for anti-forgery token
            token_elem = soup.find('input', {'name': '__RequestVerificationToken'})
            if token_elem:
                self.session.headers.update({
                    'RequestVerificationToken': token_elem.get('value', '')
                })
            
            self.logger.info("Session initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Error initializing session: {str(e)}")
            raise
    
    def setup_directories(self):
        """Create necessary directories for storing PDFs"""
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            self.logger.info(f"Created main directory: {self.output_dir}")
    
    def get_category_url(self, category):
        """Construct the URL for a category page."""
        base_url = "https://www.watts.com/products"
        category_mapping = {
            "Floor & Area Drains": "drainage-solutions/floor-drains-channels-trench/floor-area-drains",
            "Roof Drains": "drainage-solutions/roof-drains",
            "Parking Deck Drains": "drainage-solutions/roof-drains/parking-deck-drains",
            "Green Roof Drains": "drainage-solutions/roof-drains/green-roof-drains",
            "Interceptors": "drainage-solutions/interceptors",
            "Cleanouts": "drainage-solutions/floor-drains-channels-trench/cleanouts",
            "Dead Level Trench Drains": "drainage-solutions/floor-drains-channels-trench/dead-level-trench-drains"
        }
        return f"{base_url}/{category_mapping.get(category, category.lower().replace(' ', '-'))}"
    
    def get_product_links(self, url):
        """Get all product links from a category page using Selenium"""
        try:
            self.logger.info(f"Loading page: {url}")
            self.driver.get(url)
            
            # Wait longer for dynamic content to load
            time.sleep(15)  # Increased wait time
            
            # Wait for specific product elements
            try:
                self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".product-grid, .product-list, .product-tile, .product-card, [data-product-id]")))
            except TimeoutException:
                self.logger.warning("Product grid not found, trying alternative selectors")
                try:
                    self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[class*='product-'], [id*='product-']")))
                except TimeoutException:
                    self.logger.warning("No product elements found, continuing with current page state")
            
            # Execute JavaScript to ensure all dynamic content is loaded
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)  # Wait for any lazy-loaded content
            
            # Get the page source after JavaScript has rendered
            page_source = self.driver.page_source
            soup = BeautifulSoup(page_source, 'html.parser')
            
            # Log all links for debugging
            all_links = soup.find_all('a', href=True)
            self.logger.debug(f"Found {len(all_links)} total links on the page")
            
            product_links = []
            
            # Special handling for interceptors category
            if "interceptors" in url.lower():
                # Look for product cards in the interceptors grid
                product_containers = soup.find_all(['div', 'article'], attrs={
                    'class': lambda x: x and any(term in str(x).lower() for term in ['product', 'item', 'card', 'tile', 'grid-item']),
                    'data-product-id': True
                })
                
                # Also look for elements with data attributes
                product_containers.extend(soup.find_all(attrs={
                    'data-product-id': True,
                    'data-model-number': True,
                    'data-item-number': True
                }))
                
                for container in product_containers:
                    # Look for model numbers in various attributes
                    model_attrs = ['data-model-number', 'data-product-id', 'data-item-number', 'id']
                    model_match = None
                    
                    for attr in model_attrs:
                        if container.has_attr(attr):
                            model_match = re.search(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', container[attr], re.IGNORECASE)
                            if model_match:
                                break
                    
                    if not model_match:
                        # Try finding model number in text content
                        model_match = container.find(text=re.compile(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', re.IGNORECASE))
                    
                    if model_match:
                        model = re.search(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', str(model_match), re.IGNORECASE).group(0)
                        # Find the product link
                        link = container.find('a', href=lambda x: x and '/products/' in x)
                        if link:
                            product_url = urljoin(self.base_url, link['href'])
                            if (product_url, model.upper()) not in product_links:
                                product_links.append((product_url, model.upper()))
                                self.logger.info(f"Found product from container: {model} at {product_url}")
                
                # Look for subcategory links in interceptors
                subcategory_links = []
                for link in all_links:
                    href = link['href']
                    if '/products/drainage-solutions/floor-drains-channels-trench/interceptors/' in href:
                        subcategory_url = urljoin(self.base_url, href)
                        if subcategory_url not in subcategory_links:
                            subcategory_links.append(subcategory_url)
                            self.logger.info(f"Found interceptors subcategory: {subcategory_url}")
                
                # Process each subcategory
                for subcategory_url in subcategory_links:
                    self.logger.info(f"Processing interceptors subcategory: {subcategory_url}")
                    subcategory_products = self.get_product_links(subcategory_url)
                    product_links.extend(subcategory_products)
            
            # Regular product link detection for other categories
            else:
                # Method 1: Look for product cards/containers with data attributes
                product_containers = soup.find_all(['div', 'article'], attrs={
                    'class': lambda x: x and any(term in str(x).lower() for term in ['product', 'item', 'card', 'tile']),
                    'data-product-id': True
                })
                
                # Also look for elements with data attributes
                product_containers.extend(soup.find_all(attrs={
                    'data-product-id': True,
                    'data-model-number': True,
                    'data-item-number': True
                }))
                
                for container in product_containers:
                    # Look for model numbers in various attributes
                    model_attrs = ['data-model-number', 'data-product-id', 'data-item-number', 'id']
                    model_match = None
                    
                    for attr in model_attrs:
                        if container.has_attr(attr):
                            model_match = re.search(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', container[attr], re.IGNORECASE)
                            if model_match:
                                break
                    
                    if not model_match:
                        # Try finding model number in text content
                        model_match = container.find(text=re.compile(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', re.IGNORECASE))
                    
                    if model_match:
                        model = re.search(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', str(model_match), re.IGNORECASE).group(0)
                        # Find the product link
                        link = container.find('a', href=lambda x: x and '/products/' in x)
                        if link:
                            product_url = urljoin(self.base_url, link['href'])
                            if (product_url, model.upper()) not in product_links:
                                product_links.append((product_url, model.upper()))
                                self.logger.info(f"Found product from container: {model} at {product_url}")
            
            # Method 2: Look for links containing product model numbers
            for link in all_links:
                href = link['href']
                if '/products/' in href and '/drainage-solutions/' in href:
                    # Check for model numbers in the URL
                    model_match = re.search(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', href, re.IGNORECASE)
                    if model_match:
                        model = model_match.group(0)
                        product_url = urljoin(self.base_url, href)
                        if (product_url, model.upper()) not in product_links:
                            product_links.append((product_url, model.upper()))
                            self.logger.info(f"Found product from URL: {model} at {product_url}")
            
            # Method 3: Look for product model numbers in scripts
            scripts = soup.find_all('script', type='application/json')
            for script in scripts:
                if script.string:
                    model_matches = re.findall(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', script.string, re.IGNORECASE)
                    for model in model_matches:
                        product_url = f"{self.base_url}/products/drainage-solutions/{model.lower()}"
                        if (product_url, model.upper()) not in product_links:
                            product_links.append((product_url, model.upper()))
                            self.logger.info(f"Found product from script: {model} at {product_url}")
            
            # Method 4: Look for product model numbers in any text content
            text_content = soup.get_text()
            model_matches = re.findall(r'(?:GRD|RD|FD|DS|FS|CO|TD)-\d+[A-Z]?', text_content, re.IGNORECASE)
            for model in model_matches:
                # Construct potential product URL
                product_url = f"{self.base_url}/products/drainage-solutions/{model.lower()}"
                if (product_url, model.upper()) not in product_links:
                    product_links.append((product_url, model.upper()))
                    self.logger.info(f"Found product from content: {model} at {product_url}")
            
            if not product_links:
                self.logger.warning(f"No product links found for category: {url}")
                # Save the page source to a file for debugging
                debug_file = f"debug_page_source_{int(time.time())}.html"
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(page_source)
                self.logger.info(f"Saved page source to {debug_file} for debugging")
            else:
                self.logger.info(f"Found {len(product_links)} unique product links")
            
            return product_links
            
        except Exception as e:
            self.logger.error(f"Error getting product links from {url}: {str(e)}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return []
    
    def _is_valid_product_url(self, url):
        """Check if a URL is a valid product URL"""
        url_lower = url.lower()
        
        # First check if it's a category-level URL
        exclude_patterns = [
            r'/category/',
            r'/series/',
            r'/family/',
            r'drainage-solutions/?$',
            r'floor-drains-channels-trench/?$',
            r'roof-drains/?$',
            r'cleanouts/?$',
            r'interceptors/?$',
            r'parking-deck-drains/?$',
            r'fixture-carriers/?$',
            r'dead-level-trench-drains/?$'
        ]
        
        if any(re.search(pattern, url_lower) for pattern in exclude_patterns):
            return False
        
        # Then check for valid product patterns
        product_patterns = [
            r'grd-\d+',  # Green Roof Drains
            r'rd-\d+',   # Roof Drains
            r'fd-\d+',   # Floor Drains
            r'ds-\d+',   # Downspout
            r'fs-\d+',   # Floor Sink
            r'co-\d+',   # Cleanout
            r'td-\d+'    # Trench Drain
        ]
        
        return any(re.search(pattern, url_lower) for pattern in product_patterns)
    
    def get_spec_sheet_url(self, product_url):
        """Get the specification sheet URL for a product by expanding the Specifications section"""
        try:
            self.logger.info(f"Getting spec sheet URL for {product_url}")
            
            # Load the product page
            self.driver.get(product_url)
            time.sleep(5)  # Wait for page to load
            
            # Log the page source for debugging
            self.logger.debug(f"Page source for {product_url}:")
            self.logger.debug(self.driver.page_source)
            
            # Find and click the Specifications expand button
            try:
                # Look for the Specifications section with + button using various selectors
                expand_button_selectors = [
                    "//button[contains(@class, 'js-accordion__trigger') and contains(text(), 'Specifications')]",
                    "//button[contains(@class, 'accordion__trigger') and contains(text(), 'Specifications')]",
                    "//h2[contains(text(), 'Specifications')]/..//button",
                    "//div[contains(@class, 'specifications')]//button",
                    "//button[contains(@class, 'expand') and contains(text(), 'Specifications')]",
                    "//button[contains(@class, 'toggle') and contains(text(), 'Specifications')]",
                    "//div[contains(@class, 'specs')]//button",
                    "//div[contains(@class, 'technical')]//button"
                ]
                
                expand_button = None
                for selector in expand_button_selectors:
                    try:
                        self.logger.debug(f"Trying selector: {selector}")
                        expand_button = self.wait.until(
                            EC.element_to_be_clickable((By.XPATH, selector))
                        )
                        if expand_button:
                            self.logger.info(f"Found expand button with selector: {selector}")
                            break
                    except Exception as e:
                        self.logger.debug(f"Selector {selector} failed: {str(e)}")
                        continue
                
                if expand_button:
                    # Click the expand button
                    self.driver.execute_script("arguments[0].click();", expand_button)
                    time.sleep(2)  # Wait for content to expand
                    
                    # Look for the specification sheet link with more specific selectors
                    spec_link_selectors = [
                        "//a[contains(@class, 'product-download__link') and contains(text(), 'Specification Sheet')]",
                        "//a[contains(@class, 'product-download__link') and contains(@href, '.pdf')]",
                        "//div[contains(@class, 'product-downloads')]//a[contains(@href, '.pdf')]",
                        "//ul[contains(@class, 'product-downloads')]//a[contains(@href, '.pdf')]",
                        "//a[contains(@href, '.pdf') and contains(text(), 'Spec')]",
                        "//a[contains(@href, '.pdf') and contains(text(), 'Sheet')]",
                        "//a[contains(@href, '.pdf') and contains(@class, 'download')]",
                        "//a[contains(@href, '.pdf') and contains(@class, 'spec')]"
                    ]
                    
                    spec_link = None
                    for selector in spec_link_selectors:
                        try:
                            self.logger.debug(f"Trying spec link selector: {selector}")
                            spec_link = self.wait.until(
                                EC.presence_of_element_located((By.XPATH, selector))
                            )
                            if spec_link:
                                self.logger.info(f"Found spec link with selector: {selector}")
                                break
                        except Exception as e:
                            self.logger.debug(f"Spec link selector {selector} failed: {str(e)}")
                            continue
                    
                    if spec_link:
                        spec_url = spec_link.get_attribute('href')
                        if spec_url:
                            # Make sure the URL is absolute
                            if not spec_url.startswith('http'):
                                spec_url = urljoin(self.base_url, spec_url)
                            
                            # Verify it's a PDF
                            try:
                                response = self.session.head(spec_url, timeout=5)
                                if response.status_code == 200:
                                    content_type = response.headers.get('content-type', '').lower()
                                    if 'pdf' in content_type or 'octet-stream' in content_type:
                                        self.logger.info(f"Found valid spec sheet URL: {spec_url}")
                                        return spec_url
                                    else:
                                        self.logger.debug(f"URL {spec_url} is not a PDF: {content_type}")
                            except Exception as e:
                                self.logger.debug(f"Error checking spec URL {spec_url}: {str(e)}")
                    else:
                        self.logger.warning("Could not find specification sheet link after expanding section")
                else:
                    self.logger.warning("Could not find Specifications expand button")
            
            except Exception as e:
                self.logger.error(f"Error expanding specifications section: {str(e)}")
                import traceback
                self.logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Save the page source to a file for debugging
            debug_file = f"debug_product_page_{int(time.time())}.html"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            self.logger.info(f"Saved page source to {debug_file} for debugging")
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting spec sheet URL for {product_url}: {str(e)}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def verify_pdf(self, content: bytes) -> bool:
        """Verify if content is a valid PDF"""
        try:
            # Try to read PDF content
            PyPDF2.PdfReader(BytesIO(content))
            return True
        except:
            return False
            
    def download_pdf(self, url, output_path):
        """Download a PDF file with retry logic"""
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, stream=True)
                response.raise_for_status()
                
                # Verify it's a PDF
                content_type = response.headers.get('content-type', '').lower()
                if 'pdf' not in content_type:
                    self.logger.warning(f"URL {url} returned non-PDF content: {content_type}")
                    return False
                
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                # Download the file
                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                self.logger.info(f"Successfully downloaded {url} to {output_path}")
                return True
                
            except Exception as e:
                if attempt < max_retries - 1:
                    self.logger.warning(f"Attempt {attempt + 1} failed for {url}: {str(e)}")
                    time.sleep(retry_delay)
                else:
                    self.logger.error(f"Failed to download {url} after {max_retries} attempts: {str(e)}")
                    return False
    
    def clean_filename(self, filename):
        """Clean filename to be valid"""
        return re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    def scrape_category(self, category_name: str, category_slug: str):
        """Scrape a single category with enhanced error handling"""
        self.logger.info(f"\nStarting to scrape category: {category_name}")
        category_dir = os.path.join(self.output_dir, self.clean_filename(category_name))
        if not os.path.exists(category_dir):
            os.makedirs(category_dir)
            self.logger.info(f"Created category directory: {category_dir}")
        
        category_url = self.get_category_url(category_name)
        product_links = self.get_product_links(category_url)
        
        # If no product links found, try to find subcategories
        if not product_links:
            self.logger.info("No product links found, looking for subcategories...")
            self.driver.get(category_url)
            time.sleep(3)
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # Look for subcategory links
            subcategory_links = []
            for link in soup.find_all('a', href=True):
                href = link['href']
                if '/products/drainage-solutions/' in href and href != category_url:
                    subcategory_url = urljoin(self.base_url, href)
                    if subcategory_url not in subcategory_links:
                        subcategory_links.append(subcategory_url)
                        self.logger.info(f"Found subcategory: {subcategory_url}")
            
            # Try each subcategory
            for subcategory_url in subcategory_links:
                self.logger.info(f"Trying subcategory: {subcategory_url}")
                subcategory_products = self.get_product_links(subcategory_url)
                if subcategory_products:
                    product_links.extend(subcategory_products)
        
        successful_downloads = 0
        total_products = len(product_links)
        
        for i, (product_url, product_code) in enumerate(product_links, 1):
            self.logger.info(f"Processing product {i}/{total_products}")
            spec_url = self.get_spec_sheet_url(product_url)
            
            if spec_url:
                product_name = product_url.split('/')[-1]
                output_path = os.path.join(category_dir, f"{self.clean_filename(product_name)}.pdf")
                
                if not os.path.exists(output_path):
                    if self.download_pdf(spec_url, output_path):
                        successful_downloads += 1
                        time.sleep(self.current_delay)
                else:
                    self.logger.info(f"File already exists: {output_path}")
                    successful_downloads += 1
            
            time.sleep(self.current_delay)
        
        self.logger.info(f"Category {category_name} complete. "
                      f"Successfully downloaded {successful_downloads}/{total_products} specs.")
    
    def run(self, category_index: Optional[int] = None):
        """Run the scraper with enhanced reporting"""
        self.setup_directories()
        start_time = time.time()
        
        try:
            if category_index is not None:
                if 0 <= category_index < len(self.drainage_categories):
                    category_name, category_slug = self.drainage_categories[category_index]
                    self.scrape_category(category_name, category_slug)
                else:
                    self.logger.error(f"Invalid category index: {category_index}")
            else:
                for category_name, category_slug in self.drainage_categories:
                    self.scrape_category(category_name, category_slug)
                    time.sleep(self.current_delay * 2)  # Double delay between categories
        
        finally:
            # Report summary
            duration = time.time() - start_time
            self.logger.info("\nScraping Summary:")
            self.logger.info(f"Total time: {duration:.2f} seconds")
            self.logger.info(f"Failed downloads: {len(self.failed_downloads)}")
            
            if self.failed_downloads:
                self.logger.info("\nFailed Downloads:")
                for url, path in self.failed_downloads:
                    self.logger.info(f"- {url} -> {path}")

    def __del__(self):
        """Clean up Selenium resources"""
        if hasattr(self, 'driver'):
            self.driver.quit()

if __name__ == "__main__":
    scraper = WattsSpecScraper()
    
    try:
        # Run the scraper for all categories
        print("\nStarting to scrape all categories...")
        scraper.run()
        print("\nScraping completed!")
    
    except Exception as e:
        print(f"\nError during scraping: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
    finally:
        # Clean up
        print("\nCleaning up...")
        scraper.__del__()
        print("Done!") 