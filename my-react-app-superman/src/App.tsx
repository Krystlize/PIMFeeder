import React, { useState } from 'react';
import { 
  Container, 
  CssBaseline, 
  ThemeProvider, 
  createTheme, 
  Paper, 
  Box,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import DivisionCategorySelector from './components/DivisionCategorySelector';
import ProcessButton from './components/ProcessButton';
import AttributesList from './components/AttributesList';
import ChatInterface from './components/ChatInterface';
import SyncToPim from './components/SyncToPim';
import { ProcessedAttribute, ProcessingResult, AttributeGroup } from './types';
import { processPdf } from './services/pdfProcessingService';
import { divisions, categories } from './services/mockData';
import { testBackendConnection } from './utils/testConnection';
import './App.css';

// Create a theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

// Define steps for the stepper
const steps = ['Upload PDF', 'Select Division & Category', 'Process', 'Review & Modify', 'Sync to PIM'];

function App() {
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Division and category state
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');
  
  // Results state
  const [processingResults, setProcessingResults] = useState<ProcessingResult>({
    attributes: [],
  });
  
  // Step tracking
  const [activeStep, setActiveStep] = useState<number>(0);
  
  // Attribute template state
  const [attributeTemplate, setAttributeTemplate] = useState<AttributeGroup[]>([]);

  // Handle file selection
  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    if (activeStep === 0) {
      setActiveStep(1);
    }
  };
  
  // Handle division change
  const handleDivisionChange = (division: string) => {
    setSelectedDivision(division);
    if (division && selectedFile && activeStep === 1) {
      setActiveStep(2);
    }
  };
  
  // Handle category change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };
  
  // Handle processing
  const handleProcess = async () => {
    // Validate inputs
    if (!selectedFile) {
      setValidationError('Please select a PDF file');
      return;
    }
    
    if (!selectedDivision) {
      setValidationError('Please select a division');
      return;
    }
    
    if (!selectedCategory) {
      setValidationError('Please select a category');
      return;
    }
    
    setValidationError('');
    setIsProcessing(true);
    
    try {
      // Find the division and category names for display in results
      const divisionName = divisions.find(d => d.id === selectedDivision)?.name || selectedDivision;
      const categoryName = categories.find(c => c.id === selectedCategory)?.name || selectedCategory;
      
      // Process the PDF
      const results = await processPdf(selectedFile, divisionName, categoryName);
      
      // Set the processing results
      setProcessingResults(results);
      
      // If the results include a template, use it
      if (results.template && results.template.length > 0) {
        setAttributeTemplate(results.template);
      }
      // Otherwise generate a template (this is a fallback)
      else {
        try {
          const prompt = `If I had a product in division ${divisionName}, ${categoryName} category, what attributes would be required as an engineer or architect when specifying this product in a commercial project in North America?`;
          const { getAttributeTemplateFromAI } = await import('./services/backendService');
          const template = await getAttributeTemplateFromAI(prompt, divisionName, categoryName, '');
          setAttributeTemplate(template);
        } catch (templateError) {
          console.error('Error generating attribute template:', templateError);
          // Continue even if template generation fails
        }
      }
      
      setActiveStep(3);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setValidationError('Error processing PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle attribute updates from chat
  const handleAttributesUpdate = (newAttributes: ProcessedAttribute[]) => {
    setProcessingResults({
      ...processingResults,
      attributes: newAttributes
    });
  };
  
  // Handle template generation
  const handleTemplateGenerated = (template: AttributeGroup[]) => {
    setAttributeTemplate(template);
  };

  const handleTestConnection = async () => {
    console.log('Testing backend connection...');
    const isConnected = await testBackendConnection();
    if (isConnected) {
      alert('Backend connection successful!');
    } else {
      alert('Backend connection failed. Check console for details.');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Header />
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Box sx={{ mb: 4 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Paper elevation={0} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
            <Box sx={{ flex: 1 }}>
              <FileUpload 
                onFileSelected={handleFileSelected} 
                isProcessing={isProcessing} 
              />
              
              <DivisionCategorySelector 
                onDivisionChange={handleDivisionChange}
                onCategoryChange={handleCategoryChange}
                selectedDivision={selectedDivision}
                selectedCategory={selectedCategory}
                disabled={isProcessing}
              />
              
              <ProcessButton 
                onClick={handleProcess}
                disabled={!selectedFile || !selectedDivision || !selectedCategory}
                isProcessing={isProcessing}
                validationError={validationError}
              />
            </Box>
            
            <Box sx={{ flex: 1 }}>
              <AttributesList 
                attributes={processingResults.attributes} 
                rawText={processingResults.rawText}
                attributeTemplate={attributeTemplate}
              />
              
              {processingResults.attributes.length > 0 && (
                <>
                  <ChatInterface 
                    attributes={processingResults.attributes}
                    onAttributesUpdate={handleAttributesUpdate}
                  />
                  
                  <SyncToPim 
                    results={processingResults}
                    disabled={isProcessing || processingResults.attributes.length === 0}
                  />
                </>
              )}
            </Box>
          </Box>
        </Paper>
      </Container>
      <button 
        onClick={handleTestConnection}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          margin: '20px',
          cursor: 'pointer'
        }}
      >
        Test Backend Connection
      </button>
    </ThemeProvider>
  );
}

export default App;
