const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { createWorker } = require('tesseract.js');
const fs = require('fs');

// Initialize Express
const app = express();

// Initialize Hugging Face inference
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Enable CORS with proper configuration
app.use(cors({
  origin: ['https://krystlize.github.io', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// Add CORS headers to all responses explicitly for preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://krystlize.github.io');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  
  next();
});

// Parse JSON
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'API is running',
    version: '1.0',
    endpoints: {
      health: '/health or /api/health',
      api: '/api',
      processPdf: '/api/process-pdf',
      chat: '/api/chat',
      updateAttributes: '/api/update-attributes',
      generateTemplate: '/api/generate-template'
    }
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'API is running',
    version: '1.0',
    documentation: 'Contact administrator for API documentation'
  });
});

// Update the commonPlumbingAttributes to be more generic
const commonPlumbingAttributes = [
  { name: "Flow Rate Capacity", value: "Varies by pipe size (see Free Area table)" },
  { name: "Body Material", value: "Cast Iron" },
  { name: "Top/Grate Material", value: "Nickel Bronze" },
  { name: "Outlet Connection Type", value: "Varies by model" },
  { name: "Outlet Orientation", value: "Bottom (standard)" },
  { name: "Load Rating", value: "Medium Duty (MD)" }
];

// Function to normalize attribute names for better matching
function normalizeAttributeName(name) {
  // Convert to lowercase for comparison
  const normalized = name.toLowerCase()
    // Remove parentheses and their contents
    .replace(/\([^)]*\)/g, '')
    // Remove common filler words
    .replace(/\b(with|and|or|the|for|a|an)\b/g, '')
    // Replace slashes and hyphens with spaces
    .replace(/[\/\-]/g, ' ')
    // Remove duplicate spaces
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

// Function to check if two attribute names match semantically
function attributeNamesMatch(name1, name2) {
  const norm1 = normalizeAttributeName(name1);
  const norm2 = normalizeAttributeName(name2);
  
  // Direct match
  if (norm1 === norm2) return true;
  
  // Common attribute name mappings (add more as needed)
  const attributeMappings = {
    'flow rate': ['flow rate capacity', 'capacity', 'flow capacity', 'gpm'],
    'capacity': ['flow rate', 'flow rate capacity', 'flow capacity', 'gpm'],
    'material': ['body material', 'construction', 'composition', 'made of'],
    'top material': ['grate material', 'strainer material', 'top grate material'],
    'outlet type': ['outlet connection', 'connection type', 'outlet connection type'],
    'load rating': ['traffic rating', 'duty rating', 'load classification', 'weight rating']
  };
  
  // Check if either normalized name is in a mapping that includes the other
  for (const [key, aliases] of Object.entries(attributeMappings)) {
    // Check if norm1 is the key or in its aliases
    const norm1Matches = (norm1 === key || aliases.some(alias => norm1.includes(alias)));
    // Check if norm2 is the key or in its aliases
    const norm2Matches = (norm2 === key || aliases.some(alias => norm2.includes(alias)));
    
    // If both match this attribute category, they're semantically equivalent
    if (norm1Matches && norm2Matches) return true;
  }
  
  // Check for containing relationship (for partial matches)
  return norm1.includes(norm2) || norm2.includes(norm1);
}

