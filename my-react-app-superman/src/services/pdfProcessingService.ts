import { ProcessingResult } from '../types';
import { processPdfWithAI } from './backendService';

// Mock API for demo purposes - in a real app, this would call your backend
export const processPdf = async (
  file: File,
  division: string,
  category: string
): Promise<ProcessingResult> => {
  try {
    return await processPdfWithAI(file, division, category);
  } catch (error) {
    console.error('Error in processPdf:', error);
    throw error;
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