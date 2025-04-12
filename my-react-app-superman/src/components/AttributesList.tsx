import React, { useState } from 'react';
import { 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Divider,
  Box,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Grid,
  Card,
  CardContent,
  Badge
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import UpdateIcon from '@mui/icons-material/Update';
import { ProcessedAttribute } from '../types';

interface AttributesListProps {
  attributes: ProcessedAttribute[];
  rawText?: string;
}

const AttributesList: React.FC<AttributesListProps> = ({ attributes, rawText }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  
  // Filter attributes based on search term
  const filteredAttributes = attributes.filter(attr => 
    attr.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    attr.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group attributes by category (use first word of attribute name as category)
  const groupedAttributes = filteredAttributes.reduce((groups: Record<string, ProcessedAttribute[]>, attr) => {
    // Extract category from attribute name (first word or before colon)
    let category = 'General';
    
    if (attr.name.includes(':')) {
      category = attr.name.split(':')[0].trim();
    } else if (attr.name.includes(' ')) {
      category = attr.name.split(' ')[0].trim();
    }
    
    // Special cases for common attribute names
    if (attr.name.toLowerCase().includes('dimension') || 
        attr.name.toLowerCase().includes('width') || 
        attr.name.toLowerCase().includes('height') || 
        attr.name.toLowerCase().includes('depth') || 
        attr.name.toLowerCase().includes('size')) {
      category = 'Dimensions';
    } else if (attr.name.toLowerCase().includes('weight') || 
               attr.name.toLowerCase().includes('mass')) {
      category = 'Weight';
    } else if (attr.name.toLowerCase().includes('material') || 
               attr.name.toLowerCase().includes('finish') || 
               attr.name.toLowerCase().includes('coating')) {
      category = 'Materials';
    } else if (attr.name.toLowerCase().includes('color') || 
               attr.name.toLowerCase().includes('colour')) {
      category = 'Appearance';
    } else if (attr.name.toLowerCase().includes('standard') || 
               attr.name.toLowerCase().includes('certification') || 
               attr.name.toLowerCase().includes('compliance')) {
      category = 'Compliance';
    } else if (attr.name.toLowerCase().includes('product') || 
               attr.name.toLowerCase().includes('model') || 
               attr.name.toLowerCase().includes('name')) {
      category = 'Product Info';
    } else if (attr.name.toLowerCase().includes('pipe size') || 
               attr.name.toLowerCase().includes('pipe diameter') ||
               attr.name.toLowerCase().includes('pipe dim') ||
               attr.name.toLowerCase().includes('nominal size') ||
               attr.name.toLowerCase().includes('nominal diameter') ||
               attr.name.toLowerCase().match(/\bdn\b/i) ||
               attr.name.toLowerCase().match(/\bnps\b/i)) {
      category = 'Pipe Size';
    }
    
    if (!groups[category]) {
      groups[category] = [];
    }
    
    groups[category].push(attr);
    return groups;
  }, {});
  
  // Sort categories to ensure consistent order
  const sortedCategories = Object.keys(groupedAttributes).sort();
  
  // Move certain categories to the beginning
  const priorityCategories = ['Product Info', 'General', 'Dimensions', 'Pipe Size', 'Materials'];
  sortedCategories.sort((a, b) => {
    const indexA = priorityCategories.indexOf(a);
    const indexB = priorityCategories.indexOf(b);
    
    if (indexA >= 0 && indexB >= 0) return indexA - indexB;
    if (indexA >= 0) return -1;
    if (indexB >= 0) return 1;
    return a.localeCompare(b);
  });

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Extracted Attributes
        </Typography>
        <Box display="flex" alignItems="center">
          <TextField
            size="small"
            placeholder="Search attributes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ width: 200 }}
          />
        </Box>
      </Box>
      
      {attributes.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No attributes have been extracted yet. Process a PDF to see results.
        </Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {sortedCategories.map(category => (
              <Grid item xs={12} md={6} key={category}>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {category}
                    </Typography>
                    <List dense disablePadding>
                      {groupedAttributes[category].map((attribute, index) => (
                        <ListItem 
                          key={`${attribute.name}-${index}`} 
                          disablePadding 
                          sx={{ 
                            py: 0.5,
                            backgroundColor: attribute.updated ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                            borderRadius: 1
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center">
                                {attribute.updated ? (
                                  <Badge
                                    badgeContent={<UpdateIcon fontSize="small" />}
                                    color="primary"
                                    anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                                    sx={{ mr: 1 }}
                                  >
                                    <Typography variant="body1" fontWeight="medium">
                                      {attribute.name.replace(category + ':', '').trim()}
                                    </Typography>
                                  </Badge>
                                ) : (
                                  <Typography variant="body1" fontWeight="medium">
                                    {attribute.name.replace(category + ':', '').trim()}
                                  </Typography>
                                )}
                              </Box>
                            }
                            secondary={
                              <Typography 
                                variant="body2" 
                                color="text.primary"
                                sx={{ 
                                  whiteSpace: 'pre-wrap',
                                  mt: 0.5,
                                  fontWeight: attribute.updated ? 'bold' : 'regular'
                                }}
                              >
                                {attribute.value}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          {rawText && (
            <Box mt={3}>
              <Typography 
                variant="subtitle2" 
                gutterBottom
                sx={{ cursor: 'pointer' }}
                onClick={() => setShowRawText(!showRawText)}
              >
                {showRawText ? "Hide Raw Text" : "Show Raw Text"}
              </Typography>
              
              {showRawText && (
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
              )}
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};

export default AttributesList; 