import axios from 'axios';
import { ProcessingResult, ProcessedAttribute } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
const HUGGING_FACE_TOKEN = process.env.REACT_APP_HUGGING_FACE_TOKEN;

// Create an axios instance with default headers
const api = axios.create({
  headers: {
    'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

export const processPDFWithAI = async (
  file: File,
  division: string,
  category: string
): Promise<ProcessingResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('division', division);
  formData.append('category', category);

  try {
    const response = await api.post(`${API_BASE_URL}/process-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF. Please try again.');
  }
};

export const chatWithLLM = async (
  message: string,
  attributes: ProcessedAttribute[],
  context: string
): Promise<string> => {
  try {
    const response = await api.post(`${API_BASE_URL}/chat`, {
      message,
      attributes,
      context
    });
    return response.data.response;
  } catch (error) {
    console.error('Error communicating with LLM:', error);
    throw new Error('Failed to get response from AI. Please try again.');
  }
};

export const updateAttributesWithLLM = async (
  message: string,
  currentAttributes: ProcessedAttribute[],
  context: string
): Promise<ProcessedAttribute[]> => {
  try {
    const response = await api.post(`${API_BASE_URL}/update-attributes`, {
      message,
      attributes: currentAttributes,
      context,
      instructions: `
        When extracting or updating attributes, pay special attention to:
        1. Pipe size attributes - create separate attributes for nominal size, actual size, etc.
        2. Properly format dimensions with correct units
        3. Group similar attributes together for easier PIM synchronization
        4. Maintain all original attributes unless explicitly asked to modify them
      `
    });
    return response.data.updatedAttributes;
  } catch (error) {
    console.error('Error updating attributes:', error);
    throw new Error('Failed to update attributes. Please try again.');
  }
}; 