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
  Divider
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
  
  // Group suffixes for separate display
  const suffixAttributes = filteredAttributes.filter(attr => 
    attr.name.toLowerCase().includes('suffix') || 
    attr.name.toLowerCase().includes('option')
  );
  
  const nonSuffixAttributes = filteredAttributes.filter(attr => 
    !attr.name.toLowerCase().includes('suffix') && 
    !attr.name.toLowerCase().includes('option')
  );
  
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
          {/* Main Attributes Table */}
          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
            Product Information
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="40%"><strong>Attribute</strong></TableCell>
                  <TableCell width="60%"><strong>Value</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {nonSuffixAttributes.map((attr, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      {attr.name}
                      {attr.updated && (
                        <Chip 
                          label="Updated" 
                          color="primary" 
                          size="small" 
                          sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} 
                        />
                      )}
                    </TableCell>
                    <TableCell>{attr.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Suffixes Table */}
          {suffixAttributes.length > 0 && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 4, mb: 1, fontWeight: 'bold' }}>
                Options and Suffixes ({suffixAttributes.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="30%"><strong>Suffix Code</strong></TableCell>
                      <TableCell width="70%"><strong>Description</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {suffixAttributes.map((attr, index) => {
                      // Extract the suffix code from the attribute name
                      const suffixMatch = attr.name.match(/:\s*([-]?[A-Z0-9]+)/i);
                      const suffixCode = suffixMatch ? suffixMatch[1] : attr.name;
                      
                      return (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Chip 
                              label={suffixCode} 
                              variant="outlined" 
                              color="primary" 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{attr.value}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}
    </Paper>
  );
};

export default AllAttributesView; 