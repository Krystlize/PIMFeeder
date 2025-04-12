// Serverless function for chat with LLM
const { HfInference } = require('@huggingface/inference');

// Initialize Hugging Face
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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
    let { message, attributes, context } = req.body;
    console.log('Chat message:', message);
    
    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }
    
    // Sanitize input data
    message = String(message);
    context = context ? String(context) : '';
    
    // Sanitize attributes if present
    const sanitizedAttributes = attributes ? sanitizeAttributes(attributes) : [];
    
    // Format attributes for the prompt
    let attributesText = '';
    if (sanitizedAttributes.length > 0) {
      attributesText = 'Product Attributes:\n';
      sanitizedAttributes.forEach(attr => {
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
- Avoid technical jargon or references to programming concepts.
- Present your answer in a clear, direct manner.
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
    
    // Extract and sanitize the generated text
    let generatedResponse = result.generated_text.trim();
    
    // Remove any potential JSON formatting or code blocks that might cause issues
    generatedResponse = generatedResponse
      .replace(/```[a-z]*\n[\s\S]*?\n```/g, '') // Remove code blocks
      .replace(/\{[\s\S]*\}/g, match => {
        try {
          // Try to parse as JSON and stringify it to ensure it's clean
          const parsed = JSON.parse(match);
          return JSON.stringify(parsed);
        } catch (e) {
          // If it's not valid JSON, return as is
          return match;
        }
      });
    
    return res.status(200).json({ 
      response: generatedResponse,
      success: true
    });
  } catch (error) {
    console.error('Error generating chat response:', error);
    return res.status(500).json({ error: 'Failed to generate response: ' + error.message });
  }
}; 