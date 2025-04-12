const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { createWorker } = require('tesseract.js');

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
    sectionOrder: ["product info", "pipe size", "options", "outlet", "material"]
  },
  
  // Wade Drains template
  "Wade Drains": {
    productNumberPattern: /\b(?:W-|C-)?[0-9]{1,4}(?:-[A-Z0-9]{1,3})?\b/,
    productNamePattern: /^(.*?(?:FLOOR|ROOF|AREA|DRAIN|CARRIER).*?)(?:\n|$)/im,
    specificationPattern: /SPEC\s*(?:NO\.?|NUMBER)?\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["SUFFIX", "OPTION", "TYPE"],
    suffixPattern: /\s+(-[A-Z0-9]+|[A-Z]{1,2})\s+([^\n]+)/,
    tableHeaders: ["SIZE", "OUTLET", "TOP", "BODY"],
    flowRateIdentifiers: ["FLOW", "CAPACITY", "CFS", "GPM"],
    sectionOrder: ["product info", "suffix", "body material", "grate"]
  },
  
  // Zurn template
  "Zurn": {
    productNumberPattern: /\b[Z][0-9]{3,5}(?:-[A-Z0-9]{1,5})?\b/,
    productNamePattern: /^(Z[0-9]{3,5}.*?(?:FLOOR|ROOF|DRAIN|CARRIER|WATER).*?)(?:\n|$)/im,
    specificationPattern: /ZURN\s*SPEC\s*(?::|=)?\s*([A-Z0-9-]+)/i,
    suffixSectionMarkers: ["SUFFIX", "OPTION", "PREFIX"],
    suffixPattern: /\s+(-[A-Z0-9]+|[A-Z]{1,2})\s+([^\n]+)/,
    tableHeaders: ["SIZE", "CONNECTION", "MATERIAL", "FINISH"],
    flowRateIdentifiers: ["FLOW RATE", "GPM", "GALLONS PER MINUTE"],
    sectionOrder: ["product info", "materials", "options", "connections"]
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
    sectionOrder: ["product info", "options", "materials", "connections"]
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
    sectionOrder: ["product info", "options", "dimensions", "materials"]
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
    sectionOrder: ["product info", "options", "sizing"]
  }
};

// Add a function to apply manufacturer-specific extraction templates
function extractWithManufacturerTemplate(text, manufacturer) {
  const results = [];
  
  // Get the template for this manufacturer, or use a generic one
  const template = manufacturerTemplates[manufacturer] || manufacturerTemplates["Watts Drains"];
  
  console.log(`Using ${manufacturer} template for extraction`);
  
  // Extract product number using manufacturer-specific pattern
  const productNumberMatch = text.match(template.productNumberPattern);
  if (productNumberMatch) {
    results.push({
      name: "Product Number",
      value: productNumberMatch[0].trim()
    });
  }
  
  // Extract product name using manufacturer-specific pattern
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
  
  // Extract suffixes using the manufacturer-specific pattern
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
  
  // Look for table headers specific to this manufacturer
  for (const header of template.tableHeaders) {
    const tableColumnMatch = text.match(new RegExp(`${header}[\\s:]*([^\\n]+)`, 'i'));
    if (tableColumnMatch) {
      results.push({
        name: header.charAt(0).toUpperCase() + header.slice(1).toLowerCase(),
        value: tableColumnMatch[1].trim()
      });
    }
  }
  
  // Extract flow rate using manufacturer-specific identifiers
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
  
  return results;
}

