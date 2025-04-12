export interface Division {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  divisionId: string;
  name: string;
}

export interface ProcessedAttribute {
  name: string;
  value: string;
  updated?: boolean;
  oldValue?: string;
}

export interface ProcessingResult {
  attributes: ProcessedAttribute[];
  rawText?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'system';
  content: string;
  timestamp: Date;
} 