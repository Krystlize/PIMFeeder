const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Express
const app = express();

// Initialize Hugging Face inference
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Enable CORS
app.use(cors({
  origin: ['https://krystlize.github.io', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://krystlize.github.io');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Parse JSON
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'API is running',
    version: '1.0',
    endpoints: {
      health: '/health or /api/health',
      api: '/api',
      processPdf: '/api/process-pdf'
    }
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'API is running',
    version: '1.0',
    documentation: 'Contact administrator for API documentation'
  });
});

// Process PDF endpoint
app.post('/api/process-pdf', upload.single('file'), async (req, res) => {
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
});

// Catch-all for unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Export the Express app
module.exports = app;

// Start the server if not imported elsewhere
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} 