// Now modify the detectManufacturer function to return more brand information
function detectManufacturer(text) {
  const cleanedText = text.toLowerCase();
  
  const manufacturers = [
    { name: "Wade Drains", keywords: ['wade', 'drain'], confidence: 0 },
    { name: "Watts Drains", keywords: ['watts', 'drain'], confidence: 0 },
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
        score += 10;
        
        // Bonus points for the manufacturer being in the first 500 characters
        if (cleanedText.substring(0, 500).includes(keyword)) {
          score += 5;
        }
      }
    }
    
    // Check for manufacturer-specific product number patterns
    const template = manufacturerTemplates[mfr.name];
    if (template && cleanedText.match(template.productNumberPattern)) {
      score += 20;
    }
    
    mfr.confidence = score;
  }
  
  // Sort by confidence score (descending)
  manufacturers.sort((a, b) => b.confidence - a.confidence);
  
  // Return the detected manufacturer or null if no confident match
  return manufacturers[0].confidence > 0 ? manufacturers[0].name : null;
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
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File received:', req.file.originalname);
    
    // Extract text from the PDF
    const pdfBuffer = req.file.buffer;
    let pdfText = '';
    
    try {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(pdfBuffer);
      pdfText = pdfData.text;
      console.log('PDF text extraction successful, length:', pdfText.length);
    } catch (pdfError) {
      console.error('Error parsing PDF text:', pdfError);
      // Continue with empty text - we'll try OCR
    }
    
    // Check if we need to perform OCR
    if (!pdfText || pdfText.length < 100) {
      try {
        console.log('Attempting OCR on PDF...');
        
        // Create a worker and recognize text from the buffer
        // Note: This works best with PDF files that are actually images
        const worker = await createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        
        // Convert buffer to base64 to use with tesseract
        const base64Image = pdfBuffer.toString('base64');
        const { data } = await worker.recognize(`data:application/pdf;base64,${base64Image}`);
        
        if (data.text && data.text.length > 0) {
          console.log('OCR successful, text length:', data.text.length);
          
          // Apply post-processing specifically for suffix extraction
          const ocrSuffixes = extractSuffixesFromOcrText(data.text);
          if (ocrSuffixes.length > 0) {
            console.log(`Extracted ${ocrSuffixes.length} suffixes directly from OCR text`);
            extractedAttributes.push(...ocrSuffixes);
          }
          
          // Combine OCR text with any text extracted from PDF
          if (pdfText && pdfText.length > 0) {
            pdfText = pdfText + '\n\n' + data.text;
          } else {
            pdfText = data.text;
          }
        }
        
        await worker.terminate();
      } catch (ocrError) {
        console.error('Error performing OCR:', ocrError);
        // Continue with whatever text we have
      }
    }
    
    // If we still don't have text, return a message but continue with mock data
    if (!pdfText || pdfText.length < 10) {
      console.log('Warning: Could not extract text from the PDF.');
      pdfText = "No text could be extracted from this PDF";
    }
    
    // Detect manufacturer from PDF text
    const detectedManufacturer = detectManufacturer(pdfText);
    console.log(`Detected manufacturer: ${detectedManufacturer || 'Unknown'}`);
    
    // Use template-based extraction for the detected manufacturer
    let extractedProductInfo = [];
    if (detectedManufacturer) {
      // Use the manufacturer-specific template for extraction
      const templateResults = extractWithManufacturerTemplate(pdfText, detectedManufacturer);
      
      // Add manufacturer to the extracted info if not already present
      if (!templateResults.some(attr => attr.name === "Manufacturer")) {
        templateResults.push({
          name: "Manufacturer",
          value: detectedManufacturer
        });
      }
      
      extractedProductInfo = templateResults;
      console.log(`Extracted ${extractedProductInfo.length} attributes using ${detectedManufacturer} template`);
    } else {
      // Fall back to generic extraction if no manufacturer detected
      const detectedProductNumber = extractProductNumber(pdfText);
      if (detectedProductNumber) {
        console.log(`Detected product number: ${detectedProductNumber}`);
        extractedProductInfo.push({
          name: "Product Number",
          value: detectedProductNumber
        });
      }
    }
    
    // Extract tabular data from the PDF text
    let extractedAttributes = [];
    if (pdfText && pdfText.length > 0) {
      // Try to extract tabular data
      extractedAttributes = extractTabularData(pdfText);
      
      // Extract technical data like flow rates
      const technicalData = extractTechnicalData(pdfText);
      
      // Add technical data to extracted attributes
      if (technicalData.length > 0) {
        console.log(`Extracted ${technicalData.length} technical attributes from the PDF`);
        extractedAttributes = [...extractedAttributes, ...technicalData];
      }
      
      // If very few attributes were found, try using the AI model
      if (extractedAttributes.length < 5 && (extractedProductInfo.length + extractedAttributes.length) < 10) {
        try {
          console.log('Using AI model to extract additional attributes...');
          
          // Create a prompt for the Hugging Face model that includes manufacturer info
          let prompt = `
Extract key product attributes from the following text for a ${division} product in the ${category} category.

INSTRUCTIONS:
1. Return results in JSON format with attribute names as keys and their values as strings.
2. Extract each attribute individually - DO NOT group multiple attributes into a single field.
3. Be specific and detailed with attribute names - use full descriptive names.
4. Separate any complex information into individual attributes.
5. Pay special attention to tables and lists that contain product options, suffixes, or codes:
   - For any suffix codes like "-7", "-5", "-AR", "-A3", etc., extract both the code and its description
   - Format these as "Options Suffix: -7" with the value being the full description
   - Look for tables with patterns like "Code | Description" or "Suffix | Description"
   - Be careful with the AR suffix - it should be "AR" not "ARA" and means "Acid Resistant Epoxy Coated Cast Iron"
6. If there are pipe sizing options, extract them as "Pipe Size Suffix: X" where X is the size indicator
`;

          // Add manufacturer-specific instructions if detected
          if (detectedManufacturer) {
            prompt += `
7. IMPORTANT: I've detected this is a ${detectedManufacturer} product - extract attributes specific to this manufacturer's format
8. Use these EXACT attribute names for plumbing products:
   - "Flow Rate Capacity" (not just "Capacity")
   - "Body Material" (not just "Material")
   - "Top/Grate Material" (not "Strainer Material")
   - "Outlet Connection Type" (not just "Connection Type")
   - "Outlet Orientation"
   - "Load Rating"
9. Look for common ${detectedManufacturer} suffix codes and their meanings
`;
          } else {
            prompt += `
7. IMPORTANT: Look for the correct manufacturer name in the text (e.g., Watts Drains, Wade Drains, Zurn, Josam, MIFAB, Jay R. Smith)
8. Use these EXACT attribute names for plumbing products:
   - "Flow Rate Capacity" (not just "Capacity")
   - "Body Material" (not just "Material")
   - "Top/Grate Material" (not "Strainer Material")
   - "Outlet Connection Type" (not just "Connection Type")
   - "Outlet Orientation"
   - "Load Rating"
9. Common suffixes to look for include:
   -5: Sediment Bucket
   -6: Vandal Proof
   -7: Trap Primer Tapping
   -8: Backwater Valve
   -13: Galvanized Coating
   -15: Strainer Extension
   -AR: Acid Resistant Epoxy Coated Cast Iron
`;
          }

          prompt += `
10. For flow rate capacity, look for values in GPM (gallons per minute) or references to a "Free Area" table

Expected attributes for ${division} products include but are not limited to:
- Product Number / Model Number
- Product Name
- Manufacturer${detectedManufacturer ? ` (${detectedManufacturer})` : ''}
- Material
- Dimensions
${division === "22" ? 
"- Flow Rate Capacity\n- Body Material\n- Top/Grate Material\n- Outlet Connection Type\n- Outlet Orientation\n- Suffix Codes and their descriptions\n- Load Rating" : ""}

Text from the PDF:
${pdfText.substring(0, 4000)} // Limit text length to avoid token limits
`;

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
          const aiAttributes = parseAttributesFromModel(aiResponse.generated_text);
          console.log(`AI model extracted ${aiAttributes.length} attributes`);
          
          // Merge with directly extracted table attributes, avoiding duplicates
          for (const aiAttr of aiAttributes) {
            if (!extractedAttributes.some(attr => attributeNamesMatch(attr.name, aiAttr.name))) {
              extractedAttributes.push(aiAttr);
            }
          }
        } catch (aiError) {
          console.error('Error using AI model:', aiError);
          // Continue with just the attributes we extracted directly
        }
      }
    }
    
    // COMPLETELY NEW ATTRIBUTE MERGING LOGIC
    // Start with product-specific information that was extracted with templates
    let attributes = [...extractedProductInfo];
    
    // Add extracted attributes that don't conflict with already added product info
    for (const extractedAttr of extractedAttributes) {
      // Skip if we already added this attribute from product info
      if (!attributes.some(attr => attributeNamesMatch(attr.name, extractedAttr.name))) {
        attributes.push(extractedAttr);
      }
    }
    
    // Add common plumbing attributes as fallbacks if appropriate and not already present
    if (division === '22' || division.toLowerCase().includes('plumb')) {
      for (const commonAttr of commonPlumbingAttributes) {
        if (!attributes.some(attr => attributeNamesMatch(attr.name, commonAttr.name))) {
          attributes.push(commonAttr);
        }
      }
    }
    
    // If we still don't have a manufacturer, use a default
    if (!attributes.some(attr => attr.name === "Manufacturer")) {
      attributes.push({
        name: "Manufacturer",
        value: "Unknown"
      });
    }
    
    // If we still don't have a product number, use a default
    if (!attributes.some(attr => attr.name === "Product Number")) {
      attributes.push({
        name: "Product Number",
        value: "Unknown"
      });
    }
    
    // Generate the attribute template based on division and category
    let template = [];
    try {
      const mockTemplateResponse = await generateAttributeTemplate(division, category, '');
      template = mockTemplateResponse.template;
    } catch (templateError) {
      console.error('Error generating template:', templateError);
    }
    
    return res.status(200).json({
      attributes,
      rawText: pdfText.substring(0, 1000),
      template
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ error: 'Failed to process PDF' });
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
  
  // Mock template for plumbing/drainage
  if ((division && division.toLowerCase().includes('plumbing') || division === '22') && 
      (category && category.toLowerCase().includes('drain'))) {
    
    mockTemplate = [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name',
          'Product Description',
          'Specification Number',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Load rating/traffic classification (light duty, medium duty, heavy duty)',
          'Top/grate material (cast iron, stainless steel, nickel bronze, etc.)',
          'Top/grate finish (polished, satin, coated, etc.)',
          'Top/grate shape (round, square, rectangular)',
          'Top/grate dimensions',
          'Body material (cast iron, PVC, ABS, etc.)',
          'Outlet size (2", 3", 4", etc.)',
          'Outlet connection type (no-hub, threaded, push-on, etc.)',
          'Outlet orientation (bottom, side, adjustable)',
          'Trap configuration (integral P-trap, separate, none)',
          'Sediment bucket requirement (yes/no)',
          'Water seal depth for trap (if applicable)',
          'Compliance with applicable codes (UPC, IPC, local jurisdictions)'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Important Attributes',
        attributes: [
          'Flow rate capacity (GPM)',
          'Anti-ponding design (slope to drain)',
          'Membrane clamp/flashing collar (for waterproofing areas)',
          'Height adjustability (fixed or adjustable)',
          'Backwater valve (if required)',
          'ADA compliance (where applicable)',
          'Heel-proof requirements (if in pedestrian areas)',
          'Anti-bacterial coating (for healthcare facilities)',
          'Chemical resistance (for industrial applications)',
          'Fire rating (if penetrating fire-rated floors)'
        ],
        isEssential: false
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASME A112.6.3 (Floor and Trench Drains)',
          'ASME A112.21.2M (Roof Drains)',
          'CSA B79 (Commercial and Residential Drains in Canada)',
          'NSF/ANSI 14 (Plastic Components and Materials)',
          'Local plumbing codes (requirements vary by jurisdiction)',
          'Buy American Act compliance (for government projects)'
        ],
        isEssential: true
      }
    ];
  } 
  // Mock template for pipe fittings
  else if ((division && division.toLowerCase().includes('plumbing') || division === '22') && 
           (category && category.toLowerCase().includes('fitting'))) {
    
    mockTemplate = [
      {
        groupName: 'Product Information',
        attributes: [
          'Product Number',
          'Product Name', 
          'Product Description',
          'Specification Number',
          'Manufacturer'
        ],
        isEssential: true
      },
      {
        groupName: 'Mandatory Attributes',
        attributes: [
          'Material (copper, brass, PVC, CPVC, PEX, etc.)',
          'Connection type (press, solder, threaded, compression, etc.)',
          'Size/dimension (nominal pipe size)',
          'Pressure rating',
          'Temperature rating',
          'Compatible pipe types',
          'Configuration (elbow, tee, coupling, union, etc.)',
          'Angle (for elbows: 45°, 90°, etc.)',
          'End connections (FPT, MPT, sweat, press, etc.)',
          'Lead-free certification (for potable water)',
          'Standards compliance (ASME, ASTM, NSF)'
        ],
        isEssential: true
      },
      {
        groupName: 'Additional Important Attributes',
        attributes: [
          'Flow characteristics',
          'Corrosion resistance',
          'Chemical compatibility',
          'UV resistance (for outdoor applications)',
          'Insulation compatibility',
          'Sealing method (o-ring, gasket, etc.)',
          'Required tools for installation',
          'Special coating or lining',
          'Electrical conductivity/dielectric properties',
          'Fire rating'
        ],
        isEssential: false
      },
      {
        groupName: 'Code and Standards Compliance',
        attributes: [
          'ASME B16 series (various fitting standards)',
          'ASTM material standards (specific to material)',
          'NSF/ANSI 61 (drinking water system components)',
          'NSF/ANSI 372 (lead content)',
          'UL/FM approvals (for fire protection)',
          'Local plumbing codes compliance',
          'Low-lead compliance (California AB 1953, etc.)'
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