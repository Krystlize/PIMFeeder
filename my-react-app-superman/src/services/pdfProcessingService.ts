import { ProcessingResult } from '../types';
import { processPDFWithAI } from './backendService';

// Mock API for demo purposes - in a real app, this would call your backend
export const processPdf = async (
  file: File,
  division: string,
  category: string
): Promise<ProcessingResult> => {
  try {
    // Call the backend service to process the PDF
    const result = await processPDFWithAI(file, division, category);
    
    // Return the processed result
    return {
      attributes: result.attributes,
      rawText: result.rawText,
      template: result.template || []
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF');
  }
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