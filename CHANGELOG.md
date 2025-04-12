# CHANGELOG

## 2025-04-11

### Manufacturer Detection Improvements

* **Fixed manufacturer keyword matching**:
  * Removed generic "drain" keyword from Wade Drains and Watts Drains to prevent false positives
  * Increased scoring weights for brand-specific keywords (30 points vs 10 previously)
  * Added manufacturer-specific brand identifiers lists for all manufacturers

* **Enhanced product number pattern detection**:
  * Improved Zurn pattern to recognize both Z and ZN product number prefixes 
  * Made pattern matching more specific and accurate for each manufacturer
  * Increased confidence score for product number matches (50 points vs 20 previously)

* **Implemented smarter confidence scoring system**:
  * Added weighted scoring with higher emphasis on product-specific patterns
  * Implemented minimum confidence threshold (30 points) before accepting a manufacturer match
  * Added comparative ratio validation (1.5x) to ensure significant confidence gap between matches
  * Added location-based bonus for brand mentions in the first 500 characters of a document

* **Added debugging and logging**:
  * Added console logging for confidence scores across all manufacturer detection attempts

### PDF Processing Improvements

* **Manufacturer-specific templates**:
  * Created template-based extraction engines customized for each manufacturer:
    * Watts Drains
    * Wade Drains  
    * Zurn
    * Jay R. Smith
    * MIFAB
    * Josam
  * Each template includes:
    * Product number regex patterns
    * Product name patterns
    * Specification number formats
    * Suffix section markers
    * Suffix extraction patterns
    * Table header identifiers
    * Flow rate terminology
    * Logical section ordering
    * Brand identifiers

* **Enhanced attribute extraction**:
  * Improved detection of common attributes like:
    * Flow Rate Capacity
    * Body Material
    * Top/Grate Material
    * Outlet Connection Type
    * Load Rating

* **OCR Processing**:
  * Added special handling for OCR-processed text
  * Implemented text normalization for better suffix extraction from OCR text
  * Added common OCR error correction (e.g., "ARA" → "AR")

## 2025-04-05

### Initial Backend Implementation

* Added PDF processing endpoint with:
  * Text extraction
  * OCR capabilities
  * Basic attribute detection
  * Template generation

* Created manufacturer detection logic
* Implemented attribute merging strategy
* Added health check endpoints
* Configured CORS for proper cross-origin requests 