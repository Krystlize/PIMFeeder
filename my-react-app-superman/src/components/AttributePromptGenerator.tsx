import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getAttributeTemplateFromAI } from '../services/backendService';
import { ProcessedAttribute } from '../types';

interface AttributePromptGeneratorProps {
  division: string;
  category: string;
  onTemplateGenerated: (attributeGroups: AttributeGroupTemplate[]) => void;
  existingAttributes: ProcessedAttribute[];
}

export interface AttributeGroupTemplate {
  groupName: string;
  attributes: string[];
  isEssential: boolean;
}

const AttributePromptGenerator: React.FC<AttributePromptGeneratorProps> = ({
  division,
  category,
  onTemplateGenerated,
  existingAttributes
}) => {
  const [productDescription, setProductDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedTemplate, setGeneratedTemplate] = useState<AttributeGroupTemplate[]>([]);

  // Generate a default prompt based on division and category
  const getDefaultPrompt = () => {
    return `If I had a ${productDescription || 'product'} in division ${division}, ${category} category, what attributes would be required as an engineer or architect when specifying this product in a commercial project in North America?`;
  };

  const handleGenerateTemplate = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const prompt = getDefaultPrompt();
      const template = await getAttributeTemplateFromAI(prompt, division, category, productDescription);
      
      setGeneratedTemplate(template);
      onTemplateGenerated(template);
    } catch (error) {
      console.error('Error generating template:', error);
      setError('Failed to generate attribute template. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if an attribute from the template exists in the current attributes
  const doesAttributeExist = (attributeName: string) => {
    return existingAttributes.some(attr => 
      attr.name.toLowerCase().includes(attributeName.toLowerCase()) ||
      attributeName.toLowerCase().includes(attr.name.toLowerCase())
    );
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Attribute Structure Generator
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Product Description (e.g., floor drain, pipe fitting, valve)"
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
          sx={{ mb: 2 }}
          helperText="Describe the product to get customized attribute requirements"
        />
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleGenerateTemplate}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          Generate Attribute Structure
        </Button>
      </Box>
      
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      
      {generatedTemplate.length > 0 && (
        <Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Generated Attribute Structure
          </Typography>
          
          {generatedTemplate.map((group, groupIndex) => (
            <Accordion key={groupIndex} defaultExpanded={group.isEssential}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={group.isEssential ? 'bold' : 'normal'}>
                  {group.groupName}
                  {group.isEssential && (
                    <Chip 
                      size="small" 
                      color="primary" 
                      label="Mandatory"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box component="ul" sx={{ pl: 2 }}>
                  {group.attributes.map((attr, attrIndex) => (
                    <Box 
                      component="li" 
                      key={attrIndex}
                      sx={{
                        mb: 1,
                        color: doesAttributeExist(attr) ? 'text.primary' : 'text.disabled',
                        fontWeight: doesAttributeExist(attr) ? 'bold' : 'normal'
                      }}
                    >
                      {attr}
                      {doesAttributeExist(attr) && (
                        <Chip 
                          label="Found" 
                          color="success" 
                          size="small" 
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default AttributePromptGenerator; 