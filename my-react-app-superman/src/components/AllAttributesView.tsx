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

const AllAttributesView: React.FC<AllAttributesViewProps> = ({ attributes }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Filter attributes based on search query
  const filteredAttributes = searchQuery 
    ? attributes.filter(attr => 
        attr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        attr.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : attributes;
  
  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };
  
  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Helper function to extract suffix code from attribute name or value
  const extractSuffixCode = (attr: ProcessedAttribute) => {
    // Check if this is a suffix-related attribute
    const isSuffixAttribute = attr.name.toLowerCase().includes('suffix') || 
                              attr.name.toLowerCase().includes('option');
    
    if (!isSuffixAttribute) return null;
    
    // Extract from attribute name
    const suffixMatch = attr.name.match(/(?:Suffix|Option)(?:s)?(?:\s*)?(?::|-)?\s*([-]?[A-Z0-9-]+)/i);
    
    // Clean up the suffix code - remove any JSON artifacts
    let suffixCode = suffixMatch ? suffixMatch[1] : '';
    
    // Handle cases where the code might be wrapped in quotes, brackets, or braces
    suffixCode = suffixCode
      .replace(/[\[\]"'{}\s]/g, '') // Remove brackets, quotes, braces, spaces
      .replace(/^Suffix$/i, '')     // Remove word "Suffix" if it's all that's left
      .replace(/^Option$/i, '');    // Remove word "Option" if it's all that's left
    
    // Ensure dash prefix for consistency
    if (suffixCode && !suffixCode.startsWith('-')) {
      suffixCode = '-' + suffixCode;
    }
    
    // If we still don't have a good code, extract from the attribute value 
    if (!suffixCode || suffixCode === '-') {
      // Try to extract a suffix code from the start of the value
      const valueCodeMatch = attr.value.match(/^(?:["'\[\{])?(-[A-Z0-9-]+)/i);
      if (valueCodeMatch) {
        suffixCode = valueCodeMatch[1];
      }
    }
    
    return suffixCode || null;
  };
  
  // Helper function to clean attribute value
  const cleanAttributeValue = (value: string, isSuffix: boolean) => {
    let cleanValue = value;
    
    // For suffix values, remove the code part if present
    if (isSuffix) {
      cleanValue = cleanValue
        .replace(/^(?:["'\[\{])?-[A-Z0-9-]+\s*/, '')
        .replace(/["\]\}]$/, '');
    }
    
    // Clean up the value - remove any quotes or brackets
    cleanValue = cleanValue
      .replace(/^["'\[\{]+/, '') // Remove leading quotes/brackets
      .replace(/["'\]\}]+$/, '') // Remove trailing quotes/brackets
      .trim();
    
    return cleanValue;
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
                  <TableCell width="30%"><strong>Attribute</strong></TableCell>
                  <TableCell width="50%"><strong>Value</strong></TableCell>
                  <TableCell width="20%"><strong>Suffix Code</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAttributes.map((attr, index) => {
                  const isSuffixAttribute = attr.name.toLowerCase().includes('suffix') || 
                                            attr.name.toLowerCase().includes('option');
                  const suffixCode = extractSuffixCode(attr);
                  const cleanValue = cleanAttributeValue(attr.value, isSuffixAttribute);
                  
                  // Display attribute name without the suffix/option prefix for suffix attributes
                  let displayName = attr.name;
                  if (isSuffixAttribute) {
                    displayName = displayName
                      .replace(/Options Suffix: /i, '')
                      .replace(/Option Suffix: /i, '')
                      .replace(/Suffix: /i, '');
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
                        {isSuffixAttribute ? 'Suffix Option' : displayName}
                        {attr.updated && (
                          <Chip 
                            label="Updated" 
                            color="primary" 
                            size="small" 
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} 
                          />
                        )}
                      </TableCell>
                      <TableCell>{cleanValue}</TableCell>
                      <TableCell>
                        {suffixCode ? (
                          <Chip 
                            label={suffixCode} 
                            variant="outlined" 
                            color="primary" 
                            size="small"
                            title={attr.name}
                            sx={{ 
                              fontWeight: 'bold',
                              ...(suffixCode.split('-').length > 2 && {
                                bgcolor: 'rgba(25, 118, 210, 0.1)'
                              })
                            }}
                          />
                        ) : null}
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