// Add manufacturer-specific templates for different PDF formats
const manufacturerTemplates = {
  // Watts Drains template
  "Watts Drains": {
    productNumberPattern: /\b(FD|RD|FS|CO|DS|HD)[-]?[0-9]{1,5}[-]?[A-Z0-9]{0,3}\b/,
    productNamePattern: /^(.*?(?:Floor|Roof|Fixture|Cleanout|Drain|Carrier).*?)(?:\n|$)/im,
    specificationPattern: /\bES-WD-(?:[A-Z0-9-]+)\b/i,
    suffixSectionMarkers: ["SUFFIX", "OPTIONS", "VARIATIONS"],
    suffixPattern: /-([0-9A-Z]+(?:-[0-9A-Z]+)?)\s+([^-\n].*?)(?=\n-[0-9A-Z]|\n\s*$|$)/,
    tableHeaders: ["PIPE SIZE", "OUTLET", "STRAINER", "MATERIAL"],
    flowRateIdentifiers: ["FREE AREA", "GPM", "FLOW RATE"],
    sectionOrder: ["product info", "pipe size", "options", "outlet", "material"],
    brandIdentifiers: ["WATTS", "WATTS DRAINAGE", "WATTS INDUSTRIES"],
    category: "drains"
  },
  
  // Wade Drains template
  "Wade Drains": {
    productNumberPattern: /\b(?:W-|C-|WADE\s+)?[0-9]{1,4}(?:-[A-Z0-9]{1,3})?\b/,
    productNamePattern: /^(.*?(?:FLOOR|ROOF|AREA|DRAIN|CARRIER).*?)(?:\n|$)/im,
    specificationPattern: /SPEC\s*(?:NO\.?|NUMBER)?\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["SUFFIX", "OPTION", "TYPE"],
    suffixPattern: /\s+(-[A-Z0-9]+|[A-Z]{1,2})\s+([^\n]+)/,
    tableHeaders: ["SIZE", "OUTLET", "TOP", "BODY"],
    flowRateIdentifiers: ["FLOW", "CAPACITY", "CFS", "GPM"],
    sectionOrder: ["product info", "suffix", "body material", "grate"],
    brandIdentifiers: ["WADE", "BLUCHER", "WADE DRAINAGE"],
    category: "drains"
  },
  
  // Zurn template
  "Zurn": {
    productNumberPattern: /\b(?:Z|ZN|FD|RD|FS|GT|HD|Z-|ZN-|FD-|RD-)[0-9]{3,5}(?:-[A-Z0-9]{1,5})?\b/i,
    productNamePattern: /^((?:Z|ZN|FD|RD|FS|GT|HD)[-]?[0-9]{3,5}.*?(?:FLOOR|ROOF|DRAIN|CARRIER|WATER).*?)(?:\n|$)/im,
    specificationPattern: /ZURN\s*SPEC\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["SUFFIX", "OPTION", "PREFIX", "OPTIONS"],
    suffixPattern: /\s+(-[A-Z0-9]+|[A-Z]{1,2}|-VP)\s+([^\n]+)/,
    tableHeaders: ["SIZE", "CONNECTION", "MATERIAL", "FINISH", "PRODUCT", "A", "CONNECTIONS"],
    flowRateIdentifiers: ["FLOW RATE", "GPM", "GALLONS PER MINUTE"],
    sectionOrder: ["product info", "materials", "options", "connections"],
    brandIdentifiers: ["ZURN", "ZURN INDUSTRIES", "Z SERIES", "ZN SERIES", "LIGHT COMMERCIAL", "COMMERCIAL"],
    category: "drains"
  },
  
  // Jay R. Smith template
  "Jay R. Smith": {
    productNumberPattern: /\b(?:SMITH|JRS)?\s*(?:FIGURE|FIG\.?)?\s*([0-9]{3,5}(?:-[A-Z0-9]{1,3})?)\b/i,
    productNamePattern: /^(.*?(?:FLOOR|ROOF|DRAIN|FIXTURE|CARRIER).*?)(?:\n|$)/im,
    specificationPattern: /SMITH\s*SPEC\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["VARIATIONS", "OPTIONS", "SUFFIX"],
    suffixPattern: /[-]([0-9A-Z]+)\s+([^-\n].*?)(?=\n[-])/,
    tableHeaders: ["BODY", "TOP", "CONNECTION", "MATERIAL"],
    flowRateIdentifiers: ["CAPACITY", "FLOW RATE", "GALLONS"],
    sectionOrder: ["product info", "options", "materials", "connections"],
    brandIdentifiers: ["JAY R. SMITH", "SMITH", "JRS", "SMITH MFG", "SMITH MANUFACTURING"],
    category: "drains"
  },
  
  // MIFAB template
  "MIFAB": {
    productNumberPattern: /\b(?:F|R|C|T)(?:1|2|3|D)-(?:[A-Z0-9-]+)\b/i,
    productNamePattern: /^(.*?(?:FLOOR|ROOF|DRAIN|TRAP|CARRIER).*?)(?:\n|$)/im,
    specificationPattern: /MIFAB\s*(?:SPEC|SPECIFICATION)\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["SUFFIX", "VARIATIONS", "OPTIONS"],
    suffixPattern: /-([0-9A-Z]+)\s+([^-\n].*?)(?=\n-[0-9A-Z]|\n\s*$|$)/,
    tableHeaders: ["PIPE SIZE", "OUTLET", "STRAINER", "BODY"],
    flowRateIdentifiers: ["FLOW RATE", "GPM", "GALLONS PER MINUTE"],
    sectionOrder: ["product info", "options", "dimensions", "materials"],
    brandIdentifiers: ["MIFAB", "MIFAB INC", "MIFAB DRAINAGE"],
    category: "drains"
  },
  
  // Josam template
  "Josam": {
    productNumberPattern: /\b(?:JOSAM|J)?\s*(?:SERIES)?\s*([0-9]{3,5}(?:-[A-Z0-9]{1,3})?)\b/i,
    productNamePattern: /^(.*?(?:FLOOR|ROOF|DRAIN|CLEANOUT|CARRIER).*?)(?:\n|$)/im,
    specificationPattern: /JOSAM\s*SPEC\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["PREFIX", "SUFFIX", "OPTIONS"],
    suffixPattern: /\s+(-[A-Z0-9]+|[A-Z]{1,2})\s+([^\n]+)/,
    tableHeaders: ["SIZE", "CONNECTION", "MATERIAL", "FINISH"],
    flowRateIdentifiers: ["DISCHARGE RATE", "FLOW RATE", "GPM"],
    sectionOrder: ["product info", "options", "sizing"],
    brandIdentifiers: ["JOSAM", "JOSAM DRAINAGE", "JOSAM MFG", "JOSAM MANUFACTURING"],
    category: "drains"
  },
  
  // American Standard Commercial Faucets
  "American Standard": {
    productNumberPattern: /\b(?:Colony|Cadet|Heritage|Dazzle|Seva|Washbrook|Edgemere|Studio|Princeton)[-\s]?(?:[A-Z0-9]{1,4}[-\s]?)?[0-9]{3,5}(?:[-\.][0-9]{1,3})?\b/i,
    productNamePattern: /^(.*?(?:Faucet|Lavatory|Sink|Kitchen|Basin|Bath|Shower|Water|Mixing|Valve).*?)(?:\n|$)/im,
    specificationPattern: /\bSpec\s*(?:No\.?|Number)?\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["FINISH", "CERTIFICATIONS", "WARRANTY", "OPTIONS"],
    suffixPattern: /\s+([A-Z0-9]{1,3}|[0-9]{3})\s+([^\n]+)(?=\n[A-Z0-9]{1,3}|\n\s*$|$)/,
    tableHeaders: ["GPM", "FLOW", "PRESSURE", "AERATOR", "SPOUT", "HANDLE"],
    flowRateIdentifiers: ["FLOW RATE", "GALLONS PER MINUTE", "MAX GPM", "NOMINAL FLOW RATE"],
    sectionOrder: ["product info", "features", "finishes", "installation"],
    brandIdentifiers: ["AMERICAN STANDARD", "COLONY", "CADET", "HERITAGE", "DAZZLE", "SEVA"],
    category: "faucets"
  },
  
  // Moen Commercial Faucets
  "Moen": {
    productNumberPattern: /\b(?:M|8|9|62|87|84|82)(?:[0-9]{2,5}(?:[-\.][0-9]{1,2})?)/i,
    productNamePattern: /^(.*?(?:Faucet|Lavatory|Sink|Kitchen|Basin|Bath|Shower|Water|Mixing|Valve).*?)(?:\n|$)/im,
    specificationPattern: /\bSpec\s*(?:No\.?|Number)?\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["FINISH", "CERTIFICATIONS", "WARRANTY", "FEATURES"],
    suffixPattern: /\s+([A-Z0-9]{1,3})\s+([^\n]+)(?=\n[A-Z0-9]{1,3}|\n\s*$|$)/,
    tableHeaders: ["GPM", "FLOW", "PRESSURE", "AERATOR", "SPOUT", "HANDLE"],
    flowRateIdentifiers: ["FLOW RATE", "GALLONS PER MINUTE", "MAX GPM", "NOMINAL FLOW RATE"],
    sectionOrder: ["product info", "features", "finishes", "installation"],
    brandIdentifiers: ["MOEN", "MOEN COMMERCIAL", "M•POWER", "M•DURA", "M•PRESS", "M•BITION"],
    category: "faucets"
  },
  
  // Delta Commercial Faucets
  "Delta": {
    productNumberPattern: /\b(?:2[0-9]{3}|5[0-9]{2}|1[0-9]{3}|7[0-9]{2}|T[0-9]{4})(?:[-\.][A-Z0-9]{1,5})?\b/i,
    productNamePattern: /^(.*?(?:Faucet|Lavatory|Sink|Kitchen|Basin|Bath|Shower|Water|Mixing|Valve).*?)(?:\n|$)/im,
    specificationPattern: /\bSpec\s*(?:No\.?|Number)?\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["FINISH", "OPTIONS", "FEATURES"],
    suffixPattern: /\s+([A-Z0-9]{1,3})\s+([^\n]+)(?=\n[A-Z0-9]{1,3}|\n\s*$|$)/,
    tableHeaders: ["GPM", "FLOW", "PRESSURE", "AERATOR", "SPOUT", "HANDLE"],
    flowRateIdentifiers: ["FLOW RATE", "GALLONS PER MINUTE", "MAX GPM", "NOMINAL FLOW RATE"],
    sectionOrder: ["product info", "features", "finishes", "installation"],
    brandIdentifiers: ["DELTA", "DELTA FAUCET", "DELTA COMMERCIAL", "BRIZO", "PEERLESS"],
    category: "faucets"
  },
  
  // Kohler Commercial Faucets
  "Kohler": {
    productNumberPattern: /\b(?:K-)[0-9]{3,5}(?:[-\.][0-9]{1,2})?\b/i,
    productNamePattern: /^(.*?(?:Faucet|Lavatory|Sink|Kitchen|Basin|Bath|Shower|Water|Mixing|Valve).*?)(?:\n|$)/im,
    specificationPattern: /\bSpec\s*(?:No\.?|Number)?\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["FINISH", "ACCESSORIES", "CODES/STANDARDS"],
    suffixPattern: /\s+([A-Z0-9]{1,3})\s+([^\n]+)(?=\n[A-Z0-9]{1,3}|\n\s*$|$)/,
    tableHeaders: ["GPM", "FLOW", "PRESSURE", "AERATOR", "SPOUT", "HANDLE"],
    flowRateIdentifiers: ["FLOW RATE", "GALLONS PER MINUTE", "MAX GPM", "NOMINAL FLOW RATE"],
    sectionOrder: ["product info", "features", "finishes", "installation"],
    brandIdentifiers: ["KOHLER", "KOHLER CO.", "STERLING", "NOVITA"],
    category: "faucets"
  }
};

