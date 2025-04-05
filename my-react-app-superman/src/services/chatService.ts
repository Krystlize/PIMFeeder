import { ChatMessage, ProcessedAttribute, ProcessingResult } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Mock LLM service for demo purposes
export const sendMessageToLLM = async (
  message: string,
  attributes: ProcessedAttribute[]
): Promise<string> => {
  // In a real app, this would call your LLM API
  console.log('Sending to LLM:', message);
  console.log('Current attributes:', attributes);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock responses based on message content
  if (message.toLowerCase().includes('change') || message.toLowerCase().includes('update')) {
    return "I've updated the attribute values based on your request. Is there anything else you'd like to modify?";
  } else if (message.toLowerCase().includes('help')) {
    return "I can help you review and modify the extracted attributes. Just tell me what you'd like to change or update.";
  } else if (message.toLowerCase().includes('explain')) {
    return "These attributes were extracted from the PDF document using OCR and natural language processing. They represent the key product specifications that will be synced to your PIM system.";
  } else {
    return "I'm here to help you review and modify the extracted attributes from your document. Let me know if you need any changes.";
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

export const updateAttributeBasedOnChat = (
  message: string,
  currentAttributes: ProcessedAttribute[]
): ProcessedAttribute[] => {
  // In a real app, this would use an LLM to parse the message and update attributes
  // For this demo, we'll use a simple regex pattern matching
  
  const attributeUpdatePattern = /change\s+(?:the\s+)?([a-z\s]+)\s+(?:to|from)?\s+['"]?([^'"]+)['"]?/i;
  const match = message.match(attributeUpdatePattern);
  
  if (match) {
    const [_, attributeName, newValue] = match;
    
    // Create a new array with the updated attribute
    return currentAttributes.map(attr => {
      if (attr.name.toLowerCase() === attributeName.trim().toLowerCase()) {
        return { ...attr, value: newValue.trim() };
      }
      return attr;
    });
  }
  
  return currentAttributes;
}; 