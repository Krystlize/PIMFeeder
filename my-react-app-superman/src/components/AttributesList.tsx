import React from 'react';
import { 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Divider,
  Box,
  Chip
} from '@mui/material';
import { ProcessedAttribute } from '../types';

interface AttributesListProps {
  attributes: ProcessedAttribute[];
  rawText?: string;
}

const AttributesList: React.FC<AttributesListProps> = ({ attributes, rawText }) => {
  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Extracted Attributes
      </Typography>
      
      {attributes.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No attributes have been extracted yet. Process a PDF to see results.
        </Typography>
      ) : (
        <>
          <List sx={{ width: '100%' }}>
            {attributes.map((attribute, index) => (
              <React.Fragment key={`${attribute.name}-${index}`}>
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center">
                        <Chip 
                          label={attribute.name} 
                          color="primary" 
                          size="small" 
                          sx={{ mr: 2, minWidth: 120 }} 
                        />
                      </Box>
                    }
                    secondary={attribute.value}
                    secondaryTypographyProps={{
                      sx: { 
                        whiteSpace: 'pre-wrap', 
                        color: 'text.primary',
                        fontWeight: 'medium',
                        fontSize: '1rem',
                        mt: 0.5
                      }
                    }}
                  />
                </ListItem>
                {index < attributes.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
          
          {rawText && (
            <Box mt={3}>
              <Typography variant="subtitle2" gutterBottom>
                Extracted Raw Text:
              </Typography>
              <Typography 
                variant="body2" 
                component="div" 
                sx={{ 
                  p: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              >
                {rawText}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};

export default AttributesList; 