// Modified function to apply manufacturer-specific extraction templates, considering division and category
function extractWithManufacturerTemplate(text, manufacturer, division = '', category = '', categoryType = 'unknown') {
  const results = [];
  
  // Get the template for this manufacturer, or use a generic one
  let template = manufacturerTemplates[manufacturer];
  
  // Debug info for category matching
  console.log('====== TEMPLATE SELECTION DEBUG ======');
  console.log('Division:', division);
  console.log('Category:', category);
  console.log('Category Type:', categoryType);
  console.log('Manufacturer:', manufacturer);
  
  // If no template found, find a template based on division and category
  if (!template) {
    // Convert division and category to lowercase for comparison
    const divisionLower = division.toLowerCase();
    
    console.log('Division (lower):', divisionLower);
    
    // Try to match a template based on division and category type
    if ((divisionLower.includes('plumbing') || divisionLower.includes('22'))) {
      if (categoryType === 'faucet') {
        // Use a faucet template
        template = Object.values(manufacturerTemplates)
          .find(t => t.category === 'faucets') || manufacturerTemplates["American Standard"];
        console.log('Selected faucet template based on categoryType');
      } else if (categoryType === 'drain') {
        // Use a drain template
        template = Object.values(manufacturerTemplates)
          .find(t => t.category === 'drains') || manufacturerTemplates["Watts Drains"];
        console.log('Selected drain template based on categoryType');
      }
    }
    
    // If still no template, use a default
    if (!template) {
      template = manufacturerTemplates["Watts Drains"];
      console.log('Using default template (no category match)');
    }
  }
  
  console.log(`Using ${manufacturer || 'generic'} template for extraction, category: ${template.category}`);
  
  // Extract product number using template-specific pattern
  const productNumberMatch = text.match(template.productNumberPattern);
  if (productNumberMatch) {
    results.push({
      name: "Product Number",
      value: productNumberMatch[0].trim()
    });
  }
  
  // Extract product name using template-specific pattern
  const productNameMatch = text.match(template.productNamePattern);
  if (productNameMatch) {
    results.push({
      name: "Product Name",
      value: productNameMatch[1].trim()
    });
  }
  
  // Extract specification number
  const specMatch = text.match(template.specificationPattern);
  if (specMatch) {
    results.push({
      name: "Specification Number",
      value: specMatch[0].trim()
    });
  }
  
  // Find section with suffixes/options based on the marker words
  let optionsSection = '';
  for (const marker of template.suffixSectionMarkers) {
    const sectionMatch = text.match(new RegExp(`(?:${marker})[^\\n]*(?:\\n|\\r)+((?:[^\\n]+\\n)+)`, 'i'));
    if (sectionMatch) {
      optionsSection = sectionMatch[1];
      break;
    }
  }
  
  // Extract suffixes using the template-specific pattern
  if (optionsSection) {
    const suffixMatches = [...optionsSection.matchAll(new RegExp(template.suffixPattern, 'g'))];
    for (const match of suffixMatches) {
      const code = match[1].trim();
      const description = match[2].trim();
      
      if (code && description) {
        results.push({
          name: `Options Suffix: -${code}`,
          value: description
        });
      }
    }
  }
  
  // Look for table headers specific to this template
  for (const header of template.tableHeaders) {
    const tableColumnMatch = text.match(new RegExp(`${header}[\\s:]*([^\\n]+)`, 'i'));
    if (tableColumnMatch) {
      results.push({
        name: header.charAt(0).toUpperCase() + header.slice(1).toLowerCase(),
        value: tableColumnMatch[1].trim()
      });
    }
  }
  
  // Extract flow rate using template-specific identifiers
  for (const flowId of template.flowRateIdentifiers) {
    const flowMatch = text.match(new RegExp(`${flowId}[\\s:]*([0-9.,]+)\\s*(?:GPM|CFS|GALLONS)?`, 'i'));
    if (flowMatch) {
      results.push({
        name: "Flow Rate Capacity",
        value: `${flowMatch[1].trim()} GPM`
      });
      break;
    }
  }
  
  // Add category and division to results if provided
  if (division) {
    results.push({
      name: "Division",
      value: division
    });
  }
  
  if (category) {
    results.push({
      name: "Category",
      value: category
    });
  }
  
  return results;
}

// Now modify the detectManufacturer function to return more brand information
function detectManufacturer(text) {
  const cleanedText = text.toLowerCase();
  
  const manufacturers = [
    { name: "Wade Drains", keywords: ['wade'], confidence: 0 },
    { name: "Watts Drains", keywords: ['watts'], confidence: 0 },
    { name: "Zurn", keywords: ['zurn'], confidence: 0 },
    { name: "Josam", keywords: ['josam'], confidence: 0 },
    { name: "MIFAB", keywords: ['mifab'], confidence: 0 },
    { name: "Jay R. Smith", keywords: ['smith', 'jay r. smith', 'smith mfg'], confidence: 0 }
  ];
  
  // Calculate confidence score for each manufacturer
  for (const mfr of manufacturers) {
    let score = 0;
    
    // Check for manufacturer name mentions
    for (const keyword of mfr.keywords) {
      if (cleanedText.includes(keyword)) {
        // Higher score for brand name matches (previously 10)
        score += 30;
        
        // Bonus points for the manufacturer being in the first 500 characters (previously 5)
        if (cleanedText.substring(0, 500).includes(keyword)) {
          score += 15;
        }
      }
    }
    
    // Check for manufacturer-specific brand identifiers if available
    const template = manufacturerTemplates[mfr.name];
    if (template && template.brandIdentifiers) {
      for (const identifier of template.brandIdentifiers) {
        if (cleanedText.includes(identifier.toLowerCase())) {
          score += 40; // Strong indicator of the brand
        }
      }
    }
    
    // Special case for Zurn - look for Z followed by numbers which is a strong Zurn indicator
    if (mfr.name === "Zurn" && (
      /(?:z|zn)\d{3,5}/i.test(cleanedText) || 
      /fd-\d{4}/i.test(cleanedText) || // FD-2202 pattern for Zurn
      (cleanedText.includes('fd') && cleanedText.match(/general purpose floor drain/i))
    )) {
      score += 50;
    }
    
    // Check for manufacturer-specific product number patterns
    if (template && cleanedText.match(template.productNumberPattern)) {
      score += 50; // Increased from 20 to strongly favor product number patterns
    }
    
    mfr.confidence = score;
  }
  
  console.log("Manufacturer confidence scores:", manufacturers.map(m => `${m.name}: ${m.confidence}`).join(', '));
  
  // Sort by confidence score (descending)
  manufacturers.sort((a, b) => b.confidence - a.confidence);
  
  // Only return a manufacturer if the confidence is significantly high or it's notably higher than the next best match
  if (manufacturers[0].confidence >= 30) {
    // Check if there's a significant gap between the top match and the second-best match
    if (manufacturers.length > 1 && 
        (manufacturers[0].confidence >= 50 || 
         manufacturers[0].confidence >= manufacturers[1].confidence * 1.5)) {
      return manufacturers[0].name;
    } else if (manufacturers.length === 1) {
      return manufacturers[0].name;
    }
  }
  
  return null; // No confident match
}

// Extract product number from text
function extractProductNumber(text) {
  // Look for patterns like "FD-100-A", "Z1234", etc.
  const productNumberRegex = /\b([A-Z]{1,3}[-]?[0-9]{1,5}[-]?[A-Z0-9]{0,3})\b/g;
  const matches = [...text.matchAll(productNumberRegex)];
  
  // Return the first match or null
  return matches.length > 0 ? matches[0][1] : null;
}

