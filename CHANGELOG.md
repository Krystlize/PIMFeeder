# CHANGELOG

## 2025-04-11 (Update 5)

### Simplified Attribute Display

* **Unified attribute table**:
  * Combined regular attributes and suffixes into single consolidated table
  * Added dedicated suffix code column that only displays when relevant
  * Maintained special styling for suffix code chips
  
* **Improved attribute formatting**:
  * Simplified the display of attribute names for suffix options
  * Applied subtle background highlighting to suffix rows
  * Preserved suffix code extraction and cleaning logic
  
* **Enhanced user experience**:
  * Removed separate tables for better information scanning
  * Maintained search functionality across all attributes
  * Improved visual consistency for the entire dataset

## 2025-04-11 (Update 4)

### Improved Suffix Code Display

* **Fixed suffix code display format**:
  * Cleaned up the display of suffix codes to show properly formatted codes like -5, -6, -G-1
  * Added intelligent parsing to handle JSON artifacts in suffix values
  * Improved extraction of suffix codes from attribute names and values
  
* **Enhanced suffix visual presentation**:
  * Added divider to visually separate product attributes from suffix options
  * Added explanatory text about suffix codes and their purpose
  * Improved chip display with hover text showing full attribute name
  * Added special styling for composite suffix codes
  
* **Optimized table layout**:
  * Adjusted column widths for better readability
  * Cleaned up description values by removing quotes and brackets
  * Ensured consistent dash prefix for all suffix codes

## 2025-04-11 (Update 3)

### UI Improvements for Attribute Display

* **Added Table View for Attributes**:
  * Created new AllAttributesView component that displays all attributes in a single table format
  * Added search functionality to quickly filter attributes
  * Implemented visual distinction between regular attributes and suffixes
  
* **Enhanced Suffix Visualization**:
  * Added dedicated table section for suffix options and codes
  * Displayed suffix codes as chips for better visual hierarchy
  * Suffix codes are automatically extracted from attribute names
  
* **Improved Navigation**:
  * Added a tabbed interface with Table View and Grouped View options
  * Added icons to tabs for better visual distinction
  * Maintained compatibility with existing template-based grouping

## 2025-04-11 (Update 2)

### Improved Zurn Product Detection

* **Enhanced Zurn product pattern recognition**:
  * Added support for FD-prefix products (like FD-2202) in Zurn detection
  * Added pattern matching for "General Purpose Floor Drain" text
  * Improved detection of solvent weld connections common in Zurn products
  * Added recognition of "Light Commercial" indicator specific to Zurn

* **Implemented post-processing detection**:
  * Added fallback detection for when OCR fails to identify the manufacturer logo
  * Created heuristics to identify Zurn products based on product patterns
  * Added re-extraction using correct template when manufacturer is identified late

* **Updated Zurn templates**:
  * Expanded product number pattern to include more Zurn product prefixes (FD, RD, FS, GT, HD)
  * Added "OPTIONS" to suffix section markers
  * Added support for "-VP" (Vandal Proof) suffix detection
  * Extended table headers to include more Zurn-specific column names

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