require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { HfInference } = require('@huggingface/inference');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Hugging Face
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// CORS configuration
const corsOptions = {
  origin: ['https://krystlize.github.io', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle OPTIONS method
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'API is healthy', version: '1.0' });
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// PDF Processing Endpoint
app.post('/api/process-pdf', upload.single('file'), async (req, res) => {
  try {
    const { division, category } = req.body;
    
    // Extract text from PDF
    const pdfBuffer = req.file.buffer;
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    // Use OCR for images in PDF if needed
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text: ocrText } } = await worker.recognize(pdfBuffer);
    await worker.terminate();

    // Combine PDF text and OCR text
    const combinedText = `${pdfText}\n${ocrText}`;

    // Use Hugging Face to extract attributes
    const prompt = `Extract key attributes from the following text for a ${division} product in the ${category} category. Return the attributes in a structured JSON format. Text: ${combinedText}`;
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.3,
        return_full_text: false
      }
    });

    // Parse the response to extract attributes
    const attributes = parseHuggingFaceResponse(response.generated_text);

    res.json({
      attributes,
      rawText: combinedText
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, attributes, context } = req.body;

    const prompt = `You are a product information assistant. Help the user review and modify product attributes. Current attributes: ${JSON.stringify(attributes)}. Context: ${context}. User message: ${message}`;
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: prompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7,
        return_full_text: false
      }
    });

    res.json({ response: response.generated_text });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Update Attributes Endpoint
app.post('/api/update-attributes', async (req, res) => {
  try {
    const { message, attributes, context } = req.body;

    const prompt = `Update the product attributes based on the user's request. Current attributes: ${JSON.stringify(attributes)}. Context: ${context}. User request: ${message}. Return only the updated attributes in JSON format.`;
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.3,
        return_full_text: false
      }
    });

    const updatedAttributes = JSON.parse(response.generated_text);
    res.json({ updatedAttributes });
  } catch (error) {
    console.error('Error updating attributes:', error);
    res.status(500).json({ error: 'Failed to update attributes' });
  }
});

