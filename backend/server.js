require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { HfInference } = require('@huggingface/inference');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Hugging Face
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://krystlize.github.io' 
    : 'http://localhost:3000'
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// PDF Processing Endpoint
app.post('/api/process-pdf', upload.single('file'), async (req, res) => {
  try {
    const { division, category } = req.body;
    
    // Extract text from PDF
    const pdfBuffer = req.file.buffer;
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    // Use OCR for images in PDF if needed
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text: ocrText } } = await worker.recognize(pdfBuffer);
    await worker.terminate();

    // Combine PDF text and OCR text
    const combinedText = `${pdfText}\n${ocrText}`;

    // Use Hugging Face to extract attributes
    const prompt = `Extract key attributes from the following text for a ${division} product in the ${category} category. Return the attributes in a structured JSON format. Text: ${combinedText}`;
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.3,
        return_full_text: false
      }
    });

    // Parse the response to extract attributes
    const attributes = parseHuggingFaceResponse(response.generated_text);

    res.json({
      attributes,
      rawText: combinedText
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, attributes, context } = req.body;

    const prompt = `You are a product information assistant. Help the user review and modify product attributes. Current attributes: ${JSON.stringify(attributes)}. Context: ${context}. User message: ${message}`;
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: prompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7,
        return_full_text: false
      }
    });

    res.json({ response: response.generated_text });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Update Attributes Endpoint
app.post('/api/update-attributes', async (req, res) => {
  try {
    const { message, attributes, context } = req.body;

    const prompt = `Update the product attributes based on the user's request. Current attributes: ${JSON.stringify(attributes)}. Context: ${context}. User request: ${message}. Return only the updated attributes in JSON format.`;
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.3,
        return_full_text: false
      }
    });

    const updatedAttributes = JSON.parse(response.generated_text);
    res.json({ updatedAttributes });
  } catch (error) {
    console.error('Error updating attributes:', error);
    res.status(500).json({ error: 'Failed to update attributes' });
  }
});

// Helper function to parse Hugging Face response
function parseHuggingFaceResponse(response) {
  try {
    // Try to parse as JSON first
    return JSON.parse(response);
  } catch (e) {
    // If not JSON, extract attributes from text
    const lines = response.split('\n');
    return lines
      .filter(line => line.includes(':'))
      .map(line => {
        const [name, value] = line.split(':').map(s => s.trim());
        return { name, value };
      });
  }
}

// Export the Express API
module.exports = app; 