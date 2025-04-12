// Serverless function for processing PDF uploads
const multer = require('multer');
const { HfInference } = require('@huggingface/inference');
const util = require('util');
const pdfParse = require('pdf-parse');

// Initialize Hugging Face
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Make multer middleware work with serverless functions
const multerSingle = upload.single('file');
const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

// Function to extract text from PDF
async function extractTextFromPDF(pdfBuffer) {
  try {
    const pdfData = await pdfParse(pdfBuffer);
    return pdfData.text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

// Function to sanitize attributes and ensure they have the correct format
function sanitizeAttributes(attributes) {
  if (!Array.isArray(attributes)) {
    console.error('Attributes is not an array:', attributes);
    return [];
  }
  
  return attributes.map(attr => {
    // If attr is not an object, convert it to one
    if (typeof attr !== 'object' || attr === null) {
      console.error('Invalid attribute format:', attr);
      return { name: 'Unknown', value: String(attr) };
    }
    
    // If attribute has unexpected structure, normalize it
    if (!('name' in attr) || !('value' in attr)) {
      // Try to convert object key/value pairs to name/value
      const entries = Object.entries(attr);
      if (entries.length > 0) {
        const [key, value] = entries[0];
        return {
          name: key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value)
        };
      }
      return { name: 'Unknown', value: 'Unknown' };
    }
    
    // Ensure values are strings
    return {
      name: String(attr.name),
      value: typeof attr.value === 'object' ? JSON.stringify(attr.value) : String(attr.value)
    };
  });
}

// Function to parse attributes from the model's response
function parseAttributesFromResponse(text, division, category) {
  try {
    // Try to extract a JSON object from the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[0]);
        const attributes = [];
        
        // Convert the parsed JSON to our attribute format
        for (const [key, value] of Object.entries(jsonData)) {
          attributes.push({
            name: key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value)
          });
        }
        
        return sanitizeAttributes(attributes);
      } catch (e) {
        console.error("Failed to parse JSON from model response:", e);
      }
    }
    
    // Fallback: Extract key-value pairs using regex
    const attributeRegex = /([A-Za-z\s]+):\s*(.+?)(?=\n[A-Za-z\s]+:|$)/gs;
    const attributes = [];
    let match;
    
    while ((match = attributeRegex.exec(text)) !== null) {
      const name = match[1].trim();
      const value = match[2].trim();
      if (name && value) {
        attributes.push({ name, value });
      }
    }
    
    // Add division and category if they're not already included
    if (!attributes.some(attr => attr.name.toLowerCase() === 'division')) {
      attributes.push({ name: 'Division', value: division });
    }
    
    if (!attributes.some(attr => attr.name.toLowerCase() === 'category')) {
      attributes.push({ name: 'Category', value: category });
    }
    
    return sanitizeAttributes(attributes);
  } catch (error) {
    console.error("Error parsing attributes from response:", error);
    return sanitizeAttributes([
      { name: "Error", value: "Failed to parse attributes from model response" },
      { name: "Division", value: division },
      { name: "Category", value: category }
    ]);
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'https://krystlize.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Process the file upload
    await runMiddleware(req, res, multerSingle);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File received:', req.file.originalname);
    const division = req.body.division || 'Unknown Division';
    const category = req.body.category || 'Unknown Category';
    console.log('Division:', division);
    console.log('Category:', category);
    
    // Extract text from the PDF
    const pdfBuffer = req.file.buffer;
    const pdfText = await extractTextFromPDF(pdfBuffer);
    
    // Create a prompt for the model
    const prompt = `
Extract key product attributes from the following text for a ${division} product in the ${category} category.
Return the results in JSON format with attribute names as keys and their values as strings.
Include at minimum: Product Name, Description, Material, Dimensions, and any other relevant attributes for this product type.
All values must be simple strings, not nested objects or arrays.

Text from the PDF:
${pdfText.substring(0, 4000)} // Limit text length to avoid token limits
`;

    // Call Hugging Face model
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.3,
        return_full_text: false
      }
    });
    
    // Parse the response to extract attributes
    const generatedText = response.generated_text;
    const attributes = parseAttributesFromResponse(generatedText, division, category);
    
    return res.status(200).json({
      attributes,
      rawText: pdfText.substring(0, 1000) + '...' // Send a preview of the text
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
  }
}; 