// Generate Template Endpoint
app.post('/api/generate-template', async (req, res) => {
  try {
    const { division, category, productDescription } = req.body;
    
    // Create a basic template based on division and category
    const template = generateTemplate(division, category, productDescription);
    
    res.json({ template });
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Function to generate a basic template based on division and category
function generateTemplate(division = '', category = '', productDescription = '') {
  // Convert to lowercase for easier comparison
  const divisionLower = division.toLowerCase();
  const categoryLower = category.toLowerCase();
  const productDescLower = productDescription.toLowerCase();
  
  console.log(`Template request - Division: ${division}, Category: ${category}, Product: ${productDescription}`);
  
  // Detect product type
  let productType = 'unknown';
  
  // Check for bathroom faucet
  if (productDescLower.includes('bathroom') && (productDescLower.includes('faucet') || productDescLower.includes('tap'))) {
    productType = 'bathroom_faucet';
    console.log('Detected product type: BATHROOM FAUCET');
  } 
  // Check for kitchen faucet
  else if (productDescLower.includes('kitchen') && (productDescLower.includes('faucet') || productDescLower.includes('tap'))) {
    productType = 'kitchen_faucet';
    console.log('Detected product type: KITCHEN FAUCET');
  }
  // Check for delta products
  else if (productDescLower.includes('delta') && 
          (categoryLower.includes('fixture') || categoryLower.includes('faucet'))) {
    productType = 'bathroom_faucet';
    console.log('Detected product type: DELTA BATHROOM FAUCET');
  }
  // Check for shower
  else if (productDescLower.includes('shower') || productDescLower.includes('bath')) {
    productType = 'shower';
    console.log('Detected product type: SHOWER');
  }
  // Check for toilet
  else if (productDescLower.includes('toilet') || productDescLower.includes('urinal')) {
    productType = 'toilet';
    console.log('Detected product type: TOILET');
  }
  // Generic fixture defaults
  else if (categoryLower.includes('fixture') || categoryLower.includes('faucet')) {
    productType = 'faucet';
    console.log('Detected product type: GENERIC FIXTURE/FAUCET');
  }
  
  // Basic template structure
  let template = [
    {
      groupName: 'Product Information',
      attributes: [
        'Product Number',
        'Product Name',
        'Product Description',
        'Manufacturer'
      ],
      isEssential: true
    }
  ];
  
  // Return specific template based on product type
  if (productType === 'bathroom_faucet') {
    template = [
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
          'Flow Rate (GPM)',
          'Spout Height (inches)',
          'Spout Reach (inches)',
          'Mounting Type (deck-mount, wall-mount)',
          'Number of Handles',
          'Hole Configuration (single, 3-hole, 8" widespread)',
          'Connection Type',
          'Material',
          'Finish',
          'Valve Type'
        ],
        isEssential: true
      },
      {
        groupName: 'Technical Specifications',
        attributes: [
          'Operating Pressure Range',
          'Maximum Flow Rate at 60 PSI',
          'Handle Type (lever, cross, etc.)',
          'Drain Assembly Included',
          'Pop-up Type',
          'Cartridge Type'
        ],
        isEssential: true
      },
      {
        groupName: 'Features & Compliance',
        attributes: [
          'ADA Compliant',
          'WaterSense Certified',
          'Lead-Free Compliant',
          'Water Saving Features',
          'Temperature Limiting Features',
          'ASME A112.18.1/CSA B125.1 Compliant',
          'Warranty Period'
        ],
        isEssential: true
      }
    ];
  } 
  else if (productType === 'kitchen_faucet') {
    // Kitchen faucet template
    template = [
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
          'Flow Rate (GPM)',
          'Spout Height (inches)',
          'Spout Reach (inches)',
          'Mounting Type',
          'Number of Handles',
          'Pull-Down/Pull-Out Feature',
          'Spray Function',
          'Connection Type',
          'Material',
          'Finish'
        ],
        isEssential: true
      },
      {
        groupName: 'Technical Specifications',
        attributes: [
          'Operating Pressure Range',
          'Maximum Flow Rate at 60 PSI',
          'Handle Type',
          'Installation Hole Size',
          'Cartridge Type',
          'Hose Length (for pull-down models)'
        ],
        isEssential: true
      },
      {
        groupName: 'Features & Compliance',
        attributes: [
          'ADA Compliant',
          'WaterSense Certified',
          'Lead-Free Compliant',
          'Water Saving Features',
          'ASME A112.18.1/CSA B125.1 Compliant',
          'Warranty Period'
        ],
        isEssential: true
      }
    ];
  }
  else if (productType === 'shower') {
    // Use default shower template
    template = [
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
  else if (productType === 'toilet') {
    // Toilet template
    template = [
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
        groupName: 'Technical Specifications',
        attributes: [
          'Operating Pressure Range',
          'Maximum Performance (MaP) Score',
          'Flush Volume Options',
          'Water Spot Size',
          'Trap Seal Depth'
        ],
        isEssential: true
      },
      {
        groupName: 'Code Compliance',
        attributes: [
          'ADA Compliant',
          'WaterSense Certified',
          'ASME A112.19.2/CSA B45.1 Compliant',
          'Warranty Period'
        ],
        isEssential: true
      }
    ];
  }
  
  return template;
}

// Helper function to parse Hugging Face response
function parseHuggingFaceResponse(response) {
  try {
    // Try to parse as JSON first
    return JSON.parse(response);
  } catch (e) {
    // If not JSON, extract attributes from text
    const lines = response.split('\n');
    return lines
      .filter(line => line.includes(':'))
      .map(line => {
        const [name, value] = line.split(':').map(s => s.trim());
        return { name, value };
      });
  }
}

// Export the Express API
module.exports = app;

const port = process.env.PORT || 3000;

// Start the server (only in development, Vercel will handle this in production)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
} 