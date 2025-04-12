// Serverless function for updating attributes based on chat
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
    // Get the message, attributes, and context from the request body
    const { message, attributes, context } = req.body;
    console.log('Message received:', message);
    console.log('Context:', context);
    console.log('Attributes:', attributes);
    
    // For now, return the same attributes (or slightly modified ones for testing)
    // In a real implementation, you would use the HuggingFace model to update attributes
    const updatedAttributes = attributes.map(attr => {
      // Example: if the message contains the attribute name, append some text to its value
      if (message.toLowerCase().includes(attr.name.toLowerCase())) {
        return {
          ...attr,
          value: `${attr.value} (Updated based on user message)`
        };
      }
      return attr;
    });
    
    return res.status(200).json({ 
      updatedAttributes,
      success: true
    });
  } catch (error) {
    console.error('Error updating attributes:', error);
    return res.status(500).json({ error: 'Failed to update attributes' });
  }
}; 