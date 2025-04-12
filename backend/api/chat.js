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
    
    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }
    
    // Format attributes for the prompt
    let attributesText = '';
    if (attributes && attributes.length > 0) {
      attributesText = 'Product Attributes:\n';
      attributes.forEach(attr => {
        attributesText += `- ${attr.name}: ${attr.value}\n`;
      });
    }
    
    // Create the prompt for the model
    const prompt = `
You are a helpful AI assistant for a Product Information Management (PIM) system. 
You have access to the following product attributes:

${attributesText}

${context ? 'Additional context:\n' + context + '\n\n' : ''}

User: ${message}

Instructions:
- Answer the user's question based on the product attributes provided.
- If the user asks about information not in the attributes, acknowledge this and suggest what information might help.
- Keep your answers concise, professional, and helpful.
- If the user asks to update an attribute, respond affirmatively but do not make any actual changes.
`;
    
    // Use Hugging Face model to generate a response
    const result = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: prompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7,
        return_full_text: false
      }
    });
    
    // Extract the generated text
    const generatedResponse = result.generated_text.trim();
    
    return res.status(200).json({ 
      response: generatedResponse,
      success: true
    });
  } catch (error) {
    console.error('Error generating chat response:', error);
    return res.status(500).json({ error: 'Failed to generate response: ' + error.message });
  }
}; 