import React, { useState } from 'react';
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

const AllAttributesView: React.FC<AllAttributesViewProps> = ({ attributes }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Filter attributes based on search query
  const filteredAttributes = searchQuery 
    ? attributes.filter(attr => 
        attr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        attr.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : attributes;
  
  // Process attributes to normalize display
  const processedAttributes = filteredAttributes.map(attr => {
    const { suffix, cleanValue, isSuffixAttribute } = processSuffixData(attr);
    
    // Format the display name
    let displayName = attr.name;
    if (isSuffixAttribute) {
      displayName = displayName
        .replace(/Options Suffix: /i, '')
        .replace(/Option Suffix: /i, '')
        .replace(/Suffix Option/i, '')
        .replace(/Suffix: /i, '');
    }
    
    return {
      ...attr,
      displayName: isSuffixAttribute ? displayName : displayName,
      displayValue: cleanValue,
      suffixCode: suffix,
      isSuffixAttribute
    };
  });
  
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
                {processedAttributes.map((attr, index) => (
                  <TableRow 
                    key={index} 
                    hover
                    sx={{
                      backgroundColor: attr.updated ? 'rgba(76, 175, 80, 0.08)' : 'inherit',
                    }}
                  >
                    <TableCell>
                      {attr.displayName}
                      {attr.updated && (
                        <Chip 
                          label="Updated" 
                          color="primary" 
                          size="small" 
                          sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} 
                        />
                      )}
                    </TableCell>
                    <TableCell>{attr.displayValue}</TableCell>
                    <TableCell>
                      {attr.suffixCode ? (
                        <Chip 
                          label={attr.suffixCode} 
                          variant="outlined" 
                          color="primary" 
                          size="small"
                          title={attr.name}
                          sx={{ 
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            ...(attr.suffixCode.split('-').length > 2 && {
                              bgcolor: 'rgba(25, 118, 210, 0.1)'
                            })
                          }}
                        />
                      ) : null}
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