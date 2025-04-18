import React, { useState, useEffect } from 'react';
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
  Badge,
  Tabs,
  Tab
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import UpdateIcon from '@mui/icons-material/Update';
import TableChartIcon from '@mui/icons-material/TableChart';
import ListIcon from '@mui/icons-material/List';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { ProcessedAttribute, AttributeGroup } from '../types';
import AllAttributesView from './AllAttributesView';

interface AttributesListProps {
  attributes: ProcessedAttribute[];
  rawText?: string;
  attributeTemplate?: AttributeGroup[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`attributes-tabpanel-${index}`}
      aria-labelledby={`attributes-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 1 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const AttributesList: React.FC<AttributesListProps> = ({ attributes, rawText, attributeTemplate = [] }) => {
  const [showRawText, setShowRawText] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [structuredAttributes, setStructuredAttributes] = useState<Record<string, ProcessedAttribute[]>>({});
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Process attributes based on whether we have a template or need to auto-group
  useEffect(() => {
    if (attributeTemplate && attributeTemplate.length > 0) {
      // Use the template to structure attributes
      const templateGroups: Record<string, ProcessedAttribute[]> = {};
      
      // Initialize groups from template
      attributeTemplate.forEach(group => {
        templateGroups[group.groupName] = [];
      });
      
      // Assign attributes to groups
      attributes.forEach(attr => {
        let assigned = false;
        
        // Try to match attribute to a template group
        for (const group of attributeTemplate) {
          for (const templateAttr of group.attributes) {
            if (attr.name.toLowerCase().includes(templateAttr.toLowerCase()) ||
                templateAttr.toLowerCase().includes(attr.name.toLowerCase())) {
              if (!templateGroups[group.groupName]) {
                templateGroups[group.groupName] = [];
              }
              templateGroups[group.groupName].push(attr);
              assigned = true;
              break;
            }
          }
          if (assigned) break;
        }
        
        // If not matched to any group, add to General
        if (!assigned) {
          if (!templateGroups['General']) {
            templateGroups['General'] = [];
          }
          templateGroups['General'].push(attr);
        }
      });
      
      setStructuredAttributes(templateGroups);
    } else {
      // Group attributes by category (use first word of attribute name as category)
      const groupedAttributes = attributes.reduce((groups: Record<string, ProcessedAttribute[]>, attr) => {
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
      
      setStructuredAttributes(groupedAttributes);
    }
  }, [attributes, attributeTemplate]);
  
  // Sort categories to ensure consistent order
  const sortedCategories = Object.keys(structuredAttributes).sort();
  
  // Move certain categories to the beginning and ensure mandatory attributes from template come first
  const priorityCategories = ['Mandatory Attributes', 'Product Information', 'General', 'Dimensions', 'Pipe Size', 'Materials'];
  
  // Add any template groups to the priority list
  if (attributeTemplate) {
    attributeTemplate.forEach(group => {
      if (group.isEssential && !priorityCategories.includes(group.groupName)) {
        priorityCategories.unshift(group.groupName);
      }
    });
  }
  
  sortedCategories.sort((a, b) => {
    const indexA = priorityCategories.indexOf(a);
    const indexB = priorityCategories.indexOf(b);
    
    if (indexA >= 0 && indexB >= 0) return indexA - indexB;
    if (indexA >= 0) return -1;
    if (indexB >= 0) return 1;
    return a.localeCompare(b);
  });

  // Determine if we should use tabs (only if we have a template)
  const useTabs = attributeTemplate && attributeTemplate.length > 0;

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Extracted Attributes
        </Typography>
      </Box>
      
      {attributes.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No attributes have been extracted yet. Process a PDF to see results.
        </Typography>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TableChartIcon sx={{ mr: 1 }} />
                    Table View
                  </Box>
                } 
              />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ListIcon sx={{ mr: 1 }} />
                    Grouped View
                  </Box>
                } 
              />
              {attributeTemplate.map((group, idx) => (
                <Tab 
                  key={idx} 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {group.groupName}
                      {structuredAttributes[group.groupName]?.length > 0 && (
                        <Chip 
                          label={structuredAttributes[group.groupName]?.length} 
                          size="small" 
                          color={group.isEssential ? "primary" : "default"}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  } 
                />
              ))}
            </Tabs>
          </Box>
          
          {/* Table View Tab */}
          <TabPanel value={tabValue} index={0}>
            <AllAttributesView attributes={attributes} />
          </TabPanel>
          
          {/* Grouped View Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Attributes are structured according to engineering requirements for this product type.
                Click the tabs above to view attributes by category.
              </Typography>
            </Box>
            <Grid container spacing={2}>
              {sortedCategories.map(category => (
                structuredAttributes[category]?.length > 0 && (
                  <Grid item xs={12} md={6} key={category}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" component="div" gutterBottom>
                          {category}
                          <Chip 
                            label={structuredAttributes[category].length} 
                            size="small" 
                            sx={{ ml: 1 }} 
                          />
                        </Typography>
                        <List dense>
                          {structuredAttributes[category].map((attr, index) => (
                            <React.Fragment key={index}>
                              {index > 0 && <Divider component="li" />}
                              <ListItem alignItems="flex-start">
                                <ListItemText
                                  primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                      {attr.name}
                                      {attr.updated && (
                                        <Chip 
                                          icon={<UpdateIcon />} 
                                          label="Updated" 
                                          color="primary" 
                                          size="small" 
                                          sx={{ ml: 1 }} 
                                        />
                                      )}
                                    </Box>
                                  }
                                  secondary={attr.value}
                                />
                              </ListItem>
                            </React.Fragment>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              ))}
            </Grid>
          </TabPanel>
          
          {/* Template Tabs */}
          {attributeTemplate.map((group, idx) => (
            <TabPanel key={idx} value={tabValue} index={idx + 2}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" color="primary" gutterBottom>
                  {group.isEssential ? "⚠️ Required Attributes" : "Optional Attributes"}
                </Typography>
              </Box>
              
              {structuredAttributes[group.groupName]?.length > 0 ? (
                <List dense>
                  {structuredAttributes[group.groupName].map((attr, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <Divider component="li" />}
                      <ListItem alignItems="flex-start">
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {attr.name}
                              {attr.updated && (
                                <Chip 
                                  icon={<UpdateIcon />} 
                                  label="Updated" 
                                  color="primary" 
                                  size="small" 
                                  sx={{ ml: 1 }} 
                                />
                              )}
                            </Box>
                          }
                          secondary={attr.value}
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No attributes in this category. You may need to extract additional information.
                </Typography>
              )}
            </TabPanel>
          ))}
          
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