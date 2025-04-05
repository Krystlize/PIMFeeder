import axios from 'axios';
import { ProcessingResult } from '../types';

// Mock API for demo purposes - in a real app, this would call your backend
export const processPdf = async (
  file: File,
  division: string,
  category: string
): Promise<ProcessingResult> => {
  // In a real app, you would upload the file to your server and process it with OCR
  // For this demo, we'll use a mock response based on the inputs
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock response - this would normally come from your backend LLM processing
  const mockAttributes = [
    { name: 'Product Name', value: `Sample ${category} Product` },
    { name: 'Material', value: 'Stainless Steel' },
    { name: 'Dimensions', value: '12" x 8" x 6"' },
    { name: 'Weight', value: '5.7 lbs' },
    { name: 'Color', value: 'Silver' },
    { name: 'Warranty', value: '5 years' },
    { name: 'Model Number', value: 'ABC-123-XYZ' },
    { name: 'Category', value: category },
    { name: 'Division', value: division },
  ];
  
  return {
    attributes: mockAttributes,
    rawText: `This is a sample ${division} product in the ${category} category. It features premium materials and construction.`
  };
};

export const syncToPim = async (
  attributes: ProcessingResult
): Promise<boolean> => {
  // In a real app, this would send the data to your PIM system
  console.log('Syncing to PIM:', attributes);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Mock successful response
  return true;
}; 