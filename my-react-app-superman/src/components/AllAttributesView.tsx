import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Stack
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { ProcessedAttribute } from '../types';

interface AllAttributesViewProps {
  attributes: ProcessedAttribute[];
}

// Helper function to extract suffix code and clean value
const processSuffixData = (attr: ProcessedAttribute) => {
  const isSuffixAttribute = attr.name.toLowerCase().includes('suffix') || 
                           attr.name.toLowerCase().includes('option');
  
  let suffix = null;
  let cleanValue = attr.value;
  
  // Try to extract from value if it contains JSON-like fragments with "Suffix" and "Description"
  const jsonSuffixMatch = attr.value.match(/["']?Suffix["']?\s*:?\s*["']?([-\w]+)["']?/i);
  const jsonDescMatch = attr.value.match(/["']?Description["']?\s*:?\s*["']?([^"'\]\}]+)["']?/i);
  
  if (jsonSuffixMatch) {
    suffix = jsonSuffixMatch[1];
    cleanValue = jsonDescMatch ? jsonDescMatch[1].trim() : cleanValue;
  } 
  // Try to extract suffix from the attribute name if it's a suffix attribute
  else if (isSuffixAttribute) {
    const suffixMatch = attr.name.match(/(?:Suffix|Option)(?:s)?(?:\s*)?(?::|-)?\s*([-]?[A-Z0-9-]+)/i);
    if (suffixMatch && suffixMatch[1]) {
      suffix = suffixMatch[1];
    } else {
      // No suffix in name, check if the value starts with a suffix code pattern
      const valueCodeMatch = attr.value.match(/^\s*["']?(-[A-Z0-9-]+)["']?\s*/i);
      if (valueCodeMatch) {
        suffix = valueCodeMatch[1];
        cleanValue = cleanValue.replace(/^\s*["']?-[A-Z0-9-]+["']?\s*/, '');
      }
    }
  }
  
  // Clean up the suffix
  if (suffix) {
    suffix = suffix
      .replace(/[\[\]"'{}\s]/g, '') // Remove brackets, quotes, braces, spaces
      .replace(/^Suffix$/i, '')     // Remove word "Suffix" if it's all that's left
      .replace(/^Option$/i, '');    // Remove word "Option" if it's all that's left
    
    // Ensure dash prefix for consistency
    if (!suffix.startsWith('-')) {
      suffix = '-' + suffix;
    }
  }
  
  // Clean up the value
  cleanValue = cleanValue
    .replace(/^\s*["']?Suffix["']?\s*:?\s*["']?[-\w]+["']?\s*,?/i, '') // Remove suffix part
    .replace(/^\s*["']?Description["']?\s*:?\s*["']?/i, '')              // Remove description label
    .replace(/["'\]\}]+$/, '')                                          // Remove trailing quotes/brackets
    .replace(/^["'\[\{]+/, '')                                          // Remove leading quotes/brackets
    .trim();
  
  // Strip out any JSON-like artifacts in the value
  cleanValue = cleanValue.replace(/[{}\[\]"']/g, '').trim();
  
  return { suffix, cleanValue, isSuffixAttribute };
};

// Process and group attributes to handle Description + Suffix formatting
const processAttributes = (attrs: ProcessedAttribute[]) => {
  const processedAttrs: ProcessedAttribute[] = [];
  const suffixMap: { [key: string]: string } = {};
  const descriptionMap: { [key: string]: string } = {};
  
  // First pass: identify related suffix/description pairs
  attrs.forEach(attr => {
    const { suffix, cleanValue, isSuffixAttribute } = processSuffixData(attr);
    
    if (isSuffixAttribute) {
      // Store the suffix code
      if (suffix) {
        suffixMap[attr.name] = suffix;
      }
      
      // Store the description value
      if (attr.name.toLowerCase().includes('description')) {
        // Find the related suffix attribute
        const relatedSuffixAttr = attrs.find(a => 
          a !== attr && 
          a.name.toLowerCase().includes('suffix') && 
          !a.name.toLowerCase().includes('description')
        );
        
        if (relatedSuffixAttr) {
          descriptionMap[relatedSuffixAttr.name] = cleanValue;
        } else {
          // This is a standalone description - add it normally
          processedAttrs.push({
            ...attr,
            value: cleanValue,
            suffix: suffix
          });
        }
      } else {
        // This is a suffix code attribute
        const description = descriptionMap[attr.name] || cleanValue;
        
        // Add a merged attribute
        processedAttrs.push({
          ...attr,
          value: description,
          suffix: suffix || suffixMap[attr.name]
        });
      }
    } else {
      // For non-suffix attributes, just add them normally
      processedAttrs.push({
        ...attr,
        value: cleanValue,
        suffix: suffix
      });
    }
  });
  
  // Remove duplicate Description attributes that were merged
  return processedAttrs.filter(attr => 
    !attr.name.toLowerCase().includes('description') ||
    !processedAttrs.some(a => 
      a !== attr && 
      a.name.toLowerCase().includes('suffix') && 
      a.value === attr.value
    )
  );
};

const AllAttributesView: React.FC<AllAttributesViewProps> = ({ attributes }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processedAttributes, setProcessedAttributes] = useState<any[]>([]);
  
  // Process attributes on component mount or when attributes change
  useEffect(() => {
    setProcessedAttributes(processAttributes(attributes));
  }, [attributes]);
  
  // Filter attributes based on search query
  const filteredAttributes = searchQuery 
    ? processedAttributes.filter(attr => 
        attr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        attr.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : processedAttributes;
  
  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };
  
  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          All Attributes ({attributes.length})
        </Typography>
        
        <TextField
          placeholder="Search attributes..."
          size="small"
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{ width: { xs: '100%', sm: '300px' } }}
        />
      </Box>
      
      {attributes.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No attributes have been extracted yet.
        </Typography>
      ) : (
        <>
          {/* Unified Attributes Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="35%"><strong>Attribute</strong></TableCell>
                  <TableCell width="65%"><strong>Value</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAttributes.map((attr, index) => {
                  const isSuffixAttribute = attr.name && (
                    attr.name.toLowerCase().includes('suffix') || 
                    attr.name.toLowerCase().includes('option')
                  );
                  
                  // Format the display name for suffix attributes
                  let displayName = attr.name;
                  if (isSuffixAttribute) {
                    displayName = "Suffix Option";
                  }
                  
                  return (
                    <TableRow 
                      key={index} 
                      hover
                      sx={{
                        backgroundColor: isSuffixAttribute ? 'rgba(25, 118, 210, 0.04)' : 'inherit'
                      }}
                    >
                      <TableCell>
                        {displayName}
                        {attr.updated && (
                          <Chip 
                            label="Updated" 
                            color="primary" 
                            size="small" 
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} 
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {attr.value}
                          </Typography>
                          {attr.suffix && (
                            <Chip 
                              label={attr.suffix} 
                              variant="outlined" 
                              color="primary" 
                              size="small"
                              sx={{ 
                                fontWeight: 'bold',
                                minWidth: 'auto',
                                ml: 2 // Add margin to separate from text
                              }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Paper>
  );
};

export default AllAttributesView; 