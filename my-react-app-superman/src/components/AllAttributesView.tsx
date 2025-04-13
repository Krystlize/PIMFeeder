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
  
  let suffix: string | undefined = undefined;
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
  const descriptionMap: { [key: string]: ProcessedAttribute } = {};
  
  // First pass: collect all suffixes and descriptions
  attrs.forEach(attr => {
    const { suffix, cleanValue, isSuffixAttribute } = processSuffixData(attr);
    const normalizedName = attr.name.toLowerCase().replace(/\s+/g, '');
    
    // Store in maps for future combining
    if (isSuffixAttribute) {
      if (normalizedName.includes('description')) {
        descriptionMap[normalizedName] = {
          ...attr,
          value: cleanValue,
          suffix: suffix
        };
      } else if (normalizedName.includes('suffix') || normalizedName.includes('option')) {
        // Create a base ID to help match related attributes
        const baseId = normalizedName
          .replace(/suffix/ig, '')
          .replace(/option/ig, '')
          .replace(/[-_]/g, '');
        
        // Store the suffix for later matching with description
        suffixMap[baseId] = suffix || '';
        
        // Find if there's a matching description
        let matchingDescKey = Object.keys(descriptionMap).find(key => 
          key.includes(baseId) || baseId.includes(key.replace(/description/ig, ''))
        );
        
        if (matchingDescKey) {
          // We found a matching description - combine them
          const descAttr = descriptionMap[matchingDescKey];
          processedAttrs.push({
            ...descAttr,
            name: descAttr.name.replace(/description/ig, '').trim(),
            value: descAttr.value,
            suffix: suffix || suffixMap[baseId]
          });
          
          // Mark as processed
          delete descriptionMap[matchingDescKey];
        } else {
          // No matching description found yet - add with just the suffix info
          processedAttrs.push({
            ...attr,
            value: cleanValue,
            suffix: suffix
          });
        }
      }
    } else {
      // Regular attribute - add normally
      processedAttrs.push({
        ...attr,
        value: cleanValue,
        suffix: suffix
      });
    }
  });
  
  // Add any remaining description attributes that weren't matched
  Object.values(descriptionMap).forEach(attr => {
    processedAttrs.push(attr);
  });
  
  return processedAttrs;
};

const formatValue = (value: any): string => {
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return JSON.stringify(value).replace(/[{}[\]"]/g, '');
  }
  return String(value);
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
                  <TableCell width="30%"><strong>Attribute Name</strong></TableCell>
                  <TableCell width="50%"><strong>Description</strong></TableCell>
                  <TableCell width="20%"><strong>Suffix Code</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAttributes.map((attr, index) => (
                  <TableRow 
                    key={index} 
                    hover
                    sx={{
                      backgroundColor: attr.updated ? 'rgba(76, 175, 80, 0.08)' : 'inherit',
                    }}
                  >
                    <TableCell>
                      {attr.name}
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        component="span"
                        sx={{ 
                          wordBreak: 'break-word',
                          fontWeight: attr.updated ? 'bold' : 'normal'
                        }}
                      >
                        {formatValue(attr.value)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {attr.suffix && (
                        <Chip 
                          label={attr.suffix} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                          sx={{ 
                            fontFamily: 'monospace',
                            fontWeight: 'bold' 
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Paper>
  );
};

export default AllAttributesView; 