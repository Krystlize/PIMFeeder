import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  useTheme, 
  useMediaQuery 
} from '@mui/material';
import constructionIcon from '../assets/construction-icon.svg';

const Header: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <AppBar position="static" sx={{ mb: 4 }}>
      <Toolbar>
        <Box display="flex" alignItems="center">
          <img 
            src={constructionIcon} 
            alt="Construction Icon" 
            style={{ 
              width: 36, 
              height: 36, 
              marginRight: 16
            }} 
          />
          <Typography 
            variant={isMobile ? "h6" : "h5"} 
            component="div" 
            sx={{ 
              fontWeight: 'bold',
              letterSpacing: 1
            }}
          >
            PIMFeeder
          </Typography>
        </Box>
        {!isMobile && (
          <Typography 
            variant="subtitle1" 
            sx={{ 
              ml: 3,
              opacity: 0.8
            }}
          >
            Upload PDF to extract attributes to sync to PIM Tool
          </Typography>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header; 