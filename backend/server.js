require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { OpenAI } = require('openai');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://krystlize.github.io' 
    : 'http://localhost:3000'
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// PDF Processing Endpoint
app.post('/api/process-pdf', upload.single('file'), async (req, res) => {
  try {
    const { file, division, category } = req.body;
    
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

    // Use GPT to extract attributes
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a product information extraction assistant. Extract key attributes from the following text for a ${division} product in the ${category} category. Return the attributes in a structured format.`
        },
        {
          role: "user",
          content: combinedText
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    // Parse the GPT response to extract attributes
    const attributes = parseGPTResponse(completion.choices[0].message.content);

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a product information assistant. Help the user review and modify product attributes. Current attributes: ${JSON.stringify(attributes)}. Context: ${context}`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    res.json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Update Attributes Endpoint
app.post('/api/update-attributes', async (req, res) => {
  try {
    const { message, attributes, context } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Update the product attributes based on the user's request. Current attributes: ${JSON.stringify(attributes)}. Context: ${context}. Return only the updated attributes in JSON format.`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const updatedAttributes = JSON.parse(completion.choices[0].message.content);
    res.json({ updatedAttributes });
  } catch (error) {
    console.error('Error updating attributes:', error);
    res.status(500).json({ error: 'Failed to update attributes' });
  }
});

// Helper function to parse GPT response
function parseGPTResponse(response) {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 