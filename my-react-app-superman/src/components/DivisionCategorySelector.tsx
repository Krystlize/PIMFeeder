import React, { useState, useEffect } from 'react';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormHelperText,
  Box,
  SelectChangeEvent
} from '@mui/material';
import { Division, Category } from '../types';
import { divisions, categories } from '../services/mockData';

interface DivisionCategorySelectorProps {
  onDivisionChange: (division: string) => void;
  onCategoryChange: (category: string) => void;
  selectedDivision: string;
  selectedCategory: string;
  disabled: boolean;
}

const DivisionCategorySelector: React.FC<DivisionCategorySelectorProps> = ({
  onDivisionChange,
  onCategoryChange,
  selectedDivision,
  selectedCategory,
  disabled
}) => {
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [divisionError, setDivisionError] = useState<string>('');
  const [categoryError, setCategoryError] = useState<string>('');

  useEffect(() => {
    if (selectedDivision) {
      const filtered = categories.filter(cat => cat.divisionId === selectedDivision);
      setFilteredCategories(filtered);
      
      // If the current selected category doesn't belong to the new division, reset it
      if (selectedCategory && !filtered.some(cat => cat.id === selectedCategory)) {
        onCategoryChange('');
      }
    } else {
      setFilteredCategories([]);
    }
  }, [selectedDivision, selectedCategory, onCategoryChange]);

  const handleDivisionChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    onDivisionChange(value);
    setDivisionError('');
  };

  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    onCategoryChange(value);
    setCategoryError('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
      <FormControl 
        fullWidth 
        error={!!divisionError}
        disabled={disabled}
      >
        <InputLabel id="division-select-label">Division *</InputLabel>
        <Select
          labelId="division-select-label"
          id="division-select"
          value={selectedDivision}
          label="Division *"
          onChange={handleDivisionChange}
          required
        >
          <MenuItem value="">
            <em>Select a division</em>
          </MenuItem>
          {divisions.map((division) => (
            <MenuItem key={division.id} value={division.id}>
              {division.name}
            </MenuItem>
          ))}
        </Select>
        {divisionError && <FormHelperText>{divisionError}</FormHelperText>}
      </FormControl>
      
      <FormControl 
        fullWidth 
        error={!!categoryError}
        disabled={!selectedDivision || disabled}
      >
        <InputLabel id="category-select-label">Category *</InputLabel>
        <Select
          labelId="category-select-label"
          id="category-select"
          value={selectedCategory}
          label="Category *"
          onChange={handleCategoryChange}
          required
        >
          <MenuItem value="">
            <em>Select a category</em>
          </MenuItem>
          {filteredCategories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {category.name}
            </MenuItem>
          ))}
        </Select>
        {categoryError && <FormHelperText>{categoryError}</FormHelperText>}
      </FormControl>
    </Box>
  );
};

export default DivisionCategorySelector; 