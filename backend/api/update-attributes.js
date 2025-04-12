// Serverless function for updating attributes based on chat
const { HfInference } = require('@huggingface/inference');

// Initialize Hugging Face
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Helper function to ensure attributes have the correct format
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
    const { message, attributes, context } = req.body;
    console.log('Message received for attribute update:', message);
    
    if (!message || !attributes || !Array.isArray(attributes)) {
      return res.status(400).json({ 
        error: 'Invalid request: message and attributes array are required' 
      });
    }
    
    // Sanitize input attributes
    const sanitizedAttributes = sanitizeAttributes(attributes);
    
    // Format the current attributes as JSON string for the prompt
    const attributesJson = JSON.stringify(sanitizedAttributes, null, 2);
    
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
3. Keep the same attribute structure with "name" and "value" fields where value is ALWAYS a string.
4. If an attribute needs to be added, include it in the list with an appropriate name.
5. If the user's request is unclear, do not change any attributes.
6. DO NOT use nested objects or arrays as values - all values must be simple strings.

Respond ONLY with a valid JSON array containing all attributes (changed and unchanged) in this format:
[
  {
    "name": "Attribute Name",
    "value": "Attribute Value as a string"
  },
  ...
]
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
    let updatedAttributes = sanitizedAttributes; // Default to unchanged attributes
    const jsonMatch = generatedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    
    if (jsonMatch) {
      try {
        const extractedJson = jsonMatch[0];
        console.log('Extracted JSON:', extractedJson);
        
        const parsedAttributes = JSON.parse(extractedJson);
        // Sanitize the parsed attributes to ensure they have the right structure
        updatedAttributes = sanitizeAttributes(parsedAttributes);
      } catch (error) {
        console.error('Error parsing JSON from model response:', error);
      }
    }
    
    // For attributes that were updated, add a flag to highlight them
    const changedAttributes = updatedAttributes.map(newAttr => {
      const oldAttr = sanitizedAttributes.find(a => a.name === newAttr.name);
      if (!oldAttr || oldAttr.value !== newAttr.value) {
        return {
          ...newAttr,
          updated: true
        };
      }
      return newAttr;
    });
    
    // Final validation to ensure we have proper data
    const finalAttributes = changedAttributes.map(attr => ({
      name: String(attr.name || 'Unknown'),
      value: String(attr.value || ''),
      updated: Boolean(attr.updated)
    }));
    
    return res.status(200).json({ 
      updatedAttributes: finalAttributes,
      success: true
    });
  } catch (error) {
    console.error('Error updating attributes:', error);
    return res.status(500).json({ error: 'Failed to update attributes: ' + error.message });
  }
}; 