const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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

// Process PDF endpoint
app.post('/api/process-pdf', upload.single('file'), async (req, res) => {
  try {
    const { division, category } = req.body;
    
    // Mock response for a floor drain based on PDF content
    // In a real implementation, this would use OCR and AI to extract data from the PDF
    const attributes = [
      { name: "Product Number", value: "FD-100-A" },
      { name: "Product Name", value: "Floor Drain with Round Strainer" },
      { name: "Product Description", value: "Epoxy coated cast iron floor drain with anchor flange, reversible clamping collar with primary and secondary weepholes, adjustable round heel proof nickel bronze strainer, and no hub (standard) outlet" },
      { name: "Specification Number", value: "ES-WD-FD-100-A" },
      { name: "Manufacturer", value: "Wade Drains" },
      
      // Pipe Sizing attributes with suffixes
      { name: "Pipe Size Suffix: 2", value: "2\"(51) Pipe Size" },
      { name: "Pipe Size Suffix: 3", value: "3\"(76) Pipe Size" },
      { name: "Pipe Size Suffix: 4", value: "4\"(102) Pipe Size" },
      { name: "Pipe Size Suffix: 6", value: "6\"(152) Pipe Size (MI Only)" },
      
      // Options with suffixes
      { name: "Options Suffix: -5", value: "Sediment Bucket" },
      { name: "Options Suffix: -6", value: "Vandal Proof" },
      { name: "Options Suffix: -7", value: "Trap Primer Tapping" },
      { name: "Options Suffix: -8", value: "Backwater Valve" },
      { name: "Options Suffix: -13", value: "Galvanized Coating" },
      { name: "Options Suffix: -15", value: "Strainer Extension (DD-50)" },
      { name: "Options Suffix: -H4-50", value: "4\" Round Cast Iron Funnel" },
      { name: "Options Suffix: -H4-1", value: "4\" Round Nickel Bronze Funnel" },
      { name: "Options Suffix: -F6-1", value: "6\" Round Nickel Bronze Funnel" },
      { name: "Options Suffix: -6-50", value: "4\" x 9\" Oval Nickel Bronze Funnel" },
      { name: "Options Suffix: -90", value: "Special Strainer" },
      
      // Outlet Type with suffixes
      { name: "Outlet Type Suffix: MH", value: "No Hub (MI)" },
      { name: "Outlet Type Suffix: P", value: "Push On" },
      { name: "Outlet Type Suffix: T", value: "Threaded Outlet" },
      { name: "Outlet Type Suffix: X", value: "Inside Caulk" },
      
      // Strainer with suffixes
      { name: "Strainer Suffix: A5", value: "5\"(127) Dia. Nickel Bronze" },
      { name: "Strainer Suffix: A6", value: "6\"(152) Dia. Nickel Bronze" },
      { name: "Strainer Suffix: A7", value: "7\"(178) Dia. Nickel Bronze" },
      { name: "Strainer Suffix: A8", value: "8\"(203) Dia. Nickel Bronze" },
      { name: "Strainer Suffix: A10", value: "10\"(254) Dia. Nickel Bronze" },
      
      // Optional Body Material with suffixes
      { name: "Optional Body Material Suffix: -60", value: "PVC Body w/Socket Outlet" },
      { name: "Optional Body Material Suffix: -61", value: "ABS Body w/Socket Outlet" },
      
      // Load Rating with suffixes
      { name: "Load Rating", value: "MD (Medium Duty)" },
      
      // Strainer Size Chart Information
      { name: "Strainer Size: 5\"(127)", value: "Min Throat: 13/16\"(21), Max Throat: 3-1/4\"(83), Load Rating: MD, Free Area Sq. In.: 9" },
      { name: "Strainer Size: 6\"(152)", value: "Min Throat: 7/8\"(22), Max Throat: 3-3/8\"(86), Load Rating: MD, Free Area Sq. In.: 13" },
      { name: "Strainer Size: 7\"(178)", value: "Min Throat: 1-1/16\"(17), Max Throat: 3-1/2\"(83), Load Rating: MD, Free Area Sq. In.: 16" },
      { name: "Strainer Size: 8\"(203)", value: "Min Throat: 7/8\"(22), Max Throat: 3-1/4\"(83), Load Rating: MD, Free Area Sq. In.: 18" },
      { name: "Strainer Size: 10\"(254)", value: "Min Throat: 1-1/4\"(32), Max Throat: 3-1/4\"(83), Load Rating: MD, Free Area Sq. In.: 26" },
      
      // Chart B information
      { name: "Pipe Size: 2\"(51)", value: "Std. Size: 3-5/8\"(92), Push On: 4-1/4\"(108), Female Thread: 4-1/4\"(108), Inside Caulk: 4-1/2\"(114), 60/61 PVC/ABS: 4\"(102)" },
      { name: "Pipe Size: 3\"(76)", value: "Std. Size: 3-5/8\"(92), Push On: 4-1/4\"(108), Female Thread: 4-1/4\"(108), Inside Caulk: 4-1/2\"(114), 60/61 PVC/ABS: 4\"(102)" },
      { name: "Pipe Size: 4\"(102)", value: "Std. Size: 3-5/8\"(92), Push On: 4-1/4\"(108), Female Thread: 4-1/4\"(108), Inside Caulk: 4-1/2\"(114), 60/61 PVC/ABS: 4\"(102)" },
      { name: "Pipe Size: 6\"(152)", value: "Std. Size: 3-1/2\"(89), Push On: -, Female Thread: -, Inside Caulk: -, 60/61 PVC/ABS: -" },
      
      // Standards Information
      { name: "Standards Compliance", value: "Manufactured specifications are in accordance with the American National Standards ASME A112.36.2M-91(R2012) ASME Standard as a rule" },
      { name: "Load Rating Classification", value: "MD - Safe Live Load 2000-4999 lbs. (900-2250 kg)" }
    ];
    
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
      rawText: "FD-100-A Floor Drain with Round Strainer\nSpecification\nFD-100-A epoxy coated cast iron floor drain with anchor flange, reversible clamping collar with primary and secondary weepholes, adjustable round heel proof nickel bronze strainer, and no hub (standard) outlet",
      template
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ error: 'Failed to process PDF' });
  }
});

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
        groupName: 'Essential Attributes',
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
        isEssential: false
      }
    ];
  } 
  // Mock template for pipe fittings
  else if ((division && division.toLowerCase().includes('plumbing') || division === '22') && 
           (category && category.toLowerCase().includes('fitting'))) {
    
    mockTemplate = [
      {
        groupName: 'Essential Attributes',
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
        isEssential: false
      }
    ];
  }
  // Generate generic placeholder for other divisions/categories
  else {
    mockTemplate = [
      {
        groupName: 'Essential Attributes',
        attributes: [
          'Product Name',
          'Model Number',
          'Manufacturer',
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
        isEssential: false
      }
    ];
    
    // Add customization based on product description if provided
    if (productDescription) {
      mockTemplate[0].attributes.push(`${productDescription} Specific Attribute 1`);
      mockTemplate[0].attributes.push(`${productDescription} Specific Attribute 2`);
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