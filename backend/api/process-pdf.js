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

// Function to extract tabular data that might contain suffix information
function extractTabularData(text) {
  const tableData = [];
  
  // Pattern 1: Look for lines that appear to be part of a table with suffix codes
  // This looks for patterns like "-7 | Trap Primer Tapping" or "A5 | 5"(127) Dia. Nickel Bronze"
  const tableLineRegex = /^\s*([A-Z0-9-]+)\s*[\|:]\s*(.*?)$/gm;
  let tableMatch;
  
  while ((tableMatch = tableLineRegex.exec(text)) !== null) {
    const code = tableMatch[1].trim();
    const description = tableMatch[2].trim();
    
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
  const optionRegex = /-([0-9A-Z]+(?:-[0-9A-Z]+)?)\s+([^-\n].*?)(?=\n-[0-9A-Z]|\n\s*$|$)/g;
  let optionMatch;
  
  while ((optionMatch = optionRegex.exec(text)) !== null) {
    const code = optionMatch[1].trim();
    const description = optionMatch[2].trim();
    
    if (code && description) {
      tableData.push({
        name: `Options Suffix: -${code}`,
        value: description
      });
    }
  }
  
  return tableData;
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

// Function to expand any complex attributes that contain multiple values
function expandComplexAttributes(attributes) {
  let expandedAttributes = [];
  
  for (const attr of attributes) {
    // Check if this attribute looks like it contains multiple values
    const value = attr.value;
    
    // If it's a very long value or contains multiple lines, it may need to be split
    if (value.includes(',') && value.length > 50) {
      try {
        // Try to split by commas and create separate attributes
        const parts = value.split(',').map(part => part.trim()).filter(part => part.length > 0);
        
        if (parts.length > 1) {
          // Create individual attributes
          for (const part of parts) {
            if (part.includes(':')) {
              // This part might be a key-value pair
              const [subName, subValue] = part.split(':', 2).map(s => s.trim());
              expandedAttributes.push({
                name: subName,
                value: subValue
              });
            } else {
              // Just a value, use the original name
              expandedAttributes.push({
                name: attr.name + ' - ' + part.substring(0, 20),
                value: part
              });
            }
          }
        } else {
          // Not enough parts to split, keep original
          expandedAttributes.push(attr);
        }
      } catch (e) {
        console.error('Error expanding attribute:', e);
        expandedAttributes.push(attr);
      }
    } else {
      // No need to split, keep as is
      expandedAttributes.push(attr);
    }
  }
  
  return expandedAttributes;
}

// Function to parse attributes from the model's response
function parseAttributesFromResponse(text, division, category) {
  try {
    // Try to extract a JSON object from the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let attributes = [];

    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[0]);
        
        // Convert the parsed JSON to our attribute format
        for (const [key, value] of Object.entries(jsonData)) {
          if (key === 'Additional Attributes' || key === 'Additional Information' || key === 'Other') {
            // This is a common pattern where the model puts multiple attributes in one field
            // We need to extract individual attributes
            if (typeof value === 'string') {
              const lines = value.split('\n');
              for (const line of lines) {
                if (line.includes(':')) {
                  const [subKey, subValue] = line.split(':', 2).map(s => s.trim());
                  if (subKey && subValue) {
                    attributes.push({
                      name: subKey,
                      value: subValue
                    });
                  }
                } else if (line.trim()) {
                  attributes.push({
                    name: 'Detail',
                    value: line.trim()
                  });
                }
              }
            } else if (typeof value === 'object') {
              // It's already an object, extract each property
              for (const [subKey, subValue] of Object.entries(value)) {
                attributes.push({
                  name: subKey,
                  value: typeof subValue === 'object' ? JSON.stringify(subValue) : String(subValue)
                });
              }
            }
          } else {
            attributes.push({
              name: key,
              value: typeof value === 'object' ? JSON.stringify(value) : String(value)
            });
          }
        }
        
        // Expand any complex attributes
        const expandedAttributes = expandComplexAttributes(attributes);
        attributes = sanitizeAttributes(expandedAttributes);
      } catch (e) {
        console.error("Failed to parse JSON from model response:", e);
      }
    }
    
    // Fallback: Extract key-value pairs using regex
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
      
      // Expand any complex attributes
      const expandedAttributes = expandComplexAttributes(attributes);
      attributes = sanitizeAttributes(expandedAttributes);
    }
    
    // Extract suffix codes from raw text using regex
    // This targets patterns like "-7 Trap Primer Tapping" or "Suffix: -7 Trap Primer"
    const rawText = text;
    const suffixRegex = /(?:(?:suffix|option|code)[\s:-]*)([-A-Z0-9]+)(?:[\s:])*((?:[^\n,]+))/gi;
    let suffixMatch;
    
    while ((suffixMatch = suffixRegex.exec(rawText)) !== null) {
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
    
    // Add division and category if they're not already included
    if (!attributes.some(attr => attr.name.toLowerCase() === 'division')) {
      attributes.push({ name: 'Division', value: division });
    }
    
    if (!attributes.some(attr => attr.name.toLowerCase() === 'category')) {
      attributes.push({ name: 'Category', value: category });
    }
    
    return attributes;
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
    
    // Extract any tabular data from the PDF text before AI processing
    const tableAttributes = extractTabularData(pdfText);
    
    // Create a prompt for the model
    const prompt = `
Extract key product attributes from the following text for a ${division} product in the ${category} category.

INSTRUCTIONS:
1. Return results in JSON format with attribute names as keys and their values as strings.
2. Extract each attribute individually - DO NOT group multiple attributes into a single field.
3. All values must be simple strings, not nested objects or arrays.
4. Be specific and detailed with attribute names - use full descriptive names.
5. Separate any complex information into individual attributes.
6. If multiple values belong to the same category, give them individual, unique attribute names.
7. Do not create an "Additional Attributes" or "Other" field that contains multiple attributes.
8. Pay special attention to tables and lists in the document that contain product options, suffixes, or codes:
   - For any suffix codes like "-7", "-5", "-A3", etc., extract both the code and its description
   - Format these as "Options Suffix: -7" with the value being the full description (e.g., "Trap Primer Tapping")
   - Look for tables with patterns like "Code | Description" or "Suffix | Description"
9. If there are pipe sizing options, extract them as "Pipe Size Suffix: X" where X is the size indicator

Expected attributes for ${division} products include but are not limited to:
- Product Number / Model Number
- Product Name
- Manufacturer
- Material
- Dimensions (width, height, depth as separate attributes)
- Color/Finish
- Weight
- Capacity
- Installation Requirements
- Compliance Standards
- Warranty Information
${division === "22" ? 
"- Flow Rate\n- Connection Type\n- Drainage Features\n- Pipe Size Options\n- Material Compatibility\n- Suffix Codes and their descriptions\n- Optional Features\n- Outlet Type Options\n- Load Rating" : ""}

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
    let attributes = parseAttributesFromResponse(generatedText, division, category);
    
    // Merge with directly extracted table attributes, avoiding duplicates
    for (const tableAttr of tableAttributes) {
      if (!attributes.some(attr => 
          attr.name.toLowerCase() === tableAttr.name.toLowerCase() ||
          (attr.name.toLowerCase().includes('suffix') && 
           tableAttr.name.toLowerCase().includes('suffix') &&
           attr.name.includes(tableAttr.name.split(':')[1].trim())))) {
        attributes.push(tableAttr);
      }
    }
    
    return res.status(200).json({
      attributes,
      rawText: pdfText.substring(0, 1000) + '...' // Send a preview of the text
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
  }
}; 