// Process PDF endpoint
app.post('/api/process-pdf', upload.single('file'), async (req, res) => {
  try {
    const { division, category } = req.body;
    
    // Special handling for Commercial Fixtures - detect specific fixture type
    let categoryType = 'unknown';
    const categoryLower = category?.toLowerCase() || '';
    
    // First check for drains vs fixtures
    if (categoryLower.includes('drain')) {
      categoryType = 'drain';
      console.log('Detected DRAIN category type from:', category);
    } else if (category === 'Commercial Fixtures' || categoryLower.includes('fixture') || categoryLower.includes('faucet')) {
      // Default to faucet but check for more specific fixture types
      categoryType = 'faucet';
      
      // Determine more specific fixture type
      if (categoryLower.includes('toilet') || categoryLower.includes('urinal') || categoryLower.includes('water closet')) {
        categoryType = 'toilet';
      } else if (categoryLower.includes('sink') || categoryLower.includes('lavatory') || categoryLower.includes('basin')) {
        categoryType = 'sink';
      } else if (categoryLower.includes('shower') || categoryLower.includes('bath')) {
        categoryType = 'shower';
      } else if (categoryLower.includes('faucet') || categoryLower.includes('tap')) {
        categoryType = 'faucet';
      }
      
      console.log(`Detected ${categoryType.toUpperCase()} category type from:`, category);
    } else {
      console.log('Unknown category type from:', category);
    }
    
    console.log('Division:', division);
    console.log('Category:', category);
    console.log('Detected Category Type:', categoryType);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File received:', req.file.originalname);
    
    // Extract text from the PDF
    const pdfPath = req.file.path;
    const pdfText = await extractTextFromPDF(pdfPath);
    
    // Detect manufacturer from the text if possible
    const detectedManufacturer = detectManufacturer(pdfText);
    console.log('Detected manufacturer:', detectedManufacturer);
    
    // Post-process detected manufacturer based on division and category
    const postProcessedManufacturer = postProcessManufacturerDetection(pdfText, division, category);
    if (postProcessedManufacturer) {
      console.log('Post-processed manufacturer:', postProcessedManufacturer);
    }
    
    // Extract as much as possible using templates
    const attributes = [];
    
    // First try using the manufacturer-specific template if available
    if (detectedManufacturer) {
      // Use the manufacturer-specific template for extraction
      const templateResults = extractWithManufacturerTemplate(pdfText, detectedManufacturer, division, category, categoryType);
      
      // Add manufacturer to the extracted info if not already present
      if (!templateResults.some(attr => attr.name.toLowerCase() === 'manufacturer')) {
        templateResults.push({
          name: 'Manufacturer',
          value: detectedManufacturer
        });
      }
      
      attributes.push(...templateResults);
    } 
    // If no manufacturer was detected initially, but post-processing found one
    else if (postProcessedManufacturer) {
      console.log('Using post-processed manufacturer for template');
      
      // Re-extract using the manufacturer template
      const templateResults = extractWithManufacturerTemplate(pdfText, postProcessedManufacturer, division, category, categoryType);
      
      // Only use template results if we got meaningful data
      if (templateResults.length > 2) {
        // Add manufacturer to the extracted info if not already present
        if (!templateResults.some(attr => attr.name.toLowerCase() === 'manufacturer')) {
          templateResults.push({
            name: 'Manufacturer',
            value: postProcessedManufacturer
          });
        }
        
        attributes.push(...templateResults);
      } else {
        console.log('Template extraction yielded insufficient results, proceeding with general extraction');
      }
    } 
    // If no manufacturer was detected at all
    else {
      console.log('No manufacturer detected, using generic extraction');
      
      // Try to extract using a generic template based on category
      const templateResults = extractWithManufacturerTemplate(pdfText, null, division, category, categoryType);
      if (templateResults.length > 1) {
        attributes.push(...templateResults);
      }
    }
    
    // Next, extract general product information that might be missed by templates
    const productNumber = extractProductNumber(pdfText);
    if (productNumber && !attributes.some(attr => attr.name.toLowerCase().includes('product number') || attr.name.toLowerCase().includes('model'))) {
      attributes.push({
        name: 'Product Number',
        value: productNumber
      });
    }
    
    // Extract tabular data which might contain attributes
    const tabularData = extractTabularData(pdfText);
    attributes.push(...tabularData);
    
    // Try to extract suffix options from the text
    const suffixData = extractSuffixesFromOcrText(pdfText);
    attributes.push(...suffixData);
    
    // Extract technical data using regex patterns
    const technicalData = extractTechnicalData(pdfText);
    attributes.push(...technicalData);
    
    // Use AI model to extract additional attributes
    let aiAttributes = [];
    
    try {
      aiAttributes = await extractAttributesWithAI(
        pdfText, 
        division, 
        category, 
        detectedManufacturer || postProcessedManufacturer || null
      );
    } catch (error) {
      console.error('Error using AI for attribute extraction:', error);
    }
    
    attributes.push(...aiAttributes);
    
    // Add division and category if not already present
    if (division && !attributes.some(attr => attr.name.toLowerCase() === 'division')) {
      attributes.push({
        name: 'Division',
        value: division
      });
    }
    
    if (category && !attributes.some(attr => attr.name.toLowerCase() === 'category')) {
      attributes.push({
        name: 'Category',
        value: category
      });
    }
    
    // Deduplicate and clean attributes
    const uniqueAttributes = deduplicateAttributes(attributes);
    const cleanedAttributes = uniqueAttributes.map(attr => ({
      name: attr.name,
      value: attr.value
    }));
    
    // Generate an attribute template for the frontend
    const template = await generateAttributeTemplate(division, category, '');
    
    // Return the results
    res.json({
      attributes: cleanedAttributes,
      rawText: pdfText,
      template: template,
      categoryType: categoryType  // Add the detected category type to the response
    });
    
    // Clean up the temporary file
    fs.unlinkSync(pdfPath);
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: 'Error processing PDF' });
  }
});

// Function to extract tabular data that might contain suffix information
function extractTabularData(text) {
  const tableData = [];
  
  // First, clean up the text to fix common OCR issues
  const cleanedText = cleanOcrText(text);
  
  // Pattern 1: Look for lines that appear to be part of a table with suffix codes
  // This looks for patterns like "-7 | Trap Primer Tapping" or "A5 | 5"(127) Dia. Nickel Bronze"
  const tableLineRegex = /^\s*([A-Z0-9-]+)\s*[\|:\t]\s*(.*?)$/gm;
  let tableMatch;
  
  while ((tableMatch = tableLineRegex.exec(cleanedText)) !== null) {
    const rawCode = tableMatch[1].trim();
    const description = tableMatch[2].trim();
    
    // Normalize the code to fix common OCR errors
    const code = normalizeCode(rawCode);
    
    if (code && description) {
      // Determine the type of suffix based on the pattern
      let type = 'Option';
      
      if (code.match(/^[0-9]+$/) || code.match(/^[0-9]+\"$/)) {
        type = 'Pipe Size';
      } else if (code.match(/^[A-Z][0-9]+$/)) {
        type = 'Strainer';
      } else if (code.match(/^[A-Z]+$/)) {
        type = 'Outlet Type';
      }
      
      tableData.push({
        name: `${type} Suffix: ${code}`,
        value: description
      });
    }
  }
  
  // Pattern 2: Look for dash-prefixed options often found in specification sheets
  // Updated to better handle OCR errors like "-ARA" that should be "-AR"
  const optionRegex = /-([0-9A-Z]+(?:-[0-9A-Z]+)?)\s+([^-\n].*?)(?=\n-[0-9A-Z]|\n\s*$|$)/g;
  let optionMatch;
  
  while ((optionMatch = optionRegex.exec(cleanedText)) !== null) {
    const rawCode = optionMatch[1].trim();
    const description = optionMatch[2].trim();
    
    // Normalize the code to fix common OCR errors
    const code = normalizeCode(rawCode);
    
    if (code && description) {
      tableData.push({
        name: `Options Suffix: -${code}`,
        value: description
      });
    }
  }
  
  // Pattern 3: Look for tabular data with "Suffix" or "Option" headers
  const optionTableRegex = /(?:Option|Suffix)s?(?:\s+Code)?[\s:]*([A-Z0-9-]+)[\s\n]*(?:Option|Suffix)?s?(?:\s+Description)?[\s:]*([^\n]+)/gi;
  let optionTableMatch;
  
  while ((optionTableMatch = optionTableRegex.exec(cleanedText)) !== null) {
    const rawCode = optionTableMatch[1].trim();
    const description = optionTableMatch[2].trim();
    
    // Normalize the code to fix common OCR errors
    const code = normalizeCode(rawCode);
    
    if (code && description && code !== 'CODE' && description !== 'DESCRIPTION') {
      tableData.push({
        name: `Options Suffix: ${code.startsWith('-') ? code : '-' + code}`,
        value: description
      });
    }
  }
  
  // Pattern 4: Look specifically for the "-AR" case and similar patterns
  const knownOptionsRegex = /[-–—]\s*([A-Z]{2,4})\s+(Acid Resistant|.*?Coating|.*?Finish|.*?Material)/gi;
  let knownOptionMatch;
  
  while ((knownOptionMatch = knownOptionsRegex.exec(cleanedText)) !== null) {
    const rawCode = knownOptionMatch[1].trim();
    const description = knownOptionMatch[2].trim();
    const code = normalizeCode(rawCode);
    
    if (code && description) {
      // Check if we already have this code
      if (!tableData.some(item => item.name.includes(code))) {
        tableData.push({
          name: `Options Suffix: -${code}`,
          value: description
        });
      }
    }
  }
  
  // Deduplicate the data based on suffix codes
  return deduplicateAttributes(tableData);
}

// Function to clean OCR text by fixing common OCR errors
function cleanOcrText(text) {
  // Replace curly braces that might be from JSON fragments in OCR output
  let cleaned = text.replace(/[{}"]/g, ' ');
  
  // Normalize spaces and line breaks
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\n\s+/g, '\n');
  
  // Fix common OCR errors in option codes
  cleaned = cleaned.replace(/\bARA\b/g, 'AR').replace(/\bAR[^A-Z]/g, 'AR ');
  
  // Fix common OCR errors in option descriptions
  cleaned = cleaned.replace(/Options Description/gi, 'Description');
  cleaned = cleaned.replace(/Options Suffix/gi, 'Suffix');
  
  return cleaned;
}

// Function to normalize option codes by fixing common OCR errors
function normalizeCode(code) {
  // Trim the code again to be safe
  let normalized = code.trim();
  
  // Remove any non-alphanumeric characters except dash
  normalized = normalized.replace(/[^A-Z0-9-]/gi, '');
  
  // Handle common OCR errors for specific codes
  const codeMap = {
    'ARA': 'AR',
    'ARR': 'AR',
    'ARD': 'AR',
    'OASH': 'A5H',
    'O5': '05',
    'O6': '06',
    'O7': '07',
    'O8': '08',
  };
  
  if (codeMap[normalized]) {
    normalized = codeMap[normalized];
  }
  
  // If it's longer than 4 characters and not a compound code like "H4-50", 
  // it's likely an OCR error
  if (normalized.length > 4 && !normalized.includes('-')) {
    // Try to determine the correct code based on common patterns
    if (normalized.startsWith('AR')) {
      normalized = 'AR';
    }
    // Add more special cases as needed
  }
  
  return normalized;
}

// Function to deduplicate attributes based on suffix codes
function deduplicateAttributes(attributes) {
  const uniqueAttributes = [];
  const seenCodes = new Set();
  
  for (const attr of attributes) {
    // Extract the code from the name (e.g., "Options Suffix: -AR" -> "AR")
    const nameMatch = attr.name.match(/Suffix:\s*([-A-Z0-9]+)/i);
    if (nameMatch) {
      const code = nameMatch[1].trim();
      // Normalize the code for comparison
      const normalizedCode = code.replace(/^-/, '').toUpperCase();
      
      // If we haven't seen this code before, add it
      if (!seenCodes.has(normalizedCode)) {
        seenCodes.add(normalizedCode);
        uniqueAttributes.push(attr);
      }
    } else {
      // If it doesn't match our pattern, keep it
      uniqueAttributes.push(attr);
    }
  }
  
  return uniqueAttributes;
}

// Function to parse attributes from the model's response
function parseAttributesFromModel(text) {
  try {
    // Try to extract a JSON object from the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let attributes = [];

    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[0]);
        
        // Convert the parsed JSON to our attribute format
        for (const [key, value] of Object.entries(jsonData)) {
          if (typeof value === 'object') {
            // Handle nested objects
            for (const [subKey, subValue] of Object.entries(value)) {
              attributes.push({
                name: `${key} - ${subKey}`,
                value: String(subValue)
              });
            }
          } else {
            attributes.push({
              name: key,
              value: String(value)
            });
          }
        }
      } catch (e) {
        console.error("Failed to parse JSON from model response:", e);
      }
    }
    
    // Fallback: Extract key-value pairs using regex if JSON parsing failed
    if (attributes.length === 0) {
      const attributeRegex = /([A-Za-z\s]+):\s*(.+?)(?=\n[A-Za-z\s]+:|$)/gs;
      let match;
      
      while ((match = attributeRegex.exec(text)) !== null) {
        const name = match[1].trim();
        const value = match[2].trim();
        if (name && value) {
          attributes.push({ name, value });
        }
      }
    }
    
    // Extract suffix codes from the raw text using regex
    const suffixRegex = /(?:(?:suffix|option|code)[\s:-]*)([-A-Z0-9]+)(?:[\s:])*((?:[^\n,]+))/gi;
    let suffixMatch;
    
    while ((suffixMatch = suffixRegex.exec(text)) !== null) {
      const suffixCode = suffixMatch[1].trim();
      const suffixValue = suffixMatch[2].trim();
      
      if (suffixCode && suffixValue && suffixCode.match(/^[-A-Z0-9]+$/)) {
        // Check if this suffix is not already in the attributes
        if (!attributes.some(attr => 
          attr.name.toLowerCase().includes('suffix') && 
          attr.name.includes(suffixCode))) {
          
          attributes.push({
            name: `Options Suffix: ${suffixCode}`,
            value: suffixValue
          });
        }
      }
    }
    
    return attributes;
  } catch (error) {
    console.error("Error parsing attributes from model response:", error);
    return [];
  }
}

