// Serverless function for chat with LLM
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
    console.log('Chat message:', message);
    console.log('Context:', context);
    
    // For now, return a mock response
    // In a real implementation, you would use the Hugging Face model to generate a response
    let response = `I received your message: "${message}". `;
    
    if (attributes && attributes.length > 0) {
      response += `I see you have ${attributes.length} attributes. `;
      
      // Add a comment about the first attribute if available
      if (attributes[0]) {
        response += `For example, I see ${attributes[0].name} is "${attributes[0].value}". `;
      }
    }
    
    response += "How can I help you with these product attributes?";
    
    return res.status(200).json({ 
      response,
      success: true
    });
  } catch (error) {
    console.error('Error generating chat response:', error);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
}; 