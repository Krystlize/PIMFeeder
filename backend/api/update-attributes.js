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
    console.log('Message received for attribute update:', message);
    
    if (!message || !attributes || !Array.isArray(attributes)) {
      return res.status(400).json({ 
        error: 'Invalid request: message and attributes array are required' 
      });
    }
    
    // Format the current attributes as JSON string for the prompt
    const attributesJson = JSON.stringify(attributes, null, 2);
    
    // Create a prompt for the model
    const prompt = `
You are an AI assistant helping to update product attributes based on user requests.

Current attributes (in JSON format):
${attributesJson}

User request: "${message}"

Task: Based on the user's request, determine which attributes need to be updated and provide the updated version of each attribute.
Follow these rules:
1. Only update attributes that the user explicitly asked to change.
2. Return the complete list of attributes, including both updated and unchanged ones.
3. Keep the same attribute structure with "name" and "value" fields.
4. If an attribute needs to be added, include it in the list with an appropriate name.
5. If the user's request is unclear, do not change any attributes.

Respond ONLY with a valid JSON array containing all attributes (changed and unchanged).
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
    
    // Extract JSON from the response
    const generatedText = response.generated_text;
    console.log('Generated response:', generatedText);
    
    // Try to extract a JSON array from the text
    let updatedAttributes = attributes; // Default to unchanged attributes
    const jsonMatch = generatedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    
    if (jsonMatch) {
      try {
        const parsedAttributes = JSON.parse(jsonMatch[0]);
        // Validate the parsed attributes have the right structure
        if (Array.isArray(parsedAttributes) && 
            parsedAttributes.every(attr => 
              typeof attr === 'object' && 
              'name' in attr && 
              'value' in attr)) {
          updatedAttributes = parsedAttributes;
        }
      } catch (error) {
        console.error('Error parsing JSON from model response:', error);
      }
    }
    
    // For attributes that were updated, add a flag to highlight them
    const changedAttributes = updatedAttributes.map(newAttr => {
      const oldAttr = attributes.find(a => a.name === newAttr.name);
      if (!oldAttr || oldAttr.value !== newAttr.value) {
        return {
          ...newAttr,
          updated: true
        };
      }
      return newAttr;
    });
    
    return res.status(200).json({ 
      updatedAttributes: changedAttributes,
      success: true
    });
  } catch (error) {
    console.error('Error updating attributes:', error);
    return res.status(500).json({ error: 'Failed to update attributes: ' + error.message });
  }
}; 