// Function to generate attribute templates based on division and category
const generateAttributeTemplate = async (division, category, productDescription) => {
  // Here you would call your AI model to generate an attribute template
  // For now, return a mock response based on the division and category
  
  let mockTemplate = [];
  const divisionLower = division?.toLowerCase() || '';
  const categoryLower = category?.toLowerCase() || '';
  const productDescLower = productDescription?.toLowerCase() || '';
  
  // Determine the specific fixture type based on category and product description
  let fixtureType = 'unknown';
  
  // Add faucet type detection in category string
  if (categoryLower === 'commercial fixtures' || categoryLower.includes('fixture')) {
    // Default to faucet for generic fixture, but check for specific types
    fixtureType = 'faucet';
    
    // Check category for specific fixture type
    if (categoryLower.includes('faucet') || categoryLower.includes('tap')) {
      fixtureType = 'faucet';
    } else if (categoryLower.includes('toilet') || categoryLower.includes('urinal') || categoryLower.includes('water closet')) {
      fixtureType = 'toilet';
    } else if (categoryLower.includes('sink') || categoryLower.includes('lavatory') || categoryLower.includes('basin')) {
      fixtureType = 'sink';
    } else if (categoryLower.includes('shower') || categoryLower.includes('bath')) {
      fixtureType = 'shower';
    }
    
    // Check product description for more specific fixture type
    if (productDescLower) {
      if (productDescLower.includes('toilet') || productDescLower.includes('water closet') || 
          productDescLower.includes('urinal') || productDescLower.includes('bidet')) {
        fixtureType = 'toilet';
      } else if (productDescLower.includes('sink') || productDescLower.includes('lavatory') || 
                productDescLower.includes('basin')) {
        fixtureType = 'sink';
      } else if (productDescLower.includes('shower') || productDescLower.includes('bath')) {
        fixtureType = 'shower';
      } else if (productDescLower.includes('faucet') || productDescLower.includes('tap') || 
                productDescLower.includes('spout')) {
        fixtureType = 'faucet';
      }
    }
    
    console.log(`Detected fixture type: ${fixtureType} based on category: "${category}" and product desc: "${productDescription?.substring(0, 50)}..."`);
  }
  
  // Mock template for commercial toilets
  if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
      (fixtureType === 'toilet')) {
    
    console.log("Selected commercial toilet template");
    
    mockTemplate = [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Model Series',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Fixture Type (toilet, urinal, bidet)',
          'Bowl Type (elongated, round front)',
          'Configuration (floor mount, wall mount)',
          'Rough-In Dimension',
          'Flush Type (flushometer, tank)',
          'Flush Rate (GPF)',
          'Water Conservation Rating',
          'Trapway Size',
          'Flush Valve Size/Type',
          'Water Surface Area',
          'Material (vitreous china, stainless steel)',
          'Color/Finish',
          'Rim Shape/Configuration',
          'Mounting Hardware',
          'LEAD FREE Certification'
        ],
        isEssential: true
      },
      {
        groupName: 'Operation and Technical Specifications',
        attributes: [
          'Flush Mechanism Type (manual, automatic)',
          'Sensor Type (if electronic)',
          'Power Source (if electronic)',
          'Battery Type and Life (if applicable)',
          'Minimum Operating Pressure',
          'Maximum Performance (MaP) Score',
          'Flush Volume Options',
          'Water Spot Size',
          'Trap Seal Depth'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Features',
        attributes: [
          'Seat Included',
          'Seat Compatibility',
          'Seat Type (open front, closed front)',
          'QuickConnect/EasyInstall Features',
          'Concealed Trapway',
          'Flushing Technology Name',
          'Antimicrobial Surface Treatment',
          'Rim Jets/Wash Features',
          'Noise Reduction Features',
          'Bedpan Cleaner Compatible'
        ],
        isEssential: false
      },
      {
        groupName: 'Installation and Accessibility',
        attributes: [
          'ADA Compliant',
          'Meets Texas Accessibility Standards',
          'Senior Height/Comfort Height',
          'Installation Type',
          'Rough-in Range',
          'Supply Line Requirements',
          'Offset Requirements',
          'Flange Type/Requirements',
          'Wall Carrier Required/Compatible'
        ],
        isEssential: true
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASME A112.19.2/CSA B45.1',
          'EPA WaterSense Certified',
          'ANSI Z124.4 (Plastic Toilets)',
          'UPC/IPC Compliance',
          'California CEC Compliant',
          'CALGreen Compliant',
          'ADA Compliance (ANSI A117.1)',
          'Buy America(n) Compliance'
        ],
        isEssential: true
      },
      {
        groupName: 'Warranty and Maintenance',
        attributes: [
          'Warranty Period (years)',
          'Commercial Warranty Details',
          'Parts Warranty',
          'Finish Warranty',
          'Maintenance Requirements',
          'Spare Parts Availability'
        ],
        isEssential: true
      }
    ];
  }
  // Mock template for commercial sinks
  else if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
          (fixtureType === 'sink')) {
    
    console.log("Selected commercial sink template");
    
    mockTemplate = [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Model Series',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Sink Type (lavatory, kitchen, service, scrub, hand wash)',
          'Mounting Type (undermount, drop-in, wall-mount, pedestal)',
          'Overall Dimensions (LxWxH)',
          'Bowl Dimensions',
          'Bowl Depth',
          'Number of Bowls',
          'Material (stainless steel, vitreous china, solid surface)',
          'Material Gauge (for metal sinks)',
          'Finish/Color',
          'Faucet Holes/Configuration',
          'Drain Size/Type',
          'Weight Capacity',
          'Overflow Drain Included'
        ],
        isEssential: true
      },
      {
        groupName: 'Technical Specifications',
        attributes: [
          'Drain Position',
          'Sound Dampening',
          'Corner Radius',
          'Mounting Hardware Included',
          'Faucet Ledge Width',
          'Backsplash Dimensions (if included)',
          'Soap Dispenser Hole(s)',
          'Water Retention Volume',
          'Hot Water Resistance',
          'Chemical Resistance'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Features',
        attributes: [
          'Antimicrobial Surface',
          'Scratch Resistant Surface',
          'Pre-Drilled Faucet Holes',
          'Integrated Towel Bar',
          'Integrated Soap Dispenser',
          'Waste Disposal Compatible',
          'Bowl Grid/Rack Included',
          'Splash Guard Features',
          'Preassembled Components'
        ],
        isEssential: false
      },
      {
        groupName: 'Installation and Accessibility',
        attributes: [
          'ADA Compliant',
          'Installation Type',
          'Supply Line Requirements',
          'Waste Line Requirements',
          'Support Bracket Requirements',
          'Counter/Wall Construction Requirements',
          'Minimum Cabinet Size',
          'Cutout Template Included'
        ],
        isEssential: true
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASME A112.19.3/CSA B45.4 (Stainless Steel)',
          'ASME A112.19.2/CSA B45.1 (Ceramic)',
          'IAPMO/ANSI Z124.6 (Plastic Sinks)',
          'NSF/ANSI 2 (Food Equipment)',
          'UPC/IPC Compliance',
          'ADA Compliance (ANSI A117.1)',
          'ASSE 1016 (Scald Protection)',
          'Buy America(n) Compliance'
        ],
        isEssential: true
      },
      {
        groupName: 'Warranty and Support',
        attributes: [
          'Warranty Period (years)',
          'Commercial Warranty Details',
          'Finish Warranty',
          'Maintenance Requirements',
          'Recommended Cleaning Products',
          'Spare Parts Availability'
        ],
        isEssential: true
      }
    ];
  }
  // Mock template for commercial showers
  else if ((divisionLower.includes('plumbing') || divisionLower.includes('22')) && 
          (fixtureType === 'shower')) {
    
    console.log("Selected commercial shower template");
    
    mockTemplate = [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Model Series',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Shower Type (stall, panel, column, head only)',
          'Configuration (recessed, corner, barrier-free)',
          'Overall Dimensions',
          'Flow Rate (GPM)',
          'Maximum Flow Rate at 80 PSI',
          'Spray Pattern/Options',
          'Valve Type (pressure balancing, thermostatic)',
          'Connection Type/Size',
          'Material (base/pan, walls, enclosure)',
          'Finish/Color',
          'Temperature Control Type',
          'Pressure Rating',
          'Diverter Type/Function (if applicable)'
        ],
        isEssential: true
      },
      {
        groupName: 'Technical Specifications',
        attributes: [
          'Operating Pressure Range',
          'Temperature Range',
          'Anti-Scald Protection',
          'Shower Head Height/Adjustability',
          'Arm Reach/Extension',
          'Rough-in Depth',
          'Control Handle Type',
          'Check Valve Features',
          'Mounting Type/Requirements'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Features',
        attributes: [
          'Body Sprays Included',
          'Hand Shower Included',
          'Handheld Hose Length',
          'Volume Control',
          'Pause/Stop Function',
          'Water Conservation Features',
          'Comfort Features',
          'Hygiene Features',
          'Self-Cleaning Nozzles'
        ],
        isEssential: false
      },
      {
        groupName: 'Installation and Accessibility',
        attributes: [
          'ADA Compliant',
          'Installation Type',
          'Supply Line Requirements',
          'Drain Requirements',
          'Wall Construction Requirements',
          'Waterproofing Requirements',
          'Grab Bar Compatibility',
          'Seat Included/Compatible'
        ],
        isEssential: true
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASME A112.18.1/CSA B125.1',
          'ASSE 1016/ASME A112.1016/CSA B125.16',
          'EPA WaterSense Certified',
          'UPC/IPC Compliance',
          'ADA Compliance (ANSI A117.1)',
          'California Energy Commission Compliant',
          'NSF/ANSI 61 (Drinking Water System Components)',
          'NSF/ANSI 372 (Lead Content)'
        ],
        isEssential: true
      },
      {
        groupName: 'Warranty and Support',
        attributes: [
          'Warranty Period (years)',
          'Commercial Warranty Details',
          'Finish Warranty',
          'Valve Warranty',
          'Maintenance Requirements',
          'Recommended Cleaning Products',
          'Spare Parts Availability'
        ],
        isEssential: true
      }
    ];
  }
  // Generate generic placeholder for other divisions/categories
  else {
    mockTemplate = [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Name',
          'Model Number',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Material',
          'Dimensions',
          'Weight',
          'Color/Finish',
          'Standards Compliance',
          'Warranty'
        ],
        isEssential: true
      },
      {
        groupName: 'Technical Specifications',
        attributes: [
          'Performance Specifications',
          'Electrical Requirements',
          'Mechanical Properties',
          'Environmental Ratings',
          'Certifications'
        ],
        isEssential: false
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'Industry Standards',
          'Building Codes',
          'Safety Certifications',
          'Environmental Compliance',
          'Sustainability Ratings'
        ],
        isEssential: true
      }
    ];
    
    // Add customization based on product description if provided
    if (productDescription) {
      mockTemplate[1].attributes.push(`${productDescription} Specific Attribute 1`);
      mockTemplate[1].attributes.push(`${productDescription} Specific Attribute 2`);
    }
  }
  
  return {
    template: mockTemplate
  };
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, attributes, context } = req.body;
    
    // Here you would call your AI model for chat responses
    // For now, return a mock response
    return res.status(200).json({
      response: `I've processed your message: "${message}". The document has ${attributes.length} attributes.`
    });
  } catch (error) {
    console.error('Error in chat:', error);
    return res.status(500).json({ error: 'Failed to process chat' });
  }
});

