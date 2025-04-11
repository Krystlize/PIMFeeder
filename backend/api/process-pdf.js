// This is a simplified version for initial testing
const { HfInference } = require('@huggingface/inference');

// Initialize Hugging Face
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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
    // For now, return a mock response
    return res.status(200).json({
      attributes: [
        { name: "Product Name", value: "Example Product" },
        { name: "Description", value: "This is a sample product description." },
        { name: "Category", value: "Test" }
      ],
      rawText: "Sample text content from PDF"
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ error: 'Failed to process PDF' });
  }
}; 