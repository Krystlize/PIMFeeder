import { ChatMessage, ProcessedAttribute } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { chatWithLLM, updateAttributesWithLLM } from './backendService';

// Mock LLM service for demo purposes
export const sendMessageToLLM = async (
  message: string,
  attributes: ProcessedAttribute[],
  context: string
): Promise<string> => {
  try {
    return await chatWithLLM(message, attributes, context);
  } catch (error) {
    console.error('Error in sendMessageToLLM:', error);
    throw error;
  }
};

export const createNewMessage = (content: string, sender: 'user' | 'system'): ChatMessage => {
  return {
    id: uuidv4(),
    content,
    sender,
    timestamp: new Date()
  };
};

export const updateAttributeBasedOnChat = async (
  message: string,
  currentAttributes: ProcessedAttribute[],
  context: string
): Promise<ProcessedAttribute[]> => {
  try {
    return await updateAttributesWithLLM(message, currentAttributes, context);
  } catch (error) {
    console.error('Error in updateAttributeBasedOnChat:', error);
    throw error;
  }
}; 