// Update attributes endpoint
app.post('/api/update-attributes', async (req, res) => {
  try {
    const { message, attributes, context, instructions } = req.body;
    
    // Here you would call your AI model to update attributes based on the chat
    // This is where we would apply the logic for pipe size and other attribute categorization
    // For now, let's simulate adding a new pipe size attribute if mentioned in the message
    
    let updatedAttributes = [...attributes];
    
    if (message.toLowerCase().includes('pipe size') || message.toLowerCase().includes('diameter')) {
      updatedAttributes.push({
        name: 'Pipe Size',
        value: 'DN50 (2")'
      });
    }
    
    // Add any other attribute mentioned in the message
    if (message.toLowerCase().includes('add') || message.toLowerCase().includes('create')) {
      const attributeMatch = message.match(/(?:add|create|new)(.*?)attribute(?:.*?)called(.*?)(?:with value|valued at|value of|:)(.*?)(?:$|\.)/i);
      if (attributeMatch && attributeMatch.length >= 4) {
        const attrName = attributeMatch[2].trim();
        const attrValue = attributeMatch[3].trim();
        
        if (attrName && attrValue) {
          updatedAttributes.push({
            name: attrName,
            value: attrValue
          });
        }
      }
    }
    
    return res.status(200).json({
      updatedAttributes
    });
  } catch (error) {
    console.error('Error updating attributes:', error);
    return res.status(500).json({ error: 'Failed to update attributes' });
  }
});

// Generate attribute template endpoint
app.options('/api/generate-template', cors());  // Enable preflight for this specific route

app.post('/api/generate-template', async (req, res) => {
  try {
    const { prompt, division, category, productDescription } = req.body;
    
    const result = await generateAttributeTemplate(division, category, productDescription);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error generating attribute template:', error);
    return res.status(500).json({ error: 'Failed to generate attribute template' });
  }
});

// Catch-all for unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Export the Express app
module.exports = app;

