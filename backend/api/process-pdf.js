// Serverless function for processing PDF uploads
const multer = require('multer');
const { HfInference } = require('@huggingface/inference');
const util = require('util');

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
    
    console.log('File received:', req.file ? req.file.originalname : 'No file');
    console.log('Division:', req.body.division);
    console.log('Category:', req.body.category);
    
    // For now, return a mock response
    return res.status(200).json({
      attributes: [
        { name: "Product Name", value: "Example Product" },
        { name: "Description", value: "This is a sample product description." },
        { name: "Category", value: req.body.category || "Test" }
      ],
      rawText: "Sample text content from PDF"
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ error: 'Failed to process PDF' });
  }
}; 