// Start the server if not imported elsewhere
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Add the new function for OCR suffix extraction
// Function to extract suffixes specifically from OCR text
function extractSuffixesFromOcrText(ocrText) {
  const suffixes = [];
  
  // First clean the text
  const cleanedText = cleanOcrText(ocrText);
  
  // Common suffix mappings based on known product options
  const knownSuffixes = {
    'AR': 'Acid Resistant Epoxy Coated Cast Iron',
    '5': 'Sediment Bucket',
    '6': 'Vandal Proof',
    '7': 'Trap Primer Tapping',
    '8': 'Backwater Valve',
    '13': 'Galvanized Coating',
    '15': 'Strainer Extension',
  };
  
  // Look for patterns like "-AR" or "AR" near "Acid Resistant" or similar descriptive text
  const suffixDescriptionRegex = /[-–—]?\s*([A-Z0-9]{1,4})\s+([A-Za-z].*?)(?=\n|\s{2,}|$)/g;
  let match;
  
  while ((match = suffixDescriptionRegex.exec(cleanedText)) !== null) {
    const rawCode = match[1].trim();
    let description = match[2].trim();
    
    // Normalize the code
    const normalizedCode = normalizeCode(rawCode);
    
    // Check if this is a known suffix or if the description matches known patterns
    const isAcidResistant = description.toLowerCase().includes('acid') || 
                           description.toLowerCase().includes('resistant') ||
                           description.toLowerCase().includes('epoxy');
    
    const isSedimentBucket = description.toLowerCase().includes('sediment') || 
                            description.toLowerCase().includes('bucket');
    
    const isTrapPrimer = description.toLowerCase().includes('trap') || 
                         description.toLowerCase().includes('primer');
    
    // Use known description if we have a match
    if (normalizedCode === 'AR' || isAcidResistant) {
      suffixes.push({
        name: `Options Suffix: -AR`,
        value: knownSuffixes['AR']
      });
    } else if (normalizedCode === '5' || isSedimentBucket) {
      suffixes.push({
        name: `Options Suffix: -5`,
        value: knownSuffixes['5']
      });
    } else if (normalizedCode === '7' || isTrapPrimer) {
      suffixes.push({
        name: `Options Suffix: -7`,
        value: knownSuffixes['7']
      });
    } else if (knownSuffixes[normalizedCode]) {
      // Use the known description for other recognized suffix codes
      suffixes.push({
        name: `Options Suffix: -${normalizedCode}`,
        value: knownSuffixes[normalizedCode]
      });
    } else if (description.length > 5 && normalizedCode.length <= 4) {
      // For other suffix-like patterns, keep them as detected
      suffixes.push({
        name: `Options Suffix: -${normalizedCode}`,
        value: description
      });
    }
  }
  
  // Look for acid resistant coating specifically
  if (cleanedText.toLowerCase().includes('acid resistant') || 
      cleanedText.toLowerCase().includes('acid-resistant') ||
      cleanedText.includes('epoxy coat')) {
    
    // Check if we already added this suffix
    if (!suffixes.some(s => s.name.includes('AR'))) {
      suffixes.push({
        name: `Options Suffix: -AR`,
        value: knownSuffixes['AR']
      });
    }
  }
  
  return suffixes;
}

// Function to extract technical data like flow rates from tables in the text
function extractTechnicalData(text) {
  const technicalData = [];
  const cleanedText = cleanOcrText(text);
  
  // Look for flow rate information
  const flowRateRegex = /(?:flow|free area|gpm|gallons per minute|discharge)\s+(?:rate|capacity)?[\s:]*([0-9.,]+)\s*(?:gpm|gallons|g\.p\.m\.|sq\. in\.)/gi;
  let flowMatch;
  
  while ((flowMatch = flowRateRegex.exec(cleanedText)) !== null) {
    const flowValue = flowMatch[1].trim();
    
    if (flowValue && !isNaN(parseFloat(flowValue))) {
      technicalData.push({
        name: "Flow Rate Capacity",
        value: `${flowValue} GPM`
      });
      break; // Just get the first valid flow rate
    }
  }
  
  // Look for "Free Area" table data which relates to flow capacity
  const freeAreaPattern = /free area.*?(\d+).*?sq\. in\./i;
  const freeAreaMatch = cleanedText.match(freeAreaPattern);
  
  if (freeAreaMatch && freeAreaMatch[1]) {
    if (!technicalData.some(attr => attr.name === "Flow Rate Capacity")) {
      technicalData.push({
        name: "Flow Rate Capacity",
        value: `Varies based on free area (${freeAreaMatch[1]} sq. in.)`
      });
    }
  }
  
  // Look for load rating information
  const loadRatingPattern = /(?:load|traffic)\s+(?:rating|class|classification)[\s:]*([A-Za-z\s]+duty|[A-Z]{1,2})/i;
  const loadRatingMatch = cleanedText.match(loadRatingPattern);
  
  if (loadRatingMatch && loadRatingMatch[1]) {
    technicalData.push({
      name: "Load Rating",
      value: loadRatingMatch[1].trim()
    });
  } else if (cleanedText.match(/medium duty|MD/i)) {
    technicalData.push({
      name: "Load Rating",
      value: "Medium Duty (MD)"
    });
  } else if (cleanedText.match(/heavy duty|HD/i)) {
    technicalData.push({
      name: "Load Rating",
      value: "Heavy Duty (HD)"
    });
  } else if (cleanedText.match(/light duty|LD/i)) {
    technicalData.push({
      name: "Load Rating",
      value: "Light Duty (LD)"
    });
  }
  
  // Look for material information
  const materialPattern = /(?:body|frame|drain)\s+material[\s:]*(cast iron|pvc|abs|stainless steel|bronze|brass|[a-z\s]+)/i;
  const materialMatch = cleanedText.match(materialPattern);
  
  if (materialMatch && materialMatch[1]) {
    technicalData.push({
      name: "Body Material",
      value: materialMatch[1].trim().replace(/^(.)/, match => match.toUpperCase())
    });
  }
  
  // Look for grate/top material
  const gratePattern = /(?:grate|top|strainer)\s+material[\s:]*(cast iron|nickel bronze|stainless steel|bronze|brass|[a-z\s]+)/i;
  const grateMatch = cleanedText.match(gratePattern);
  
  if (grateMatch && grateMatch[1]) {
    technicalData.push({
      name: "Top/Grate Material",
      value: grateMatch[1].trim().replace(/^(.)/, match => match.toUpperCase())
    });
  }
  
  return technicalData;
}

// Post-process detected manufacturer to handle special cases
function postProcessManufacturerDetection(text, division = '', category = '') {
  const cleanedText = text.toLowerCase();
  const divisionLower = division.toLowerCase();
  const categoryLower = category.toLowerCase();
  
  // Special case handling based on division and category
  if (divisionLower.includes('22') || divisionLower.includes('plumbing')) {
    
    // First, detect the fixture type
    let fixtureType = 'unknown';
    
    if (categoryLower.includes('drain')) {
      fixtureType = 'drain';
    } else if (categoryLower.includes('toilet') || categoryLower.includes('urinal') || categoryLower.includes('water closet')) {
      fixtureType = 'toilet';
    } else if (categoryLower.includes('sink') || categoryLower.includes('lavatory') || categoryLower.includes('basin')) {
      fixtureType = 'sink';
    } else if (categoryLower.includes('shower') || categoryLower.includes('bath')) {
      fixtureType = 'shower';
    } else if (categoryLower.includes('faucet') || categoryLower.includes('tap') || categoryLower.includes('fixture')) {
      fixtureType = 'faucet';
    }
    
    console.log("Detected fixture type for manufacturer matching:", fixtureType);
    
    // For commercial faucets, look for specific manufacturers
    if (fixtureType === 'faucet') {
      console.log("Checking faucet manufacturers");
      
      if (cleanedText.includes('american standard') || 
          cleanedText.includes('colony') || 
          cleanedText.includes('cadet') || 
          cleanedText.includes('heritage')) {
        console.log("Post-processing detected American Standard based on category and text");
        return "American Standard";
      }
      
      if (cleanedText.includes('moen') || 
          cleanedText.includes('m•power') || 
          cleanedText.includes('m-power')) {
        console.log("Post-processing detected Moen based on category and text");
        return "Moen";
      }
      
      if (cleanedText.includes('delta') || 
          cleanedText.includes('brizo') || 
          cleanedText.includes('peerless')) {
        console.log("Post-processing detected Delta based on category and text");
        return "Delta";
      }
      
      if (cleanedText.includes('kohler') || 
          cleanedText.includes('sterling')) {
        console.log("Post-processing detected Kohler based on category and text");
        return "Kohler";
      }
      
      if (cleanedText.includes('sloan') || 
          cleanedText.includes('optima')) {
        console.log("Post-processing detected Sloan based on category and text");
        return "Sloan";
      }
      
      if (cleanedText.includes('chicago faucets') || 
          cleanedText.includes('geberit')) {
        console.log("Post-processing detected Chicago Faucets based on category and text");
        return "Chicago Faucets";
      }
    }
    
    // For commercial toilets, look for specific manufacturers
    else if (fixtureType === 'toilet') {
      console.log("Checking toilet manufacturers");
      
      if (cleanedText.includes('american standard') || 
          cleanedText.includes('cadet')) {
        console.log("Post-processing detected American Standard toilet based on text");
        return "American Standard";
      }
      
      if (cleanedText.includes('kohler')) {
        console.log("Post-processing detected Kohler toilet based on text");
        return "Kohler";
      }
      
      if (cleanedText.includes('toto') || 
          cleanedText.includes('drake') || 
          cleanedText.includes('ultramax')) {
        console.log("Post-processing detected TOTO toilet based on text");
        return "TOTO";
      }
      
      if (cleanedText.includes('sloan') || 
          cleanedText.includes('flushmate')) {
        console.log("Post-processing detected Sloan toilet based on text");
        return "Sloan";
      }
      
      if (cleanedText.includes('zurn')) {
        console.log("Post-processing detected Zurn toilet based on text");
        return "Zurn";
      }
    }
    
    // For commercial sinks, look for specific manufacturers
    else if (fixtureType === 'sink') {
      console.log("Checking sink manufacturers");
      
      if (cleanedText.includes('american standard')) {
        console.log("Post-processing detected American Standard sink based on text");
        return "American Standard";
      }
      
      if (cleanedText.includes('kohler')) {
        console.log("Post-processing detected Kohler sink based on text");
        return "Kohler";
      }
      
      if (cleanedText.includes('elkay')) {
        console.log("Post-processing detected Elkay sink based on text");
        return "Elkay";
      }
      
      if (cleanedText.includes('just')) {
        console.log("Post-processing detected Just sink based on text");
        return "Just";
      }
      
      if (cleanedText.includes('advance tabco') || cleanedText.includes('advance-tabco')) {
        console.log("Post-processing detected Advance Tabco sink based on text");
        return "Advance Tabco";
      }
    }
    
    // For drains, check specific patterns
    else if (fixtureType === 'drain') {
      // Check for specific Zurn indicators when manufacturer was not detected
      const hasZurnFDPattern = /fd-\d{4}/i.test(cleanedText);
      const hasGeneralPurposeFloorDrain = cleanedText.match(/general purpose floor drain/i);
      const hasSolventWeld = cleanedText.match(/solvent weld/i);
      const hasLightCommericalIndicator = cleanedText.match(/light commercial/i);
      
      // Special case for Zurn FD-2202 and similar patterns
      if ((hasZurnFDPattern && hasGeneralPurposeFloorDrain) || 
          hasSolventWeld || hasLightCommericalIndicator) {
        console.log("Post-processing detected Zurn product based on drain pattern matching");
        return "Zurn";
      }
      
      // Watts drain indicators
      if (cleanedText.includes('watts') || cleanedText.match(/series fd-/i)) {
        console.log("Post-processing detected Watts Drains based on text patterns");
        return "Watts Drains";
      }
      
      // Wade drain indicators
      if (cleanedText.includes('wade') || cleanedText.match(/\bw-\d{3,4}\b/i)) {
        console.log("Post-processing detected Wade Drains based on text patterns");
        return "Wade Drains";
      }
    }
  }
  
  // Default return null if no match
  return null;
}

// Extract attributes using AI model
async function extractAttributesWithAI(pdfText, division, category, detectedManufacturer) {
  console.log('Using AI model to extract additional attributes...');
  
  // Create a prompt for the model
  let prompt = `
Extract key product attributes from the following text for a ${division} product in the ${category} category.

INSTRUCTIONS:
1. Return results in JSON format with attribute names as keys and their values as strings.
2. Extract each attribute individually - DO NOT group multiple attributes into a single field.
3. All values must be simple strings, not nested objects or arrays.
4. Be specific and detailed with attribute names - use full descriptive names.
5. Separate any complex information into individual attributes.
6. Pay special attention to tables and lists in the document that contain product options, suffixes, or codes:
   - For any suffix codes like "-7", "-5", "-A3", etc., extract both the code and its description
   - Format these as "Options Suffix: -7" with the value being the full description (e.g., "Trap Primer Tapping")
   - Look for tables with patterns like "Code | Description" or "Suffix | Description"
`;

  // Add category-specific instructions
  const isFaucetOrFixture = 
    category.toLowerCase().includes('fixture') || 
    category.toLowerCase().includes('faucet') || 
    category.toLowerCase() === 'commercial fixtures' ||
    category.toLowerCase() === 'commercial fixture' ||
    category === 'Commercial Fixtures';
    
  if (isFaucetOrFixture) {
    console.log("Using faucet-specific prompt for category:", category);
    prompt += `
7. For faucets, look specifically for these attributes:
   - Flow Rate (GPM)
   - Spout Reach
   - Spout Height
   - Handle Type
   - Mounting Type
   - Finish
   - Material
   - Certification/Compliance (like NSF/ANSI 61, WaterSense)
`;
  } else if (category.toLowerCase().includes('drain')) {
    prompt += `
7. For drains, look specifically for these attributes:
   - Flow Rate Capacity
   - Body Material
   - Top/Grate Material
   - Outlet Connection Type
   - Outlet Size
   - Load Rating
`;
  }

  // Add manufacturer-specific instructions if detected
  if (detectedManufacturer) {
    prompt += `
8. IMPORTANT: I've detected this is a ${detectedManufacturer} product - extract attributes specific to this manufacturer
9. Make sure to look for suffix codes and options that are specific to ${detectedManufacturer}
`;
  }

  prompt += `\nText from the PDF:\n${pdfText.substring(0, 4000)}`; // Limit text length
  
  try {
    // Call Hugging Face model
    const aiResponse = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.3,
        return_full_text: false
      }
    });
    
    // Parse the response to extract attributes
    const results = parseAttributesFromResponse(aiResponse.generated_text, division, category);
    console.log(`AI model extracted ${results.length} attributes`);
    return results;
  } catch (error) {
    console.error('Error using AI model:', error);
    return []; // Return empty array on error
  }
}

// Function to parse AI model response for attributes
function parseAttributesFromResponse(text, division, category) {
  try {
    // Start by finding the JSON structure
    const jsonStartIndex = text.indexOf('{');
    const jsonEndIndex = text.lastIndexOf('}');
    
    if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
      const jsonStr = text.substring(jsonStartIndex, jsonEndIndex + 1);
      const data = JSON.parse(jsonStr);
      
      // Convert to our attribute format
      const attributes = [];
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'string') {
          attributes.push({
            name: key,
            value: value.trim()
          });
        }
      }
      
      return sanitizeAttributes(attributes);
    }
    
    // If no JSON found, try to extract attributes line by line
    const lines = text.split('\n');
    const attributes = [];
    
    for (const line of lines) {
      const sepMatch = line.match(/^([^:]+):\s*(.+)$/);
      if (sepMatch) {
        attributes.push({
          name: sepMatch[1].trim(),
          value: sepMatch[2].trim()
        });
      }
    }
    
    if (!attributes.some(attr => attr.name.toLowerCase() === 'division')) {
      attributes.push({ name: 'Division', value: division });
    }
    
    if (!attributes.some(attr => attr.name.toLowerCase() === 'category')) {
      attributes.push({ name: 'Category', value: category });
    }
    
    return sanitizeAttributes(attributes);
  } catch (error) {
    console.error("Error parsing attributes from response:", error);
    return [
      { name: "Error", value: "Failed to parse attributes from model response" },
      { name: "Division", value: division },
      { name: "Category", value: category }
    ];
  }
}

// Sanitize attributes to remove problematic values
function sanitizeAttributes(attributes) {
  return attributes.map(attr => {
    // Clean name and value
    let name = attr.name.trim();
    let value = attr.value ? attr.value.trim() : '';
    
    // Remove quotes from value if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    
    // Special handling for suffix items
    if (name.includes('Suffix') && !name.startsWith('Options Suffix:')) {
      name = `Options Suffix: ${name.includes('-') ? name : '-' + name.split(' ').pop()}`;
    }
    
    return { name, value };
  });
} 